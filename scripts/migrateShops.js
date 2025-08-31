// scripts/migrateShops.js
import mongoose from "../mongo.js"; // ✅ ต้องชี้ไปที่ไฟล์ mongo.js ที่อยู่ใน root
import { connectDB } from "../mongo.js"; // ⬅️ เพิ่มบรรทัดนี้ด้วย

import fs from "fs";
import path from "path";
import Shop from "../models/Shop.js";
import dotenv from "dotenv";

const envPath = path.join(process.cwd(), "info.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// ✅ Connect MongoDB ก่อน migrate
await connectDB();

async function migrateShops() {
  try {
    const filePath = path.join(process.cwd(), "line_shops.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const json = JSON.parse(raw);
    const shops = json.shops || [];

    await Shop.deleteMany({}); // ลบข้อมูลเก่าทิ้ง
    await Shop.insertMany(shops); // เพิ่มข้อมูลใหม่ทั้งหมด

    console.log(`✅ ย้ายข้อมูลร้าน ${shops.length} รายการ เรียบร้อย`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrateShops();
