async function getCID(casNumber) {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(casNumber)}/synonyms/JSON`;
    const res = await fetch(url);
    const data = await res.json();

  //CID number lets us access the information about the chemical
    const cidNumber = data.InformationList.Information[0].CID;
    const synonyms = data.InformationList.Information[0].Synonym;

    const chemicalName = data.InformationList.Information[0].Synonym[0];

    //removes CAS numbers from synonyms, if present
    const casRegex = /^\d{2,7}-\d{2}-\d$/;
    const cleanSynonyms = synonyms.filter(syn => !casRegex.test(syn));

    //take the first 5, and most common synonyms (index 0 is used for chemical name)
    const topSynonyms = cleanSynonyms.splice(1,6);
    

        //now we call the build function to collect all our data while exporting the data we collected from this call.
        buildChemicalData(cidNumber, topSynonyms, casNumber, chemicalName);
}

async function getCAS(cidNumber) {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cidNumber}/JSON/?heading=CAS`
    const res = await fetch(url);
    const data = await res.json();

    const name = data.Record.RecordTitle
    const casSection = findSection(data.Record.Section, "CAS");
    const casInfo = casSection.Information;

    const casNumbersSet = new Set();
    
    for (let i = 0; i < casInfo.length; i++) {
        const cas = casInfo[i].Value?.StringWithMarkup?.[0]?.String;
        if (cas) {
            casNumbersSet.add(cas);
        }
    }
    
    const casNumbers = [...casNumbersSet];
    return casNumbers;
}

async function getHazards(cidNumber) {
    //Step 1: API call
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cidNumber}/JSON/?heading=GHS+Classification`;
    const res = await fetch(url);
    const data = await res.json();

    //Step 2: build reference map to know which source hazards come from
    const refMap = {};
    (data.Record.Reference || []).forEach(ref => {
        refMap[ref.ReferenceNumber] = ref.SourceName || "Unknown Source"
    });
    // console.log('refMap:', refMap);

    //Step 3 Loop over each object and sort it by ref number

    const ghSection = data.Record.Section[0];
    // console.log('ghSection:', ghSection.Section[0]);
    const hazardInformation = ghSection.Section[0].Section[0].Information
    const groupedHazards = {};

    // console.log('hazardInformation:', hazardInformation);

    for (let i = 0; i < hazardInformation.length; i++) {
        let referenceNumber = hazardInformation[i].ReferenceNumber
        let source = refMap[referenceNumber] || 'Unknown source';

        //make sure source array exists
        if (!groupedHazards[source]) {
            groupedHazards[source] = [];
        }

        //if the information is a picogram image, we set the value equal to their URLs
        if (hazardInformation[i].Name === "Pictogram(s)") {
            const markups = hazardInformation[i].Value.StringWithMarkup[0].Markup;
            const urls = markups.map(m => m.URL); //extract the URLs


            groupedHazards[source].push({
                name: hazardInformation[i].Name,
                refNumber: hazardInformation[i].ReferenceNumber,
                value: urls,
            })
        }
        
        //if not a pictogram, we simply add the value
        else groupedHazards[source].push({
            name: hazardInformation[i].Name,
            refNumber: hazardInformation[i].ReferenceNumber,
            value: hazardInformation[i].Value.StringWithMarkup,
        });
    }
    // console.log("Grouped Hazards Object:",groupedHazards)
    return groupedHazards;
}

async function getFormula(cidNumber) {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cidNumber}/JSON`;
    const res = await fetch(url);
    const data = await res.json();

    const formulaSection = findSection(data.Record.Section, "Molecular Formula");
    const molecularFormula = formulaSection.Information[0].Value.StringWithMarkup[0].String;

    return molecularFormula;
}

async function getClass(cidNumber) {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cidNumber}/JSON`;
    const res = await fetch(url);
    const data = await res.json();

    const classSection = findSection(data.Record.Section, "Transport Information");
    const classNumberSection = findSection(classSection.Section, "UN Classification")
    const classNumber = classNumberSection.Information[0].Value.StringWithMarkup[0].String;

    const hazardSection = findSection(classSection.Section, "DOT Label");
    const hazardLabel = hazardSection.Information[0].Value.StringWithMarkup[0].String;

    return { classNumber, hazardLabel  }


}

function fisherLookup(casNumber) {
    const primaryCAS = casNumber[0];
    const url = `https://www.fishersci.com/us/en/catalog/search/sds?selectLang=EN&store=&msdsKeyword=${primaryCAS}`;

    return url;
    // window.open(url);
}

function findSection(sections, heading) {

    //recursive function for finding TOC heading we want

    for (const section of sections) {
        if (section.TOCHeading === heading) {
            return section;
        }
        if (section.Section) {
            const found = findSection(section.Section, heading);
            if (found) return found;
        }
    }
    return null;
}


async function buildChemicalData(cidNumber, topSynonyms, casNumber, chemicalName) {
    const chemicalData = {};

    chemicalData.searchedCAS = casNumber;
    chemicalData.name = chemicalName
    chemicalData.synonyms = topSynonyms;

    chemicalData.casNumber = await getCAS(cidNumber);
  //calls the getHazards function on the correct chemical via the CID number
    chemicalData.hazards = await getHazards(cidNumber);
    
    chemicalData.fisherURL = await fisherLookup(chemicalData.casNumber)

    chemicalData.molecularFormula = await getFormula(cidNumber);

    // bugged, fix this later
    // chemicalData.class = await getClass(cidNumber);

    console.log(`Chemical Data for ${chemicalData.name}:`, chemicalData)
}

// const casNumbers = [
//     '90-15-3',
//     '150-78-7',
//     '123-91-1',
//     '124-09-4',
//     '109-65-9',
//     '71-36-3',
// ]

async function processAll(casNumbers) {
    for (let i = 0; i <casNumbers.length; i++) {
        await getCID(casNumbers[i].toString());
    }
}

processAll(casNumbers)



//NEXT STEPS
//    1. Swap from a name search to a CAS number search --> will eliminate typo errors, weird nomenclature, multiple cas numbers per chemical -- just search what CAS number is on the bottle. Keep the logic to search by name, just in case you need it later :)
//    2. reduce API calls to pubChem server --> doing 1 big API request and save it in memory until we're done with it --> parse through for what we need, then write over it with next chemical. We need to throttle it (no more than 5 requests per second)
//    3. make it searchable in html doc and update + window.open fisher link--> maybe need to parse to find OSHA hazard info
//    4. look into node.js for pdf parsing to get the sds sheet to find most recent sds sheet
//    5. 