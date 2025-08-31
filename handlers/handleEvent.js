// handlerEvent.js
import Shop from '../models/Shop.js';                     
import { handleImageEvent } from './handlerImage.js';      
import { handleTextEvent } from './handleText.js';
import { broadcastLog } from '../index.js';               

const waitTimeouts = new Map();
const userMessageHistory = new Map();
const usersWhoSentImage = new Map(); 
const usersWhoSentSlip = new Map(); 
const slipTimeouts = new Map();

async function handleEvent(event, client, prefix, linename, qrDatabase) {
  // ✅ โหลดข้อมูลร้านค้า
  const shop = await Shop.findOne({ prefix });

  // ✅ ตรวจสอบว่าร้านค้านี้เปิดใช้งานหรือไม่
  if (!shop || !shop.status) return;

  const eventType = event.message?.type || event.type;

  console.log(`📩 ข้อความ: ${eventType} จาก ${linename}`);
  broadcastLog(`📩 ข้อความ: ${eventType} จาก ${linename}`);

  if (event.type === "message" && event.message.type === "text") {
    await handleTextEvent(event, client);
    return;
  }

  if (event.type === "message" && event.message.type === "image") {
    await handleImageEvent(event, client, prefix, linename, qrDatabase);
    return;
  }
}

function clearUserTimeout(userId) {
  if (waitTimeouts.has(userId)) {
    clearTimeout(waitTimeouts.get(userId));
    waitTimeouts.delete(userId);
    console.log('🧹 ล้าง timeout เดิมของ', userId);
  }
}

function clearUserMessageHistory(userId) {
  if (userMessageHistory.has(userId)) {
    userMessageHistory.delete(userId);
    console.log(`🧹 เคลียร์ข้อความของผู้ใช้ ${userId} แล้ว`);
  }
}

function getTime() {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
  const date = new Date(now);
  return date.getHours() * 60 + date.getMinutes(); // เวลาเป็นนาที เช่น 22:30 → 1350
}

// ✅ สำหรับภาพทั่วไป (ไม่ใช่สลิป)
function setUserSentImage(userId) {
  usersWhoSentImage.set(userId, Date.now());
  setTimeout(() => usersWhoSentImage.delete(userId), 15 * 60 * 1000);
}

function hasUserSentImage(userId) {
  return usersWhoSentImage.has(userId);
}

// ✅ สำหรับสลิป (มี QR)
function setUserSentSlip(userId) {
  usersWhoSentSlip.set(userId, Date.now());
  setTimeout(() => usersWhoSentSlip.delete(userId), 15 * 60 * 1000);
}

function hasUserSentSlip(userId) {
  return usersWhoSentSlip.has(userId);
}

function clearUserSentSlip(userId) {
  usersWhoSentSlip.delete(userId);

  if (slipTimeouts.has(userId)) {
    clearTimeout(slipTimeouts.get(userId));
    slipTimeouts.delete(userId);
  }
}

export {
  handleEvent,
  clearUserTimeout,
  clearUserMessageHistory,
  getTime,
  hasUserSentSlip,
  hasUserSentImage,
  setUserSentSlip,
  setUserSentImage,
  clearUserSentSlip,
  waitTimeouts,
  userMessageHistory
};