// scripts/migrateSlipStats.js
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import SlipStats from "../models/SlipStats.js";
import { fileURLToPath } from "url";

dotenv.config({ path: path.join(process.cwd(), "info.env") });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATS_PATH = path.join(__dirname, "../utils/dataSlip/slipStats.json");

async function migrateSlipStats() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ เชื่อมต่อ MongoDB สำเร็จ");

  if (!fs.existsSync(STATS_PATH)) {
    console.error("❌ ไม่พบไฟล์ slipStats.json");
    return;
  }

  const raw = fs.readFileSync(STATS_PATH, "utf-8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("❌ JSON ไม่ถูกต้อง:", err.message);
    return;
  }

  for (const prefix in parsed) {
    const stats = parsed[prefix];
    for (const category in stats) {
      const amount = stats[category];
      await SlipStats.findOneAndUpdate(
        { prefix, category },
        { $set: { amount } },
        { upsert: true }
      );
    }
  }

  console.log("✅ ส่ง slipStats เข้า MongoDB แล้ว");
  await mongoose.disconnect();
}

migrateSlipStats().catch(err => {
  console.error("❌ Migration failed:", err);
});
