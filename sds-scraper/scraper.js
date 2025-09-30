import puppeteer from "puppeteer";

export async function scrapeFisherSDS(casNumber) {
  const searchURL = `https://www.fishersci.com/us/en/catalog/search/sds?selectLang=EN&store=&msdsKeyword=${encodeURIComponent(casNumber)}`;
  console.log("🔍 Searching:", searchURL);

  // step 1: Launch a headless browser
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // step 2: Go to the search page and wait for network to be idle
  await page.goto(searchURL, { waitUntil: "networkidle2", timeout: 30000 });

   // step 3: select all relavant links on the page
const sdsLinks = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('a')) // turn NodeList into array
    .map(a => a.href) // extract hrefs
    .filter(href => href && href.toLowerCase().includes('partnumber')); // this is how fisher labels their sds links
});

  console.log('found links', sdsLinks);

  await browser.close();

  // return sdsLinks;
}

scrapeFisherSDS('90-15-3')


