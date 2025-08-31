import { getCachedSettings } from "./settingsManager.js";

const userProcessingQueue = new Map();

function getUserQueue(userId) {
  if (!userProcessingQueue.has(userId)) {
    userProcessingQueue.set(userId, []);
  }
  return userProcessingQueue.get(userId);
}

function addToUserQueue(userId, taskFn) {
  const queue = getUserQueue(userId);
  const { maxProcessingPerUser } = getCachedSettings(); // ✅ โหลดสดทุกครั้ง

  if (queue.length >= maxProcessingPerUser) {
    console.log(`⛔ [${userId}] เพิกเฉย ส่งสลิปเกิน ${maxProcessingPerUser} ครั้งต่อเนื่อง`);
    finishUserTask(userId); // ✅ ล้างคิว เพื่อให้สามารถส่งใหม่ได้รอบหน้า
    return false;
  }

  queue.push(taskFn);
  console.log(`✅ [${userId}] เพิ่มงานเข้า queue แล้ว (รวมเป็น ${queue.length})`);

  if (queue.length === 1) {
    taskFn();
  }

  return true;
}

function finishUserTask(userId) {
  const queue = userProcessingQueue.get(userId);
  if (!queue) {
    console.log(`⚠️ [${userId}] ไม่มีคิวให้ลบ`);
    return;
  }

  console.log(`ลบออกจาก queue`);
  queue.shift();

  if (queue.length > 0) {
    queue[0]();
  } else {
    userProcessingQueue.delete(userId);
  }
}

export { addToUserQueue, finishUserTask };
