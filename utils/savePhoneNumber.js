//savePhoneNumber.js
import fs from 'fs';
import path from 'path';

const customerPath = path.join('logs', 'phones.json');

export function getCustomerList() {
  if (!fs.existsSync(customerPath)) return [];
  try {
    const data = fs.readFileSync(customerPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("❌ อ่านไฟล์ phones.json ไม่สำเร็จ:", err);
    return [];
  }
}

export function isNewCustomer(userId) {
  const customers = getCustomerList();
  return !customers.some(c => c.userId === userId);
}

// ฟังก์ชันเดิมสำหรับบันทึกเบอร์โทร
export function checkAndSavePhoneNumber(text, userId) {
  const phoneMatch = text.match(/\b(06|08|09)\d{8}\b/);
  if (!phoneMatch) return;

  const phoneNumber = phoneMatch[0];
  const customers = getCustomerList();

  if (!customers.some(c => c.userId === userId)) {
    customers.push({ userId, phoneNumber });
    try {
      fs.writeFileSync(customerPath, JSON.stringify(customers, null, 2));
      console.log(`✅ เพิ่มลูกค้าใหม่: ${userId} (${phoneNumber})`);
    } catch (err) {
      console.error('❌ บันทึกเบอร์โทรไม่สำเร็จ:', err);
    }
  }
}
