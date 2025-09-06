const userSavedCategories = new Map(); // global memory store

// ✅ บันทึก category พร้อม timestamp
function saveCategoryForUser(userId, category) {
  const now = Date.now();

  if (!userSavedCategories.has(userId)) {
    userSavedCategories.set(userId, []);
  }

  const entry = { category, timestamp: now };
  userSavedCategories.get(userId).push(entry);

  // ✅ Debug log
  console.log(`✅ [saveCategory] userId: ${userId} | category: ${category} | เวลา: ${new Date(now).toLocaleString('th-TH')} | รวมทั้งหมด: ${userSavedCategories.get(userId).length}`);
}

// ✅ ตรวจสอบว่าภายใน 15 นาทีมี category นี้ไหม
function hasCategory(userId, targetCategory) {
  const now = Date.now();
  const history = userSavedCategories.get(userId) || [];

  const result = history.some(entry =>
    entry.category === targetCategory &&
    now - entry.timestamp <= 15 * 60 * 1000
  );

  if (result) {
    console.log(`🔁 [hasCategory] พบ '${targetCategory}' ภายใน 15 นาทีของ userId: ${userId}`);
    console.log(`📦 ประวัติ:`, history);
  }

  return result;
}

// ✅ ตรวจสอบว่าภายใน 1.5 ชั่วโมงมี category นี้ไหม
function hasCategoryInHour(userId, targetCategory) {
  const now = Date.now();
  const history = userSavedCategories.get(userId) || [];

  return history.filter(entry =>
    entry.category === targetCategory &&
    now - entry.timestamp <= 90 * 60 * 1000
  ).length;
}

// ✅ ลบประวัติทั้งหมดของ userId (เผื่อต้องการ clear)
function clearUserCategoryHistory(userId) {
  userSavedCategories.delete(userId);
  console.log(`🧹 [clearUserCategoryHistory] ลบประวัติของ userId: ${userId}`);
}


export {
  saveCategoryForUser,
  hasCategory,
  hasCategoryInHour,
  clearUserCategoryHistory,
};
