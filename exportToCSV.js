import fs from 'fs';
 
export function exportToCSV(parsedData, filepath = 'chemical_data.csv') {
    if (!parsedData || parsedData.length === 0) {
        console.warn('No data to export');
        console.log('debug:', parsedData);
        return;
    }

    const keys = Object.keys(parsedData[0])
    const header = keys.join(",") + "\n";

    const rows = parsedData.map(r => 
        keys.map(k => {
            const v = r[k] ?? "";
            const str = v === null || v === undefined ? "" : String(v);
            return /[",]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;

        }).join(",")
    );

    fs.writeFileSync(filepath, header + rows.join("\n") + "\n", 'utf-8')
    console.log(`csv saved to ${filepath}`);
}