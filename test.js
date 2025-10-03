import fetch from "node-fetch";
import fs from "fs";
import * as pdfjsLibRaw from "pdfjs-dist/legacy/build/pdf.js";
const pdfjsLib = pdfjsLibRaw.default || pdfjsLibRaw;

const url = "https://www.fishersci.com/store/msds?partNumber=A18200&productDescription=acetone-acs-l&vendorId=VN00033897&keyword=true&countryCode=US&language=en";

// ⚠️ Use your cookie string from cURL here (it’s often required)
const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Referer": "https://www.fishersci.com/",
  "Accept-Language": "en-US,en;q=0.9",
  "Cookie": "YOUR_COOKIE_HERE" // paste full cookie string here
};

// 📁 Save paths
const saveDir = "C:/Users/cd02m/OneDrive/Desktop/Chem_Database/Chemical-Database-Generator/temp_pdf";
if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
const pdfPath = `${saveDir}/final_sds.pdf`;
const textPath = `${saveDir}/final_sds.txt`;

(async () => {
  try {
    console.log("📥 Downloading SDS as PDF...");

    // 1️⃣ Fetch as 'html' but save raw bytes
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`❌ Failed to fetch: ${res.status}`);
    const buffer = await res.buffer();

    // 2️⃣ Save the PDF bytes even if content-type is wrong
    fs.writeFileSync(pdfPath, buffer);
    console.log(`✅ PDF saved to: ${pdfPath}`);

    // 3️⃣ Parse the PDF with pdfjs-dist
    console.log("📖 Parsing SDS PDF...");
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    console.log(`📚 PDF loaded with ${pdf.numPages} pages`);

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(" ") + "\n";
    }

    // 4️⃣ Save text or print preview
    fs.writeFileSync(textPath, text, "utf-8");
    console.log(`✅ Extracted text saved to: ${textPath}`);
    console.log("📄 Preview of extracted text:");
    console.log(text.slice(0, 500));

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
