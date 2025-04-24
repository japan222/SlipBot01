// models/SlipStats.js
import mongoose from "mongoose";

const statSchema = new mongoose.Schema({
  prefix: String,        // เช่น JPN
  category: String,      // เช่น "ตรวจสลิปปลายทางไม่ถูกต้องไปแล้ว"
  amount: Number
});

export default mongoose.model("SlipStats", statSchema);