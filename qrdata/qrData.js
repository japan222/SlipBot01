import path from "path";
import fs from "fs";

// 📌 กำหนด path สำหรับแต่ละ prefix
const qrdatapath = {
    "GDD": path.join(process.cwd(), "qrdata/GDD.json"),
    "BIW": path.join(process.cwd(), "qrdata/BIW.json"),
    "VCE": path.join(process.cwd(), "qrdata/VCE.json"),
    "APB": path.join(process.cwd(), "qrdata/APB.json"),
    "GHB": path.join(process.cwd(), "qrdata/GHB.json"),
    "LUX": path.join(process.cwd(), "qrdata/LUX.json"),
    "PGW": path.join(process.cwd(), "qrdata/PGW.json"),
    "JDX": path.join(process.cwd(), "qrdata/JDX.json"),
    "JPN": path.join(process.cwd(), "qrdata/JPN.json"),
    "KRM": path.join(process.cwd(), "qrdata/KRM.json"),
    "JEN": path.join(process.cwd(), "qrdata/JEN.json"),
    "JYX": path.join(process.cwd(), "qrdata/JYX.json"),
    "ADN": path.join(process.cwd(), "qrdata/ADN.json"),
    "DOB": path.join(process.cwd(), "qrdata/DOB.json"),
    "MMA": path.join(process.cwd(), "qrdata/MMA.json"),
    "GNV": path.join(process.cwd(), "qrdata/GNV.json"),
    "TGO": path.join(process.cwd(), "qrdata/TGO.json"),
    "BFU": path.join(process.cwd(), "qrdata/BFU.json"),
    "SF": path.join(process.cwd(), "qrdata/SF.json")
};

const loadQRDatabaseFromFile = (prefix) => {
    const filePath = qrdatapath[prefix];
    if (!filePath) {
        console.error(`❌ ไม่พบฐานข้อมูล QR สำหรับ prefix: ${prefix}`);
        return new Map(); // ✅ ป้องกัน undefined
    }

    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ ไฟล์ ${filePath} ไม่พบ กำลังสร้างใหม่...`);
        fs.writeFileSync(filePath, JSON.stringify([]));
    }

    let rawData;
    try {
        rawData = fs.readFileSync(filePath, "utf-8");
        if (!rawData.trim()) {
            console.warn(`⚠️ ไฟล์ ${filePath} ว่างเปล่า กำลังรีเซ็ตเป็น []`);
            rawData = "[]";
            fs.writeFileSync(filePath, rawData);
        }
    } catch (error) {
        console.error(`❌ อ่านไฟล์ ${filePath} ไม่สำเร็จ:`, error.message);
        return new Map();
    }

    try {
        const parsedData = JSON.parse(rawData);
        if (!Array.isArray(parsedData)) {
            console.error(`❌ ไฟล์ ${filePath} มีข้อมูลผิดรูปแบบ กำลังรีเซ็ตเป็น []`);
            fs.writeFileSync(filePath, JSON.stringify([]));
            return new Map();
        }

        const qrDatabase = new Map(parsedData.map(({ qrData, firstDetected, amount, users }) => [
            qrData,
            { firstDetected, amount: amount || 0, users: new Map(users) }
        ]));
        return qrDatabase;
    } catch (error) {
        console.error(`❌ ไม่สามารถแปลง JSON ของ ${filePath}:`, error.message);
        console.warn(`⚠️ รีเซ็ตไฟล์ ${filePath} เป็น []`);
        fs.writeFileSync(filePath, JSON.stringify([]));
        return new Map();
    }
};


const saveQRDatabaseToFile = (prefix, qrDatabase) => {
    const filePath = qrdatapath[prefix];
    if (!filePath) {
        console.error(`❌ ไม่พบฐานข้อมูล QR สำหรับ prefix: ${prefix}`);
        return;
    }

    try {
        // ✅ โหลดฐานข้อมูล QR เดิมก่อนบันทึก
        const existingData = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : [];

        const dataToSave = Array.from(qrDatabase.entries()).map(([qrData, info]) => {
            const updatedEntry = {
                qrData,
                firstDetected: info.firstDetected,
                users: Array.from(info.users.entries()) // ✅ ไม่ต้อง map เพิ่มเอง
            };
        
            if (info.amount !== undefined && info.amount !== null && info.amount > 0) {
                updatedEntry.amount = info.amount;
            }
        
            return updatedEntry;
        });

        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
        console.error(`❌ เกิดข้อผิดพลาดในการบันทึกไฟล์ ${filePath}:`, error.message);
    }
};

export { loadQRDatabaseFromFile, saveQRDatabaseToFile };
