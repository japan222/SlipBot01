// savePhoneNumber.js
import PhoneLog from '../models/Phone.js'; // path อาจต้องปรับตามโปรเจกต์คุณ

// ✅ ดึงรายชื่อลูกค้าทั้งหมด (ของทุก prefix)
export async function getCustomerList() {
  try {
    return await PhoneLog.find({});
  } catch (err) {
    console.error("❌ อ่านข้อมูลจาก MongoDB ไม่สำเร็จ:", err);   
    return [];
  }
}

// ✅ ตรวจสอบว่าเป็นลูกค้าใหม่หรือไม่ (ตาม userId)
export async function isNewCustomer(userId) {
  try {
    const found = await PhoneLog.findOne({ userId });
    return !found;
  } catch (err) {
    console.error("❌ ตรวจสอบลูกค้าใหม่ล้มเหลว:", err);
    return false;
  }
}

// ✅ ตรวจจับและบันทึกเบอร์โทรใหม่ลง MongoDB พร้อม prefix
export async function checkAndSavePhoneNumber(text, userId, prefix) {
  const phoneMatch = text.match(/\b(06|08|09)\d{8}\b/);
  if (!phoneMatch) return;

  const phoneNumber = phoneMatch[0];

  try {
    const existing = await PhoneLog.findOne({ userId });
    if (existing) return;

    const newLog = new PhoneLog({ userId, phoneNumber, prefix });
    await newLog.save();

    console.log(`✅ เพิ่มลูกค้าใหม่: ${userId} (${phoneNumber}) [${prefix}]`);
  } catch (err) {
    console.error('❌ บันทึกเบอร์โทรไม่สำเร็จ:', err);
  }
}