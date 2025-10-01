import { fetchFromPubChem } from './api_requestor.js';
import { parsePubChemData } from './data_parser.js';
import { scrapeFisherSDS } from './sds-scraper/scraper.js';
import { exportToCSV } from './exportToCSV.js';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run(casList) {

    const allRecords = [];

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

            const sdsLinks = await scrapeFisherSDS(currentCAS);
            
            
            parsedData.sdsLinks = sdsLinks;
            console.log(parsedData);

           allRecords.push(parsedData);
        } catch (err) {
            console.error(`💥 Unexpected error processing ${currentCAS}:`, err);
        }
        //wait 500ms before next API request, per PubChem docs (4 calls per second max). Each chemical needs 2 api calls.
        await sleep(500);
    }
    exportToCSV(allRecords, 'chemical_database.csv')
}


const casList = [
    '90-15-3', //1-naphthol
    // '67-64-1' //acetone
    // '71-43-2' //benzene
]


run(casList);
