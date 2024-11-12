const { createReportsDir, calculateStartDate } = require('./utils');
const { fetchFigmaFile, fetchFigmaAnalytics } = require('./figmaService');
const { fetchComponentActions } = require('./componentActionsService');

const args = process.argv.slice(2);
const DEBUG = args.includes('--debug');
const INCLUDE_VARIANTS = args.includes('--include-variants');

let period = '30days';
const periodOptions = ['30days', '60days', '90days', '1year', 'custom'];
args.forEach(arg => {
    if (periodOptions.includes(arg)) {
        period = arg;
    }
});

const fileIds = args.filter(arg => arg !== '--debug' && arg !== '--include-variants' && !periodOptions.includes(arg) && !arg.startsWith('custom'));

if (DEBUG) {
    console.log('Figma Token used:', process.env.FIGMA_TOKEN);
}

createReportsDir();

const startDate = calculateStartDate(period);
const endDate = new Date().toISOString().split('T')[0];

fileIds.forEach(async (fileId) => {
    try {
        const fileData = await fetchFigmaFile(fileId);
        console.log(`Fetched data for file ${fileId}:`, fileData);
        if (INCLUDE_VARIANTS) {
            const analyticsData = await fetchFigmaAnalytics(fileId);
            console.log(`Fetched analytics for file ${fileId}:`, analyticsData);
        }
        const componentActions = await fetchComponentActions(fileId, startDate, endDate);
        console.log(`Fetched component actions for file ${fileId}:`, componentActions);
    } catch (error) {
        console.error(`Error fetching data for file ${fileId}:`, error);
    }
});