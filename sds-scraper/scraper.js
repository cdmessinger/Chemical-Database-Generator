import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { createWorker } from "tesseract.js";

export async function scrapeFisherSDS(casNumber) {
  // 📁 File paths
  const saveDir = "C:/Users/cd02m/OneDrive/Desktop/Chem_Database/Chemical-Database-Generator/temp_pdf";
  if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

  const textPath = path.join(saveDir, "temp.txt");
  const screenshotDir = path.join(saveDir, "screenshots");

  // Clear old screenshots
  if (fs.existsSync(screenshotDir)) {
    fs.readdirSync(screenshotDir).forEach(f => fs.unlinkSync(path.join(screenshotDir, f)));
  } else {
    fs.mkdirSync(screenshotDir);
  }

  const searchURL = `https://www.fishersci.com/us/en/catalog/search/sds?selectLang=EN&msdsKeyword=${encodeURIComponent(
    casNumber
  )}`;
  console.log("🔍 Searching SDS page:", searchURL);

  // 🧠 Launch browser
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });
  const page = await browser.newPage();

  // 1️⃣ Navigate to SDS search page
  await page.goto(searchURL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // 2️⃣ Find the first SDS link
  const sdsLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a"))
      .map(a => a.href)
      .filter(href => href && href.toLowerCase().includes("partnumber"))
      .slice(0, 1)
  );

  if (!sdsLinks.length) {
    console.log("❌ No SDS links found for CAS:", casNumber);
    await browser.close();
    return;
  }

  const productUrl = sdsLinks[0];
  console.log("🔎 Opening SDS:", productUrl);
  await page.goto(productUrl, { waitUntil: "networkidle0", timeout: 40000 });

  console.log("⏳ Waiting for SDS to fully load...");
  await new Promise(res => setTimeout(res, 8000));

  // 3️⃣ Focus the viewer before starting screenshots
  console.log("🖱️ Clicking into SDS viewer to focus...");
  await page.mouse.click(800, 400);
  await new Promise(res => setTimeout(res, 1500));

  // 4️⃣ Screenshot + scroll loop
  console.log("📸 Starting visual capture...");
  const totalShots = 20; // number of screenshots to attempt
  const scrollPause = 2000; // wait time between scrolls
  const screenshots = [];

  for (let i = 1; i <= totalShots; i++) {
    const shotPath = path.join(screenshotDir, `page_${i}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`📸 Captured screenshot ${i}: ${shotPath}`);
    screenshots.push(shotPath);

    // Attempt both PageDown and mouse wheel scrolling
    await page.keyboard.press("PageDown");
    await page.mouse.wheel({ deltaY: 800 });
    await new Promise(res => setTimeout(res, scrollPause));
  }

  console.log("✅ Screenshotting complete. Beginning OCR...");

  // 5️⃣ OCR each screenshot
  const worker = await createWorker("eng");
  let combinedText = "";

  for (let i = 0; i < screenshots.length; i++) {
    console.log(`🔍 OCR processing screenshot ${i + 1}/${screenshots.length}...`);
    const {
      data: { text },
    } = await worker.recognize(screenshots[i]);
    combinedText += `\n\n--- PAGE ${i + 1} ---\n\n${text}`;
  }

  await worker.terminate();

  // 6️⃣ Save combined OCR text
  fs.writeFileSync(textPath, combinedText, "utf-8");
  console.log(`✅ All OCR text saved to: ${textPath}`);

  await browser.close();
}


