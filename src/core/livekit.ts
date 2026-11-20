import "server-only";

/**
 * LiveKit (live video) helpers. Server-only.
 *
 * Flow (works for viewers in Expo Go, no native module):
 *   astrologer's browser ──WebRTC──▶ LiveKit room "live-<id>"
 *   LiveKit egress ──HLS segments──▶ storage  live/<id>/r<run>/…
 *   app (expo-video) plays  live/<id>/r<run>/live.m3u8  (5-10 s behind)
 *
 * Cost: the egress is billed per minute (video ~4x audio), so the live service
 * runs it only while someone watches. Storage is the main S3 bucket, or an
 * S3-compatible bucket with free downloads (Cloudflare R2) via LIVE_S3_*.
 *
 * Everything is optional: without LIVEKIT_* env the live simply has no video.
 */
import {
  AccessToken, AudioCodec, EgressClient, EgressStatus, EncodingOptions, RoomConfiguration, S3Upload,
  SegmentedFileOutput, SegmentedFileProtocol, VideoCodec, WebhookReceiver, type WebhookEvent,
} from "livekit-server-sdk";
import { env } from "@/core/config/env";
import { getBucket, getRegion, isS3Configured, publicUrl } from "@/core/storage/s3";

/** Own live storage (R2 or another S3-compatible bucket) is complete. */
function ownStorage(): boolean {
  return Boolean(env.LIVE_S3_BUCKET && env.LIVE_S3_ENDPOINT && env.LIVE_PUBLIC_URL && env.LIVE_S3_ACCESS_KEY_ID && env.LIVE_S3_SECRET_ACCESS_KEY);
}

export function liveVideoConfigured(): boolean {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && (ownStorage() || isS3Configured()));
}

export const liveRoomName = (liveId: string) => `live-${liveId}`;
/** Live id from a room name, or null when the room is not a live. */
export const liveIdOfRoom = (room: string | undefined | null) => (room && /^live-[a-f0-9]{24}$/i.test(room) ? room.slice(5) : null);
export const publisherIdentity = (astrologerId: string) => `astro-${astrologerId}`;

const folder = (liveId: string, run: number) => `live/${liveId}/r${run}`;

/** Sliding-window playlist of one recorder run. */
export function liveHlsUrl(liveId: string, run: number): string {
  const key = `${folder(liveId, run)}/live.m3u8`;
  return ownStorage() ? `${env.LIVE_PUBLIC_URL!.replace(/\/+$/, "")}/${key}` : publicUrl(key);
}

/**
 * Token for the astrologer's browser: may publish camera + mic in this live's
 * room only. The room closes 20 s after they leave, which also ends the recorder.
 */
export async function publisherToken(liveId: string, astrologerId: string, name: string): Promise<{ url: string; token: string }> {
  const at = new AccessToken(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!, { identity: publisherIdentity(astrologerId), name, ttl: "4h" });
  at.addGrant({ roomJoin: true, room: liveRoomName(liveId), canPublish: true, canSubscribe: false, canPublishData: false });
  at.roomConfig = new RoomConfiguration({ departureTimeout: 20, emptyTimeout: 60, maxParticipants: 4 });
  return { url: env.LIVEKIT_URL!, token: await at.toJwt() };
}

function httpHost(): string {
  return env.LIVEKIT_URL!.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}
const egressClient = () => new EgressClient(httpHost(), env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);

function upload(): S3Upload {
  if (ownStorage()) {
    return new S3Upload({
      accessKey: env.LIVE_S3_ACCESS_KEY_ID!,
      secret: env.LIVE_S3_SECRET_ACCESS_KEY!,
      region: env.LIVE_S3_REGION ?? "auto",
      endpoint: env.LIVE_S3_ENDPOINT!,
      bucket: env.LIVE_S3_BUCKET!,
      forcePathStyle: true,
    });
  }
  return new S3Upload({
    accessKey: env.LIVE_S3_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID!,
    secret: env.LIVE_S3_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY!,
    region: getRegion(),
    bucket: getBucket(),
  });
}

export interface RecorderOptions {
  kind: "video" | "audio";
  orientation: "portrait" | "landscape";
  quality: "540p" | "720p";
}

/** Canvas matches the camera (portrait phone or landscape webcam), so the app fills the screen without bars. */
function encoding(o: RecorderOptions): EncodingOptions {
  if (o.kind === "audio") return new EncodingOptions({ audioCodec: AudioCodec.AAC, audioBitrate: 64, audioFrequency: 48000 });
  const hi = o.quality === "720p";
  const [long, short] = hi ? [1280, 720] : [960, 540];
  const portrait = o.orientation === "portrait";
  return new EncodingOptions({
    width: portrait ? short : long,
    height: portrait ? long : short,
    framerate: hi ? 30 : 24,
    videoCodec: VideoCodec.H264_MAIN,
    videoBitrate: hi ? 2500 : 1200,
    keyFrameInterval: 2,
    audioCodec: AudioCodec.AAC,
    audioBitrate: 64,
    audioFrequency: 48000,
  });
}

/** Start writing the room to HLS (one folder per run). Returns the egress id. */
export async function startHlsEgress(liveId: string, run: number, o: RecorderOptions): Promise<string> {
  const dir = folder(liveId, run);
  const output = new SegmentedFileOutput({
    protocol: SegmentedFileProtocol.HLS_PROTOCOL,
    filenamePrefix: `${dir}/seg`,
    playlistName: `${dir}/index.m3u8`,
    livePlaylistName: `${dir}/live.m3u8`,
    segmentDuration: 2,
    output: { case: "s3", value: upload() },
  });
  const info = await egressClient().startRoomCompositeEgress(liveRoomName(liveId), output, {
    layout: "speaker",
    audioOnly: o.kind === "audio",
    encodingOptions: encoding(o),
  });
  return info.egressId;
}

export async function stopEgress(egressId: string): Promise<void> {
  await egressClient().stopEgress(egressId);
}

/** Recorders running (or starting) for lives right now. */
export async function activeLiveEgress(): Promise<{ egressId: string; liveId: string }[]> {
  const list = await egressClient().listEgress({ active: true });
  return list
    .filter((e) => e.status === EgressStatus.EGRESS_STARTING || e.status === EgressStatus.EGRESS_ACTIVE)
    .map((e) => ({ egressId: e.egressId, liveId: liveIdOfRoom(e.roomName) }))
    .filter((e): e is { egressId: string; liveId: string } => Boolean(e.liveId));
}

/** Verify and parse a LiveKit webhook (signed with our API key/secret). */
export async function receiveWebhook(body: string, auth: string | null): Promise<WebhookEvent> {
  const r = new WebhookReceiver(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);
  return r.receive(body, auth ?? undefined);
}

export { EgressStatus };
