import {
  puppeteer,
  fs,
  path,
  pdfjsLib,
  pdfParse,
  fetch,
  text,
  sleep
} from '../utils/index.js'

export async function scrapeFisherSDS(chemicalData, page, cookieString) {

  const searchQuery = chemicalData.searchQuery;

  //search fisher website for sds sheets
  const searchUrl = `https://www.fishersci.com/us/en/catalog/search/sds?selectLang=EN&store=&msdsKeyword=${encodeURIComponent(searchQuery)}`;
  console.log("searching:", searchUrl);

  await page.goto(searchUrl, {waitUntil: "domcontentloaded", timeout: 30000 });

  //grab the first 5 sds links on the page and puts them in an array
  const sdsLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
    .map(a => a.href)
    .filter(href => href && href.toLowerCase().includes('partnumber'))
    .slice(0,1); //grab first 5 links on page
  })

  //check if we got any sds links, tell us if not
    if (!sdsLinks.length) {
      console.log('no sds links found');
      return;
    }

  


    let bestSDS = {};
    for (let i=0; i<sdsLinks.length; i++) {
      const currLink = sdsLinks[i];
      console.log(i+1, currLink);

      let textPath = await pdfExtract(currLink, cookieString);
      let sdsData = pdfParse(chemicalData, textPath);

      if (!bestSDS.sdsConfidenceScore || sdsData.sdsConfidenceScore && sdsData.sdsConfidenceScore > bestSDS.sdsConfidenceScore) {
        console.log('New Best SDS found')
        bestSDS = sdsData;
        bestSDS.sdsLink = currLink;
      }

      if (bestSDS.sdsConfidenceScore > 70) {
        console.log('SDS PASSES VALIDATION');
        return bestSDS;
      } else {
        console.log('Checking next SDS for better confidence score');
        await sleep();
      }
   };
      console.warn('No SDS passes validation - returning best avaliable')
      return bestSDS;
};

  async function pdfExtract(currLink, cookieString) {
    try {
    console.log(`Trying to get a pdf for ${currLink}`)


    const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://www.fishersci.com/",
    "Accept-Language": "en-US,en;q=0.9",
    "Cookie": cookieString || "" // pass in fresh cookies if needed
  };

    //save path to file
    const saveDir = "./data/temp_pdf";
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
    const pdfPath = `${saveDir}/temp.pdf`;
    const textPath = `${saveDir}/temp.txt`; 

    const res = await fetch(currLink , { headers });
    if (!res.ok) throw new Error(`Failed to fetch ${res.status}`);
    const buffer = await res.buffer();

    fs.writeFileSync(pdfPath, buffer);
    console.log(`PDF saved to ${pdfPath}`)

    console.log('Parsing SDS PDF...')
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    console.log( `Pdf loaded with ${pdf.numPages} pages`);

    let rawText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const currPage = await pdf.getPage(i);
      const content = await currPage.getTextContent();
      rawText += content.items.map(item => item.str).join(" ") + "\n";
    }
    console.log('first 300 characters:', rawText.slice(0,300))
    
    //filter text to remove page breaks - can cause weird parsing

    const contactInfo = 'Company Thermo Fisher Scientific Chemicals, Inc. 30 Bond Street Ward Hill, MA 01835-8099 Tel: 800-343-0660 Fax: 800-322-4757 Emergency Telephone Number For information US call: 001-800-227-6701 / Europe call: +32 14 57 52 11 Emergency Number US: 001-201-796-7100 / Europe: +32 14 57 52 99 CHEMTREC Tel. No. US: 001-800-424-9300 / Europe: 001-703-527-3887'
    const contactInfo2 = 'Company Fisher Scientific Company One Reagent Lane Fair Lawn, NJ 07410 Tel: (201) 796-7100 Acros Organics One Reagent Lane Fair Lawn, NJ 0741'

    let cleanText = rawText
  .replace(/Page\s*\d+\s*(?:\/|of)\s*\d+/gi, '')     // Remove 'Page 1 of 8' or 'Page 1/8'
  .replace(/_{3,}/g, '')                             // Remove long underscore lines
  .replace(/^\s*\d+\s*$/gm, '')                      // Remove lines that are just numbers
  .replace(/\f/g, '')                                // Remove form-feed page breaks
  .replace(/\s{2,}/g, ' ')                           // Collapse extra spaces
  .replace(new RegExp(contactInfo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
  .replace(new RegExp(contactInfo2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ''); // Remove contact info block


  const sectionMap = [
  { number: 1, title: 'Identification' },
  { number: 2, title: 'Hazard(s) identification' },
  { number: 3, title: 'Composition/Information on Ingredients' },
  { number: 4, title: 'First-aid measures' },
  { number: 5, title: 'Fire-fighting measures' },
  { number: 6, title: 'Accidental release measures' },
  { number: 7, title: 'Handling and storage' },
  { number: 8, title: 'Exposure controls' },
  { number: 9, title: 'Physical and chemical properties' },
  { number: 10, title: 'Stability and reactivity' },
  { number: 11, title: 'Toxicological information' },
  { number: 12, title: 'Ecological information' },
  { number: 13, title: 'Disposal considerations' },
  { number: 14, title: 'Transport information' },
  { number: 15, title: 'Regulatory information' },
  { number: 16, title: 'Other information' }
];

for (const { number, title } of sectionMap) {
  // make a forgiving pattern (handles spacing and case issues)
  const pattern = new RegExp(
    `\\b${number}\\s*\\.\\s*${title.replace(/\s+/g, '\\s*')}\\b`,
    'i'
  );

  cleanText = cleanText.replace(
    pattern,
    `\n\n<<<SECTION_${number}_START>>>\n${number}\n\n`
  );
}

    fs.writeFileSync(textPath, cleanText, 'utf-8');
    
    return textPath;

    } catch (err) {
      console.error('Error', err.message);
    }
    
  }

