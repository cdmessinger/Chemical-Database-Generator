import { 
    puppeteer, 
    fsp,
    path,
    sleep, 
    importExcel, 
    exportToExcel, 
    scrapeFisherSDS, 
    parsePubChemData, 
    fetchFromPubChem,
    buildChemicalData
} from '../utils/index.js';


export async function run(filePath) {

    //runtime
    const start = Date.now(); 

    const allRecords = []; //all data export
    const firstCell = 2 // for tracking cell number in "badMatches" for success report, we multiple index by 7 and add this
    let lastData = {}; //stores last data to check for duplicates 
    let lastErrors = {}; //stores last errors for duplicates


    //Import our data
    const chemicalList =  await importExcel(filePath);

    if (!chemicalList) {
        throw new Error('Error: could not import chemical Data')
    } 
    //QA stuff
    const totalChemicals = chemicalList.length;
    const successReport = {
        totalChemicals,
        badMatches: {}, //for labeling each mismatched chemical w/ row number in excel export
        passedSDS: 0,
        reviewSDS: 0,
        failedSDS: 0,
        errors: 0
    }
    
    console.log('==============================')
    console.log(`Successfully imported ${totalChemicals} chemical(s)`);
    console.log('==============================')

    //start the websession in puppeteer
    const { browser, page, cookieString } = await openBrowser();
    
    //Start running Chemical Searches
    for (let i = 0; i < totalChemicals; i++) {
        const searchQuery = chemicalList[i].searchQuery; //CAS number, what we use to search everything
        let chemicalData = {};
        const errorStatements = [];

        //Add known information to our chemicalData object and return it.
        chemicalData = buildChemicalData(chemicalData, chemicalList[i])

        try{
            //check is last CAS is a duplicate, save memory and time
            if (lastData.searchQuery && searchQuery === lastData.searchQuery) {
                console.log('Current CAS matches the previous one, skipping lookup & copying data');
                chemicalData = buildChemicalData(chemicalData, lastData);
                chemicalData.errorStatements = lastErrors;

                //update total validation numbers
                if (chemicalData.sdsConfidenceScore >= 70) {
                    successReport.passedSDS += 1;
                } else if (chemicalData.sdsConfidenceScore < 40) {
                    successReport.failedSDS += 1;
                    const cellIndex = (i * 7) + firstCell;
                    successReport.badMatches[cellIndex] = chemicalData.importedProductName;
                    
                } else {
                    successReport.reviewSDS += 1;
                    const cellIndex = (i * 7) + firstCell;
                    successReport.badMatches[cellIndex] = chemicalData.importedProductName;
                }
                
                if (errorStatements.length !== 0) {
                    successReport.errrors += 1;
                }
                allRecords.push(chemicalData);
                const clonedData = structuredClone(chemicalData);
                lastData = clonedData;
                continue;
            } else {
                //Normal functionality
                console.log(`Request ${i}, ${searchQuery}`)
                console.log(`Fetching PubChem data for ${searchQuery}...`);

                //Call PubChem API
                const apiRawData = await fetchFromPubChem(searchQuery);
            
                if (!apiRawData) {
                    console.warn(`Pubchem Error: ${searchQuery} — no data returned from API.`);
                    errorStatements.push(`Pubchem Error: ${searchQuery} — no data returned from API.`)
                    continue; //skipping Pubchem data, continuing to scrape fisher SDS
                }
                else {
                    console.log('Data retrieved from API', apiRawData);
                    //Add 1st part of API Data to our chemicalData object
                    chemicalData = buildChemicalData(chemicalData, apiRawData)
                }

                //Parse and extract API response from PubChem
                console.log(`Parsing data for ${searchQuery}...`);
                const parsedData = await parsePubChemData(apiRawData);

                if (!parsedData) {
                    console.warn(`Pubchem Error: ${searchQuery} — could not parse API data.`)
                    errorStatements.push(`Pubchem Error: ${searchQuery} — could not parse API data.`)
                }
                else {
                    console.log(`Parsed data for ${searchQuery}`);
                    //Add our 2nd part of Pubchem API data to our object
                    chemicalData = buildChemicalData(chemicalData, parsedData);

                    //Add any error statements
                    if (parsedData?.errorStatements?.length) {
                        for (const error of parsedData.errorStatements) {
                            errorStatements.push(error);
                        }
                    }
                }

                //Scrape FisherSci website for SDS sheets and parse their data. SDS validation also occurs here.
                const sdsData = await scrapeFisherSDS(chemicalData, page, cookieString);

                //add SDS Data and Validation Data to our chemicalData object
                chemicalData = buildChemicalData(chemicalData, sdsData);

                if (sdsData?.errorCode?.length) {
                    for (const error of sdsData.errorCode) {
                                errorStatements.push(error);
                    }
                }

                //update total validation numbers
                if (chemicalData.sdsConfidenceScore >= 70) {
                    successReport.passedSDS += 1;
                } else if (chemicalData.sdsConfidenceScore < 40) {
                    successReport.failedSDS += 1;
                    const cellIndex = (i * 7) + firstCell;
                    successReport.badMatches[cellIndex] = chemicalData.importedProductName
                } else {
                    successReport.reviewSDS += 1;
                    const cellIndex = (i * 7) + firstCell;
                    successReport.badMatches[cellIndex] = chemicalData.importedProductName
                }
                
                if (errorStatements.length !== 0) {
                    successReport.errrors += 1;
                }

                //Add error statements to chemicalData
                chemicalData.errorStatements = errorStatements;
                console.log('Finished Chemical Data Object:', chemicalData)

                //add the data to our records
                allRecords.push(chemicalData);

                console.log('==============================')
                console.log(`Chemical ${i+1} / ${totalChemicals} completed.`)
                console.log('==============================')
        
                //Call sleep function to limit API requests, unless on the last index.
                if (i !== (chemicalList.length-1)) {
                    await sleep(); 
                }
                
                lastData = chemicalData; //set lastData to check for duplicates and save time
                lastErrors = errorStatements; //saves error statements incase of duplicates
            }

        } catch (err) {
            console.error(`Unexpected error processing ${searchQuery}: ${err.message}`);
            errorStatements.push(`Unexpected error processing ${searchQuery}: ${err.message}`);
        }
    }

    //Close Puppeteer at the end of the session
    await closeBrowser(browser);

    //Generate success report
    console.log('==============================')
    console.log('TOTAL SUMMARY:');
    console.log('TOTAL CHEMICALS SEARCHED:', successReport.totalChemicals);
    console.log('PASSED SDS:', successReport.passedSDS);
    console.log('SDS NEEDS REVIEW:', successReport.reviewSDS);
    console.log('FAILED SDS:', successReport.failedSDS);
    console.log('==============================')


    //end runtime
    const end = Date.now();
    let runTime = '';
    const totalSeconds = (end - start) / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(1);
    if (minutes !== 0) {
        runTime = `${minutes}minutes, ${seconds}seconds.`
    } else {
        runTime = `${seconds} seconds.`
    }

    successReport.runTime = runTime;

    const runDate = new Date(end);
    successReport.runDate = runDate.toLocaleString();

    console.log('==============================')
    console.log(`RUNTIME: ${runTime}`)
    console.log('==============================')

    console.log('BAD MATCHES:', successReport.badMatches)

    //Export our data to an excel file
    exportToExcel(allRecords, 'chemical_database.xlsx', successReport)
    
    //Delete temp files used in scraping
    // await cleanTempFiles();

}

async function openBrowser() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    //Go to fisher to generate fresh cookies
    await page.goto('https://www.fishersci.com', { waitUntil: 'domcontentloaded' })

    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    console.log('==============================')
    console.log('Browser initialized')
    console.log('==============================')

    return { browser, page, cookieString };
}

async function closeBrowser(browser) {
    await browser.close();
    console.log('==============================')
    console.log('Browser Closed')
    console.log('==============================')

}

async function cleanTempFiles() {
    const files = [
        "./data/temp_pdf/temp.pdf",
        "./data/temp_pdf/temp.txt"
    ];

    for (const file of files) {
        try {
            await fsp.access(file);
            await fsp.unlink(file);
            console.log(`Deleted ${file}`);
        } catch(err) {
            if (err.code === "ENOENT") {
                console.log(`File not found, skipped: ${file}`)
            } else {
                console.error(`Failed to delete ${file}:`, err);
            }
        }
    }
}
