// models/Setting.js
import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },   // เช่น "global-settings"
  value: { type: Object, required: true }                // ค่า settings เป็น object
}, { collection: "settings" });

export default mongoose.model("Setting", settingSchema);