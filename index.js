// index.js
import express from "express";
import * as line from "@line/bot-sdk";
import dotenv from "dotenv";
import fs from "fs";
import session from "express-session"; // สำหรับจัดการ session
import { validateAccessToken } from "./utils/lcf.js"; // แยกฟังก์ชันออกไปอยู่ไฟล์อื่น
import path from "path";
import { fileURLToPath } from "url";
import credentials from "./credentials.js";
import * as crypto from "crypto";
import { handleEvent, reloadSettings } from "./handlers/duplicateSlipHandler.js";
import { loadSettings, saveSettings } from './config/settings.js';
import { loadSlipResults, saveSlipResults } from "./utils/slipStatsManager.js";

dotenv.config({ path: `${process.cwd()}/info.env` });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const clients = [];
const MAX_LOGS = 200;
const logHistory = [];
const logClients = [];
const SLIP_STATS_PATH = path.join(__dirname, "stats", "slipStats.json");

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
let slipResults = loadSlipResults();

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

app.get("/api/bank-accounts", (req, res) => {
  try {
    const data = fs.readFileSync("./bank_accounts.json", "utf-8");
    const accounts = JSON.parse(data);
    res.json(accounts);
  } catch (err) {
    console.error("❌ โหลด bank_accounts.json ไม่สำเร็จ:", err.message);
    res.status(500).json({ error: "โหลดบัญชีไม่สำเร็จ" });
  }
});

app.post("/api/add-bank", (req, res) => {
  const { prefix, name, number } = req.body;

  if (!prefix || !name || !number) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบ" });
  }

  try {
    const raw = fs.readFileSync("./bank_accounts.json", "utf-8");
    const json = JSON.parse(raw);

    // ✅ ถ้ายังไม่มี prefix ให้สร้างใหม่
    if (!json.accounts[prefix]) {
      json.accounts[prefix] = [];
    }

    // ✅ เพิ่มบัญชีใหม่โดยใช้ status: false
    json.accounts[prefix].push({
      name,
      account: number,
      status: false,
    });

    fs.writeFileSync("./bank_accounts.json", JSON.stringify(json, null, 2));
    res.json({ success: true });
    restartWebhooks();
  } catch (err) {
    console.error("❌ ไม่สามารถบันทึกบัญชี:", err.message);
    res.status(500).json({ success: false, message: "ไม่สามารถบันทึกข้อมูล" });
  }
});

app.post("/api/edit-bank", (req, res) => {
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
    const raw = fs.readFileSync("./bank_accounts.json", "utf-8");
    const json = JSON.parse(raw);

    if (!json.accounts[prefix] || !json.accounts[prefix][index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชีธนาคารที่ต้องการแก้ไข" });
    }

    json.accounts[prefix][index].name = name;
    json.accounts[prefix][index].account = number;

    fs.writeFileSync("./bank_accounts.json", JSON.stringify(json, null, 2));
    res.json({ success: true });
    restartWebhooks();
  } catch (err) {
    console.error("❌ แก้ไขบัญชีล้มเหลว:", err.message);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการบันทึก" });
  }
});

app.post("/api/update-bank-status", (req, res) => {
  const { prefix, index, status } = req.body;

  try {
    const filePath = "./bank_accounts.json";
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    if (!data.accounts[prefix]) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านค้า" });
    }

    if (!data.accounts[prefix][index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชีธนาคารในตำแหน่งที่ระบุ" });
    }

    // อัปเดตสถานะ
    data.accounts[prefix][index].status = status;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    res.json({ success: true });
    restartWebhooks();
  } catch (err) {
    console.error("❌ ไม่สามารถอัปเดตสถานะบัญชีได้:", err.message);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
  }
});

app.post("/api/delete-bank", (req, res) => {
  const { prefix, index } = req.body;

  if (typeof prefix !== "string" || typeof index !== "number") {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง" });
  }

  try {
    const raw = fs.readFileSync("./bank_accounts.json", "utf-8");
    const json = JSON.parse(raw);

    // เช็กว่ามีร้านนี้ไหม
    if (!json.accounts[prefix]) {
      return res.status(404).json({ success: false, message: "ไม่พบร้านนี้" });
    }
    // เช็ก index ถูกต้องไหม
    if (!json.accounts[prefix][index]) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชีในตำแหน่งนี้" });
    }
    // ลบ
    json.accounts[prefix].splice(index, 1);
    fs.writeFileSync("./bank_accounts.json", JSON.stringify(json, null, 2), "utf-8");

    res.json({ success: true });
    restartWebhooks();
  } catch (err) {
    console.error("❌ ลบบัญชีล้มเหลว:", err.message);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการลบบัญชี" });
  }
});


function removeOldSlips() {
  const now = new Date();
  slipResults = slipResults.filter((item) => {
    const created = new Date(item.createdAt || item.time);
    return (now - created) <= 24 * 60 * 60 * 1000;
  });
  saveSlipResults(slipResults); // 🟢 อัปเดตไฟล์ด้วย
}

app.post("/api/slip-results", (req, res) => {
  const newSlip = req.body;
  newSlip.createdAt = new Date();

  slipResults.push(newSlip);
  removeOldSlips(); // ลบเก่าออกก่อน
  saveSlipResults(slipResults); // ✅ บันทึกไฟล์
  res.status(201).send({ message: "บันทึกแล้ว" });

  const data = `data: ${JSON.stringify(newSlip)}\n\n`;
  clients.forEach(client => client.write(data));
});

app.get("/api/slip-results", (req, res) => {
  removeOldSlips(); // ลบ + บันทึก
  res.json(slipResults);
});

const loadShopData = () => {
    try {
        const rawData = fs.readFileSync("./line_shops.json", "utf-8");
        const jsonData = JSON.parse(rawData);
        shopData = jsonData.shops || [];
      } catch (error) {
        console.error("❌ ไม่สามารถโหลด line_shops.json:", error.message);
        broadcastLog(`❌ ไม่สามารถโหลด line_shops.json: ${error.message}`);
        shopData = [];
    }
};

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


// 4) Endpoint สำหรับส่งข้อมูลร้านค้าใน line_shops.json ให้ Frontend
app.get("/api/shops", (req, res) => {
  try {
    const rawData = fs.readFileSync("./line_shops.json", "utf-8");
    const jsonData = JSON.parse(rawData);
    // ส่งข้อมูลร้านค้ากลับไป (โครงสร้าง { shops: [...] })
    res.json(jsonData);
  } catch (error) {
    console.error("❌ ไม่สามารถอ่านไฟล์ line_shops.json:", error.message);
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

  app.post("/api/add-shop", (req, res) => {
    const { name, prefix } = req.body;
    
    if (!name || !prefix) {
      return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลให้ครบ" });
  }

  try {
      // อ่านข้อมูลร้านค้าปัจจุบัน
      const rawData = fs.readFileSync("./line_shops.json", "utf-8");
      let data = JSON.parse(rawData);

      // ตรวจสอบว่ามี prefix ซ้ำหรือไม่
      if (data.shops.some(shop => shop.prefix === prefix)) {
          return res.status(400).json({ success: false, message: "Prefix นี้ถูกใช้ไปแล้ว" });
      }

      // ✅ ตรวจสอบ prefix ว่าอยู่ใน slipStats หรือไม่
      const prefixStatsRaw = fs.readFileSync(SLIP_STATS_PATH, "utf-8");
      const prefixStats = JSON.parse(prefixStatsRaw);

      if (!prefixStats.hasOwnProperty(prefix)) {
          return res.status(400).json({
              success: false,
              message: `ไม่สามารถเพิ่มร้านได้: prefix '${prefix}' ไม่อยู่ในระบบ`
          });
      }

        // เพิ่มร้านค้าใหม่
        const newShop = {
            name,
            prefix,
            lines: [],
            status: false, // ร้านใหม่เริ่มต้นที่ปิดอยู่
            slipCheckOption: "duplicate", // ตัวเลือกตรวจสอบสลิปเริ่มต้นเป็น duplicate
        };
        data.shops.push(newShop);
        // บันทึกข้อมูลลงไฟล์
        fs.writeFileSync("./line_shops.json", JSON.stringify(data, null, 2), "utf-8");
        
        res.json({ success: true });
        restartWebhooks();
    } catch (error) {
        console.error("Error adding shop:", error);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการเพิ่มร้านค้า" });
    }
});

// API สำหรับแก้ไขบัญชี LINE
app.post("/api/update-line", (req, res) => {
    const { prefix, index, linename, access_token, secret_token } = req.body;

    if (!prefix || index === undefined || !linename || !access_token || !secret_token) {
        return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
    }

    try {
        // โหลดข้อมูลร้านค้าทั้งหมด
        const rawData = fs.readFileSync("./line_shops.json", "utf-8");
        let data = JSON.parse(rawData);

        // ค้นหาร้านค้าตาม prefix
        let shop = data.shops.find(s => s.prefix === prefix);
        if (!shop) {
            return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
        }

        // ตรวจสอบว่าดัชนี (index) มีอยู่จริง
        if (!shop.lines[index]) {
            return res.status(404).json({ success: false, message: "ไม่พบบัญชี LINE ที่ต้องการแก้ไข" });
        }

        // อัปเดตข้อมูลบัญชี LINE
        shop.lines[index] = {
            linename,
            access_token,
            secret_token
        };

        // ✅ บันทึกข้อมูลลงไฟล์ (ไม่ใช้ async เพราะต้องให้การบันทึกเสร็จก่อน)
        fs.writeFileSync("./line_shops.json", JSON.stringify(data, null, 2), "utf-8");

        res.json({ success: true, message: "อัปเดตบัญชี LINE สำเร็จ!" });
    } catch (error) {
        console.error("❌ Error updating LINE account:", error);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัปเดตบัญชี LINE" });
    }
});

// ✅ API อัปเดตชื่อร้าน และสถานะร้านค้า
app.post("/api/update-shop", (req, res) => {
    const { prefix, name, status } = req.body;

    if (!prefix) {
        return res.status(400).json({ success: false, message: "กรุณาระบุ prefix ของร้านค้า" });
    }

    try {
        const rawData = fs.readFileSync("./line_shops.json", "utf-8");
        let data = JSON.parse(rawData);
        let shop = data.shops.find(s => s.prefix === prefix);
    
        if (!shop) {
          return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
        }
    
        if (name) {
          shop.name = name;
        }
    
        if (typeof status === "boolean") {
          shop.status = status;
        }
    
        fs.writeFileSync("./line_shops.json", JSON.stringify(data, null, 2), "utf-8");
    
        restartWebhooks(); // ✅ รีโหลด Webhook เมื่ออัปเดตร้านค้า
    
        res.json({ success: true, message: "อัปเดตร้านค้าเรียบร้อย" });
      } catch (error) {
        console.error("❌ Error updating shop:", error);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัปเดตร้านค้า" });
      }
    });

// เพิ่ม API สำหรับลบบัญชี LINE
app.post("/api/delete-line", (req, res) => {
    const { prefix, index } = req.body;
    
    if (!prefix || index === undefined) {
        return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
    }

    try {
        // อ่านข้อมูลร้านค้าจากไฟล์ line_shops.json
        const rawData = fs.readFileSync("./line_shops.json", "utf-8");
        let data = JSON.parse(rawData);

        // ค้นหาร้านค้า
        const shop = data.shops.find(s => s.prefix === prefix);
        if (!shop) {
            return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
        }

        // ตรวจสอบว่ามี index ที่ถูกต้อง
        if (shop.lines[index] === undefined) {
            return res.status(404).json({ success: false, message: "ไม่พบบัญชี LINE ที่ต้องการลบ" });
        }

        // ลบบัญชี LINE จาก array
        shop.lines.splice(index, 1);

        // บันทึกข้อมูลใหม่ลงในไฟล์
        fs.writeFileSync("./line_shops.json", JSON.stringify(data, null, 2), "utf-8");

        // ส่งคำตอบกลับ
        res.json({ success: true, message: "ลบบัญชี LINE สำเร็จ!" });
    } catch (error) {
        console.error("❌ Error deleting line:", error);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการลบบัญชี LINE" });
    }
});

// API สำหรับเพิ่มบัญชี LINE ใหม่เข้าไปในร้านค้า
app.post("/api/add-line", (req, res) => {
    const { prefix, linename, access_token, secret_token } = req.body;

    // ✅ ตรวจสอบว่าข้อมูลที่ส่งมาครบถ้วนหรือไม่
    if (!prefix || !linename || !access_token || !secret_token) {
        return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน!" });
    }

    try {
        // ✅ โหลดข้อมูลร้านค้าทั้งหมดจากไฟล์
        const rawData = fs.readFileSync("./line_shops.json", "utf-8");
        let data = JSON.parse(rawData);

        // ✅ ค้นหาร้านค้าตาม prefix
        let shop = data.shops.find(s => s.prefix === prefix);
        if (!shop) {
            return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้!" });
        }

        // ✅ ตรวจสอบว่ามีชื่อบัญชี LINE ซ้ำหรือไม่
        if (shop.lines.some(line => line.linename === linename)) {
            return res.status(400).json({ success: false, message: "ชื่อบัญชี LINE นี้มีอยู่แล้ว!" });
        }

        // ✅ เพิ่มบัญชี LINE ใหม่เข้าไปในร้านค้า
        shop.lines.push({ linename, access_token, secret_token });

        // ✅ บันทึกข้อมูลร้านค้าลงไฟล์
        fs.writeFileSync("./line_shops.json", JSON.stringify(data, null, 2), "utf-8");
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
        // โหลดข้อมูลร้านค้าทั้งหมด
        const rawData = fs.readFileSync("./line_shops.json", "utf-8");
        let data = JSON.parse(rawData);

        // ค้นหาร้านค้าตาม prefix
        let shop = data.shops.find(s => s.prefix === prefix);
        if (!shop) {
            return res.status(404).json({ success: false, message: "ไม่พบร้านค้านี้" });
        }

        // ✅ ปิดร้านก่อนเปลี่ยนตัวเลือก
        shop.status = false;
        shop.slipCheckOption = slipCheckOption;

        // บันทึกข้อมูลใหม่ลงไฟล์
        fs.writeFileSync("./line_shops.json", JSON.stringify(data, null, 2), "utf-8");

        res.json({ success: true, message: "บันทึกการเปลี่ยนแปลงสำเร็จ" });
    } catch (error) {
        console.error("❌ Error updating slip check option:", error);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัปเดตตัวเลือกตรวจสลิป" });
    }
});

app.get('/api/settings', (req, res) => {
  const settings = loadSettings();

  // แปลง ms → s เพื่อให้แสดงใน form ได้ถูกต้อง
  res.json({
    ...settings,
    timeLimit: settings.timeLimit / 1000,
    sameQrTimeLimit: settings.sameQrTimeLimit / 1000
  });
});

app.post('/api/settings', (req, res) => {
  try {
    saveSettings(req.body);
    reloadSettings(); // ✅ โหลดใหม่เข้าตัวแปร global
    restartWebhooks(); // ✅ ถ้าจำเป็น
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
  
// Endpoint สำหรับลบร้านค้า
app.post("/api/delete-shop", (req, res) => {
    const { prefix } = req.body;
    try {
      // อ่านข้อมูลร้านค้าจากไฟล์ line_shops.json
      const rawData = fs.readFileSync("./line_shops.json", "utf8");
      let data = JSON.parse(rawData);
      // เก็บร้านค้าที่ไม่มี prefix ตรงกับที่ระบุไว้
      const filteredShops = data.shops.filter((shop) => shop.prefix !== prefix);
      
      // หากไม่มีการเปลี่ยนแปลงหมายความว่าไม่พบร้านที่ต้องการลบ
      if (filteredShops.length === data.shops.length) {
        return res.status(404).json({ success: false, message: "ไม่พบร้านค้าด้วย prefix นี้" });
      }
      
      // อัปเดตข้อมูลร้านค้า
      data.shops = filteredShops;
      // เขียนข้อมูลที่อัปเดตลงในไฟล์ใหม่ (มีการจัดรูปแบบให้อ่านง่าย)
      fs.writeFileSync("./line_shops.json", JSON.stringify(data, null, 2), "utf8");
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting shop:", error);
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


const setupWebhooks = () => {
    // ✅ ลบเฉพาะ route ที่ขึ้นต้นด้วย "/webhook"
    app._router.stack = app._router.stack.filter((layer) => {
      return !(
        layer.route &&
        layer.route.path &&
        layer.route.path.startsWith("/webhook")
      );
    });

    loadShopData(); // โหลดข้อมูลร้านค้าใหม่

    shopData.forEach((shop) => {
        shop.lines.forEach((lineAccount, index) => {
            const prefix = shop.prefix;
            const lineName = lineAccount.linename; // ✅ แก้ตรงนี้
            const lineConfig = {
                channelAccessToken: String(lineAccount.access_token),
                channelSecret: String(lineAccount.secret_token)
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
setupWebhooks();

export const restartWebhooks = () => {
    console.log("🔄 พบการแก้ไขข้อมูลร้านค้า...");
    broadcastLog("🔄 พบการแก้ไขข้อมูลร้านค้า...");
    setupWebhooks();
};

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ กำลังทำงานที่พอร์ต ${PORT}`);
});