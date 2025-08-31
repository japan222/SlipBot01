// mongo.js
import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";

const envPath = path.join(process.cwd(), "info.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  } catch (err) {
    console.error("❌ Mongoose connection failed:", err.message);
  }
}

export default mongoose; // ✅ เพิ่มบรรทัดนี้