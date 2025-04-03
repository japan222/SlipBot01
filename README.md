# 🧾 SlipChecker - Multi LINE Bot Slip Verification System

SlipChecker เป็นระบบตรวจสอบสลิปอัตโนมัติผ่าน LINE ที่สามารถรองรับหลายบัญชี LINE พร้อม Web Dashboard, การบันทึกผล, การจัดการร้านค้า, และการแสดง log แบบเรียลไทม์

---

## 🔧 ฟีเจอร์หลัก

- รองรับหลายร้านค้า/หลายบัญชี LINE
- ตรวจสอบสลิปผ่าน QR Code ด้วย SlipOK
- ระบบจัดการร้านค้า (เพิ่ม/แก้ไข/ลบ LINE Account)
- Web Dashboard สำหรับดูผลลัพธ์แบบเรียลไทม์ (ผ่าน Server-Sent Events)
- ระบบล็อกอิน + จัดการ session admin
- ตั้งค่าจำกัดจำนวนข้อความ / ตรวจซ้ำ / จำนวนคิว
- Log viewer เรียลไทม์ผ่าน `/logs`

---

## 🚀 วิธีใช้งานเบื้องต้น

### 1. Clone Repo

```bash
git clone https://github.com/<your-user>/SlipChecker.git
cd SlipChecker
