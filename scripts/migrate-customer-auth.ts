/**
 * One-time migration for phone-OTP sign-in + multi-device sessions.
 *
 *   npm run migrate:customer-auth
 *
 *  1. customers.email_1 → unique ONLY when an email exists (phone-only accounts have none)
 *  2. customers.phone_verified_unique → one account per verified phone
 *  3. creates the customer_sessions / customer_otps indexes
 *
 * Safe to re-run. Does not change or delete any customer data.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  const { connectMongoose } = await import("../src/core/db/mongoose");
  await connectMongoose();
  const mongoose = (await import("mongoose")).default;
  const col = mongoose.connection.collection("customers");

  const idx = await col.indexes();
  const email = idx.find((i) => i.name === "email_1");
  const pfe = JSON.stringify(email?.partialFilterExpression ?? {});
  if (email && !pfe.includes("$type")) {
    console.log("Rebuilding customers.email_1 (unique only when an email exists)…");
    await col.dropIndex("email_1");
  }
  await col.createIndex({ email: 1 }, { name: "email_1", unique: true, partialFilterExpression: { isDeleted: false, email: { $type: "string" } } });
  await col.createIndex({ phone: 1 }, { name: "phone_verified_unique", unique: true, partialFilterExpression: { isDeleted: false, phoneVerified: true, phone: { $type: "string" } } });
  console.log("customers indexes ok");

  const { SessionModel } = await import("../src/modules/customer-auth/session.model");
  const { OtpModel } = await import("../src/modules/customer-auth/otp.model");
  await SessionModel.init();
  await OtpModel.init();
  console.log("customer_sessions + customer_otps indexes ok");

  const total = await col.countDocuments({ isDeleted: { $ne: true } });
  console.log(`Done. ${total} customers untouched.`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
