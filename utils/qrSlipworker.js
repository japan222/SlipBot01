import { createCanvas, loadImage } from "canvas";
import jsQR from "jsqr";

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

// ✅ แปลง stream เป็น Buffer
const streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
};

// ✅ ฟังก์ชันสแกน QR Code
const scan_qr_code = async (buffer) => {
  try {
    const image = await loadImage(buffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, image.width, image.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const qrPromise = new Promise((resolve) => {
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
      resolve(qrCode ? qrCode.data : null);
    });

    const qrData = await Promise.race([qrPromise]);

    // ✅ กรองเฉพาะ QR Code ที่เป็นสลิปธนาคาร
    if (qrData && isBankSlipQR(qrData)) {
      return qrData;
    } else {
      return null;
    }
  } catch (error) {
    console.error("🚨 เกิดข้อผิดพลาดในการสแกน QR Code:", error.message);
    return null;
  }
};

export { scan_qr_code, streamToBuffer };