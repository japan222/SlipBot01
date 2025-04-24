import mongoose from "mongoose";

const qrRecordSchema = new mongoose.Schema({
  prefix: { type: String, required: true },
  qrData: { type: String, required: true },
  firstDetected: { type: Date, required: true },
  amount: { type: Number, default: 0 },
  users: { type: Map, of: new mongoose.Schema({
    lastSentTime: Number,
    messageCount: Number
  }) }
});

qrRecordSchema.index({ prefix: 1, qrData: 1 }, { unique: true }); // ✅ ป้องกันซ้ำ

export default mongoose.model("QRRecord", qrRecordSchema);