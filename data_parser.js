export async function parsePubChemData(apiRawData) {

    let rawData = apiRawData?.rawData?.Record?.Section;
    if (!rawData) {
        console.error('No data retrieved from API')
        return null;
    }

    const casNumbers = findCASNumbers(rawData);
    const molecularFormula = findFormula(rawData);
    const dotClass = findClass(rawData);

    //do more stuff here

    const chemicalData = {};

    chemicalData.casNumbers = casNumbers;
    chemicalData.molecularFormula = molecularFormula;
    chemicalData.class = dotClass;

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
        throw new Error('Error: Could not find CAS section in dataset.');
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
        console.error('Error parsing CAS numbers:', err.message);
        return [];
    }
    
}

function findFormula(rawData) {
    try {
        const formulaSection = findSection(rawData, "Molecular Formula")

        if (!formulaSection) {
            throw new Error('Error: Could not find Molecular Formula in dataset.')
        }
        
        const molecularFormula = formulaSection.Information?.[0]?.Value?.StringWithMarkup?.[0]?.String || 'N/A';
        return molecularFormula;

    }
    catch(err) {
        console.error('Error parsing Molecular Formula:', err.message);
        return "Not found";
    }
}

function findClass(rawData) {
    try {
        const classSection = findSection(rawData, "Transport Information")
        console.log(classSection);
    }
    catch(err) {
        console.error('Error parsing Class:', err.message);
    }
}



//we need to parse and return the following:
    //hazards
    //fisherURL
    //dot class
