import puppeteer from "puppeteer";
import fs from 'fs';
// import pdf from "pdf-parse";

export async function scrapeFisherSDS(casNumber) {

  //search fisher website for sds sheets
  const searchUrl = `https://www.fishersci.com/us/en/catalog/search/sds?selectLang=EN&store=&msdsKeyword=${encodeURIComponent(casNumber)}`;
  console.log("searching:", searchUrl);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(searchUrl, {waitUntil: "domcontentloaded", timeout: 30000 });
  
  //grab the first 5 sds links on the page and puts them in an array
  const sdsLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
    .map(a => a.href)
    .filter(href => href && href.toLowerCase().includes('partnumber'))
    .slice(0,5);
  })

  //check if we got any sds links, tell us if not
    if (!sdsLinks.length) {
      console.log('no sds links found');
      await browser.close();
      return;
    }

    for (let i=0; i<sdsLinks.length; i++) {
      const currLink = sdsLinks[i];
      console.log(i+1, currLink);
      //call revision date check function here
      //if revision date < set date && name/cas match, break loop
      //if not, check next sds sheet
      //save most recent sds in case none match and flag it
    }

    await browser.close();

    setTimeout(() => {
      console.log('timeout reached, exiting...')
      process.exit(0)
    }, 30000);
  }




// export async function scrapeFisherSDS(casNumber) {
//   const searchURL = `https://www.fishersci.com/us/en/catalog/search/sds?selectLang=EN&store=&msdsKeyword=${encodeURIComponent(casNumber)}`;
//   console.log("Searching:", searchURL);

//   const browser = await puppeteer.launch({ headless: true });
//   const page = await browser.newPage();

//   let pdfBuffer = null;

//   page.on('response', async(response) => {
//     const url = response.url();
//     if (url.toLowerCase().endsWith('.pdf') && !pdfBuffer) {
//       console.log(`found pdf response`, url)
//       try {
//         pdfBuffer = await response.buffer();
//         fs.writeFileSync(`${casNumber}.pdf`, pdfBuffer);
//         console.log(`Saved pdf as ${casNumber}.pdf`);
//       } catch (err) {
//         console.error('Error saving pdf;', err);
//       }
//     }
//   })

//   // ✅ Use 'networkidle' not 'networkidle2'
//   await page.goto(searchURL, { waitUntil: "domcontentloaded", timeout: 30000 });

//   // ✅ Get first 5 SDS product links
//   const sdsLinks = await page.evaluate(() => {
//     return Array.from(document.querySelectorAll("a"))
//       .map(a => a.href)
//       .filter(href => href && href.toLowerCase().includes("partnumber"))
//       .slice(0, 5);
//   });

//   if (!sdsLinks.length) {
//     console.log(`no SDS found`)
//     await browser.close();
//     return;
//   }

//   let productUrl = sdsLinks[0]; // for testing, refactor later
//   console.log('visting sds page', productUrl);

//   //visit product sds page
//   await page.goto(productUrl, {waitUntil: "domcontentloaded", timeout: 30000 });
//   await page.waitForTimeout(5000); // let page load for a few seconds

//   //parse pdf text
//   if (pdfBuffer) {

//     console.log('pdf Buffer type:', typeof pdfBuffer);
//     console.log('pdf size:', pdfBuffer ? pdfBuffer.length : 'null')

//     const parsed = await pdf(pdfBuffer);
//     console.log('first 300 char of sds');
//     console.log(parsed.text.slice(0, 300));
//   } else {
//     console.log('could not get pdf for this product')
//   }

//   await browser.close();
// }


// // async function getRevisionDateFromPDF(testpdf) {
// //   try {
// //     console.log(`fetching pdf from ${testpdf}`)
// //     const response = await fetch(testpdf);
// //     if (!response.ok) throw new Error(`failed to fetch PDF: ${response.status}`);

// //     const buffer = await response.arrayBuffer();

// //     //parse pdf content
// //     const data = await pdf(Buffer.from(buffer));
// //     const text = data.text

// //     console.log(`first 500 characters:`, text.slice(0,500));
// //   }
// //   catch (err) {
// //     console.error('error reading pdf:', err.message);
// //   }
// // }








// // async function findMostRecentSDS(sdsLinks, page) {
// //   for (let i = 0; i < sdsLinks.length; i++) {
// //     const url = sdsLinks[i];
// //     console.log(`Visiting product page ${i + 1}: ${url}`);

// //     // ✅ Visit each SDS page
// //     await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

// //     // ✅ Grab all visible text and search for revision date
// //     const revisionDate = await page.evaluate(() => {
// //       const pageText = document.body.innerText;
// //       const match = pageText.match(
// //         /Revision Date[:\s]+([A-Za-z]+\s\d{1,2},?\s\d{4}|\d{4}-\d{2}-\d{2})/i
// //       );
// //       return match ? match[1] : null;
// //     });

// //     // ✅ Log result
// //     if (revisionDate) {
// //       console.log(`📅 Revision date found: ${revisionDate}`);
// //     } else {
// //       console.log("❌ No Revision Date Found for this entry");
// //     }
// //   }
// // }
