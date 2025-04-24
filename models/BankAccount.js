import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema({
  prefix: { type: String, required: true },
  name: { type: String, required: true },
  account: { type: String, required: true },
  status: { type: Boolean, default: false }
});

export default mongoose.model("BankAccount", bankAccountSchema);