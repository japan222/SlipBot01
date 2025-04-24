// scripts/migrateQrdata.js
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import QrEntry from "../models/QrEntry.js";
import dotenv from "dotenv";
dotenv.config({ path: `${process.cwd()}/info.env` }); // โหลด .env

const qrDir = path.join(process.cwd(), "qrdata");

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);

  const files = fs.readdirSync(qrDir).filter(f => f.endsWith(".json"));

  for (const file of files) {
    const prefix = path.basename(file, ".json");
    const fullPath = path.join(qrDir, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const data = JSON.parse(content);

    for (const entry of data) {
      const users = Array.isArray(entry.users)
        ? entry.users.map(([userId, info]) => ({
            userId,
            lastSentTime: info.lastSentTime,
            messageCount: info.messageCount
          }))
        : [];

      await QrEntry.updateOne(
        { prefix, qrData: entry.qrData },
        {
          $set: {
            firstDetected: entry.firstDetected,
            amount: entry.amount || 0,
            users
          }
        },
        { upsert: true }
      );
    }

    console.log(`✅ migrated: ${prefix} (${data.length} entries)`);
  }

  await mongoose.disconnect();
  console.log("✅ migration complete");
}

migrate().catch(err => {
  console.error("❌ migration error:", err);
});