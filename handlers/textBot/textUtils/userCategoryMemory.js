const userSavedCategories = new Map(); // global

function saveCategoryForUser(userId, category) {
  const now = Date.now();

  if (!userSavedCategories.has(userId)) {
    userSavedCategories.set(userId, []);
  }

  // ✅ ไม่ลบรายการเก่า — เก็บไว้ให้ hasCategoryInHour ใช้ได้
  userSavedCategories.get(userId).push({ category, timestamp: now });
}

// ✅ ตรวจสอบว่าภายใน 15 นาทีมี category นี้ไหม
function hasCategory(userId, targetCategory) {
  const now = Date.now();
  const history = userSavedCategories.get(userId) || [];

  return history.some(entry =>
    entry.category === targetCategory &&
    now - entry.timestamp <= 15 * 60 * 1000
  );
}

// ✅ ตรวจสอบว่าภายใน 1.5 ชั่วโมงมี category นี้ไหม
function hasCategoryInHour(userId, targetCategory) {
  const now = Date.now();
  const history = userSavedCategories.get(userId) || [];

  return history.some(entry =>
    entry.category === targetCategory &&
    now - entry.timestamp <= 90 * 60 * 1000
  );
}
export { saveCategoryForUser, hasCategory, hasCategoryInHour };