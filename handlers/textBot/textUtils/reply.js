//reply.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getRandomReplyFromFile(filename) {
  if (!filename.endsWith('.json')) {
    filename += '.json';
  }

  const filePath = path.join(__dirname, '../reply', filename);

  if (!fs.existsSync(filePath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(data) && data.length > 0) {
      const randomIndex = Math.floor(Math.random() * data.length);
      return data[randomIndex];
    }
  } catch (err) {
    console.error(`❌ Error reading ${filename}:`, err);
  }

  return null;
}


/**
 * ตอบกลับตามหมวดหมู่ โดยใช้ชื่อหมวดเป็นชื่อไฟล์ reply เช่น greeting → reply/greeting.json
 * @param {string} text - ข้อความจาก GPT เช่น "ทักทาย: สวัสดีค่ะ"
 * @returns {{ category: string, text: string } | null}
 */
function getReplyMessage(text) {
  const category = detectCategory(text);

  console.log(`📂 ตรวจพบ category: "${category}" สำหรับข้อความ: "${text}"`);

  const reply = getRandomReplyFromFile(`${category}.json`);
  if (!reply) return null;

  return { category, text: reply };
}

export { getReplyMessage, getRandomReplyFromFile, };
