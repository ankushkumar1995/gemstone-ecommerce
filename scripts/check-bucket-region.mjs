// Diagnostic: find the real region of the S3 bucket and test a list call.
// Run: node scripts/check-bucket-region.mjs
import { readFileSync } from "node:fs";
import { S3Client, GetBucketLocationCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

// tiny .env loader
const envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2];
}

// Mirror the resolution order in src/core/config/env.ts (S3_* preferred).
const accessKeyId = env.S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
const secretAccessKey = env.S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || env.AWS_ACCESS_KEY_SECRET;
const region = env.S3_REGION || env.REGION || env.AWS_REGION;
const bucket = env.S3_BUCKET || env.BUCKET_NAME || env.AWS_S3_BUCKET;

console.log("Resolved region :", region);
console.log("Resolved bucket :", bucket);

const creds = { accessKeyId, secretAccessKey };

const locClient = new S3Client({ region: "us-east-1", credentials: creds });
try {
  const loc = await locClient.send(new GetBucketLocationCommand({ Bucket: bucket }));
  const realRegion = loc.LocationConstraint || "us-east-1";
  console.log("ACTUAL bucket region:", realRegion);
  console.log(
    region === realRegion
      ? "OK Configured region MATCHES bucket region."
      : `MISMATCH: region "${region}" != bucket "${realRegion}". Set S3_REGION=${realRegion}`,
  );

  const testClient = new S3Client({ region: realRegion, credentials: creds });
  const res = await testClient.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
  console.log("List test OK. Objects found:", res.KeyCount ?? 0);
} catch (e) {
  console.error("ERROR:", e.name, "-", e.message);
}
