import fs from "fs";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { broadcastLog } from "../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const statsFilePath = path.join(__dirname, "dataSlip", "slipStats.json");
const FILE_PATH = path.join(__dirname, "dataSlip", "slip_results.json");

// ✅ สร้างโฟลเดอร์ถ้ายังไม่มี
if (!fs.existsSync(path.join(__dirname, "dataSlip"))) {
    fs.mkdirSync(path.join(__dirname, "dataSlip"), { recursive: true });
}

// ✅ ฟังก์ชันโหลดข้อมูล slipStats ตาม PREFIX
export const loadStats = (prefix) => {
  try {
    if (fs.existsSync(statsFilePath)) {
      const raw = fs.readFileSync(statsFilePath, "utf-8");
      const allStats = JSON.parse(raw);
      return allStats[prefix] || {};
    }
  } catch (err) {
    console.error("❌ โหลด slipStats ล้มเหลว:", err.message);
  }
  return {};
};

// ✅ ฟังก์ชันบันทึกข้อมูล slipStats ตาม PREFIX
const saveStats = (prefix, newStats) => {
  let allStats = {};

  try {
    if (fs.existsSync(statsFilePath)) {
      const raw = fs.readFileSync(statsFilePath, "utf-8");
      allStats = JSON.parse(raw);
    }
  } catch (err) {
    console.error("❌ อ่านไฟล์ slipStats.json ไม่สำเร็จ:", err.message);
  }

  allStats[prefix] = {
    ...(allStats[prefix] || {}),
    ...newStats,
  };

  try {
    fs.writeFileSync(statsFilePath, JSON.stringify(allStats, null, 2), "utf-8");
  } catch (err) {
    console.error("❌ ไม่สามารถบันทึก slipStats.json:", err.message);
  }
};

// ✅ อัปเดตยอดเงินของแต่ละหมวดหมู่ แยกตาม PREFIX
export const updateSlipStats = (prefix, category, amount) => {
  if (!prefix) {
    console.error("❌ ไม่พบค่า prefix");
    return;
  }

  if (amount === undefined || amount === null) {
    console.warn(`⚠️ ไม่สามารถอัปเดต slipStats: amount เป็น ${amount}`);
    return;
  }

  const stats = loadStats(prefix);

  if (!stats[category]) {
    stats[category] = 0;
  }

  stats[category] += amount;
  saveStats(prefix, stats);
};

// ✅ ฟังก์ชันดึงข้อมูลสถิติของแต่ละ PREFIX
export const getSlipStatsAmount = (prefix) => {
    if (!prefix) {
        console.error("❌ ไม่พบค่า prefix");
        return {};
    }
    return loadStats(prefix);
};

export function loadSlipResults() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      console.warn(`⚠️ ไม่พบไฟล์ ${FILE_PATH} สร้างใหม่เป็น []`);
      fs.writeFileSync(FILE_PATH, "[]", "utf-8");
      return [];
    }

    let rawData = fs.readFileSync(FILE_PATH, "utf-8");

    if (!rawData.trim()) {
      console.warn(`⚠️ ไฟล์ ${FILE_PATH} ว่างเปล่า กำลังรีเซ็ตเป็น []`);
      rawData = "[]";
      fs.writeFileSync(FILE_PATH, rawData);
    }

    const parsed = JSON.parse(rawData);

    if (!Array.isArray(parsed)) {
      throw new Error("❌ ข้อมูลในไฟล์ไม่ใช่ Array");
    }

    return parsed;

  } catch (err) {
    console.error("❌ โหลด slipResults ล้มเหลว:", err.message);
    return [];
  }
}

export function saveSlipResults(data) {
    try {
      if (!Array.isArray(data)) throw new Error("data is not array");
      if (data.length === 0) {
        return;
      }
      fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("❌ บันทึก slipResults ล้มเหลว:", err.message);
    }
}

export async function reportSlipResultToAPI(result) {
    try {
      await axios.post("http://localhost:2638/api/slip-results", result);
    } catch (error) {
      console.error("❌ ไม่สามารถส่งข้อมูลผลสลิปไปยัง API:", error.message);
    }
  }