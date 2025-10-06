import { fetchFromPubChem } from './api_requestor.js';
import { parsePubChemData } from './data_parser.js';
import { scrapeFisherSDS } from './sds-scraper/scraper.js';
import { exportToCSV } from './exportToCSV.js';
import puppeteer from 'puppeteer';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run(casList) {

    const allRecords = [];

    //start the websession
    const { browser, page, cookieString } = await openBrowser();
    

    for (let i = 0; i < casList.length; i++) {
        const currentCAS = casList[i];
        try{
            console.log(`Request ${i}, ${currentCAS}`)
            console.log(`Fetching PubChem data for ${currentCAS}...`);
            const apiRawData = await fetchFromPubChem(currentCAS);
            if (!apiRawData) {
                console.warn(`⚠️ Skipping ${currentCAS} — no data returned.`);
                continue;
            }
            else {
                console.log('Data retrieved from API', apiRawData);
            }
            // Usage:
            console.log(`Parsing data for ${currentCAS}...`);
            const parsedData = parsePubChemData(apiRawData);
            console.log(`Parsed data for ${currentCAS}`, parsedData);

            const sdsLinks = await scrapeFisherSDS(currentCAS, page, cookieString);
            
            
            parsedData.sdsLinks = sdsLinks;
            console.log(parsedData);

           allRecords.push(parsedData);
        } catch (err) {
            console.error(`💥 Unexpected error processing ${currentCAS}:`, err);
        }
        //wait 500ms before next API request, per PubChem docs (4 calls per second max). Each chemical needs 2 api calls.
        await sleep(500);
    }


    await closeBrowser(browser);

    exportToCSV(allRecords, 'chemical_database.csv')
}

async function openBrowser() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    //Go to fisher to generate fresh cookies

    await page.goto('https://www.fishersci.com', { waitUntil: 'domcontentloaded' })

    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    console.log('Browser initialized')
    return { browser, page, cookieString };
}

async function closeBrowser(browser) {
    await browser.close();
    console.log('Browser Closed')
}


const casList = [
    // '90-15-3', //1-naphthol
    // '67-64-1' //acetone
    // '71-43-2' //benzene
    // '7647-14-5' //NaCl
    '75-09-2'  //dichloromethane
]


run(casList);
