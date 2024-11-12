const { parseArguments } = require('./cli/argumentsParser');
const { parsePeriod } = require('./utils/dateHelper');
const ReportService = require('./services/reportService');
const progressBar = require('./utils/progressBar');
const Logger = require('./cli/logger');

async function main() {
    const argv = parseArguments();
    const logger = new Logger(argv.debug);
    const reportService = new ReportService(argv.debug);

    try {
        const fileIds = argv.files
            .replace(/['"]/g, '')
            .split(',')
            .map(id => id.trim())
            .filter(id => id);

        if (fileIds.length === 0) {
            throw new Error('No file IDs provided. Please provide at least one file ID.');
        }

        const { startDate, endDate } = parsePeriod(argv.period);

        logger.log('\n=== STARTING BATCH REPORT GENERATION ===');
        logger.log(`Files to process: ${fileIds.length}`);
        logger.log(`Period: ${argv.period} (${startDate} to ${endDate})`);

        progressBar.start(fileIds.length);

        for (let i = 0; i < fileIds.length; i++) {
            const fileId = fileIds[i];
            try {
                await reportService.generateReport(fileId, startDate, endDate, argv.period);
                progressBar.update(i + 1);
                logger.success(`Report generated for file ID: ${fileId}`);
            } catch (error) {
                logger.error(`Error processing file ID ${fileId}:`, error);
            }
        }

        progressBar.stop();
        logger.log('\n=== BATCH REPORT GENERATION COMPLETED ===');
        logger.log(`Total files processed: ${fileIds.length}`);
    } catch (error) {
        logger.error('Error in batch processing:', error);
        process.exit(1);
    }
}

main(); 