import fs from "fs";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { broadcastLog } from "../index.js";

const statsDir = "./stats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FILE_PATH = path.join(__dirname, "dataSlip", "slip_results.json");

// ✅ สร้างโฟลเดอร์ถ้ายังไม่มี
if (!fs.existsSync(path.join(__dirname, "dataSlip"))) {
    fs.mkdirSync(path.join(__dirname, "dataSlip"), { recursive: true });
}

// ✅ ฟังก์ชันโหลดข้อมูล slipStats ตาม PREFIX
const loadStats = (prefix) => {
    const filePath = path.join(statsDir, `slipStats_${prefix}.json`);
    try {
        if (!fs.existsSync(filePath)) {
            return {}; // ถ้าไม่มีไฟล์ ให้คืนค่าเป็น Object เปล่า
        }
        const rawData = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(rawData);
    } catch (error) {
        console.error(`❌ ไม่สามารถโหลด ${filePath}:`, error);
        return {};
    }
};

// ✅ ฟังก์ชันบันทึกข้อมูล slipStats ตาม PREFIX
const saveStats = (prefix, stats) => {
    const filePath = path.join(statsDir, `slipStats_${prefix}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(stats, null, 2), "utf-8");
    } catch (error) {
        console.error(`❌ ไม่สามารถบันทึก ${filePath}:`, error);
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
      if (fs.existsSync(FILE_PATH)) {
        const raw = fs.readFileSync(FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        } else {
          throw new Error("ไม่ใช่ array");
        }
      }
    } catch (err) {
      console.error("❌ โหลด slipResults ล้มเหลว:", err.message);
    }
    return [];
}

export function saveSlipResults(data) {
    try {
      if (!Array.isArray(data)) throw new Error("data is not array");
      if (data.length === 0) {
        console.warn("⚠️ ไม่มีข้อมูลจะบันทึก slip_results.json");
        return;
      }
      fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("❌ บันทึก slipResults ล้มเหลว:", err.message);
    }
}

export async function reportSlipResultToAPI(result) {
    try {
      await axios.post("http://localhost:2600/api/slip-results", result);
    } catch (error) {
      console.error("❌ ไม่สามารถส่งข้อมูลผลสลิปไปยัง API:", error.message);
    }
  }