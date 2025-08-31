const userSavedCategories = new Map(); // global

function saveCategoryForUser(userId, category) {
  const now = Date.now();

  if (!userSavedCategories.has(userId)) {
    userSavedCategories.set(userId, []);
  }

  // ดึงรายการเก่าที่ไม่เกิน 15 นาที
  const previousList = userSavedCategories.get(userId).filter(entry =>
    now - entry.timestamp <= 15 * 60 * 1000
  );

  // เพิ่มรายการใหม่
  previousList.push({ category, timestamp: now });

  userSavedCategories.set(userId, previousList);
}

function hasCategory(userId, targetCategory) {
  const now = Date.now();
  const history = userSavedCategories.get(userId) || [];

  return history.some(entry =>
    entry.category === targetCategory &&
    now - entry.timestamp <= 15 * 60 * 1000
  );
}

export { saveCategoryForUser, hasCategory };