import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Setting from "../models/Setting.js";

const envPath = path.join(process.cwd(), "info.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const FILE_PATH = path.join(process.cwd(), "config", "settings.json");

async function migrateSettings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    if (!fs.existsSync(FILE_PATH)) {
      console.error("❌ settings.json not found");
      return;
    }

    const settingsData = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));

    await Setting.findOneAndUpdate(
      { key: "global-settings" },
      { $set: { value: settingsData } },
      { upsert: true }
    );

    console.log("✅ settings.json uploaded to MongoDB");
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrateSettings();
