// models/Shop.js
import mongoose from "mongoose";

const LineSchema = new mongoose.Schema({
    linename: String,
    channel_id: String,
    access_token: String,
    secret_token: String,
}, { _id: false });

const ShopSchema = new mongoose.Schema({
  name: String,
  prefix: String,
  lines: [LineSchema],
  status: Boolean,
  slipCheckOption: String,
});

export default mongoose.model("Shop", ShopSchema);