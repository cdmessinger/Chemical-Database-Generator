import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import * as pdfjsLibRaw from "pdfjs-dist/legacy/build/pdf.js";
const pdfjsLib = pdfjsLibRaw.default || pdfjsLibRaw;

import fetch from 'node-fetch';

export async function scrapeFisherSDS(casNumber, page, cookieString) {

  //search fisher website for sds sheets
  const searchUrl = `https://www.fishersci.com/us/en/catalog/search/sds?selectLang=EN&store=&msdsKeyword=${encodeURIComponent(casNumber)}`;
  console.log("searching:", searchUrl);

  await page.goto(searchUrl, {waitUntil: "domcontentloaded", timeout: 30000 });

  //grab the first 5 sds links on the page and puts them in an array
  const sdsLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
    .map(a => a.href)
    .filter(href => href && href.toLowerCase().includes('partnumber'))
    .slice(0,1); //temp 1 for testing
  })

  //check if we got any sds links, tell us if not
    if (!sdsLinks.length) {
      console.log('no sds links found');
      return;
    }

    for (let i=0; i<sdsLinks.length; i++) {
      const currLink = sdsLinks[i];
      console.log(i+1, currLink);


      const pdftext = await pdfExtract(currLink, cookieString)
      //call pdfExtract function
    }


    return sdsLinks;
  }

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
    const saveDir = "C:/Users/cd02m/OneDrive/Desktop/Chem_Database/Chemical-Database-Generator/temp_pdf";
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

    const cleanText = rawText
        .replace(/Page\s*\d+\s*(?:\/|of)\s*\d+/gi, '')  // Remove 'Page 1 of 8' or 'Page 1/8'
        .replace(/_{3,}/g, '')                          // Remove long underscore lines
        .replace(/^\s*\d+\s*$/gm, '')                   // Remove lines that are just numbers
        .replace(/\f/g, '')                             // Remove form-feed page breaks
        .replace(/\s{2,}/g, ' ')                 // Collapse extra spaces
        .replace(new RegExp(contactInfo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '') //removes contact info block that sometimes causes issues





    fs.writeFileSync(textPath, cleanText, 'utf-8');
    return cleanText;

    } catch (err) {
      console.error('Error', err.message);
    }
    
  }

  // function pdfExtract(textPath) {

  // }