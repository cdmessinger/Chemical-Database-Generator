import puppeteer from "puppeteer";
// import pdf from "pdf-parse";
// import fetch from 'node-fetch';

export async function scrapeFisherSDS(casNumber) {
  const searchURL = `https://www.fishersci.com/us/en/catalog/search/sds?selectLang=EN&store=&msdsKeyword=${encodeURIComponent(casNumber)}`;
  console.log("🔍 Searching:", searchURL);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // ✅ Use 'networkidle' not 'networkidle2'
  await page.goto(searchURL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // ✅ Get first 5 SDS product links
  const sdsLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a"))
      .map(a => a.href)
      .filter(href => href && href.toLowerCase().includes("partnumber"))
      .slice(0, 5);
  });

  let productUrl = sdsLinks[0];
  console.log('visting sds page', productUrl);
  
  // ✅ Pass 'page' and await this function

  await browser.close();
}


async function getRevisionDateFromPDF(testpdf) {
  try {
    console.log(`fetching pdf from ${testpdf}`)
    const response = await fetch(testpdf);
    if (!response.ok) throw new Error(`failed to fetch PDF: ${response.status}`);

    const buffer = await response.arrayBuffer();

    //parse pdf content
    const data = await pdf(Buffer.from(buffer));
    const text = data.text

    console.log(`first 500 characters:`, text.slice(0,500));
  }
  catch (err) {
    console.error('error reading pdf:', err.message);
  }
}








// async function findMostRecentSDS(sdsLinks, page) {
//   for (let i = 0; i < sdsLinks.length; i++) {
//     const url = sdsLinks[i];
//     console.log(`Visiting product page ${i + 1}: ${url}`);

//     // ✅ Visit each SDS page
//     await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

//     // ✅ Grab all visible text and search for revision date
//     const revisionDate = await page.evaluate(() => {
//       const pageText = document.body.innerText;
//       const match = pageText.match(
//         /Revision Date[:\s]+([A-Za-z]+\s\d{1,2},?\s\d{4}|\d{4}-\d{2}-\d{2})/i
//       );
//       return match ? match[1] : null;
//     });

//     // ✅ Log result
//     if (revisionDate) {
//       console.log(`📅 Revision date found: ${revisionDate}`);
//     } else {
//       console.log("❌ No Revision Date Found for this entry");
//     }
//   }
// }
