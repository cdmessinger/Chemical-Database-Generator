import { fetchFromPubChem } from './api_requestor.js';
import { parsePubChemData } from './data_parser.js';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run(casList) {
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
            console.log(`Parsing data for ${currentCAS}...`);
            const parsedData = parsePubChemData(apiRawData);
            console.log(`Parsed data for ${currentCAS}`, parsedData);
        }
        catch (err) {
            console.error(`💥 Unexpected error processing ${currentCAS}:`, err);
        }
        //wait 500ms before next API request, per PubChem docs (4 calls per second max). Each chemical needs 2 api calls.
        await sleep(500);
    }
}


const casList = [
    '90-15-3',
    // '150-78-7'
]


run(casList);