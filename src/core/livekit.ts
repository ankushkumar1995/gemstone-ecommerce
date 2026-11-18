import "server-only";

/**
 * LiveKit (live video) helpers. Server-only.
 *
 * Flow (works for viewers in Expo Go, no native module):
 *   astrologer's browser ──WebRTC──▶ LiveKit room "live-<id>"
 *   LiveKit egress ──HLS segments──▶ our S3 bucket  live/<id>/…
 *   app (expo-video) plays  live/<id>/live.m3u8  (5-10 s behind)
 *
 * Everything is optional: without LIVEKIT_* env the live simply has no video.
 */
import { AccessToken, EgressClient, EncodingOptionsPreset, S3Upload, SegmentedFileOutput, SegmentedFileProtocol } from "livekit-server-sdk";
import { env } from "@/core/config/env";
import { getBucket, getRegion, isS3Configured, publicUrl } from "@/core/storage/s3";

export function liveVideoConfigured(): boolean {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && isS3Configured());
}

export const liveRoomName = (liveId: string) => `live-${liveId}`;
const prefix = (liveId: string) => `live/${liveId}`;
/** Sliding-window playlist for live viewers. */
export const liveHlsUrl = (liveId: string) => publicUrl(`${prefix(liveId)}/live.m3u8`);

/** Token for the astrologer's browser: may publish camera + mic in this live's room only. */
export async function publisherToken(liveId: string, astrologerId: string, name: string): Promise<{ url: string; token: string }> {
  const at = new AccessToken(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!, { identity: `astro-${astrologerId}`, name, ttl: "4h" });
  at.addGrant({ roomJoin: true, room: liveRoomName(liveId), canPublish: true, canSubscribe: false, canPublishData: false });
  return { url: env.LIVEKIT_URL!, token: await at.toJwt() };
}

function httpHost(): string {
  return env.LIVEKIT_URL!.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

/** Start writing the room to HLS on S3. Returns the egress id. */
export async function startHlsEgress(liveId: string): Promise<string> {
  const client = new EgressClient(httpHost(), env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);
  const output = new SegmentedFileOutput({
    protocol: SegmentedFileProtocol.HLS_PROTOCOL,
    filenamePrefix: `${prefix(liveId)}/seg`,
    playlistName: `${prefix(liveId)}/index.m3u8`,
    livePlaylistName: `${prefix(liveId)}/live.m3u8`,
    segmentDuration: 2,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey: env.LIVE_S3_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID!,
        secret: env.LIVE_S3_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY!,
        region: getRegion(),
        bucket: getBucket(),
      }),
    },
  });
  // Portrait-friendly single speaker layout, 720p.
  const info = await client.startRoomCompositeEgress(liveRoomName(liveId), output, { layout: "speaker", encodingOptions: EncodingOptionsPreset.H264_720P_30 });
  return info.egressId;
}

export async function stopEgress(egressId: string): Promise<void> {
  const client = new EgressClient(httpHost(), env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);
  await client.stopEgress(egressId);
}
