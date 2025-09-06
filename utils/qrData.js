import QrEntry from "../models/QrEntry.js"; // ✅ จากระดับ utils → กลับ root → เข้า models

export async function loadQRDatabaseFromFile(prefix) {
  try {
    const entries = await QrEntry.find({ prefix });
    const map = new Map();

    for (const entry of entries) {
      const userMap = new Map();

      // รองรับทั้ง Array และ Object ของ users
      if (Array.isArray(entry.users)) {
        // กรณีเป็น array ของ { userId, lastSentTime, messageCount }
        for (const user of entry.users) {
          userMap.set(user.userId, {
            lastSentTime: user.lastSentTime,
            messageCount: user.messageCount
          });
        }
      } else if (typeof entry.users === "object") {
        // กรณีเป็น object แบบ { userId: { ... }, ... }
        for (const [userId, record] of Object.entries(entry.users)) {
          userMap.set(userId, {
            lastSentTime: record.lastSentTime,
            messageCount: record.messageCount
          });
        }
      }

      map.set(entry.qrData, {
        firstDetected: entry.firstDetected,
        amount: entry.amount || 0,
        users: userMap
      });
    }

    return map;
  } catch (err) {
    console.error(`❌ โหลด QR จาก MongoDB ไม่สำเร็จ (prefix: ${prefix}):`, err.message);
    return new Map(); // ป้องกันระบบพัง
  }
}

export async function saveQRDatabaseToFile(prefix, map) {
  for (const [qrData, info] of map.entries()) {
    // แปลง Map → Array ของ object เพื่อ MongoDB เก็บง่าย
    const usersArray = Array.from(info.users.entries()).map(([userId, userInfo]) => ({
      userId,
      lastSentTime: userInfo.lastSentTime,
      messageCount: userInfo.messageCount
    }));

    await QrEntry.findOneAndUpdate(
      { prefix, qrData },
      {
        $set: {
          firstDetected: info.firstDetected,
          amount: info.amount || 0,
          users: usersArray
        },
        $setOnInsert: {
          firstSent: new Date() // ✅ เพิ่ม field ใหม่
        }
      },
      { upsert: true }
    );
  }
}