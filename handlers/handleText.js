// handlerText.js
import { askGPT, categorizeFromGptReply } from "./textBot/textUtils/gptCategorizer.js";
import { detectCategory } from "./textBot/textUtils/keywords.js";
import { getRandomReplyFromFile } from "./textBot/textUtils/reply.js";
import { saveCategoryForUser, hasCategory, hasCategoryInHour } from "./textBot/textUtils/userCategoryMemory.js";
import { getTime, clearUserTimeout, hasUserSentImage, hasUserSentSlip, clearUserMessageHistory, waitTimeouts, userMessageHistory } from "./handleEvent.js";
import { isNewCustomer, checkAndSavePhoneNumber } from "../utils/savePhoneNumber.js";
import { broadcastLog } from "../index.js";

function findMostImportantCategory(categories) {
  const categoryPriority = ['deposit_missing', 'register', 'withdraw_error','withdraw_missing', 'other', 'greeting'];

  for (const priority of categoryPriority) {
    if (categories.includes(priority)) {
      return priority;
    }
  }

  broadcastLog('⚠️ ไม่พบหมวดหมู่ที่ตรงตามลำดับความสำคัญ');
  console.log('⚠️ ไม่พบหมวดหมู่ที่ตรงตามลำดับความสำคัญ');
  return null;
}

export async function handleTextEvent(event, client) {
  const userId = event.source.userId;
  const isNew = isNewCustomer(userId); // ✅ ชื่อไม่ชนกับฟังก์ชัน
  const WAIT_CATEGORIES = ['deposit_missing', 'register', 'withdraw_error','withdraw_missing', 'other', 'greeting'];
  const now = Date.now();

  if (event.message.type === 'text') {
    const userMessage = event.message.text.trim();
    console.log('📥', userId, '|', userMessage);
    broadcastLog('📥', userId, '|', userMessage);
    if (!userMessageHistory.has(userId)) {
      userMessageHistory.delete(userId);
    }
    // 🔍 ตรวจ keyword ก่อน
    let category = detectCategory(userMessage);
    if (category) {
      console.log(`🔍 ตรงกับ keywords หมวดหมู่: ${category}`);
      broadcastLog(`🔍 ตรงกับ keywords หมวดหมู่: ${category}`);
    } else {
      // 📛 กรองข้อความที่มีตัวเลขเยอะ (ป้องกันเบอร์โทร/เลขบัญชี)
      const digits = (userMessage.match(/\d/g) || []).length;

      if (digits >= 10) {
        checkAndSavePhoneNumber(userMessage, userId);

        if (digits !== 6) {
          return;
        }
      }

      // 🔍 ถ้าไม่เจอ keyword → ส่งไปให้ GPT
      console.log('ส่งข้อความให้ GPT วิเคราะห์');
      broadcastLog('ส่งข้อความให้ GPT วิเคราะห์');
      const gptReply = await askGPT(userMessage);

      const result = categorizeFromGptReply(gptReply);
      if (!result?.category) return;

      category = result.category;
    }

    saveCategoryForUser(userId, category);

    if (!userMessageHistory.has(userId)) {
      userMessageHistory.set(userId, []);
    }

    userMessageHistory.get(userId).push({
      text: userMessage,
      time: now,
      category
    });

    // ✅ เฉพาะหมวดที่ต้องตอบหลังรอ 10 วิ
    if (WAIT_CATEGORIES.includes(category)) {
      clearUserTimeout(userId);
      console.log(`⏳ รอ 10 วิ ก่อนตอบ ...`);
      broadcastLog(`⏳ รอ 10 วิ ก่อนตอบ ...`);
      const timeoutId = handleDelayedReply(userId, event.replyToken, client, isNew);
      waitTimeouts.set(userId, timeoutId);
      return;
    }

  }
}

function handleDelayedReply(userId, replyToken, client, isNew, detectedCategory = null) {
  return setTimeout(async () => {

    const userTexts = userMessageHistory.get(userId) || [];
    const categoryList = [];

    if (detectedCategory) categoryList.push(detectedCategory);

    for (const msg of userTexts) {
      if (msg.category) {
        categoryList.push(msg.category);
      }
    }

    console.log('📌 รายการหมวดหมู่ที่ตรวจพบ:', categoryList);
    broadcastLog('📌 รายการหมวดหมู่ที่ตรวจพบ:', categoryList);

    const finalCategory = findMostImportantCategory(categoryList);
    console.log('🏷️ หมวดหมู่ที่สำคัญที่สุด:', finalCategory);
    broadcastLog('🏷️ หมวดหมู่ที่สำคัญที่สุด:', finalCategory);

    if (!finalCategory || finalCategory === 'other') {
      console.log('📭 ไม่ตอบกลับหมวดอื่นๆ)');
      broadcastLog('📭 ไม่ตอบกลับหมวดอื่นๆ)');
      clearUserMessageHistory(userId);
      return;
    }

    const replyMissing = await getRandomReplyFromFile('deposit_missing');
    const replyGreeting = await getRandomReplyFromFile('greeting');
    const replyInfo = await getRandomReplyFromFile('info');
    const replyWithdrawError = await getRandomReplyFromFile('withdraw_error');
    const replyWithdrawMissing = await getRandomReplyFromFile('withdraw_missing');
    const withdrawcount = hasCategoryInHour(userId, finalCategory);
    const nowMinutes = getTime();
    const messages = [];

    
    // ❌ ไม่ตอบถ้าเพิ่งส่งสลิปมา
    if (
      (finalCategory === 'deposit_missing'|| finalCategory === 'greeting')  && 
      (hasUserSentSlip(userId))) {
      console.log('⏹️ เพิกเฉย "ข้อความการฝากเงิน" เพราะเพิ่งส่ง slip มาแล้ว');
      broadcastLog('⏹️ เพิกเฉย "ข้อความการฝากเงิน" เพราะเพิ่งส่ง slip มาแล้ว');
      clearUserMessageHistory(userId);
      return;
    }

    // ✅ ตอบกลับสำหรับ deposit_missing
    if (finalCategory === 'deposit_missing') {
      if (replyMissing) {
        messages.push({ type: 'text', text: replyMissing });
      }
    }

    if ((finalCategory === 'withdraw_missing' || finalCategory === 'withdraw_error') && withdrawcount >= 2) {
      clearUserMessageHistory(userId);
      console.log('⏹️ เพิกเฉย "ข้อความการถอนเงิน" เพราะเพิ่งถามมาใน 1 ชม.');
      broadcastLog('⏹️ เพิกเฉย "ข้อความการถอนเงิน" เพราะเพิ่งถามมาใน 1 ชม.');
      return;
    }

    // ✅ กรณี withdraw_missing
    if (finalCategory === 'withdraw_missing') {
      if (nowMinutes >= 1325 || nowMinutes < 125) {
        // ช่วงปิดถอน
        if (replyWithdrawError) {
          messages.push({ type: 'text', text: replyWithdrawError });
        }
      } else {
        // ⛔ นอกช่วงปิดถอน เพิกเฉย
        clearUserMessageHistory(userId);
        console.log('⏹️ เพิกเฉย "ข้อความการถอนเงิน" เพราะอยู่นอกช่วงปิดถอน');
        broadcastLog('⏹️ เพิกเฉย "ข้อความการถอนเงิน" เพราะอยู่นอกช่วงปิดถอน');
        return;
      }
    }

    // ✅ กรณี withdraw_error
    if (finalCategory === 'withdraw_error') {
      if (nowMinutes >= 1345 || nowMinutes < 125) {
        // ช่วงปิดถอน
        if (replyWithdrawError) {
          messages.push({ type: 'text', text: replyWithdrawError });
        }
      } else {
        clearUserMessageHistory(userId);
        console.log('⏹️ เพิกเฉย "ข้อความการถอนเงิน" เพราะอยู่นอกช่วงปิดถอน');
        broadcastLog('⏹️ เพิกเฉย "ข้อความการถอนเงิน" เพราะอยู่นอกช่วงปิดถอน');
        return;
      }
    }

    if (finalCategory === 'register') {
      if (!isNew) {
        clearUserMessageHistory(userId);
      }

      if (isNew && replyInfo) {
        messages.push({ type: 'text', text: replyInfo });
      }

      if (messages.length > 0) {
        try {
          await client.replyMessage(replyToken, messages);
          clearUserMessageHistory(userId);
        } catch (err) {
          console.error('❌ ส่งข้อความ "ขอข้อมูล" ล้มเหลว:', err);
          broadcastLog('❌ ส่งข้อความ "ขอข้อมูล" ล้มเหลว:', err);
        }
      }

      waitTimeouts.delete(userId);
      return;
    }

    if (finalCategory === 'greeting' && hasCategory(userId, 'register')) {
      clearUserMessageHistory(userId);
      return;
    }

    if (finalCategory === 'greeting' && hasUserSentImage(userId)) {
      console.log(`เพิกเฉย "ข้อความทักทาย" เพราะมีการส่งภาพมา`);
      broadcastLog(`เพิกเฉย "ข้อความทักทาย" เพราะมีการส่งภาพมา`);
      clearUserMessageHistory(userId);
      return;
    }

    if (finalCategory === 'greeting') {
      if (replyGreeting) {
        messages.push({ type: 'text', text: replyGreeting });
      }
    }

    if (messages.length > 0) {
      try {
        await client.replyMessage(replyToken, messages);
        clearUserMessageHistory(userId);
      } catch (err) {
        console.error('❌ ส่งข้อความล้มเหลว:', err);
        broadcastLog('❌ ส่งข้อความล้มเหลว:', err);
      }
    } else {
      console.log('⚠️ ไม่มีข้อความสำหรับตอบกลับ');
      broadcastLog('⚠️ ไม่มีข้อความสำหรับตอบกลับ');
      clearUserMessageHistory(userId);
    }
    waitTimeouts.delete(userId);
  }, 10000); // ✅ รอ 10 วินาที
}