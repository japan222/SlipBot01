// regularSlipChecker.js
import { sendMessageRight } from "../../reply/right_reply.js";
import { sendMessageWait } from "../../reply/text_reply.js";
import { sendMessageOld } from "../../reply/oldpic_reply.js";
import { sendMessageWrong } from "../../reply/wrong_reply.js";
import { sendMessageMinimum } from "../../reply/minimum_reply.js";
import { sendImageToSlip2Go } from "./slipService.js"; 
import { saveQRDatabaseToFile } from "../../utils/qrData.js";
import bankCodeMapping from "../../utils/bankCodeMapping.js";
import { updateSlipStats } from "../../utils/slipStatsManager.js";
import { reportSlipResultToAPI } from "../../utils/slipStatsManager.js";
import { broadcastLog } from "../../index.js";
import { isAccountNumberMatch } from "../../utils/accountUtils.js";
import BankAccount from "../../models/BankAccount.js";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js'; 

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

dayjs.extend(utc);
dayjs.extend(timezone);

export async function handleRegularSlip(
  client,
  messageId,
  replyToken,
  prefix,
  qrDatabase,
  qrData,
  userId,
  lineName,     // <--- ตรงนี้กำลังรอรับ lineName
  image,        // <--- รอรับ image
  linename,     // <--- รอรับ linename
  tranRef,     // <--- รอรับ tranRef
  isNew,
  replyInfo
) {
  try {
    const now = Date.now();
    const Slip2GoResponse = await sendImageToSlip2Go(client, messageId);
    const bankList = await BankAccount.find({ prefix });

    const thaiTime = dayjs().tz("Asia/Bangkok").format("HH:mm") + " น.";
    if (Slip2GoResponse.status === "valid") {
    const data = Slip2GoResponse.data?.data;
        if (!data || data.amount == null) return { amount: undefined };
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

        if (bankList.length === 0) {
          console.log("ไม่มีบัญชีในร้านนี้");
          broadcastLog("ไม่มีบัญชีในร้านนี้");
        } else {
          const activeAccounts = bankList.filter(acc => acc.status === true); // ✅ คัดเฉพาะบัญชีที่เปิด
      
              if (activeAccounts.length === 0) {
                console.log("ข้ามการตรวจสอบบัญชี ไม่มีบัญชีที่เปิดใช้ในการตรวจสอบ.... ");
                broadcastLog("ข้ามการตรวจสอบบัญชี ไม่มีบัญชีที่เปิดใช้ในการตรวจสอบ.... ");
              } else {
                const receiverAccount = data.receiver?.account?.bank?.account || "ไม่ระบุ";
                let accountMatched = false;
            
                for (const account of activeAccounts) {
                  console.log(`✅ กำลังตรวจสอบบัญชี: ${receiverAccount} กับ ${account.account}`);
                  broadcastLog(`✅ กำลังตรวจสอบบัญชี: ${receiverAccount} กับ ${account.account}`);
                  if (isAccountNumberMatch(receiverAccount, account.account)) {
                    console.log(`🎯 หมายเลขบัญชีตรงกับ: ${receiverAccount}`);
                    broadcastLog(`🎯 หมายเลขบัญชีตรงกับ: ${receiverAccount}`);
                    accountMatched = true;
                    break;
                  } else {
                    console.log(`❌ หมายเลขบัญชีไม่ตรงกับ: ${receiverAccount}`);
                    broadcastLog(`❌ หมายเลขบัญชีไม่ตรงกับ: ${receiverAccount}`);
                  }
                }

                if (!accountMatched) {
                  console.log(`🔴 พบสลิปบัญชีปลายทางไม่ถูกต้อง ❌`);
                  broadcastLog(`🔴 พบสลิปบัญชีปลายทางไม่ถูกต้อง ❌`);
                  updateSlipStats(prefix, "ตรวจสลิปปลายทางไม่ถูกต้องไปแล้ว", data.amount);
                  await sendMessageWrong(replyToken, client,
                    tranRef, data.amount, data.sender?.account?.name || "ไม่ระบุ",
                    data.sender?.account?.bank?.account || "ไม่ระบุ",
                    data.receiver?.account?.name || "ไม่ระบุ",
                    data.receiver?.account?.bank?.account || "ไม่ระบุ"
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

            const fromBank = data.sender.bank?.name || "ไม่ระบุ";
            const toBank = data.receiver.bank?.name || "ไม่ระบุ";
            const transactionDate = dayjs(data.dateTime).tz("Asia/Bangkok");

            const daysDifference = dayjs().tz("Asia/Bangkok").diff(transactionDate, 'day');

            const timeOnly = transactionDate.format("HH:mm") + " น.";

            // วันที่ + เดือน + ปีไทย
            const monthsThai = [
              "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
              "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
            ];

            const formattedTransactionDateTime = `${transactionDate.date()} ${
              monthsThai[transactionDate.month()]
            } ${transactionDate.year() + 543} ${timeOnly}`;
            
            if (Amount < process.env.MINIMUM_AMOUNT) {
              console.log(`🟡 พบสลิปยอดเงินต่ำกว่ากำหนด จำนวน ${Amount} บาท ❕`);
              broadcastLog(`🟡 พบสลิปยอดเงินต่ำกว่ากำหนด จำนวน ${Amount} บาท ❕`);
              updateSlipStats(prefix, "ตรวจสลิปยอดเงินต่ำกว่าที่กำหนดไปแล้ว", Amount);
              await sendMessageMinimum(replyToken,client,formattedTransactionDateTime,
                tranRef,data.amount,data.sender?.account?.name || "ไม่ระบุ",
                fromBank ,data.sender?.account?.bank?.account || "ไม่ระบุ",
                data.receiver?.account?.name || "ไม่ระบุ",
                data.receiver?.account?.bank?.account || "ไม่ระบุ"
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
                tranRef,data.amount,data.sender?.account?.name || "ไม่ระบุ",
                fromBank, data.sender?.account?.bank?.account || "ไม่ระบุ",
                data.receiver?.account?.name || "ไม่ระบุ", toBank,
                data.receiver?.account?.bank?.account || "ไม่ระบุ"
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

            // ตอบกลับหลัก
            await sendMessageRight(
              replyToken,
              client,
              formattedTransactionDateTime,
              tranRef,
              data.amount,
              data.sender?.account?.name || "ไม่ระบุ",
              fromBank,
              data.sender?.account?.bank?.account || "ไม่ระบุ",
              data.receiver?.account?.name || "ไม่ระบุ",
              toBank,
              data.receiver?.account?.bank?.account || "ไม่ระบุ"
            );

            // ตอบข้อความ info เพิ่ม หากเป็นลูกค้าใหม่
            if (isNew && replyInfo) {
              await client.pushMessage(userId, {
                type: 'text',
                text: replyInfo
              });
            }

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
            if (Slip2GoResponse.status === "Wait") {
              const thaiTime = dayjs().tz("Asia/Bangkok").format("HH:mm") + " น.";
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
          
            if (Slip2GoResponse.status === "timeout") {
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
          
            if (Slip2GoResponse.status === "ignored" || Slip2GoResponse.status === "error") {
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


