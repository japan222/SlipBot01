import fs from "fs";
import express from "express";
import * as line from "@line/bot-sdk";
import dotenv from "dotenv";
import axios from "axios";
import FormData from "form-data";
import { sendMessageWait } from "./reply/text_reply.js";
import { isAccountNumberMatch, isNameMatch, cleanReceiverName } from "./utils/accountUtils.js";
import bankCodeMapping from "./utils/bankCodeMapping.js";
import crypto from "crypto";
import { loadQRDatabaseFromFile, saveQRDatabaseToFile } from "./qrdata/qrData.js";
import { scan_qr_code, streamToBuffer } from "./utils/qrSlipworker.js";
import { updateSlipStats, getSlipStatsAmount } from "./utils/slipStatsManager.js";
import { exec } from "child_process";
import deepEqual from "fast-deep-equal"; 

// โหลด info.env
dotenv.config({ path: `${process.cwd()}/info.env` });


let shopData = [];

const loadShopData = () => {
  try {
    const rawData = fs.readFileSync("./line_shops.json", "utf-8");
    const jsonData = JSON.parse(rawData);
    shopData = jsonData.shops || [];
    console.log("📌 โหลดข้อมูลร้านค้าเรียบร้อย");
  } catch (error) {
    console.error("❌ ไม่สามารถโหลด line_shops.json:", error.message);
    shopData = [];
  }
};

// ✅ โหลดข้อมูลร้านค้า
loadShopData();

let bankAccounts = loadBankAccounts();
if (bankAccounts && Object.keys(bankAccounts).length > 0) {
} else {
  console.warn("⚠️ ไม่มีบัญชีธนาคารที่ใช้งานได้");
}

fs.watchFile("./line_shops.json", (curr, prev) => {
  console.log("🔄 ตรวจพบการเปลี่ยนแปลงของไฟล์ line_shops.json กำลังโหลดใหม่...");

  // เก็บข้อมูลร้านค้าเดิม (ทำ deep copy)
  const oldShops = JSON.parse(JSON.stringify(shopData));

  // โหลดข้อมูลร้านค้าใหม่จากไฟล์ line_shops.json
  loadShopData(); 

  // เปรียบเทียบข้อมูลเดิมกับข้อมูลที่โหลดใหม่
  if (!deepEqual(oldShops, shopData)) {
    console.log("🔄 มีการเปลี่ยนแปลงใน line_shops.json -> รีโหลด Webhook");
    restartWebhooks();
  } else {
    console.log("✅ ไม่มีการเปลี่ยนแปลงใน line_shops.json, ไม่ต้องรีโหลด Webhook");
  }
});

fs.watchFile("./bank_accounts.json", (curr, prev) => {
  console.log("🔄 ตรวจพบการเปลี่ยนแปลงของไฟล์ bank_accounts.json กำลังโหลดใหม่...");

  const oldBankAccounts = { ...bankAccounts }; // 📌 เก็บค่าก่อนอัปเดต
  const newBankAccounts = loadBankAccounts(); // 📌 โหลดใหม่

  if (!deepEqual(oldBankAccounts, newBankAccounts)) {
      console.log("🔄 มีการเปลี่ยนแปลงบัญชีธนาคาร -> รีโหลด Webhook");
      bankAccounts = newBankAccounts; // ✅ อัปเดตข้อมูลใหม่
      restartWebhooks(); // ✅ รีโหลด Webhook ใหม่ให้ตรงกับบัญชีที่ใช้งานอยู่
  } else {
      console.log("✅ ไม่มีการเปลี่ยนแปลงในบัญชีธนาคาร, ไม่ต้องรีโหลด Webhook");
  }
});

const app = express();
const programStartTime = Date.now(); // บันทึกเวลาที่โปรแกรมเริ่มทำงาน


const checkInternetConnection = async () => {
  try {
    // เรียก API จาก Flask
    const response = await axios.get(`http://127.0.0.1:5000/check-internet`); // URL ของ Flask API
    const { status } = response.data; // ดึงค่า status จาก JSON

    if (status) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
};

let isInternetConnected = true; // สถานะการเชื่อมต่ออินเทอร์เน็ต
let isPaused = false; // ระบุว่าโปรแกรมอยู่ในโหมดหยุดชั่วคราวหรือไม่
let pauseResumeTime = 0;   
const internetCheckInterval = 10000; // ตรวจสอบอินเทอร์เน็ตทุก 5 วินาที

const checkInternetStatus = async () => {
  const isConnected = await checkInternetConnection(); // ฟังก์ชันที่คุณมีอยู่แล้ว
  if (isConnected && !isInternetConnected) {
    // อินเทอร์เน็ตกลับมา
    isInternetConnected = true;
    isPaused = false;
    pauseResumeTime = Date.now();
    console.log("🟢 อินเทอร์เน็ตกลับมาแล้ว");
  } else if (!isConnected && isInternetConnected) {
    // อินเทอร์เน็ตหลุด
    isInternetConnected = false;
    isPaused = true;
    console.log("🔴 อินเทอร์เน็ตหลุด");
  }
};

// เริ่มการตรวจสอบอินเทอร์เน็ตทุก 5 วินาที
setInterval(checkInternetStatus, internetCheckInterval);


const sendImageToSlipOK = async (client, messageId) => {

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
        (_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000) // ตั้ง timeout 10 วินาที
      ),
    ]);

    // กรณีสถานะ 200
    const data = response.data; 
    return { success: true, status: "valid", data: data.data };
  } catch (err) {
    // ตรวจสอบว่าข้อผิดพลาดมาจาก Timeout หรือไม่
    if (err.message === "Timeout") {
      console.error("การตรวจสอบใช้เวลานานเกิน ข้ามข้อความนี้");
      return { success: false, status: "timeout", data: null };
    }

    const errorResponse = err.response?.data;

    if (errorResponse) {
      // ตรวจสอบรหัสข้อผิดพลาดที่รู้จัก
      if (
        [1000, 1002, 1004, 1005, 1006, 1007, 1008, 1011, 1012, 1013, 1014].includes(errorResponse.code)
      ) {
        console.log(`เพิกเฉย: ${errorResponse.message}`);
        return { success: false, status: "ignored", data: errorResponse };
      }
      else if (
        [1009, 1010].includes(errorResponse.code)
      ) {
        console.log(`เพิกเฉย: ${errorResponse.message}`);
        return { success: false, status: "Wait", data: errorResponse };
      }
      else if (
        [ 1003 ].includes(errorResponse.code)
      ) {
        console.log("Package ของคุณหมดอายุแล้ว");
        return;
      }
      // กรณีอื่นๆ
      console.error(
        `ไม่สามารถรับข้อมูลจาก SlipOK: ${JSON.stringify(errorResponse)}`
      );
      return { success: false, status: "error", data: errorResponse };
    }

    console.error("ไม่สามารถส่งภาพไปที่ SlipOK:", err.message);
    return { success: false, status: "failed", data: null };
  }
};

const timeLimit = 120000; // 2 นาที (120,000 ms)
const sameQrTimeLimit = 1200000; // 20 นาที (600,000 ms)
const maxMessagesPerUser = 3; // จำกัดการตรวจ 3 รูปภาพที่เป็นสลิป ต่อผู้ใช้ 1 คน
const maxMessagesSamePerUser = 2; // จำกัดการแจ้งเตือนซ้ำเพียง 2 ครั้ง
const maxProcessingPerUser = 3; // จำกัดการตรวจได้สูงสุด 3 รายการต่อผู้ใช้

const userProcessingQueue = new Map(); // คิวของผู้ใช้แต่ละคน
const userMessageCount = new Map(); // ใช้เก็บจำนวนรูปที่ส่ง
const processedEvents = new Set(); // เก็บ event ที่ถูกประมวลผลแล้ว


async function handleEvent(event, client, prefix, qrDatabase) {
    // ✅ ตรวจสอบว่า prefix นี้ยังเปิดทำงานอยู่หรือไม่
    const shop = shopData.find(shop => shop.prefix === prefix);
    if (!shop || !shop.status) {
      return;
    }
    
    console.log(`📩 ข้อความ: ${event.message?.type || event.type} จาก ${prefix}`);

    if (event.type !== "message" || event.message.type !== "image") {
      return;
    }
    
    const userId = event.source.userId;
    const messageId = event.message.id;
    const now = Date.now();
    const eventId = `${event.message?.id || event.timestamp}`;


    if (!isInternetConnected) {
      console.log("เพิกเฉย: อินเทอร์เน็ตขาดการเชื่อมต่อ");
      return;
    }
    // ✅ ตรวจสอบว่า event นี้เคยถูกประมวลผลหรือยัง
    if (processedEvents.has(eventId)) return;
    processedEvents.add(eventId);
    setTimeout(() => processedEvents.delete(eventId), 24 * 60 * 60 * 1000);

    // ✅ ตรวจสอบว่าผู้ใช้อยู่ในช่วงเวลาหยุดพักหรือไม่
    if (isPaused && event.timestamp < pauseResumeTime) {
      console.log(`เพิกเฉย: Event ${event.message?.id} ถูกส่งเข้ามาระหว่างช่วงพัก`);
      return;
    }

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
      console.log(`⚠️ ผู้ใช้ ${userId} มีคิวเต็ม (2 รายการ) ข้ามการประมวลผล`);
      return;
    }
    // ✅ เพิ่มงานเข้าไปในคิว
    userQueue.push(async () => {
      try {
          console.log(`🔄 กำลังประมวลผลสลิปของ ${userId} (${userQueue.length} รายการในคิว)`);

          const stream = await client.getMessageContent(messageId);
          const buffer = await streamToBuffer(stream);
          const qrData = await scan_qr_code(buffer);

          // ✅ ตรวจสอบว่าเป็นภาพสลิปหรือไม่
          if (!qrData) {
            console.log("❌ ไม่พบ QR Code ในภาพนี้");
            return;
          }
          
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
                    await sendMessageWait(event.replyToken, client);

                    qrInfo.users.set(userId, {
                        lastSentTime: now,
                        messageCount: sameMessageCount + 1
                    });
          
                    saveQRDatabaseToFile(prefix, qrDatabase);
                    return;
                } else {
                    console.log(`⏳ เพิกเฉย: ผู้ใช้ ${userId} ส่งซ้ำเกิน ${maxMessagesSamePerUser} ครั้ง`);
                    console.log(qrInfo.amount);
                    return;
                }
            }
        }
            // ✅ ถ้าเกิน 10 นาที ให้ตรวจเป็น "🔴 พบสลิป QR Code ซ้ำ ❌"
            console.log(`🔴 พบสลิป QR Code ซ้ำ ❌ ${qrInfo.amount} บาท`);
            updateSlipStats(prefix, "ตรวจสลิปซ้ำไปแล้ว", qrInfo.amount);  // ✨ อัปเดต slipStats
            saveQRDatabaseToFile(prefix, qrDatabase);
            return;
          }

              if (now - userInfo.lastSentTime < timeLimit && userInfo.qrMessageCount >= maxMessagesPerUser) {
                  console.log(`⏳ เพิกเฉย: ผู้ใช้ ${userId} ส่งสลิปเกิน ${maxMessagesPerUser} ครั้ง`);
                  return;
              }

              const slipOKResponse = await sendImageToSlipOK(client, messageId);
              if (!isInternetConnected) {
                return;
              }

              if (slipOKResponse.status === "valid") {
                const data = slipOKResponse?.data 
                if (!data) return;
                const Amount = data.amount 
                console.log("💰 จำนวนเงินที่ตรวจพบ:", Amount);

              // ✅ บันทึก QR Code ลงฐานข้อมูล (เฉพาะ mode "all" เท่านั้นที่จะบันทึก amount)
              if (shop.slipCheckOption === "all") {
                qrDatabase.set(qrData, {
                    firstDetected: now,
                    amount: Amount,  // ✅ บันทึกจำนวนเงินเฉพาะ mode "all"
                    users: new Map([[userId, { lastSentTime: now, messageCount: 1 }]])
                });
              } else {
                qrDatabase.set(qrData, {
                    firstDetected: now,
                    users: new Map([[userId, { lastSentTime: now, messageCount: 1 }]])
                });
              }

              saveQRDatabaseToFile(prefix, qrDatabase);


            // ✅ อัปเดตจำนวนครั้งที่ส่งภาพสลิป
            userMessageCount.set(userId, {
                lastSentTime: now,
                qrMessageCount: userInfo.qrMessageCount + 1
            });

            const accountData = bankAccounts[prefix] || [];

            if (accountData.length === 0) {
          } else {
              // ✅ คัดเฉพาะบัญชีที่ active
              const activeAccounts = accountData.filter(account => account.status);

              if (activeAccounts.length === 0) {
                console.log("ข้ามการตรวจสอบบัญชี ไม่มได้ระบุบัญชีที่ใช้ตรวจสอบ.... ");
            } else {
          
                const receiverName = cleanReceiverName(data.receiver?.displayName || "");
                const receiverAccount = data.receiver?.account?.value || data.receiver?.proxy?.value || "ไม่ระบุ";
                let accountMatched = false;

                for (const account of activeAccounts) {
                    if (isNameMatch(receiverName, account)) {  // 🔥 เช็คชื่อ
                        console.log(`✅ ชื่อตรงกับบัญชี: ${account.THname} / ${account.ENGname}`);

                        if (isAccountNumberMatch(receiverAccount, account.account)) {  // 🔥 เช็คเลขบัญชี
                            console.log(`✅ หมายเลขบัญชีตรงกัน: ${receiverAccount}`);
                            accountMatched = true;
                            break;  // ✅ หยุดทันทีถ้าตรง
                        } else {
                            console.log(`❌ หมายเลขบัญชีไม่ตรงกับ: ${receiverAccount}`);
                        }
                    }
                }
          
                if (!accountMatched) {
                  console.log(`❌ ไม่พบชื่อหรือหมายเลขบัญชีที่ตรงกัน`);
                  updateSlipStats(prefix, "ตรวจสลิปปลายทางไม่ถูกต้องไปแล้ว", data.amount);
                  return;    
                }

                if (!isInternetConnected) {
                  return;
                }
              }
            }

            const fromBank = getBankName(data.sendingBank) || "ไม่ระบุ";
            const toBank = getBankName(data.receivingBank) || "ไม่ระบุ";
            const sendingBankIcon = getBankIconURL(data.sendingBank) || defaultBankIcon;
            const receivingBankIcon = getBankIconURL(data.receivingBank) || defaultBankIcon;
            const transactionDate = new Date(
                `${data.transDate.substring(0, 4)}-${data.transDate.substring(4, 6)}-${data.transDate.substring(6, 8)}T${data.transTime}`
            );
            const daysDifference = (Date.now() - transactionDate.getTime()) / (1000 * 60 * 60 * 24);
  
            const monthsThai = [
                "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
            ];
  
            const formattedTransactionDateTime = `${transactionDate.getDate()} ${
                monthsThai[transactionDate.getMonth()]
            } ${transactionDate.getFullYear() + 543} ${transactionDate.toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
            })}`;

            if (!isInternetConnected) {
              return;
            }

            console.log("Amount:", Amount);

            if (Amount < process.env.MINIMUM_AMOUNT) {
              console.log(`🟡 พบสลิปยอดเงินต่ำกว่ากำหนด จำนวน ${Amount} บาท ❕`);
              updateSlipStats(prefix, "ตรวจสลิปยอดเงินต่ำกว่าที่กำหนดไปแล้ว", Amount);
              return;
            }

            // ตรวจสอบวันที่เกิน 2 วัน
            if (daysDifference > 2) {
              console.log("🟡 พบสลิปย้อนหลังเกิน 2 วัน ❕");
              updateSlipStats(prefix, "ตรวจสลิปย้อนหลังไปแล้ว", Amount);
              return;
            }

            if (!isInternetConnected) {
              return;
            }
  
            // หากผ่านทุกการตรวจสอบ ตอบกลับว่า "สลิปถูกต้องและใหม่"
            console.log("🟢 สลิปถูกต้อง ✅");
            updateSlipStats(prefix, "ตรวจสลิปถูกต้องไปแล้ว", Amount);
            return;
          } else if (slipOKResponse.status === "Wait") {
            return;
          } else if (slipOKResponse.status === "timeout") {
            return;
          } else if (slipOKResponse.status === "ignored") {
            return;
          } else if (slipOKResponse.status === "error") {
            return;
          }

        } catch (error) {
          console.error(`Error processing event for PREFIX ${prefix}: ${error.message}`);
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


function loadBankAccounts() {
  try {
    const rawData = fs.readFileSync("./bank_accounts.json", "utf-8");
    const jsonData = JSON.parse(rawData);
    return jsonData.accounts || {}; // ✅ คืนค่ารายการบัญชี
  } catch (error) {
    console.error("❌ ไม่สามารถโหลด bank_accounts.json:", error.message);
    return {};
  }
}

const getActiveShops = () => {
  const banks = loadBankAccounts();
  let activeShops = [];

  if (!Array.isArray(shopData)) {
    console.error("❌ shopData ไม่ใช่ array:", shopData);
    shopData = [];
  }
  
  for (let shop of shopData) {
    if (shop.status) {
      const prefix = shop.prefix;
      const activeBanks = banks[prefix] ? banks[prefix].filter(bank => bank.status) : [];

      if (activeBanks.length > 0) {
        activeShops.push({
          name: shop.name,
          prefix: prefix,
          lines: shop.lines,
          banks: activeBanks
        });
      } else {
        console.warn(`⚠️ ร้าน ${shop.name} ไม่มีบัญชีธนาคารที่ใช้งานได้`);
      }
    }
  }
  return activeShops;
};

const activeShops = getActiveShops();
console.log("📌 ร้านค้าที่กำลังทำงาน:", JSON.stringify(activeShops, null, 2));

function getBankIconURL(bankCode) {
  if (!bankCode || bankCode.trim() === "") {
    return "";
  }
  return bankCodeMapping[bankCode]?.iconUrl || ""; 
}

function getBankName(bankCode) {
  if (!bankCode || bankCode.trim() === "") {
    return ""; 
  }
  return bankCodeMapping[bankCode]?.fullName || "ไม่ระบุ";
}


function setCorrectSignature(channelSecret) {
  return (req, res, next) => {
    // req.body เป็น Buffer เพราะเราใช้ express.raw()
    const computedSignature = crypto
      .createHmac("sha256", channelSecret)
      .update(req.body)
      .digest("base64");
    req.headers["x-line-signature"] = computedSignature;
    next();
  };
}

let webhookRoutes = [];


function restartWebhooks() {

  // 📌 ลบ Webhook เดิมที่เคยสร้าง
  webhookRoutes.forEach(route => {
    app._router.stack = app._router.stack.filter(layer => !(layer.route && layer.route.path === route));
  });

  webhookRoutes = [];
    // สร้าง webhook endpoint สำหรับแต่ละบัญชี LINE
    shopData.forEach((shop) => {
      shop.lines.forEach((lineAccount, index) => {
          const prefix = shop.prefix; 
          const lineConfig = {
              channelAccessToken: String(lineAccount.access_token),
              channelSecret: String(lineAccount.secret_token)
          };
        const client = new line.Client(lineConfig);
        const route = `/${shop.prefix}/line${index + 1}.bot`;
        app.post(
          route,
          express.raw({ type: "application/json" }),
          setCorrectSignature(lineConfig.channelSecret),
          line.middleware(lineConfig),
          async (req, res) => {
            // หลังจาก LINE middleware ผ่านการตรวจสอบแล้ว,
            // req.body จะมี key "events" ที่เป็น array ของ event
            const events = req.body.events || [];
            // ส่งต่อ event เหล่านี้ไปยังฟังก์ชัน handleEvent เพื่อประมวลผลต่อ
            await Promise.all(events.map((event) => handleEvent(event, client, prefix)));
            res.status(200).send("OK");
          }
        );
        console.log(`✅ Webhook สำหรับร้าน ${prefix} ที่ ${route}`);
      });
    });
  }


axios.get("http://127.0.0.1:5000/status")
  .then(() => {
    console.log("🟢 GUI ทำงานอยู่, เริ่มโหลด Webhook...");
    restartWebhooks(); // ✅ โหลด Webhooks ทันที
  })
  .catch(() => {
    console.log("🔴 GUI ยังไม่เปิด, กำลังเปิด GUI...");

    const guiProcess = exec("python multi_bot_gui.py", { windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ เกิดข้อผิดพลาดในการเปิด GUI: ${error.message}`);
            return;
        }
        console.log(`✅ GUI ทำงาน: ${stdout}`);
    });

    guiProcess.unref(); 

    setTimeout(() => {
        console.log("🟢 GUI เปิดแล้ว, เริ่มโหลด Webhook...");
        restartWebhooks(); // ✅ โหลด Webhooks ทันทีหลังจาก GUI เปิด
    }, 3000);
});

// ✅ ให้บอทรันที่พอร์ตเดียวกัน
const PORT = process.env.PORT || 5000;
const startProgram = async () => {
  const isConnected = await checkInternetConnection();
  if (!isConnected) isPaused = true;

  app.listen(PORT, () => {
    console.log(`🚀 Server ทำงานที่พอร์ต ${PORT}`);
  });
};

startProgram();
