require('dotenv').config(); // Load environment variables from the .env file
const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment'); // For date manipulation
const fs = require('fs');
const { performance } = require('perf_hooks'); // For measuring execution time
const cliProgress = require('cli-progress'); // For progress bar
const yargs = require('yargs');
const https = require('https');

// Figma API settings
const FIGMA_API_URL = 'https://api.figma.com/v1/files/';
const FIGMA_ANALYTICS_URL = 'https://api.figma.com/v1/analytics/libraries/';
const FIGMA_TOKEN = process.env.FIGMA_TOKEN; // Get the token from the environment variable

// Check if the token was loaded correctly
if (!FIGMA_TOKEN) {
    console.error('Error: FIGMA_TOKEN not found. Check the .env file and the value of the environment variable.');
    process.exit(1);
}

// Debugging parameter
const args = process.argv.slice(2);
const DEBUG = args.includes('--debug');
if (DEBUG) {
    console.log('Figma Token used:', FIGMA_TOKEN);
}

// Create reports folder if it doesn't exist
const REPORTS_DIR = './reports';
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR);
}

// Variant parameter
const INCLUDE_VARIANTS = args.includes('--include-variants');

// Period parameter
let period = '30days';
const periodOptions = ['30days', '60days', '90days', '1year', 'custom'];
args.forEach(arg => {
    if (periodOptions.includes(arg)) {
        period = arg;
    }
});

// Remove '--debug', '--include-variants' and period from arguments if present
const fileIds = args.filter(arg => arg !== '--debug' && arg !== '--include-variants' && !periodOptions.includes(arg) && !arg.startsWith('custom'));

// Function to calculate start dates based on the period
function calculateStartDate(period) {
    let startDate;
    if (period.startsWith('custom')) {
        const dates = period.match(/custom\[(\d{4}-\d{2}-\d{2})\s(\d{4}-\d{2}-\d{2})\]/);
        if (dates && dates.length === 3) {
            return {
                startDate: dates[1],
                endDate: dates[2]
            };
        } else {
            console.error('Error: Invalid custom date format. Use custom[YYYY-MM-DD YYYY-MM-DD].');
            process.exit(1);
        }
    }
    switch (period) {
        case '60d':
            startDate = moment().subtract(60, 'days').startOf('week').format('YYYY-MM-DD');
            break;
        case '90d':
            startDate = moment().subtract(90, 'days').startOf('week').format('YYYY-MM-DD');
            break;
        case '1year':
            startDate = moment().subtract(1, 'year').startOf('week').format('YYYY-MM-DD');
            break;
        default:
            startDate = moment().subtract(30, 'days').startOf('week').format('YYYY-MM-DD');
    }
    return { startDate };
}

const { startDate, endDate } = calculateStartDate(period);

// Function to make API call to get file metadata (including the file name)
async function fetchFileMetadata(libraryFileKey) {
    try {
        const response = await axios.get(`${FIGMA_API_URL}${libraryFileKey}`, {
            headers: {
                'X-Figma-Token': FIGMA_TOKEN,
            },
        });

        if (response.data && response.data.name) {
            return response.data.name;
        } else {
            console.warn(`Unexpected response when fetching metadata for file ${libraryFileKey}`);
            return 'Unknown_Library_Name';
        }
    } catch (error) {
        console.error(`Error fetching file metadata for file ${libraryFileKey}:`, error.message);
        return 'Unknown_Library_Name';
    }
}

// Function to make API call to Components endpoint
async function fetchComponents(libraryFileKey) {
    try {
        const response = await axios.get(`${FIGMA_API_URL}${libraryFileKey}/components`, {
            headers: {
                'X-Figma-Token': FIGMA_TOKEN,
            },
        });

        if (DEBUG) {
            console.log('Full API response from Components:', JSON.stringify(response.data, null, 2));
        }

        if (response.data && response.data.meta && response.data.meta.components) {
            return response.data.meta.components;
        } else {
            console.warn(`Unexpected response when fetching components for file ${libraryFileKey}`);
            return [];
        }
    } catch (error) {
        console.error(`Error fetching components for file ${libraryFileKey}:`, error);
        return [];
    }
}

// Function to fetch and process component actions
async function fetchComponentActions(fileId, startDate, endDate) {
    try {
        console.log('\n=== COMPONENT ACTIONS DATA ===');
        console.log('Fetching actions for period:', { startDate, endDate });
        
        const response = await axios.get(
            `${FIGMA_ANALYTICS_URL}${fileId}/component/actions`,
            {
                headers: {
                    'X-Figma-Token': FIGMA_TOKEN
                },
                params: {
                    group_by: 'component',
                    start_date: startDate,
                    end_date: endDate
                }
            }
        );

        console.log('Response structure:', {
            cursor: response.data?.cursor,
            next_page: response.data?.next_page,
            total_rows: response.data?.rows?.length,
            period: `${startDate} to ${endDate}`
        });

        // Group actions by key
        const actionsByKey = (response.data?.rows || []).reduce((acc, row) => {
            const key = row.component_key;
            
            if (!acc[key]) {
                acc[key] = {
                    insertions: 0,
                    detachments: 0
                };
            }

            acc[key].insertions += Number(row.insertions || 0);
            acc[key].detachments += Number(row.detachments || 0);

            return acc;
        }, {});

        // Debug log for processed data
        console.log('\nFirst 3 processed actions:');
        console.log(Object.entries(actionsByKey).slice(0, 3).map(([key, data]) => ({
            key,
            insertions: data.insertions,
            detachments: data.detachments
        })));

        return actionsByKey;
    } catch (error) {
        console.error('Error fetching component actions:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
        return {};
    }
}

// Function to save component names in a CSV
async function extractDataToCSV(components, fileName) {
    console.log('Starting CSV generation...');
    console.log('Components received:', components.length);

    if (components.length === 0) {
        console.warn('No components found to generate CSV.');
        return;
    }

    try {
        // Check if reports directory exists
        if (!fs.existsSync(REPORTS_DIR)) {
            console.log('Creating reports directory...');
            fs.mkdirSync(REPORTS_DIR);
        }

        // Create CSV Writer instance
        const csvWriter = createCsvWriter({
            path: `${REPORTS_DIR}/${fileName}.csv`,
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

        console.log('Preparing data for CSV...');
        
        // Sort components alphabetically
        components.sort((a, b) => {
            const nameA = (a.component_name || '').toLowerCase();
            const nameB = (b.component_name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        // Debug log
        console.log('Complete component list:');
        components.forEach(comp => {
            console.log({
                component_name: comp.component_name,
                total_variants: comp.total_variants,
                usages: comp.usages,
                insertions: comp.insertions || 'N/A',
                detachments: comp.detachments || 'N/A',
                updated_at: comp.updated_at,
                created_at: comp.created_at,
                type: comp.type
            });
        });

        console.log('Writing CSV file...');
        await csvWriter.writeRecords(components);
        console.log(`CSV generated successfully: ${REPORTS_DIR}/${fileName}.csv`);
    } catch (error) {
        console.error('Error generating CSV:', error);
        throw error;
    }
}

// Function to save log in Markdown
async function saveLogMarkdown(fileName, libraryName, totalComponents, totalVariants, executionTime, period, lastValidWeek) {
    const logFilePath = `${REPORTS_DIR}/${fileName}.md`;
    const logContent = `# CSV Generation Report

- **Library Name**: ${libraryName}
- **Total Components**: ${totalComponents}
- **Total Variants**: ${totalVariants}
- **Generation Date**: ${moment().format('YYYY-MM-DD HH:mm:ss')}
- **Selected Period**: ${period}
- **Last Closed Valid Week**: ${lastValidWeek}
- **Total Execution Time**: ${executionTime} seconds
`;

    try {
        fs.writeFileSync(logFilePath, logContent);
        console.log(`Generation log successfully created: ${logFilePath}`);
    } catch (error) {
        console.error(`Error writing log file ${logFilePath}:`, error.message);
    }
}

// Function to fetch file metadata
async function fetchFileMetadata(fileId) {
    try {
        const response = await axios.get(`${FIGMA_API_URL}${fileId}`, {
            headers: {
                'X-Figma-Token': FIGMA_TOKEN,
            },
        });

        if (response.data && response.data.name) {
            return response.data.name;
        } else {
            console.warn(`Unexpected response when fetching metadata for file ${fileId}`);
            return 'Unknown Library';
        }
    } catch (error) {
        if (error.response) {
            console.error(`Error fetching file metadata for ${fileId}: Status ${error.response.status}`);
            console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('No response received from API:', error.request);
        } else {
            console.error('Error setting up request:', error.message);
        }
        return 'Unknown Library';
    }
}

// Function to normalize special characters
function normalizeString(string) {
    return string
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')     // Remove accents
        .replace(/[^a-z0-9]/gi, '_')         // Replace non-alphanumeric with _
        .replace(/_+/g, '_')                 // Replace multiple _ with single _
        .toLowerCase();
}

// Function to process period
function parsePeriod(periodStr) {
    const validPeriods = {
        '30d': 30,
        '60d': 60,
        '90d': 90,
        '1y': 365
    };

    // Remove quotes if present
    periodStr = (periodStr || '30d').replace(/['"]/g, '');

    // Check if it's a custom period
    if (periodStr.includes(',')) {
        const [startStr, endStr] = periodStr.split(',').map(d => d.trim());
        return {
            startDate: startStr,
            endDate: endStr
        };
    }

    // Validate if period is valid
    if (!validPeriods[periodStr]) {
        throw new Error('Invalid period. Use 30d, 60d, 90d, 1y or custom format (YYYY-MM-DD, YYYY-MM-DD)');
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - validPeriods[periodStr]);

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
}

// Function to process and aggregate components
function processComponents(components, actionsData, usages) {
    console.log('\n=== PROCESSING COMPONENTS ===');
    console.log('Actions data received:', {
        totalKeys: Object.keys(actionsData).length,
        sample: Object.entries(actionsData).slice(0, 2)
    });
    
    const processedComponents = components.reduce((acc, component) => {
        const setName = component.containing_frame?.name || component.name;
        const componentKey = component.key;

        // Format dates
        const formattedUpdatedAt = moment(component.updated_at).format('YYYY-MM-DD-HH-mm');
        const formattedCreatedAt = moment(component.created_at).format('YYYY-MM-DD-HH-mm');

        if (!acc[setName]) {
            acc[setName] = {
                component_name: setName,
                total_variants: 0,
                usages: 0,
                insertions: 0,
                detachments: 0,
                updated_at: formattedUpdatedAt,
                created_at: formattedCreatedAt,
                type: 'Single'
            };
        }

        // Rest of the processing...
        acc[setName].total_variants++;
        if (acc[setName].total_variants > 1) {
            acc[setName].type = 'Set';
        }

        acc[setName].usages += Number(usages[componentKey]?.usages || 0);

        if (actionsData[componentKey]) {
            acc[setName].insertions += Number(actionsData[componentKey].insertions || 0);
            acc[setName].detachments += Number(actionsData[componentKey].detachments || 0);
        }

        return acc;
    }, {});

    // Sort results
    const result = Object.values(processedComponents)
        .sort((a, b) => a.component_name.toLowerCase().localeCompare(b.component_name.toLowerCase()));

    // Component listing with formatted dates
    console.log('\n=== COMPONENT LIST ===');
    console.log('Component Name | Total Variants | Usages (total) | Inserts (period) | Detachs (period) | Type | Updated At | Created At');
    console.log('----------------------------------------------------------------------------------------------------------------');
    result.forEach(comp => {
        console.log(
            `${comp.component_name.padEnd(20)} | ` +
            `${String(comp.total_variants).padEnd(14)} | ` +
            `${String(comp.usages).padEnd(13)} | ` +
            `${String(comp.insertions || 0).padEnd(15)} | ` +
            `${String(comp.detachments || 0).padEnd(14)} | ` +
            `${comp.type.padEnd(6)} | ` +
            `${comp.updated_at} | ` +
            `${comp.created_at}`
        );
    });

    return result;
}

// Main function to generate component report
async function generateComponentReport(fileId, startDate, endDate, debug = false) {
    try {
        console.log('Starting report generation...');
        console.log('Report period:', { startDate, endDate });
        
        // Fetch library name
        const libraryName = await fetchFileMetadata(fileId);
        console.log('Library name:', libraryName);

        // Fetch components
        const components = await fetchComponents(fileId);
        console.log('Components found:', components.length);

        // Fetch component actions with specified period
        const actionsData = await fetchComponentActions(fileId, startDate, endDate);
        console.log('Action data found:', Object.keys(actionsData).length);
        
        // Fetch usage data
        const usages = await fetchComponentUsages(fileId);
        console.log('Usage data found:', Object.keys(usages).length);

        if (DEBUG) {
            console.log('Data samples:');
            console.log('- First component:', components[0]);
            console.log('- First action:', Object.entries(actionsData)[0]);
            console.log('- First usage:', Object.entries(usages)[0]);
        }

        // Process and aggregate components
        const reportData = processComponents(components, actionsData, usages);
        console.log('Report data prepared:', reportData.length);

        // Generate filename with timestamp
        const timestamp = moment().format('YYYY-MM-DD-HH-mm');
        const fileName = `report_${normalizeString(libraryName)}_${timestamp}`;
        
        // Generate CSV and MD files
        await extractDataToCSV(reportData, fileName);
        
        const executionTime = process.hrtime()[0];
        await saveLogMarkdown(
            fileName,
            libraryName,
            reportData.length,
            INCLUDE_VARIANTS ? reportData.length : reportData.reduce((acc, curr) => acc + curr.total_variants, 0),
            executionTime,
            `${startDate} to ${endDate}`,
            moment().subtract(1, 'week').format('YYYY-MM-DD')
        );

        console.log('Report generated successfully!');
        return reportData;
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
}

// Function to fetch and process component usages
async function fetchComponentUsages(fileId) {
    try {
        console.log('\n=== COMPONENT USAGE DATA ===');
        
        const response = await axios.get(
            `${FIGMA_ANALYTICS_URL}${fileId}/component/usages`,
            {
                headers: {
                    'X-Figma-Token': FIGMA_TOKEN
                },
                params: {
                    group_by: 'component'
                }
            }
        );

        // Process usages by component key
        const usagesByKey = {};
        (response.data?.rows || []).forEach(row => {
            if (!row.component_key) return;
            usagesByKey[row.component_key] = {
                usages: parseInt(row.usages) || 0
            };
        });

        // Debug log for processed data
        console.log('\nFirst 3 processed usages:');
        console.log(Object.entries(usagesByKey).slice(0, 3));

        return usagesByKey;
    } catch (error) {
        console.error('Error fetching component usages:', error.message);
        return {};
    }
}

// Start the report generation process
(async () => {
    const argv = yargs
        .option('files', {
            alias: 'f',
            description: 'Comma-separated Figma file keys',
            type: 'string',
            demandOption: true
        })
        .option('period', {
            alias: 'p',
            description: 'Analysis period (30d, 60d, 90d, 1y)',
            type: 'string',
            default: '30d'
        })
        .help()
        .argv;

    try {
        // Process file IDs
        const fileIds = argv.files
            .replace(/['"]/g, '') // Remove quotes
            .split(',')           // Split by comma
            .map(id => id.trim()) // Remove whitespace
            .filter(id => id);    // Remove empty entries

        if (fileIds.length === 0) {
            console.error('Error: No file IDs provided. Please provide at least one file ID.');
            process.exit(1);
        }

        // Calculate period dates
        const { startDate, endDate } = parsePeriod(argv.period);

        console.log('\n=== STARTING BATCH REPORT GENERATION ===');
        console.log('Files to process:', fileIds.length);
        console.log('Period:', { startDate, endDate });

        // Process each file sequentially
        for (let i = 0; i < fileIds.length; i++) {
            const fileId = fileIds[i];
            console.log(`\n[${i + 1}/${fileIds.length}] Processing file ID: ${fileId}`);
            
            try {
                await generateComponentReport(fileId, startDate, endDate, argv.debug);
                console.log(`✓ Report generated successfully for file ID: ${fileId}`);
            } catch (error) {
                console.error(`✗ Error generating report for file ID ${fileId}:`, error.message);
                // Continue with next file even if current one fails
                continue;
            }
        }

        console.log('\n=== BATCH REPORT GENERATION COMPLETED ===');
        console.log(`Total files processed: ${fileIds.length}`);
    } catch (error) {
        console.error('Error in batch processing:', error);
        process.exit(1);
    }
})();

