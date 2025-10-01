import pdf from "pdf-parse";

import path from "path";
import { fileURLToPath } from "url";

// 📦 Check where pdf-parse is actually loaded from
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log("📦 pdf-parse is being loaded from:", require.resolve("pdf-parse", { paths: [__dirname] }));


console.log("🚀 Script is running!");

(async () => {
  try {
    const fake = Buffer.from("not a pdf");
    const result = await pdf(fake);
    console.log("✅ pdf-parse ran:", result.text.slice(0, 100));
  } catch (err) {
    console.error("❌ pdf-parse error:", err.message);
  }
})();
