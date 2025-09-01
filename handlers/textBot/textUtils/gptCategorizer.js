import OpenAI from 'openai';
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { broadcastLog } from "../index.js";

const envPath = path.join(process.cwd(), "info.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const categoryMap = {
  'ทักทาย': 'greeting',
  'อื่นๆ': 'other',
  'ฝากเงินไม่เข้า': 'deposit_missing',
  'สมัครสมาชิก': 'register',
  'ถอนเงินไม่เข้า': 'withdraw_missing',
  'ถอนเงินมีปัญหา': 'withdraw_error',
};

/**
 * ส่งข้อความไปยัง GPT แล้วรับข้อความตอบกลับ
 */
async function askGPT(userMessage) {
  const prompt = `คุณเป็นผู้เชี่ยวชาญทางภาษาที่วิเคราะห์ประโยคจากข้อความเพื่อหาบริบทของข้อความนั้นๆ โดยให้ตอบกลับมาในรูปแบบต่อไปนี้:

รายการหมวดหมู่ที่เป็นไปได้ มีแค่ 6 อย่างเท่านั้น:
ทักทาย
ฝากเงินไม่เข้า
สมัครสมาชิก
ถอนเงินไม่เข้า
ถอนเงินมีปัญหา
อื่นๆ

ข้อความคือ: ${userMessage}

คำทักทายจะรวมถึงคำเปิดบทสนทนาทั่วไป เช่น:
"สวัสดี", "ดีจ้า", "ฮัลโหล", "แอดมินครับ", "แอดค่ะ", "แอดจ๋า", "แอด", "เฮลโหล", "ทัก",

ฝากเงินไม่เข้าจะรวมถึงคำ เช่น:
"เครดิตยังไม่เข้า", "เงินยังไม่เข้า", "ฝากเงินไม่เข้า", "โอนแล้วเคดิตไม่ขึ้น"

**อื่นๆ จะเป็นข้อความที่ไม่เกี่ยวข้องกับการทักทาย และฝากเงิน เช่น "ขอบคุณ", "ด่าทอ", "ข้อมูล" **
**ข้อความสามารถเขียนผิด หรือยืดหยุ่นได้**
***ตอบได้คำตอบเดียวเท่านั้น***
***ตอบแค่เพียงหมวดหมู่ที่ระบุข้างต้นเท่านั้น อย่าใส่คำอธิบายหรือข้อความอื่นๆ เพิ่มเติม***`;


  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
    });

    const reply = completion.choices[0].message.content;
    console.log('🤖 [GPT ตอบกลับ]:', reply);
    broadcastLog(`🤖 [GPT ตอบกลับ]: ${reply}`);
    return reply;
  } catch (error) {
    console.error('❌ [askGPT] เกิดข้อผิดพลาด:', error);
    broadcastLog(`❌ [askGPT] เกิดข้อผิดพลาด: ${error}`);
    return '';
  }
}


function categorizeFromGptReply(gptReply) {
  const cleaned = gptReply.trim(); // เช่น "ทักทาย"
  const normalizedCategory = categoryMap[cleaned]; // เช่น "greeting"

  if (!normalizedCategory) {
    console.warn('⚠️ [categorizeFromGptReply] ไม่รู้จักหมวดหมู่:', cleaned);
    broadcastLog(`⚠️ [categorizeFromGptReply] ไม่รู้จักหมวดหมู่: ${cleaned}`);
    return null;
  }
  return {
    category: normalizedCategory,
    correctedText: null, // ไม่มีการแก้ไขข้อความ
  };
}

export { askGPT, categorizeFromGptReply };