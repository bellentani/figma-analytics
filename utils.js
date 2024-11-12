const fs = require('fs');
const REPORTS_DIR = './reports';

function createReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR);
    }
}

function calculateStartDate(period) {
    let startDate;
    if (period.startsWith('custom')) {
        const dates = period.match(/custom\[(\d{4}-\d{2}-\d{2})\s(\d{4}-\d{2}-\d{2})\]/);
        if (dates) {
            startDate = dates[1];
        }
    } else {
        const now = new Date();
        switch (period) {
            case '30days':
                startDate = new Date(now.setDate(now.getDate() - 30));
                break;
            case '60days':
                startDate = new Date(now.setDate(now.getDate() - 60));
                break;
            case '90days':
                startDate = new Date(now.setDate(now.getDate() - 90));
                break;
            case '1year':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
            default:
                startDate = now;
        }
    }
    return startDate.toISOString().split('T')[0];
}

module.exports = {
    createReportsDir,
    calculateStartDate
};