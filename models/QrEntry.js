// models/QrEntry.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: String,
  lastSentTime: Number,
  messageCount: Number
}, { _id: false });

const qrEntrySchema = new mongoose.Schema({
  prefix: String,          // รหัสร้าน
  qrData: String,          // ค่าจาก QR
  firstDetected: Number,
  amount: Number,
  users: [userSchema],      // รายการ user ที่เคยส่ง
  firstSent: {
  type: Date,
  default: Date.now,
  expires: 60 * 60 * 24 * 5 // ลบหลัง 5 วัน (หน่วยวินาที)
  }
});

export default mongoose.model("QrEntry", qrEntrySchema);