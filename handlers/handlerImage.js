// handlerImage.js
import { sendMessageWait } from "../reply/text_reply.js";
import { sendMessageSame } from "../reply/same_reply.js";
import { loadQRDatabaseFromFile, saveQRDatabaseToFile } from "../utils/qrData.js";
import { addToUserQueue, finishUserTask } from "../utils/userQueueManager.js";
import { analyzeSlipImage, streamToBuffer } from "../utils/qrSlipworker.js";
import { handleRegularSlip } from "./Image/regularSlipChecker.js";
import { getLineProfile } from "../utils/getLineProfile.js";
import { reportSlipResultToAPI } from "../utils/slipStatsManager.js";
import { setUserSentSlip, setUserSentImage, clearUserMessageHistory, clearUserTimeout } from "./handleEvent.js";
import { isNewCustomer } from "../utils/savePhoneNumber.js";
import { broadcastLog } from "../index.js";
import { getCachedSettings, reloadSettings } from "../utils/settingsManager.js";
import { connectDB } from "../mongo.js";
import Shop from "../models/Shop.js";

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

export async function loadShopDataFromDB() {
  try {
    await connectDB(); // เชื่อม MongoDB ถ้ายังไม่ได้เชื่อม
    shopData = await Shop.find({}); // ดึงข้อมูลทั้งหมด
  } catch (err) {
    console.error("❌ โหลดข้อมูลร้านจาก MongoDB ไม่สำเร็จ:", err.message);
    shopData = [];
  }
}

// ✅ โหลดข้อมูลร้านและ settings ตอนเริ่ม
(async () => {
  await loadShopDataFromDB();
  await reloadSettings();
})();

const programStartTime = Date.now(); // เวลาที่โปรแกรมเริ่มทำงาน
const userMessageCount = new Map(); // เก็บจำนวนสลิปที่ผู้ใช้ส่ง

export async function handleImageEvent(event, client, prefix, linename, qrDatabase) {
  try {
    const {
      timeLimit,
      sameQrTimeLimit,
      maxMessagesPerUser,
      maxMessagesSamePerUser,
    } = getCachedSettings();
    
    const userId = event.source.userId;
    const messageId = event.message.id;
    const now = Date.now();
    clearUserTimeout(userId);
    clearUserMessageHistory(userId);
    
    // ✅ โหลดข้อมูลร้าน
    const shop = shopData.find((s) => s.prefix === prefix);
    if (!shop) {
      console.log(`❌ ไม่พบร้านที่มี prefix: ${prefix}`);
      broadcastLog(`❌ ไม่พบร้านที่มี prefix: ${prefix}`);
      return;
    }

    // ✅ โหลดฐานข้อมูล QR
    qrDatabase = await loadQRDatabaseFromFile(prefix) || new Map();

    const success = addToUserQueue(
      userId,
      async () => {
        const stream = await client.getMessageContent(messageId);
        const buffer = await streamToBuffer(stream);
        const qrData = await analyzeSlipImage(buffer);
        const profile = await getLineProfile(userId, shop.lines[0].access_token);
        const lineName = profile?.displayName || "-";
        const image = profile?.pictureUrl || "";
        const isNew = isNewCustomer(userId);

        if (event.timestamp < programStartTime) return;

          if (!qrData) {
            console.log("❌ ไม่ใช่ภาพสลิป");
            broadcastLog("❌ ไม่ใช่ภาพสลิป");
            setUserSentImage(userId);
            console.log('ภาพทั่วไป → บันทึกว่า user ส่งรูปมา');
            return;
          }

          setUserSentSlip(userId);
          console.log('ตรวจพ QR → บันทึกว่า user ส่งสลิป');

          // ✅ เพิ่มการตอบ info ให้เฉพาะลูกค้าใหม่
          if (isNew) {
            const infoText = await getRandomReplyFromFile("info");
            if (infoText) {
              try {
                await client.replyMessage(event.replyToken, [{ type: "text", text: infoText }]);
                console.log(`📨 ส่งข้อความ info ให้ลูกค้าใหม่: ${userId}`);
                broadcastLog(`📨 ส่งข้อความ info ให้ลูกค้าใหม่: ${userId}`);
              } catch (err) {
                console.error("❌ ส่งข้อความ info ล้มเหลว:", err);
                broadcastLog("❌ ส่งข้อความ info ล้มเหลว");
              }
            }
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
            console.log(`📦 QR นี้เคยถูกตรวจแล้ว`);
            const qrInfo = qrDatabase.get(qrData);
            const qrUsers = Array.from(qrInfo.users.keys());
            console.log(`📌 พบผู้ใช้ที่เคยส่ง QR นี้: ${qrUsers.join(", ")}`);


            if (qrInfo.users.has(userId)) {
              const userRecord = qrInfo.users.get(userId); // ✅ ดึงข้อมูลของผู้ใช้จากฐานข้อมูล
              const lastSentTime = userRecord.lastSentTime || 0;
              const sameMessageCount = userRecord.messageCount || 0;
              console.log(`🔄 [ซ้ำ] ผู้ใช้เดิมเคยส่ง QR นี้`);
              console.log(`⏱️ เวลาเดิม: ${new Date(lastSentTime).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`);
              console.log(`📊 messageCount = ${sameMessageCount}`);
          
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
                      response: "ตอบกลับ 'รอสักครู่'",
                      amount: qrInfo.amount,
                      ref: qrData
                    });
                    await sendMessageWait(event.replyToken, client);

                    qrInfo.users.set(userId, {
                        lastSentTime: now,
                        messageCount: sameMessageCount + 1
                    });
          
                    saveQRDatabaseToFile(prefix, qrDatabase);
                    finishUserTask(userId);
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
            finishUserTask(userId);
            
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
              lineName,    // ✅ ส่ง lineName จริง
              image,       // ✅ ส่ง image จริง
              linename,    // ✅ ส่ง linename จริง
              tranRef      // ✅ ส่ง tranRef จริง
            );

          if (slipData && slipData.amount !== undefined) {
            qrEntry.amount = slipData.amount;
          }
        }

        qrDatabase.set(qrData, qrEntry);
        saveQRDatabaseToFile(prefix, qrDatabase);
        finishUserTask(userId);
      }
    );

  } catch (error) {
    console.error(`❌ Error processing event for PREFIX ${prefix}: ${error.message}`);
    broadcastLog(`❌ Error processing event for PREFIX ${prefix}: ${error.message}`);
  }
}

function getCurrentTimeOnly() {
  return new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok"
  }) + " น.";
}

