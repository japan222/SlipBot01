import jsQR from "jsqr";
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from "fs";
import { createWorker } from "tesseract.js";

// ✅ keywords ที่พบบ่อยในภาพสลิปธนาคาร
const keywords = [
    // กลุ่ม 1: คำเกี่ยวกับสถานะการโอน
    "โอนเงินสำเร็จ", "ทำรายการสำเร็จ", "รายการสำเร็จ", "ดำเนินการเสร็จสิ้น", "จำนวนเงิน",
    "successful", "transaction completed", "transaction success", "transaction successful", "transfer complete", "completed",
  
    // กลุ่ม 2: ข้อมูลการทำรายการ
    "reference", "ref", "transref", "transaction id", "รหัสอ้างอิง", "เลขอ้างอิง", "เลขที่รายการ", "รหัสที่รายการ", "รหัสธุรกรรม",
    "จำนวนเงิน", "ยอดเงิน", "ยอดโอน", "ค่าธรรมเนียม",
  
    // กลุ่ม 3: ผู้โอน / ผู้รับ / บัญชี
    "จาก", "ไปยัง", "ถึง", "ผู้โอน", "ผู้รับ", "ชื่อบัญชี", "เลขที่บัญชี", "เลขบัญชี", "บัญชีธนาคาร", "ชื่อผู้รับ", "ผู้รับเงิน",
    "from", "to", "beneficiary", "sender", "receiver", "account name", "account holder", "account number",
    "a/c number", "bank account", "recipient", "withdrawer", "amount", "total amount",
    "transaction amount", "transfer amount", "payment amount", "total payment", "fee",

    // กลุ่ม 4: เวลา / วันที่
    "วันที่", "เวลา", "วันที่ทำรายการ", "วันเวลาทำรายการ", "วันและเวลา",
  
    // กลุ่ม 5: ชื่อธนาคาร
    "scb", "ไทยพาณิชย์", "kbank", "กสิกรไทย", "krungthai", "กรุงไทย", "กรุงเทพ", "bangkok bank",
    "ttb", "tmb", "ธนชาต", "ธนาคาร", "ออมสิน", "gsb", "uob", "citi", "ktb", "bay", "cimb", "กรุงศรี",
  
    // กลุ่ม 6: คำที่มักอยู่บนสลิป / ระบบ Mobile Banking
    "slip", "verified", "qr", "คิวอาร์โค้ด", "สแกนตรวจสอบสลิป", "ตรวจสอบสถานะ", "mobile banking", "online banking", "ibanking",
    "my mo", "krungthai next", "k plus", "scb easy", "tmb touch", "krungsri", "next app", "kbank app",
    "ภาพสลิป",
  ];

// ✅ OCR: อ่านข้อความจากภาพ
async function extractTextFromImage(buffer) {
    const worker = await createWorker("tha+eng");
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    return text.toLowerCase();
  }

// ✅ แปลง stream เป็น Buffer (สำรองไว้ใช้กรณีพี่ใช้ stream ภายนอก)
const streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
};

// ✅ ตรวจสอบว่าเป็น QR Code สำหรับการชำระเงินหรือไม่
function isPaymentQR(qrData) {
  const hasPaymentTag = qrData.includes("A0000006770101"); // ใช้ใน PromptPay
  const hasCurrencyTag = qrData.includes("5303764"); // 764 = Thai Baht
  return hasPaymentTag || hasCurrencyTag;
}

// ✅ ตรวจสอบว่าเป็น QR Code ของสลิปธนาคารหรือไม่
function isBankSlipQR(qrData) {
  if (isPaymentQR(qrData)) return false;
  const hasTH91 = qrData.includes("TH91");
  const hasNoURL = !qrData.includes("http://") && !qrData.includes("https://");
  const isValidLength = qrData.length >= 30 && qrData.length <= 80;
  const qrPattern = /^[0-9A-Za-z]{10,}TH91[0-9A-Za-z]{5,}$/;
  return hasTH91 && hasNoURL && isValidLength && qrPattern.test(qrData);
}

// ✅ ฟังก์ชันสแกน QR Code จากภาพ
const scan_qr_code = async (buffer) => {
  try {
    const image = await loadImage(buffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, image.width, image.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
    const qrData = qrCode ? qrCode.data : null;

    return qrData && isBankSlipQR(qrData) ? qrData : null;
  } catch (error) {
    console.error("🚨 เกิดข้อผิดพลาดในการสแกน QR Code:", error.message);
    return null;
  }
};

// ✅ วิเคราะห์ภาพตามที่พี่ต้องการ
async function analyzeSlipImage(buffer) {
  const text = await extractTextFromImage(buffer);
  const matchedKeywords = keywords.filter((k) => text.includes(k.toLowerCase()));
  const keywordCount = matchedKeywords.length;

  if (keywordCount >= 3) {
    const qrData = await scan_qr_code(buffer);
    if (qrData && isBankSlipQR(qrData)) {
      return qrData; // ✅ เงื่อนไข 1
    } else {
      return { suspicious: true }; // ✅ เงื่อนไข 2
    }
  } else {
    return null; // ✅ เงื่อนไข 3
  }
}

export { analyzeSlipImage, streamToBuffer };