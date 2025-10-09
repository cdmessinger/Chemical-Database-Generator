import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import * as pdfjsLibRaw from "pdfjs-dist/legacy/build/pdf.js";
const pdfjsLib = pdfjsLibRaw.default || pdfjsLibRaw;

import fetch from 'node-fetch';
import { text } from "stream/consumers";

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


      const pdfText = await pdfExtract(currLink, cookieString);
      const sdsData = extractSDSData(chemicalData, pdfText);
      const confidenceScore = validateData(chemicalData, sdsData);
    }

      

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
    
    return textPath;

    } catch (err) {
      console.error('Error', err.message);
    }
    
  }


  function extractSDSData(chemicalData, pdfText) {
      
    const text = fs.readFileSync(pdfText, 'utf-8');

    console.log('data block 2', chemicalData)
    
        const sdsInformation = { errorCode: [] };
        const searchedCAS = chemicalData.searchQuery
        sdsInformation.sdsSearchQuery = searchedCAS;
        let validateInformation = true;
        let normalizedDate = null;
    
        try {
            //Grab revision date
            const revision = text.match(/Revision Date[:\s]*([\s\S]*?)(?=Revision Number|Product Name|$)/i);
            if (revision && revision[1]) {
                let rawDate = revision[1].trim();
                sdsInformation.revisionDate = rawDate;
    
                const formattedDate = rawDate.replace(
                    /(\d{2})-(\w{3})-(\d{4})/,
                    (match, day, month, year) => {
                        const months = {
                            Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
                            Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
                        };
                        return `${year}-${months[month]}-${day}`;
                    }
                );
                normalizedDate = new Date(formattedDate);
    
                if (isNaN(normalizedDate.getTime())) {
                    sdsInformation.revisionDate = `Invalid Date Format: ${rawDate}`;
                    sdsInformation.errorCode.push('Could not check Revision Date Automatically');
                }
            } 
            else {
                    sdsInformation.revisionDate = "Revision date not found";
                    sdsInformation.errorCode.push("Error: could not retrieve revision date");
            }
    
    
            //Grab Product Name
            const productName = text.match(/Product Name[:\s]*([\s\S]*?)(?=Cat)/i); //stops at "cat" for catalog number. If chemical contains "cat" it will break, unlikely.
            if (productName && productName[1]) {
                sdsInformation.productName = productName[1].trim();
            }
            else {
                sdsInformation.productName = 'Product name not found';
                validateInformation = false;
                sdsInformation.errorCode.push("Error: could not retrieve product name from SDS");
            }
    
    
            //Remove page headers - Fisher has page breaks with name/revision date headers, we want to filter out all of these to not get parsing issues.
            
                const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape any special regex characters in the product name and revision date
    
                const cleanedText = text
                .replace(new RegExp(escapeRegex(sdsInformation.productName), 'gi'), '')
                .replace(/Revision Date/gi, '')
                .replace(new RegExp(escapeRegex(sdsInformation.revisionDate), 'gi'), '');
    
    
    
            //grab CAS No
            const casNumber = cleanedText.match(/CAS[\s\-]*No\.?[:\s]*([\d\s\-]+)/i);
            if (casNumber && casNumber[1]) {
                sdsInformation.casNumber = casNumber[1].trim();
            }
            else {
                sdsInformation.casNumber = 'CAS Number not found in SDS';
                validateInformation = false;
                sdsInformation.errorCode = sdsInformation.errorCode || [];
                sdsInformation.errorCode.push("Error: could not retrieve CAS number from SDS");
            }
    
            //Grab Synonyms
            const synonyms = cleanedText.match(/Synonyms[:\s]*([\s\S]*?)(?=Recommended)/i); //stops at "recommended" which is next section
            if (synonyms && synonyms[1]) {
                sdsInformation.synonyms = synonyms[1].trim();
            }
            else {
                sdsInformation.synonyms = 'Synonyms not found';
                validateInformation = false;
                sdsInformation.errorCode.push("Error: could not retrieve synonyms from SDS");
            }
    
            //Grab Signal Word
            const signalWord = cleanedText.match(/Signal Word[:\s]*([\s\S]*?)(?=Hazard)/i);
            if (signalWord && signalWord[1]) {
                sdsInformation.signalWord = signalWord[1].trim();
            }
            else {
                sdsInformation.signalWord = 'Signal word not found';
                validateInformation = false;
                sdsInformation.errorCode.push("Error: could not retrieve Signal Word from SDS");
            }
    
            //Grab Hazard Statements and separate them for csv exporter later
            const unfilteredHazards = cleanedText.match(/Hazard Statements[:\s]*([\s\S]*?)(?=Precautionary|$)/i);
    
            if (unfilteredHazards && unfilteredHazards[1]) {
                const hazardBlock = unfilteredHazards[1].trim();
    
                // 🧪 Only capture hazard statements that *start* with Causes, May, Harmful, H###
                const hazardArray = hazardBlock.match(/\b(?:Causes|May|Harmful|H\d{3})[\s\S]*?(?=\b(?:Causes|May|Harmful|H\d{3})\b|$)/gi) || [];
    
                const formattedHazards = hazardArray.map(h => h.trim()).join('|||SEP|||'); //this allows us to parse it later for csv easier
    
                sdsInformation.hazardStatements = formattedHazards.length > 0
                    ? formattedHazards
                    : 'No valid hazard statements found';
            } else {
                sdsInformation.hazardStatements = 'Hazard Statements not found';
                validateInformation = false;
                sdsInformation.errorCode.push("Error: could not retrieve Hazard Statements from SDS");
            }
    
            
            //Grab Class
            const transportSection = cleanedText.match(/(?:14\.\s*)?Transport\s+Information[:\s]*([\s\S]*?)(?=(?:15\.\s*)?Regulatory\s+Information)/i);
            if (transportSection && transportSection[1]) {
                const dotClass = transportSection[1].match(/Class[:\s]*([\s\S]*?)(?=Packing)/i);
                if (dotClass && dotClass[1]) {
                    sdsInformation.class = dotClass[1].trim();
                }
                else {
                    sdsInformation.class = 'Hazard Class not found';
                    validateInformation = false;
                    sdsInformation.errorCode.push("Error: could not retrieve Hazard Class from SDS");
                }
            } 
            else {
                sdsInformation.class = 'Transportation Section not found: could not get Hazard Class';
                validateInformation = false;
                sdsInformation.errorCode.push("Error: could not retrieve Hazard Class from SDS");
            }
    
            //validating data
    
            let statusCode = 'green';
            
            const casRegex = /^\d{2,7}-\d{2}-\d$/;
            if (!casRegex.test(sdsInformation.casNumber)) {
                sdsInformation.errorCode.push("Check CAS number, it looks weird");
            }
            
            const normalizeCAS = str => str.replace(/\s+/g, "");
    
            if (normalizeCAS(searchedCAS) !== normalizeCAS(sdsInformation.casNumber)) {
                statusCode = 'red';
                sdsInformation.errorCode.push('CAS numbers do not match - verify SDS sheet')
            } else if (validateInformation === false) {
                statusCode = 'orange';
            }
    
            if (normalizedDate && normalizedDate < cutoffDate) {
                statusCode = 'red';
                sdsInformation.errorCode.push(`SDS revision date (${normalizedDate.toISOString().split('T')[0]}) is before cutoff (${cutoffDate.toISOString().split('T')[0]})`);
            };
            sdsInformation.statusCode = statusCode;        
        } catch (err) {
            console.error("Error parsing SDS data:", err.message)
            sdsInformation.errorCode.push(`ERROR parsing ALL sds information. ${err.message}`)
            console.log('partial SDS info:', sdsInformation);
        }
        return sdsInformation;
    
    }

    function validateData(chemicalData, sdsData) {

      let confidencescore = 100

      if (chemicalData.searchQuery1 !== sdsData.casNumber) {
        confidencescore -= 40
        console.log(confidencescore)
      }


    }