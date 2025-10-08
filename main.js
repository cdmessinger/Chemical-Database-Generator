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
        const chemicalData = {};
        chemicalData.searchQuery = currentCAS;
        const errorStatements = [];
        try{
            console.log(`Request ${i}, ${currentCAS}`)
            console.log(`Fetching PubChem data for ${currentCAS}...`);
            const apiRawData = await fetchFromPubChem(currentCAS);
            if (!apiRawData) {
                console.warn(`Pubchem Error: ${currentCAS} — no data returned from API.`);
                errorStatements.push(`Pubchem Error: ${currentCAS} — no data returned from API.`)
                continue; //skipping Pubchem data, continuing to scrape fisher SDS
            }
            else {
                console.log('Data retrieved from API', apiRawData);
                chemicalData.searchQueryViaParser = apiRawData.searchQuery;
                chemicalData.cidNumber = apiRawData.cid || 'Not Found';
                chemicalData.chemicalName = apiRawData.chemicalName || 'Not Found';
                chemicalData.synonyms = apiRawData.synonyms || [];
            }
            // Usage:
            console.log(`Parsing data for ${currentCAS}...`);
            const parsedData = await parsePubChemData(apiRawData);

            if (!parsedData) {
                console.warn(`Pubchem Error: ${currentCAS} — could not parse API data.`)
                errorStatements.push(`Pubchem Error: ${currentCAS} — could not parse API data.`)
            }
            else {
                console.log(`Parsed data for ${currentCAS}`);
                chemicalData.pubChemCasNumbers = parsedData.casNumbers || [];
                chemicalData.pubChemMolecularFormula = parsedData.molecularFormula || 'Not found';
                chemicalData.pubChemMolecularWeight = parsedData.molecularWeight || 'Not found';
                chemicalData.pubChemSignalWord = parsedData.signalWord || 'Not Found';
                chemicalData.pubChemPictograms = parsedData.pictograms || [];
                chemicalData.pubChemHazardStatements = parsedData.hazardStatements || [];
                if (parsedData?.errorStatements?.length) {
                    for (const error of parsedData.errorStatements) {
                        errorStatements.push(error);
                    }
                }
            }

            

            // const sdsLinks = await scrapeFisherSDS(currentCAS, page, cookieString);
            


        chemicalData.errorStatements = errorStatements;
        console.log('Chemical data:', chemicalData);
        allRecords.push(chemicalData);
        } catch (err) {
            console.error(`Unexpected error processing ${currentCAS}: ${err.message}`);
            errorStatements.push(`Unexpected error processing ${currentCAS}: ${err.message}`);
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
    // '7758-98-7' // copper ii sulfate
]


run(casList);
