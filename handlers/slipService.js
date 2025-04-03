// slipService.js
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";
import { broadcastLog } from "../index.js";

dotenv.config();

export async function sendImageToSlipOK(client, messageId) {
    try {
      const stream = await client.getMessageContent(messageId);
      const formData = new FormData();
      formData.append("files", stream, "slip.jpg");
  
      const response = await Promise.race([
        axios.post(
          `https://api.slipok.com/api/line/apikey/${process.env.BRANCH_ID}`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              "x-authorization": process.env.SLIPOK_API_KEY,
            },
          }
        ),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000) // ตั้ง timeout 15 วินาที
        ),
      ]);
  
      // กรณีสถานะ 200
      const data = response.data; 
      return { success: true, status: "valid", data: data.data };
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
  
    const errorResponse = err.response?.data;
  
      if (errorResponse) {
        // ตรวจสอบรหัสข้อผิดพลาดที่รู้จัก
        if (
          [1000, 1002, 1004, 1005, 1006, 1007, 1008, 1011, 1012, 1013, 1014].includes(errorResponse.code)
        ) {
          console.log(`เพิกเฉย: ${errorResponse.message}`);
          broadcastLog(`เพิกเฉย: ${errorResponse.message}`);
          return { success: false, status: "ignored", data: errorResponse };
        }
        else if (
          [1009, 1010].includes(errorResponse.code)
        ) {
          console.log(`เพิกเฉย: ${errorResponse.message}`);
          broadcastLog(`เพิกเฉย: ${errorResponse.message}`);
          return { success: false, status: "Wait", data: errorResponse };
        }
        else if (
          [ 1003 ].includes(errorResponse.code)
        ) {
          console.log("Package ของคุณหมดอายุแล้ว");
          broadcastLog("Package ของคุณหมดอายุแล้ว");
          return;
        }
        // กรณีอื่นๆ
        console.error(
          `ไม่สามารถรับข้อมูลจาก SlipOK: ${JSON.stringify(errorResponse)}`
        );
        broadcastLog(
          `ไม่สามารถรับข้อมูลจาก SlipOK: ${JSON.stringify(errorResponse)}`
        );
        return { success: false, status: "error", data: errorResponse };
      }
  
      console.error("ไม่สามารถส่งภาพไปที่ SlipOK:", err.message);
      broadcastLog("ไม่สามารถส่งภาพไปที่ SlipOK:", err.message);
      return { success: false, status: "failed", data: null };
    }
  };