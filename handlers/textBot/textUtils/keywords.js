//keywords.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { broadcastLog } from "../../../index.js";

// ✅ แทน __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ ใช้ path.join กับ __dirname
const keywordDir = path.join(__dirname, '..', 'keywords');

const keywords = {};

// ✅ แทน require ด้วย JSON.parse
fs.readdirSync(keywordDir).forEach(file => {
  if (file.endsWith('.json')) {
    const category = path.basename(file, '.json');
    const content = fs.readFileSync(path.join(keywordDir, file), 'utf8');
    try {
      keywords[category] = JSON.parse(content);
    } catch (err) {
      console.error(`❌ Error loading ${file}:`, err);
      broadcastLog(`❌ Error loading ${file}:`, err);
    }
  }
});

function detectCategory(text) {
  if (typeof text !== 'string') return null;

  for (const [category, keywordList] of Object.entries(keywords)) {
    for (const keyword of keywordList) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  return null;
}

export { detectCategory };

