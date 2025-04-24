// mongo.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: `${process.cwd()}/info.env` });

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