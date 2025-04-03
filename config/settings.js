import fs from 'fs';

const DEFAULT_SETTINGS = {
  timeLimit: 120000,          // 120 seconds * 1000
  sameQrTimeLimit: 1200000,   // 1200 seconds * 1000
  maxMessagesPerUser: 3,
  maxMessagesSamePerUser: 2,
  maxProcessingPerUser: 2
};

export function loadSettings() {
  try {
    const data = fs.readFileSync('./config/settings.json', 'utf8');
    return JSON.parse(data); // ✅ ใช้ค่า ms ตรง ๆ
  } catch (error) {
    saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  // ✅ ไม่ต้องแปลงค่าใด ๆ อีก เพราะ frontend ส่งมาเป็น ms แล้ว
  fs.writeFileSync('./config/settings.json', JSON.stringify(settings, null, 2));
}