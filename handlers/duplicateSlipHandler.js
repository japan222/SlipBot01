// duplicateSlipHandler.js
import { sendMessageWait } from "../reply/text_reply.js";
import { sendMessageSame } from "../reply/same_reply.js";
import fs from "fs";
import { loadQRDatabaseFromFile, saveQRDatabaseToFile } from "../qrdata/qrData.js";
import { analyzeSlipImage, streamToBuffer } from "../utils/qrSlipworker.js";
import { handleRegularSlip } from "../handlers/regularSlipChecker.js";
import { getLineProfile } from "../utils/getLineProfile.js";
import { reportSlipResultToAPI } from "../utils/slipStatsManager.js";
import { broadcastLog } from "../index.js";
import { loadSettings } from '../config/settings.js';

/**
 * ฟังก์ชันสำหรับตรวจสอบสลิปซ้ำ
 * @param {string} qrData - ข้อมูล QR ที่สแกนได้
 * @param {string} userId - รหัสผู้ใช้
 * @param {Map} qrDatabase - ฐานข้อมูล QR Code
 * @param {object} client - LINE client สำหรับส่งข้อความตอบกลับ
 * @param {string} replyToken - reply token สำหรับตอบกลับ LINE
 * @param {string} prefix - รหัสร้าน (ใช้ในการบันทึกข้อมูล)
 */

let shopData = []; 

const loadShopData = () => {
  try {
    const rawData = fs.readFileSync("./line_shops.json", "utf-8");
    const jsonData = JSON.parse(rawData);
    shopData = jsonData.shops || [];
  } catch (error) {
    console.error("❌ ไม่สามารถโหลด line_shops.json:", error.message);
    broadcastLog(`❌ ไม่สามารถโหลด line_shops.json: ${error.message}`); 
    shopData = []; // กรณีเกิดข้อผิดพลาด ให้ shopData เป็น array ว่าง
  }
};

// โหลดข้อมูลร้านค้าในครั้งแรก
loadShopData();

let bankAccounts = loadBankAccounts();
if (bankAccounts && Object.keys(bankAccounts).length > 0) {
} else {
  console.warn("⚠️ ไม่มีบัญชีธนาคารที่ใช้งานได้");
  broadcastLog("⚠️ ไม่มีบัญชีธนาคารที่ใช้งานได้");
}

let currentSettings = loadSettings();

export function getSettings() {
  return currentSettings;
}

export function reloadSettings() {
  currentSettings = loadSettings();
}
const {
  timeLimit,
  sameQrTimeLimit,
  maxMessagesPerUser,
  maxMessagesSamePerUser,
  maxProcessingPerUser
} = getSettings();

const programStartTime = Date.now(); // เวลาที่โปรแกรมเริ่มทำงาน
const userProcessingQueue = new Map(); // คิวการประมวลผลของผู้ใช้
const userMessageCount = new Map(); // เก็บจำนวนสลิปที่ผู้ใช้ส่ง
const processedEvents = new Set(); // เก็บ event ที่ประมวลผลแล้ว

export async function handleEvent(event, client, prefix, linename, qrDatabase) {
  // ✅ โหลดข้อมูลร้านค้า
  const rawData = fs.readFileSync("./line_shops.json", "utf-8");
  const shopData = JSON.parse(rawData).shops || [];
  const shop = shopData.find(shop => shop.prefix === prefix);

  // ✅ ตรวจสอบว่าร้านค้านี้เปิดใช้งานหรือไม่
  if (!shop || !shop.status) return;
  
  console.log(`📩 ข้อความ: ${event.message?.type || event.type} จาก ${linename}`);
  broadcastLog(`📩 ข้อความ: ${event.message?.type || event.type} จาก ${linename}`);

  if (event.type !== "message" || event.message.type !== "image") return;
  const userId = event.source.userId;
  const messageId = event.message.id;
  const now = Date.now();
  const eventId = `${event.message?.id || event.timestamp}`;

    // ✅ ตรวจสอบว่า event นี้เคยถูกประมวลผลหรือยัง
    if (processedEvents.has(eventId)) return;
    processedEvents.add(eventId);
    setTimeout(() => processedEvents.delete(eventId), 24 * 60 * 60 * 1000);


    if (event.timestamp < programStartTime) return;

    // ✅ โหลดฐานข้อมูล QR Code ของร้านนี้
    qrDatabase = loadQRDatabaseFromFile(prefix) || new Map();

    // ✅ ตรวจสอบว่าผู้ใช้นี้มีคิวหรือยัง ถ้าไม่มีให้สร้างใหม่
    if (!userProcessingQueue.has(userId)) {
        userProcessingQueue.set(userId, []);
    }

    const userQueue = userProcessingQueue.get(userId);

    // ✅ จำกัดจำนวนสูงสุด 2 งานต่อผู้ใช้
    if (userQueue.length >= maxProcessingPerUser) {
      console.log(`⚠️ ผู้ใช้ ${userId} มีคิวเต็ม (2 รายการ)`);
      broadcastLog(`⚠️ ผู้ใช้ ${userId} มีคิวเต็ม (2 รายการ)`);
      return;
    }
    // ✅ เพิ่มงานเข้าไปในคิว
    userQueue.push(async () => {
      try {
          console.log(`🔄 กำลังประมวลรูปภาพของ ${userId} (${userQueue.length} รายการในคิว)`);
          broadcastLog(`🔄 กำลังประมวลรูปภาพของ ${userId} (${userQueue.length} รายการในคิว)`);
          const stream = await client.getMessageContent(messageId);
          const buffer = await streamToBuffer(stream);

          const qrData = await analyzeSlipImage(buffer);
          const profile = await getLineProfile(userId, shop.lines[0].access_token);

          const lineName = profile?.displayName || "-";
          const image = profile?.pictureUrl || "";

          if (!qrData) {
            console.log("❌ ไม่ใช่ภาพสลิป");
            broadcastLog("❌ ไม่ใช่ภาพสลิป");
            return;
          }
        
          // ✅ กรณีพบว่าเป็นสลิปต้องสงสัย
          if (qrData.suspicious) {
            console.log("⚠️ พบสลิปต้องสงสัย ( อาจเป็นภาพสลิป แต่ไม่มี QRcode หรือ ปลอมสลิป )");
            broadcastLog("⚠️ พบสลิปต้องสงสัย ( อาจเป็นภาพสลิป แต่ไม่มี QRcode หรือ ปลอมสลิป )");
            await reportSlipResultToAPI({
              time: getCurrentTimeOnly(),  // เพิ่ม () เพื่อเรียกใช้ฟังก์ชัน
              shop: linename,
              lineName,
              image,
              status: "พบสลิปต้องสงสัย ( อาจเป็นภาพสลิป แต่ไม่มี QRcode หรือ ปลอมสลิป )",
              response: "ไม่ได้ตอบกลับ",
          });
            return;
          }
          
          // ✅ กรณีสลิปถูกต้องและมี QR Code
          console.log("📥 QR Code ที่สแกนได้:", qrData);
          broadcastLog(`📥 QR Code ที่สแกนได้: ${qrData}`);
          
          
          if (!userMessageCount.has(userId)) {
            userMessageCount.set(userId, { lastSentTime: 0, qrMessageCount: 0 });
          }

          const userInfo = userMessageCount.get(userId);
          
          // ✅ ตรวจสอบว่า QR Code นี้ถูกส่งเข้ามาก่อนหรือไม่ (เคยตรวจไปแล้ว)
          if (qrDatabase.has(qrData)) {
            const qrInfo = qrDatabase.get(qrData);
        

            if (qrInfo.users.has(userId)) {
              const userRecord = qrInfo.users.get(userId); // ✅ ดึงข้อมูลของผู้ใช้จากฐานข้อมูล
              const lastSentTime = userRecord.lastSentTime || 0;
              const sameMessageCount = userRecord.messageCount || 0;
          
              if (now - lastSentTime < sameQrTimeLimit) {
                if (sameMessageCount < maxMessagesSamePerUser) {
                    console.log(`🔔 ตอบกลับ "รอสักครู่" ครั้งแรกให้กับ ${userId}`);
                    broadcastLog(`🔔 ตอบกลับ "รอสักครู่" ครั้งแรกให้กับ ${userId}`);
                    await reportSlipResultToAPI({
                      time: getCurrentTimeOnly(),  // เพิ่ม () เพื่อเรียกใช้ฟังก์ชัน
                      shop: linename,
                      lineName,
                      image,
                      status: "สลิปซ้ำ ไม่เกิน 1 ชั่วโมง",
                      response: "ตอบกลับ '' รอสักครู่ '' แล้ว",
                      amount: qrInfo.amount,
                      ref: qrData
                    });
                    await sendMessageWait(event.replyToken, client);

                    qrInfo.users.set(userId, {
                        lastSentTime: now,
                        messageCount: sameMessageCount + 1
                    });
          
                    saveQRDatabaseToFile(prefix, qrDatabase);
                    return;
                } else {
                    console.log(`⏳ เพิกเฉย: ผู้ใช้ ${userId} ส่งซ้ำเกิน ${maxMessagesSamePerUser} ครั้ง`);
                    broadcastLog(`⏳ เพิกเฉย: ผู้ใช้ ${userId} ส่งซ้ำเกิน ${maxMessagesSamePerUser} ครั้ง`);
                    return;
                }
            }
        }
            // ✅ ถ้าเกิน 10 นาที ให้ตรวจเป็น "🔴 พบสลิป QR Code ซ้ำ ❌"
            const tranRef = qrData.length > 20 ? qrData.slice(-20) : qrData;
            console.log(`🔴 พบสลิป QR Code ซ้ำ ❌`);
            broadcastLog(`🔴 พบสลิป QR Code ซ้ำ ❌`);
            saveQRDatabaseToFile(prefix, qrDatabase);
            
            // รายงานผลก่อน
            await reportSlipResultToAPI({
                time: getCurrentTimeOnly(),  // เพิ่ม () เพื่อเรียกใช้ฟังก์ชัน
                shop: linename,
                lineName,
                image,
                status: "สลิปซ้ำเดิม",
                response: "ตอบกลับแล้ว",
                amount: qrInfo.amount,
                ref: qrData
            });

            return sendMessageSame(
              event.replyToken, 
              client, 
              new Date(qrInfo.firstDetected).toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok"
              }) + " น.",
              tranRef
          );
          }

          if (now - userInfo.lastSentTime < timeLimit && userInfo.qrMessageCount >= maxMessagesPerUser) {
            console.log(`⏳ เพิกเฉย: ผู้ใช้ ${userId} ส่งสลิปเกิน ${maxMessagesPerUser} ครั้ง`);
            broadcastLog(`⏳ เพิกเฉย: ผู้ใช้ ${userId} ส่งสลิปเกิน ${maxMessagesPerUser} ครั้ง`);
            return;
          }
            userMessageCount.set(userId, {
              lastSentTime: now,
              qrMessageCount: userInfo.qrMessageCount + 1
          });
          const tranRef = qrData.length > 20 ? qrData.slice(-20) : qrData;
          const qrEntry = {
            firstDetected: now,
            users: new Map([
              [userId, { lastSentTime: now, messageCount: 1 }]
            ])
          };

          if (shop.slipCheckOption === "all") {
            console.log(`🆕 ส่งต่อไปตรวจสลิปที่ SlipOK`);
            broadcastLog(`🆕 ส่งต่อไปตรวจสลิปที่ SlipOK`);
            // ส่งต่อให้ regularSlipChecker.js ตรวจสอบและรับข้อมูลจาก SlipOK
            const slipData = await handleRegularSlip(
              client,
              event.message.id,
              event.replyToken,
              prefix,
              qrDatabase,
              qrData,
              userId,
              userMessageCount,
              userInfo,
              bankAccounts,
              lineName,
              image,
              linename,
              tranRef
            );

            // ✅ บันทึกค่า amount หากได้รับจาก SlipOK
            if (slipData && slipData.amount !== undefined) {
              qrEntry.amount = slipData.amount;
            }
          }
  
          // ✅ บันทึกข้อมูล QR Code
          qrDatabase.set(qrData, qrEntry);
          saveQRDatabaseToFile(prefix, qrDatabase);

  } catch (error) {
      console.error(`❌ Error processing event for PREFIX ${prefix}: ${error.message}`);
      broadcastLog(`❌ Error processing event for PREFIX ${prefix}: ${error.message}`);
  } finally {
      // ✅ ลบงานที่เสร็จสิ้นออกจากคิว
      userQueue.shift();

      // ✅ ถ้ามีงานในคิว ให้รันงานถัดไป
      if (userQueue.length > 0) {
          userQueue[0]();
        } else {
          // ✅ ถ้าคิวหมด ให้เคลียร์ userQueue เพื่อให้ผู้ใช้สามารถเพิ่มงานใหม่ได้
          userProcessingQueue.delete(userId);
      }
    }
});

  // ✅ ถ้าไม่มีงานกำลังประมวลผล → เริ่มประมวลผล
  if (userQueue.length === 1) {
      userQueue[0]();
  }
}

function getCurrentTimeOnly() {
  return new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok"
  }) + " น.";
}

function loadBankAccounts() {
  try {
    const rawData = fs.readFileSync("./bank_accounts.json", "utf-8");
    const jsonData = JSON.parse(rawData);
    return jsonData.accounts || {}; // ✅ คืนค่ารายการบัญชี
  } catch (error) {
    console.error("❌ ไม่สามารถโหลด bank_accounts.json:", error.message);
    broadcastLog(`❌ ไม่สามารถโหลด bank_accounts.json:", ${error.message}`);
    return {};
  }
}




