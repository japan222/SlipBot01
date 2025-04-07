// regularSlipChecker.js
import { sendMessageRight } from "../reply/right_reply.js";
import { sendMessageWait } from "../reply/text_reply.js";
import { sendMessageOld } from "../reply/oldpic_reply.js";
import { sendMessageWrong } from "../reply/wrong_reply.js";
import { sendMessageMinimum } from "../reply/minimum_reply.js";
import { sendImageToSlipOK } from "./slipService.js"; 
import { saveQRDatabaseToFile } from "../qrdata/qrData.js";
import bankCodeMapping from "../utils/bankCodeMapping.js";
import { updateSlipStats } from "../utils/slipStatsManager.js";
import { reportSlipResultToAPI } from "../utils/slipStatsManager.js";
import { broadcastLog } from "../index.js";
import { isAccountNumberMatch } from "../utils/accountUtils.js";

/**
 * ฟังก์ชันสำหรับตรวจสอบสลิปแบบปกติ
 * @param {object} client - LINE client สำหรับส่งข้อความตอบกลับ
 * @param {string} messageId - รหัสข้อความสำหรับดึงเนื้อหารูป
 * @param {string} replyToken - reply token สำหรับตอบกลับ LINE
 * @param {string} prefix - รหัสร้าน (ใช้ในการบันทึกข้อมูล)
 * @param {Map} qrDatabase - ฐานข้อมูล QR Code
 * @param {string} qrData - ข้อมูล QR ที่สแกนได้
 * @param {string} userId - รหัสผู้ใช้ที่ส่งสลิป
 */


export async function handleRegularSlip(
  client,
  messageId,
  replyToken,
  prefix,
  qrDatabase,
  qrData,
  userId,
  userMessageCount, // ✅ เพิ่มเข้ามา
  userInfo,
  bankAccounts, // ✅ รับเข้ามา
  lineName,
  image,
  linename,
  tranRef
) {
  try {
    const now = Date.now();
    const slipOKResponse = await sendImageToSlipOK(client, messageId);

    const thaiTime = new Date(now).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok"
    }) + " น.";

    if (slipOKResponse.status === "valid") {
      const data = slipOKResponse.data;
      if (!data) return { amount: undefined };
        const Amount = data.amount;
        console.log(`💰 จำนวนเงินในสลิป: ${Amount} บาท`);
        broadcastLog(`💰 จำนวนเงินในสลิป: ${Amount} บาท`);

      // หากไม่ได้รับ Amount (กรณี SlipOK error, timeout, ฯลฯ)
      if (Amount === undefined || Amount === null) {
        return { amount: undefined };
      }

      // สร้าง entry สำหรับ QR code นี้
      const qrEntry = {
        firstDetected: now,
        users: new Map([[userId, { lastSentTime: now, messageCount: 1 }]])
      };

      qrEntry.amount = Amount;

      qrDatabase.set(qrData, qrEntry);
      saveQRDatabaseToFile(prefix, qrDatabase);

            const accountData = bankAccounts[prefix] || [];

            if (accountData.length === 0) {
            } else {
              const activeAccounts = accountData.filter(account => account.status === true);
            
              if (activeAccounts.length === 0) {
                console.log("ข้ามการตรวจสอบบัญชี ไม่มีบัญชีที่ใช้ตรวจสอบ.... ");
              } else {
                const receiverAccount = data.receiver?.account?.value || data.receiver?.proxy?.value || "ไม่ระบุ";
                let accountMatched = false;
            
                for (const account of activeAccounts) {
                  console.log(`✅ กำลังตรวจสอบบัญชี: ${receiverAccount} กับ ${account.account}`);
                  if (isAccountNumberMatch(receiverAccount, account.account)) {
                    console.log(`🎯 หมายเลขบัญชีตรงกับ: ${receiverAccount}`);
                    accountMatched = true;
                    break; // ✅ หยุดทันทีเมื่อเจอเลขบัญชีที่ตรงกัน
                  } else {
                    console.log(`❌ หมายเลขบัญชีไม่ตรงกับ: ${receiverAccount}`);
                  }
                }

                if (!accountMatched) {
                  console.log(`🔴 พบสลิปบัญชีปลายทางไม่ถูกต้อง ❌`);
                  broadcastLog(`🔴 พบสลิปบัญชีปลายทางไม่ถูกต้อง ❌`);
                  updateSlipStats(prefix, "ตรวจสลิปปลายทางไม่ถูกต้องไปแล้ว", data.amount);
                  await sendMessageWrong(replyToken, client,
                    tranRef, data.amount, data.sender?.displayName || "ไม่ระบุ",
                    data.sender?.account.value || data.sender?.proxy.value,
                    data.receiver?.displayName || "ไม่ระบุ",
                    data.receiver?.account.value || data.receiver?.proxy.value
                  );
                  await reportSlipResultToAPI({
                    time: thaiTime,
                    shop: linename,
                    lineName,
                    image,
                    status: "บัญชีปลายทางผิด",
                    response: "ตอบกลับแล้ว",
                    amount: Amount,
                    ref: data.qrcodeData
                  });
                  return { amount: Amount };
                }
            }
          }

            const fromBank = getBankName(data.sendingBank) || "ไม่ระบุ";
            const toBank = getBankName(data.receivingBank) || "ไม่ระบุ";
            const transactionDate = new Date(
              `${data.transDate.slice(0, 4)}-${data.transDate.slice(4, 6)}-${data.transDate.slice(6, 8)}T${data.transTime}+07:00`
            );

            const daysDifference = (now - transactionDate.getTime()) / (1000 * 60 * 60 * 24);

            const timeOnly = transactionDate.toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: "Asia/Bangkok"
            }) + " น.";
  
            const monthsThai = [
                "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
            ];

            const formattedTransactionDateTime = `${transactionDate.getDate()} ${
              monthsThai[transactionDate.getMonth()]
            } ${transactionDate.getFullYear() + 543} ${timeOnly}`;
            
            if (Amount < process.env.MINIMUM_AMOUNT) {
              console.log(`🟡 พบสลิปยอดเงินต่ำกว่ากำหนด จำนวน ${Amount} บาท ❕`);
              broadcastLog(`🟡 พบสลิปยอดเงินต่ำกว่ากำหนด จำนวน ${Amount} บาท ❕`);
              updateSlipStats(prefix, "ตรวจสลิปยอดเงินต่ำกว่าที่กำหนดไปแล้ว", Amount);
              await sendMessageMinimum(replyToken,client,formattedTransactionDateTime,
                tranRef,data.amount,data.sender?.displayName || "ไม่ระบุ",
                fromBank ,data.sender?.account.value || data.sender?.proxy.value,
                data.receiver?.displayName || "ไม่ระบุ", toBank,
                data.receiver?.account.value || data.receiver?.proxy.value
              );
              await reportSlipResultToAPI({
                time: thaiTime,
                shop: linename,
                lineName,
                image,
                status: "สลิปยอดเงินต่ำ",
                response: "ตอบกลับแล้ว",
                amount: Amount,
                ref: data.qrcodeData
              });
              return { amount: Amount };
            }

            // ตรวจสอบวันที่เกิน 2 วัน
            if (daysDifference > 2) {
              console.log("🟡 พบสลิปย้อนหลังเกิน 2 วัน ❕");
              broadcastLog("🟡 พบสลิปย้อนหลังเกิน 2 วัน ❕");
              updateSlipStats(prefix, "ตรวจสลิปย้อนหลังไปแล้ว", Amount);
              await sendMessageOld(replyToken,client,formattedTransactionDateTime,
                tranRef,data.amount,data.sender?.displayName || "ไม่ระบุ",
                fromBank, data.sender?.account.value || data.sender?.proxy.value,
                data.receiver?.displayName || "ไม่ระบุ", toBank,
                data.receiver?.account.value || data.receiver?.proxy.value
              );
              await reportSlipResultToAPI({
                time: thaiTime,
                shop: linename,
                lineName,
                image,
                status: "สลิปย้อนหลัง",
                response: "ตอบกลับแล้ว",
                amount: Amount,
                ref: data.qrcodeData
              });
              return { amount: Amount };
            }
  
            // หากผ่านทุกการตรวจสอบ ตอบกลับว่า "สลิปถูกต้องและใหม่"
            console.log("🟢 สลิปถูกต้อง ✅");
            broadcastLog("🟢 สลิปถูกต้อง ✅");
            updateSlipStats(prefix, "ตรวจสลิปถูกต้องไปแล้ว", Amount);
            await sendMessageRight(replyToken,client,formattedTransactionDateTime,
              tranRef,data.amount,data.sender?.displayName || "ไม่ระบุ",
              fromBank, data.sender?.account.value || data.sender?.proxy.value,
              data.receiver?.displayName || "ไม่ระบุ", toBank,
              data.receiver?.account.value || data.receiver?.proxy.value
            );
            await reportSlipResultToAPI({
              time: thaiTime,
              shop: linename,
              lineName,
              image,
              status: "สลิปถูกต้อง",
              response: "ตอบกลับแล้ว",
              amount: Amount,
              ref: data.qrcodeData
            });
            return { amount: Amount };
          }        
            if (slipOKResponse.status === "Wait") {
              const errorMessage = slipOKResponse?.data || "ไม่สามารถตรวจสอบได้";
              const thaiTime = new Date(now).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "Asia/Bangkok"
              }) + " น.";
              console.log("⏱️ สถานะ: รอตรวจสอบ");
              broadcastLog("⏱️ สถานะ: รอตรวจสอบ");
              await sendMessageWait(replyToken, client);
              await reportSlipResultToAPI({
                time: thaiTime,
                shop: linename,
                lineName,
                image,
                status: "เกิดข้อผิดพลาดระหว่างตรวจสอบ รอแอดมินตรวจสอบ",
                response: "ตอบกลับ '' รอสักครู่ ''",
                amount: undefined,
                ref: qrData
              });
              return { amount: undefined };
            }
          
            if (slipOKResponse.status === "timeout") {
              console.log("⏱️ สถานะ: ใช้เวลาตรวจสอบนานเกินไป");
              broadcastLog("⏱️ สถานะ: ใช้เวลาตรวจสอบนานเกินไป");
              await sendMessageWait(replyToken, client);
              await reportSlipResultToAPI({
                time: thaiTime,
                shop: linename,
                lineName,
                image,
                status: "ใช้เวลาตรวจสอบนานเกินไป",
                response: "ตอบกลับ '' รอสักครู่ ''",
                amount: undefined,
                ref: qrData
              });
              return { amount: undefined };
            }
          
            if (slipOKResponse.status === "ignored" || slipOKResponse.status === "error") {
              await reportSlipResultToAPI({
                time: thaiTime,
                shop: linename,
                lineName,
                image,
                status: "เกิดข้อผิดพลาดระหว่างตรวจสอบ รอแอดมินตรวจสอบ",
                response: "ไม่ได้ตอบกลับ",
                amount: undefined,
                ref: qrData
              });
              return { amount: undefined };
            }
          
          } catch (err) {
            console.error(`❌ เกิดข้อผิดพลาดในการตรวจสอบสลิป: ${err.message}`);
            broadcastLog(`❌ เกิดข้อผิดพลาดในการตรวจสอบสลิป: ${err.message}`);
            return { amount: undefined };
          }
        }

function getBankName(bankCode) {
  if (!bankCode || bankCode.trim() === "") {
    return ""; 
  }
  return bankCodeMapping[bankCode]?.fullName || "ไม่ระบุ";
}


