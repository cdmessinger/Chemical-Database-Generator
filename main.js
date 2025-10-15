import { fetchFromPubChem } from './api_requestor.js';
import { parsePubChemData } from './data_parser.js';
import { scrapeFisherSDS } from './sds-scraper/scraper.js';
import { exportToExcel } from './exportToExcel.js';
import { importExcel } from './excel_importer.js';
import puppeteer from 'puppeteer';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    const allRecords = [];
    const importFilePath = './test_import.xlsx';

    const chemicalList =  await importExcel(importFilePath);

    //start the websession
    const { browser, page, cookieString } = await openBrowser();
    

    for (let i = 0; i < chemicalList.length; i++) {
        const currentCAS = chemicalList[i].casNumber;
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

            

        const sdsData = await scrapeFisherSDS(chemicalData, page, cookieString);
        console.log('sds DATA LOOK HERE IDIOT', sdsData);

        chemicalData.sdsRevisionDate = sdsData.revisionDate;
        chemicalData.sdsProductName = sdsData.productName;
        chemicalData.sdsCASNumber = sdsData.casNumber;
        chemicalData.sdsSynonyms = sdsData.synonyms;
        chemicalData.sdsSignalWord = sdsData.signalWord;
        chemicalData.sdsHazardStatements = sdsData.hazardStatements;
        chemicalData.sdsClass = sdsData.class;
        chemicalData.sdsMolecularFormula = sdsData.molecularFormula;
        chemicalData.sdsMolecularWeight = sdsData.molecularWeight;
        chemicalData.sdsStatusCode = sdsData.statusCode;
        chemicalData.sdsConfidenceScore = sdsData.confidenceScore;
        chemicalData.sdsConfidenceInfo = sdsData.confidenceScoreInfo;
        chemicalData.sdsLink = sdsData.sdsLink;

        if (sdsData?.errorCode?.length) {
            for (const error of sdsData.errorCode) {
                        errorStatements.push(error);
            }
        }

        console.log('entire CHEMICAL BLOCK:', chemicalData)


        chemicalData.errorStatements = errorStatements;
        // console.log('Chemical data:', chemicalData);
        allRecords.push(chemicalData);
        } catch (err) {
            console.error(`Unexpected error processing ${currentCAS}: ${err.message}`);
            errorStatements.push(`Unexpected error processing ${currentCAS}: ${err.message}`);
        }
        //wait 500ms before next API request, per PubChem docs (4 calls per second max). Each chemical needs 2 api calls.

        const baseDelay = Math.floor(Math.random() * 5000) + 3000;  // 3–8 sec
        const jitter = Math.floor(Math.random() * 300);             // 0–300 ms extra
        const ms = baseDelay + jitter;

        console.log(`⏳ Sleeping for ${ms} ms...`);
        await sleep(ms);

    }


    await closeBrowser(browser);

    exportToExcel(allRecords, 'chemical_database.xlsx')
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




run();
