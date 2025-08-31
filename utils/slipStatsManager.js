// utils/slipStatsManager.js (ใช้ MongoDB แทน File)
import mongoose from "mongoose";
import axios from "axios";
import { broadcastLog } from "../index.js";

const slipStatSchema = new mongoose.Schema({
  prefix: String,
  category: String,
  amount: Number
});

const slipResultSchema = new mongoose.Schema({
  prefix: String,
  shop: String,
  lineName: String,
  image: String,
  time: String,
  status: String,
  response: String,
  amount: Number,
  ref: String,
  createdAt: { type: Date, default: Date.now }
});

// ✅ แก้ตรงนี้ให้เช็กก่อนว่าเคยสร้างไว้หรือยัง
const SlipStat = mongoose.models.SlipStat || mongoose.model("SlipStat", slipStatSchema);
const SlipResult = mongoose.models.SlipResult || mongoose.model("SlipResult", slipResultSchema);

export async function updateSlipStats(prefix, category, amount) {
  if (!prefix || amount == null) return;

  try {
    const result = await SlipStat.findOneAndUpdate(
      { prefix, category },
      { $inc: { amount } },
      { upsert: true, new: true }
    );
    broadcastLog(`📊 อัปเดตสถิติ ${prefix} - ${category}: ${amount}`);
  } catch (err) {
    console.error("❌ อัปเดต SlipStats ไม่สำเร็จ:", err.message);
  }
}

export async function getSlipStatsAmount(prefix) {
  if (!prefix) return {};
  const stats = await SlipStat.find({ prefix });
  const grouped = {};
  stats.forEach(({ category, amount }) => {
    grouped[category] = amount;
  });
  return grouped;
}

export async function loadSlipResults() {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return await SlipResult.find({ createdAt: { $gte: yesterday } }).sort({ createdAt: -1 }).limit(100);
  } catch (err) {
    console.error("❌ โหลด slipResults ล้มเหลว:", err.message);
    return [];
  }
}

export async function saveSlipResults(newSlip) {
  try {
    await SlipResult.create(newSlip);
  } catch (err) {
    console.error("❌ บันทึก slipResult ล้มเหลว:", err.message);
  }
}

export async function reportSlipResultToAPI(result) {
  try {
    await axios.post("http://localhost:2638/api/slip-results", result);
  } catch (error) {
    console.error("❌ ไม่สามารถส่งข้อมูลผลสลิปไปยัง API:", error.message);
  }
}

export async function removeOldSlips() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  try {
    const result = await SlipResult.deleteMany({ createdAt: { $lt: yesterday } });
    console.log(`🧹 ลบ SlipResult เก่า ${result.deletedCount} รายการ`);
  } catch (err) {
    console.error("❌ ลบข้อมูลเก่าล้มเหลว:", err.message);
  }
}