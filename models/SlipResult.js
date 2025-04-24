// models/SlipResult.js
import mongoose from "mongoose";

const slipResultSchema = new mongoose.Schema({
  shop: String,
  lineName: String,
  image: String,
  status: String,
  response: String,
  amount: Number,
  ref: String,
  time: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 86400 } // ลบทิ้งอัตโนมัติใน 24 ชม.
  }
});

export default mongoose.models.SlipResult || mongoose.model("SlipResult", slipResultSchema);
