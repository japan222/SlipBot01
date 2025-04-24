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
  users: [userSchema]      // รายการ user ที่เคยส่ง
});

export default mongoose.model("QrEntry", qrEntrySchema);