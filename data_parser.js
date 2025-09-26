export async function parsePubChemData(apiRawData) {

    let rawData = apiRawData?.rawData?.Record?.Section;

    if (!rawData) {
        console.error('No data retrieved from API')
        return null;
    }

    const casNumbers = findCASNumbers(rawData);

    //do more stuff here

    const chemicalData = {};

    chemicalData.casNumbers = casNumbers;

    return chemicalData;
}

function findSection(sections, heading) {

    //recursive function for finding TOC heading we want

    for (const section of sections) {
        if (section.TOCHeading === heading) {
            return section;
        }
        if (Array.isArray(section.Section)) {
            const found = findSection(section.Section, heading);
            if (found) return found;
        }
    }
    return null;
}

function findCASNumbers(rawData) {
    try {
    const casSection = findSection(rawData, "CAS");

    if (!casSection) {
        throw new Error('Error: Could not find CAS section in dataset');
    }
    
    const casInfo = casSection.Information;
    const casNumberSet = new Set();

    for (let i=0; i < casInfo.length; i++) {
        const currentCAS = casInfo[i].Value?.StringWithMarkup?.[0]?.String;
        if (currentCAS) {
            casNumberSet.add(currentCAS);
        }
    }
    const casNumbers = [...casNumberSet];
    return casNumbers;
    }
    catch (err) {
        console.error('Error parsing CAS numbers:', err.message)
        return [];
    }
    
}

//we need to parse and return the following:
    //cas numbers
    //hazards
    //fisherURL
    //molecular formula
    //dot class
