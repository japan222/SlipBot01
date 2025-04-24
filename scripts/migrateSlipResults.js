// scripts/migrateSlipResults.js
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: `${process.cwd()}/info.env` });

const slipFile = path.join(process.cwd(), "utils/dataSlip/slip_results.json");
const slipSchema = new mongoose.Schema({}, { strict: false });
const SlipResult = mongoose.model("SlipResult", slipSchema, "slipresults");

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  const raw = fs.readFileSync(slipFile, "utf-8");
  const slips = JSON.parse(raw);

  for (const slip of slips) {
    if (!slip.createdAt) slip.createdAt = new Date();
    await SlipResult.updateOne(
      { ref: slip.ref },
      { $set: slip },
      { upsert: true }
    );
  }

  console.log(`✅ migrated ${slips.length} slip results`);
  await mongoose.disconnect();
}

migrate().catch((err) => console.error("❌ migrate failed:", err));
