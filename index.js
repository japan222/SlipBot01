// index.js
import express from "express";
import * as line from "@line/bot-sdk";
import session from "express-session"; // สำหรับจัดการ session
import { validateAccessToken } from "./utils/lcf.js"; // แยกฟังก์ชันออกไปอยู่ไฟล์อื่น
import path from "path";
import { fileURLToPath } from "url";
import credentials from "./credentials.js";
import * as crypto from "crypto";
import { handleEvent } from "./handlers/duplicateSlipHandler.js";
import { loadSettings, saveSettings, reloadSettings } from './utils/settingsManager.js';
import BankAccount from "./models/BankAccount.js";
import Shop from "./models/Shop.js";
import dotenv from "dotenv";
import SlipResult from "./models/SlipResult.js"; // เพิ่มตรงนี้
import SlipStat from "./models/SlipStats.js"; 

dotenv.config({ path: `${process.cwd()}/info.env` }); // ← มาโหลดตรงนี้ช้าไปแล้ว

import { connectDB } from "./mongo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const clients = [];
const MAX_LOGS = 200;
const logHistory = [];
const logClients = [];

// ✅ ตั้ง session ไว้ก่อนเสมอ
app.use(session({
  secret: 'a8f5f167f44f4964e6c998dee827110c!@#QWEasd987',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 ชั่วโมง
}));

// ✅ ป้องกัน cache
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// ✅ Static ที่ไม่ต้อง login
app.use(express.static("public")); // สำหรับ login.html
app.use("/views/css", express.static(path.join(__dirname, "views/css")));
app.use("/views/js", express.static(path.join(__dirname, "views/js")));

// ✅ Body parser
app.use("/webhook", express.raw({ type: "application/json" })); // อยู่บนสุด
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


let shopData = [];

// Endpoint สำหรับส่ง Logs แบบเรียลไทม์
app.get("/api/logs", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // ส่ง logs ที่มีอยู่ทั้งหมดให้ client ใหม่
  const currentLogs = logHistory.slice(-MAX_LOGS);
  currentLogs.forEach(log => {
    res.write(`data: ${log}\n\n`);
  });

  logClients.push(res);

  req.on("close", () => {
    const index = logClients.indexOf(res);
    if (index > -1) {
      logClients.splice(index, 1);
    }
  });
});


// ฟังก์ชันสำหรับส่ง Logs ไปยัง Clients
export function broadcastLog(message) {
  const timestamp = new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok"
  });

  const logEntry = `[${timestamp}] ${message}`;

  // ✅ เก็บ log ลงในประวัติ
  logHistory.push(logEntry);
  if (logHistory.length > MAX_LOGS) {
    logHistory.splice(0, logHistory.length - MAX_LOGS);
  }

  // ✅ ส่ง log ไปยัง clients แบบ real-time
  const data = `data: ${logEntry}\n\n`;
  logClients.forEach(client => {
    try {
      client.write(data);
    } catch (error) {
      console.error("Error sending log to client:", error);
    }
  });
}

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  clients.push(res);

  req.on("close", () => {
    clients.splice(clients.indexOf(res), 1);
  });
});

let bankAccounts = {};

export async function loadBankAccounts() {
  try {
    const all = await BankAccount.find();
    const grouped = {};
    for (const entry of all) {
      if (!grouped[entry.prefix]) grouped[entry.prefix] = [];
      grouped[entry.prefix].push({
        name: entry.name,
        account: entry.account,
        status: entry.status
      });
    }
    bankAccounts = grouped;
  } catch (err) {
    console.error("❌ โหลดบัญชีธนาคารล้มเหลว:", err.message);
    bankAccounts = {};
  }
}

// ✅ ให้เรียกใช้ตัวแปร global
export function getBankAccounts() {
  return bankAccounts;
}

app.get("/api/bank-accounts", (req, res) => {
  try {
    res.json({ accounts: bankAccounts });
  } catch (err) {
    console.error("❌ โหลดบัญชีล้มเหลว:", err.message);
    res.status(500).json({ error: "โหลดบัญชีไม่สำเร็จ" });
  }
});

app.post("/api/add-bank", async (req, res) => {
  const { prefix, name, number } = req.body;

  if (!prefix || !name || !number) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบ" });
  }

  try {
    await BankAccount.create({
      prefix,
      name,
      account: number,
      status: false
    });

    await loadBankAccounts(); // Reload global variable
    res.json({ success: true });
  } catch (err) {
    console.error("❌ ไม่สามารถเพิ่มบัญชี:", err.message);
    res.status(500).json({ success: false, message: "ไม่สามารถบันทึกข้อมูล" });
  }
});

app.post("/api/edit-bank", async (req, res) => {
  const { prefix, index, name, number } = req.body;

  if (
    typeof prefix !== "string" ||
    typeof index !== "number" ||
    typeof name !== "string" ||
    typeof number !== "string"
  ) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบหรือไม่ถูกต้อง" });
  }

  try {
    const accounts = await BankAccount.find({ prefix });
    if (!accounts[index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชีธนาคารที่ต้องการแก้ไข" });
    }

    accounts[index].name = name;
    accounts[index].account = number;
    await accounts[index].save();
    restartWebhooks(); // รีโหลด Webhook ใหม่
    res.json({ success: true });
  } catch (err) {
    console.error("❌ แก้ไขบัญชีล้มเหลว:", err.message);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการบันทึก" });
  }
});

app.post("/api/update-bank-status", async (req, res) => {
  const { prefix, index, status } = req.body;

  try {
    const accounts = await BankAccount.find({ prefix });
    if (!accounts[index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชีธนาคาร" });
    }

    accounts[index].status = status;
    await accounts[index].save(); // ✅ สำคัญมาก ต้อง save หลังเปลี่ยนค่า

    await loadBankAccounts();     // ✅ รีโหลด global variable ให้บอทเห็นค่าที่เปลี่ยน
    await setupWebhooks();        // ✅ รีโหลด webhook
    res.json({ success: true });
  } catch (err) {
    console.error("❌ ไม่สามารถอัปเดตสถานะบัญชีได้:", err.message);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});

app.post("/api/delete-bank", async (req, res) => {
  const { prefix, index } = req.body;

  if (typeof prefix !== "string" || typeof index !== "number") {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง" });
  }

  try {
    const accounts = await BankAccount.find({ prefix });
    if (!accounts[index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชีธนาคารในตำแหน่งนี้" });
    }

    const accountToDelete = accounts[index];
    await BankAccount.deleteOne({ _id: accountToDelete._id });

    res.json({ success: true, message: "ลบบัญชีสำเร็จ" });
  } catch (err) {
    console.error("❌ ลบบัญชีล้มเหลว:", err.message);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการลบบัญชี" });
  }
});


// ✅ POST: รับ slip ใหม่ + บันทึก MongoDB + broadcast
app.post("/api/slip-results", async (req, res) => {
  try {
    const moment = require('moment-timezone');

    const newSlip = {
      ...req.body,
      createdAt: moment().tz('Asia/Bangkok').toDate()
    };

    await SlipResult.create(newSlip);

    // ✅ ส่ง SSE ทันที
    const data = `data: ${JSON.stringify(newSlip)}\n\n`;
    clients.forEach(client => client.write(data));

    res.status(201).json({ message: "บันทึกแล้ว" });
  } catch (err) {
    console.error("❌ บันทึก SlipResult ล้มเหลว:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ✅ GET: ดึง slip ล่าสุด 100 รายการ (ภายใน 24 ชม.)
app.get("/api/slip-results", async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const results = await SlipResult.find({
      createdAt: { $gte: oneDayAgo }
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(results);
  } catch (err) {
    console.error("❌ โหลด slip results ล้มเหลว:", err.message);
    res.status(500).json({ message: "โหลดข้อมูลไม่สำเร็จ" });
  }
});

export async function loadShopData() {
  try {
    shopData = await Shop.find().lean(); // ดึงจาก MongoDB แล้วเก็บในตัวแปร global
  } catch (error) {
    console.error("❌ ไม่สามารถโหลดร้านค้าจาก MongoDB:", error.message);
    broadcastLog(`❌ ไม่สามารถโหลดร้านค้าจาก MongoDB: ${error.message}`);
    shopData = [];
  }
}

// ✅ Auth middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login");
}

// ✅ Route: หน้า login
app.get("/login", (req, res) => {
  if (req.session?.user) return res.redirect("/"); // 👈 เปลี่ยนเป็น /
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
  
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  let role = null;

  if (username === credentials.owner.username && password === credentials.owner.password) {
    role = "owner";
  } else {
    const admin = credentials.admins.find(
      (a) => a.username === username && a.password === password
    );
    if (admin) role = "user";
  }

  if (role) {
    req.session.user = { username, role };
    return res.redirect("/");
  }

  return res.redirect("/login?error=1");
});

// ✅ Route: logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// ✅ เข้าหน้าหลัก index ต้อง login
app.get("/", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});


// ✅ สำหรับโหลดเนื้อหาย่อย เช่น main.html ฯลฯ
app.get("/page/:name", isAuthenticated, (req, res) => {
  const name = req.params.name;
  const allowed = ["main", "dashboard", "settings", "logs"];
  if (!allowed.includes(name)) {
    return res.status(404).send("ไม่พบหน้านี้");
  }
  res.sendFile(path.join(__dirname, "views", `${name}.html`));
});

// ✅ API ตรวจสอบ Access Token เมื่อผู้ใช้ส่งข้อมูลมา
app.post("/api/validate-access-token", async (req, res) => {
    const { token } = req.body; // ตรวจสอบว่า token ส่งมาไหม

    if (!token) {
        return res.status(400).json({ valid: false, message: "กรุณากรอก Access Token" });
    }

    try {
        // เรียกใช้ฟังก์ชัน validateAccessToken เพื่อทำการตรวจสอบ
        const result = await validateAccessToken(token);
        if (result.valid) {
            res.json({ valid: true, message: "Access Token ถูกต้อง" });
        } else {
            res.status(400).json({ valid: false, message: "Access Token ไม่ถูกต้อง" });
        }
    } catch (error) {
        res.status(500).json({ valid: false, message: "เกิดข้อผิดพลาดในการตรวจสอบ Access Token" });
    }
});


// 4) Endpoint สำหรับส่งข้อมูลร้านค้า
app.get("/api/shops", async (req, res) => {
  try {
    const shops = await Shop.find(); // ดึงข้อมูลทั้งหมดจาก MongoDB
    res.json({ shops });
  } catch (error) {
    console.error("❌ ไม่สามารถโหลดข้อมูลร้านค้าจาก MongoDB:", error.message);
    res.status(500).json({ error: "ไม่สามารถโหลดข้อมูลร้านค้าได้" });
  }
});

app.get('/api/quota', async (req, res) => {
    const BRANCH_ID = process.env.BRANCH_ID;       // ค่า BRANCH_ID จาก info.env
    const SLIPOK_API_KEY = process.env.SLIPOK_API_KEY; // ค่า SLIPOK_API_KEY จาก info.env
    const url = `https://api.slipok.com/api/line/apikey/${BRANCH_ID}/quota`;
    
    try {
      const response = await fetch(url, { 
        headers: { "x-authorization": SLIPOK_API_KEY }
      });
      if (!response.ok) {
        throw new Error("เกิดข้อผิดพลาดในการดึงข้อมูลโควตา");
      }
      const json = await response.json();
      // ส่งกลับทั้งข้อมูล quota, specialQuota, overQuota
      res.json(json.data);
    } catch (error) {
      console.error("Error fetching quota:", error);
      res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลโควตา" });
    }
  });

  app.post("/api/add-shop", async (req, res) => {
    const { name, prefix } = req.body;
  
    if (!name || !prefix) {
      return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลให้ครบ" });
    }  

    try {
      // ตรวจสอบว่ามี prefix ซ้ำหรือไม่
      const existingShop = await Shop.findOne({ prefix });
      if (existingShop) {
        return res.status(400).json({ success: false, message: "Prefix นี้ถูกใช้ไปแล้ว" });
      }
  
      // ตรวจสอบ prefix กับ slipStats
      const existingStat = await SlipStat.findOne({ prefix });

      if (!existingStat) {
        return res.status(400).json({
          success: false,
          message: `ไม่สามารถเพิ่มร้านได้: prefix '${prefix}' ไม่อยู่ในระบบ`
        });
      }
  
      // บันทึกร้านค้าใหม่ลง MongoDB
      const newShop = new Shop({
        name,
        prefix,
        lines: [],
        status: false,
        slipCheckOption: "duplicate"
      });
      await newShop.save();
  
      restartWebhooks(); // รีโหลด Webhook ใหม่
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding shop:", error);
      res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการเพิ่มร้านค้า" });
    }
  });

// API สำหรับแก้ไขบัญชี LINE
app.post("/api/update-line", async (req, res) => {
  const { prefix, index, linename, access_token, secret_token } = req.body;

  if (!prefix || index === undefined || !linename || !access_token || !secret_token) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  try {
    const shop = await Shop.findOne({ prefix });
    if (!shop) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
    }

    if (!shop.lines || !shop.lines[index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชี LINE ที่ต้องการแก้ไข" });
    }

    shop.lines[index] = {
      linename,
      access_token,
      secret_token
    };

    await shop.save();
    res.json({ success: true, message: "อัปเดตบัญชี LINE สำเร็จ!" });
  } catch (error) {
    console.error("❌ Error updating LINE account:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัปเดตบัญชี LINE" });
  }
});

// ✅ API อัปเดตชื่อร้าน และสถานะร้านค้า
app.post("/api/update-shop", async (req, res) => {
  const { prefix, name, status } = req.body;

  if (!prefix) {
    return res.status(400).json({ success: false, message: "กรุณาระบุ prefix ของร้านค้า" });
  }

  try {
    const shop = await Shop.findOne({ prefix });

    if (!shop) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
    }

    if (name) shop.name = name;
    if (typeof status === "boolean") shop.status = status;

    await shop.save();
    restartWebhooks();

    res.json({ success: true, message: "อัปเดตร้านค้าเรียบร้อย" });
  } catch (error) {
    console.error("❌ Error updating shop:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัปเดตร้านค้า" });
  }
});


// เพิ่ม API สำหรับลบบัญชี LINE
app.post("/api/delete-line", async (req, res) => {
  const { prefix, index } = req.body;

  if (!prefix || index === undefined) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  try {
    const shop = await Shop.findOne({ prefix });
    if (!shop) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
    }

    if (!shop.lines || shop.lines.length <= index) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชี LINE ที่ต้องการลบ" });
    }

    shop.lines.splice(index, 1);
    await shop.save();

    res.json({ success: true, message: "ลบบัญชี LINE สำเร็จ!" });
  } catch (error) {
    console.error("❌ Error deleting LINE account:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการลบบัญชี LINE" });
  }
});

// API สำหรับเพิ่มบัญชี LINE ใหม่เข้าไปในร้านค้า
app.post("/api/add-line", async (req, res) => {
  const { prefix, linename, access_token, secret_token } = req.body;

  if (!prefix || !linename || !access_token || !secret_token) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน!" });
  }

  try {
    const shop = await Shop.findOne({ prefix });
    if (!shop) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้!" });
    }

    const duplicate = shop.lines.some(line => line.linename === linename);
    if (duplicate) {
      return res.status(400).json({ success: false, message: "ชื่อบัญชี LINE นี้มีอยู่แล้ว!" });
    }

    shop.lines.push({ linename, access_token, secret_token });
    await shop.save();

    restartWebhooks();
    res.json({ success: true, message: "เพิ่มบัญชี LINE สำเร็จ!" });
  } catch (error) {
    console.error("❌ Error adding LINE account:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการเพิ่มบัญชี LINE" });
  }
});


app.post("/api/update-slip-option", async (req, res) => {
  const { prefix, slipCheckOption } = req.body;

  if (!prefix || !slipCheckOption) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  try {
    const shop = await Shop.findOne({ prefix });
    if (!shop) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
    }

    shop.status = false;
    shop.slipCheckOption = slipCheckOption;
    await shop.save();

    res.json({ success: true, message: "บันทึกการเปลี่ยนแปลงสำเร็จ" });
  } catch (error) {
    console.error("❌ Error updating slip check option:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัปเดตตัวเลือกตรวจสลิป" });
  }
});


app.get('/api/settings', async (req, res) => {
  try {
    const settings = await loadSettings(); // 👉 โหลดจาก MongoDB
    if (!settings) throw new Error("ไม่พบ settings");

    // ✅ แปลง ms → s สำหรับ frontend
    res.json({
      ...settings,
      timeLimit: settings.timeLimit / 1000,
      sameQrTimeLimit: settings.sameQrTimeLimit / 1000
    });
  } catch (err) {
    console.error("❌ โหลด settings ไม่สำเร็จ:", err.message);
    res.status(500).json({ error: "โหลด settings ไม่สำเร็จ" });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    await saveSettings(req.body); // 👉 บันทึกลง MongoDB
    await reloadSettings(); // 👉 โหลดใหม่เข้าตัวแปร global
    restartWebhooks();     // 👉 ถ้าจำเป็นต้องใช้ settings กับ webhook
    res.json({ success: true });
  } catch (err) {
    console.error("❌ บันทึก settings ไม่สำเร็จ:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint สำหรับลบร้านค้า
app.post("/api/delete-shop", async (req, res) => {
  const { prefix } = req.body;

  try {
    const result = await Shop.deleteOne({ prefix });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้าด้วย prefix นี้" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error deleting shop:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการลบร้านค้า" });
  }
});
  

function setCorrectSignature(channelSecret) {
    return (req, res, next) => {
      if (!Buffer.isBuffer(req.body)) {
        console.error("❌ req.body ไม่ใช่ Buffer");
        return res.status(400).send("Invalid request format");
      }
  
      const computedSignature = crypto
        .createHmac("sha256", channelSecret)
        .update(req.body)
        .digest("base64");
  
      req.headers["x-line-signature"] = computedSignature;
      next();
    };
  }

const setupWebhooks = async () => {
    // ✅ ลบเฉพาะ route ที่ขึ้นต้นด้วย "/webhook"
    app._router.stack = app._router.stack.filter((layer) => {
      return !(
        layer.route &&
        layer.route.path &&
        layer.route.path.startsWith("/webhook")
      );
    });

    await loadShopData(); // ✅ ใช้ async version

    shopData.forEach((shop) => {
      shop.lines.forEach((lineAccount, index) => {
        const prefix = shop.prefix;
        const lineName = lineAccount.linename;
        const lineConfig = {
          channelAccessToken: String(lineAccount.access_token),
          channelSecret: String(lineAccount.secret_token),
        };

            const client = new line.Client(lineConfig);
            const route = `/webhook/${shop.prefix}/line${index + 1}.bot`;

            // ✅ กำหนด Middleware ให้ใช้ `express.raw()` เฉพาะ Webhook เท่านั้น
            app.post(
              route, // 👈 ใช้ route จากข้างบนตรง ๆ เลย
              setCorrectSignature(lineConfig.channelSecret),
              line.middleware(lineConfig),
              async (req, res) => {
                const events = req.body.events || [];
                await Promise.all(
                  events.map(async (event) => await handleEvent(event, client, prefix, lineName ))
                );
                res.status(200).send("OK");
              }
            );
          });
        });
      };

export const restartWebhooks = async () => {
  console.log("✅ พบการแก้ไขข้อมูล รีสตาร์ทบอทแล้ว...");
  broadcastLog("✅ พบการแก้ไขข้อมูล รีสตาร์ทบอทแล้ว...");
  await loadBankAccounts();        // ✅ รอโหลดให้เสร็จจริง ๆ ก่อนใช้
  await setupWebhooks();           // ✅ รีเซ็ต webhook
};

(async () => {
  await connectDB();
  await loadBankAccounts();        // ✅ รอโหลดให้เสร็จก่อนบอททำงาน
  await setupWebhooks();           // ✅ รอ setup ให้เสร็จแน่ ๆ

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✅ กำลังทำงานที่พอร์ต ${PORT}`);
  });
})();