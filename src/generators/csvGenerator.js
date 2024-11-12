const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');

class CsvGenerator {
    constructor(reportsDir = './reports') {
        this.reportsDir = reportsDir;
        this.ensureReportDirectory();
    }

    ensureReportDirectory() {
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir);
        }
    }

    async generateReport(data, fileName) {
        const csvWriter = createCsvWriter({
            path: `${this.reportsDir}/${fileName}.csv`,
            header: [
                { id: 'component_name', title: 'Component Name' },
                { id: 'total_variants', title: 'Total Variants' },
                { id: 'usages', title: 'Usages' },
                { id: 'insertions', title: 'Insertions' },
                { id: 'detachments', title: 'Detachments' },
                { id: 'updated_at', title: 'Updated At' },
                { id: 'created_at', title: 'Created At' },
                { id: 'type', title: 'Type' }
            ]
        });

        try {
            await csvWriter.writeRecords(data);
            return `${this.reportsDir}/${fileName}.csv`;
        } catch (error) {
            throw new Error(`Error generating CSV: ${error.message}`);
        }
    }
}

module.exports = new CsvGenerator(); 