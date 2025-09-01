// slipService.js
import axios from "axios";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import dotenv from "dotenv";
import { broadcastLog } from "../../index.js";

const envPath = path.join(process.cwd(), "info.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export async function sendImageToSlip2Go(client, messageId) {
  try {
    const stream = await client.getMessageContent(messageId);
    const formData = new FormData();
    formData.append("file", stream, "slip.jpg");

    const response = await Promise.race([
      axios.post(
        "https://connect.slip2go.com/api/verify-slip/qr-image/info",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${process.env.SLIP2GO_API_KEY}`,
          },
        }
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 15000)
      ),
    ]);


    const data = response.data;
    const code = data.code;

    // กรณีสถานะ 200
    if (code === "200000") {
      return { success: true, status: "valid", data };
    } else if (["200404", "200500", "500500"].includes(code)) {
      console.log(`❌ เพิกเฉย: ${data.message}`);
      broadcastLog(`❌ เพิกเฉย: ${data.message}`);
      return { success: false, status: "ignored", data };
    } else if (["401004", "401005", "401006"].includes(code)) {
      console.log("🚫 ไม่มีโควต้า หรือแพ็คหมด");
      broadcastLog("🚫 ไม่มีโควต้า หรือแพ็คหมด");
      return { success: false, status: "error", data };
    }

  } catch (err) {
    // --- เพิ่มโค้ดตรวจจับ ECONNRESET ให้ถือเป็น timeout ---
    if (err.code === "ECONNRESET") {
      console.error("การตรวจสอบใช้เวลานานเกิน ข้ามข้อความนี้");
      broadcastLog("การตรวจสอบใช้เวลานานเกิน ข้ามข้อความนี้");
      return { success: false, status: "timeout", data: null };
    }

    // ตรวจสอบว่าข้อผิดพลาดมาจาก Timeout หรือไม่
    if (err.message === "Timeout") {
      console.error("การตรวจสอบใช้เวลานานเกิน ข้ามข้อความนี้");
      broadcastLog("การตรวจสอบใช้เวลานานเกิน ข้ามข้อความนี้");
      return { success: false, status: "timeout", data: null };
    }

    console.error("ไม่สามารถส่งภาพไปที่ Slip2Go:", err.message);
    broadcastLog("ไม่สามารถส่งภาพไปที่ Slip2Go:", err.message);
    return { success: false, status: "error", data: null };
  }
}