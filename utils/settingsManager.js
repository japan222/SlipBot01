import Setting from "../models/Setting.js";

let cachedSetting = null;

export async function loadSettings() {
  try {
    const setting = await Setting.findOne({ key: "global-settings" });
    if (!setting) throw new Error("ไม่มีข้อมูล Settings");
    cachedSetting = setting.value;
    return setting.value;
  } catch (err) {
    console.error("❌ โหลด settings ไม่สำเร็จ:", err.message);
    return {};
  }
}

export async function saveSettings(data) {
  try {
    await Setting.findOneAndUpdate(
      { key: "global-settings" },
      { $set: { value: data } },
      { upsert: true }
    );
    cachedSetting = data;
  } catch (err) {
    console.error("❌ บันทึก settings ไม่สำเร็จ:", err.message);
    throw err;
  }
}

export function getCachedSettings() {
  return cachedSetting || {};
}

export async function reloadSettings() {
  await loadSettings(); // ต้องใช้ await เพื่อ update ค่าให้ทัน
}
