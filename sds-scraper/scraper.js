import puppeteer from "puppeteer";

export async function scrapeFisherSDS(casNumber) {
  const searchURL = `https://www.fishersci.com/us/en/catalog/search/sds?selectLang=EN&store=&msdsKeyword=${encodeURIComponent(casNumber)}`;
  console.log("🔍 Searching:", searchURL);

  const browser = await puppeteer.launch({ headless: false, slowMo: 50 });
  const page = await browser.newPage();

  // ✅ Use 'networkidle' not 'networkidle2'
  await page.goto(searchURL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // ✅ Get first 5 SDS product links
  const sdsLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a"))
      .map(a => a.href)
      .filter(href => href && href.toLowerCase().includes("partnumber"))
      .slice(0, 1);
  });

  // ✅ Pass 'page' and await this function
  await findMostRecentSDS(sdsLinks, page);

  // await browser.close();
}

async function findMostRecentSDS(sdsLinks, page) {
  for (let i = 0; i < sdsLinks.length; i++) {
    const url = sdsLinks[i];
    console.log(`Visiting product page ${i + 1}: ${url}`);

    // ✅ Visit each SDS page
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // ✅ Grab all visible text and search for revision date
    const revisionDate = await page.evaluate(() => {
      const pageText = document.body.innerText;
      const match = pageText.match(
        /Revision Date[:\s]+([A-Za-z]+\s\d{1,2},?\s\d{4}|\d{4}-\d{2}-\d{2})/i
      );
      return match ? match[1] : null;
    });

    // ✅ Log result
    if (revisionDate) {
      console.log(`📅 Revision date found: ${revisionDate}`);
    } else {
      console.log("❌ No Revision Date Found for this entry");
    }
  }
}
