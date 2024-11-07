require('dotenv').config(); // Load environment variables from the .env file
const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment'); // For date manipulation
const fs = require('fs');
const { performance } = require('perf_hooks'); // For measuring execution time
const cliProgress = require('cli-progress'); // For progress bar

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
const periodOptions = ['30days', '60days', '90days', '1year'];
args.forEach(arg => {
    if (periodOptions.includes(arg)) {
        period = arg;
    }
});

// Remove '--debug', '--include-variants' and period from arguments if present
const fileIds = args.filter(arg => arg !== '--debug' && arg !== '--include-variants' && !periodOptions.includes(arg));

// Function to calculate start dates based on the period
function calculateStartDate(period) {
    let startDate;
    switch (period) {
        case '60days':
            startDate = moment().subtract(60, 'days').startOf('week').format('YYYY-MM-DD');
            break;
        case '90days':
            startDate = moment().subtract(90, 'days').startOf('week').format('YYYY-MM-DD');
            break;
        case '1year':
            startDate = moment().subtract(1, 'year').startOf('week').format('YYYY-MM-DD');
            break;
        default:
            startDate = moment().subtract(30, 'days').startOf('week').format('YYYY-MM-DD');
    }
    return startDate;
}

const startDate = calculateStartDate(period);

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

        // Display the full API response for diagnosis
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
        if (error.response) {
            // Response received, but server responded with an error status
            console.error(`Error fetching components for file ${libraryFileKey}: Status ${error.response.status}`);
            console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            // Request was made, but no response received
            console.error('No response received from API:', error.request);
        } else {
            // Something went wrong in setting up the request
            console.error('Error setting up request:', error.message);
        }
        return [];
    }
}

// Function to make API call to Component Actions endpoint with pagination
async function fetchComponentActions(libraryFileKey) {
    let actions = [];
    let nextPage = true;
    let cursor = null;

    while (nextPage) {
        try {
            const response = await axios.get(`${FIGMA_ANALYTICS_URL}${libraryFileKey}/component/actions`, {
                headers: {
                    'X-Figma-Token': FIGMA_TOKEN,
                },
                params: {
                    group_by: 'component',
                    start_date: startDate,
                    cursor: cursor,
                },
            });

            // Display the full API response for diagnosis
            if (DEBUG) {
                console.log('Full API response from Component Actions:', JSON.stringify(response.data, null, 2));
            }

            if (response.data && response.data.rows && Array.isArray(response.data.rows)) {
                actions = actions.concat(response.data.rows);
                nextPage = response.data.next_page;
                cursor = response.data.cursor;
            } else {
                console.warn(`Unexpected response when fetching component actions for file ${libraryFileKey}`);
                nextPage = false;
            }
        } catch (error) {
            if (error.response) {
                // Response received, but server responded with an error status
                console.error(`Error fetching component actions for file ${libraryFileKey}: Status ${error.response.status}`);
                console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
            } else if (error.request) {
                // Request was made, but no response received
                console.error('No response received from API:', error.request);
            } else {
                // Something went wrong in setting up the request
                console.error('Error setting up request:', error.message);
            }
            nextPage = false;
        }
    }

    return actions;
}

// Function to make API call to Component Usages endpoint with pagination
async function fetchComponentUsages(libraryFileKey) {
    let usages = [];
    let nextPage = true;
    let cursor = null;

    while (nextPage) {
        try {
            const response = await axios.get(`${FIGMA_ANALYTICS_URL}${libraryFileKey}/component/usages`, {
                headers: {
                    'X-Figma-Token': FIGMA_TOKEN,
                },
                params: {
                    group_by: 'component',
                    cursor: cursor,
                },
            });

            // Display the full API response for diagnosis
            if (DEBUG) {
                console.log('Full API response from Component Usages:', JSON.stringify(response.data, null, 2));
            }

            if (response.data && response.data.rows && Array.isArray(response.data.rows)) {
                usages = usages.concat(response.data.rows);
                nextPage = response.data.next_page;
                cursor = response.data.cursor;
            } else {
                console.warn(`Unexpected response when fetching component usages for file ${libraryFileKey}`);
                nextPage = false;
            }
        } catch (error) {
            if (error.response) {
                // Response received, but server responded with an error status
                console.error(`Error fetching component usages for file ${libraryFileKey}: Status ${error.response.status}`);
                console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
            } else if (error.request) {
                // Request was made, but no response received
                console.error('No response received from API:', error.request);
            } else {
                // Something went wrong in setting up the request
                console.error('Error setting up request:', error.message);
            }
            nextPage = false;
        }
    }

    return usages;
}

// Function to save component names to a CSV
async function extractDataToCSV(components, fileName) {
    if (components.length === 0) {
        console.warn('No components found to generate the CSV.');
        return;
    }

    // Sort components
    components.sort((a, b) => {
        const nameA = a.component_name.toLowerCase();
        const nameB = b.component_name.toLowerCase();
        if (nameA.startsWith('🚫') && !nameB.startsWith('🚫')) return 1;
        if (!nameA.startsWith('🚫') && nameB.startsWith('🚫')) return -1;
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    if (INCLUDE_VARIANTS) {
        components.sort((a, b) => {
            if (a.component_name === b.component_name) {
                return a.component_variant.toLowerCase().localeCompare(b.component_variant.toLowerCase());
            }
            return 0;
        });
    }

    const csvWriter = createCsvWriter({
        path: `${REPORTS_DIR}/${fileName}.csv`,
        header: INCLUDE_VARIANTS ? [
            { id: 'component_name', title: 'Component Name' },
            { id: 'component_variant', title: 'Component Variant' },
            { id: 'component_key', title: 'Component Key' },
            { id: 'usages', title: 'Usages' },
            { id: 'insertions', title: 'Insertions' },
            { id: 'detachments', title: 'Detachments' },
            { id: 'updated_at', title: 'Updated At' },
            { id: 'created_at', title: 'Created At' },
        ] : [
            { id: 'component_name', title: 'Component Name' },
            { id: 'total_variants', title: 'Total Variants' },
            { id: 'usages', title: 'Usages' },
            { id: 'insertions', title: 'Insertions' },
            { id: 'detachments', title: 'Detachments' },
            { id: 'updated_at', title: 'Updated At' },
            { id: 'created_at', title: 'Created At' },
        ],
    });

    try {
        await csvWriter.writeRecords(components);
        console.log(`CSV report successfully generated: ${REPORTS_DIR}/${fileName}.csv`);
    } catch (error) {
        console.error(`Error writing CSV file ${fileName}:`, error.message);
    }
}

// Function to save a log in Markdown
async function saveLogMarkdown(fileName, libraryName, totalComponents, totalVariants, executionTime, period, lastValidWeek) {
    const logFilePath = `${REPORTS_DIR}/${fileName}.md`;
    const logContent = `# CSV Generation Report

- **Library Name**: ${libraryName}
- **Total Components**: ${totalComponents}
- **Total Variants**: ${totalVariants}
- **Generation Date**: ${moment().format('YYYY-MM-DD HH:mm:ss')}
- **Selected Period**: ${period}
- **Last Valid Closed Week**: ${lastValidWeek}
- **Total Execution Time**: ${executionTime} seconds
`;

    try {
        fs.writeFileSync(logFilePath, logContent);
        console.log(`Generation log successfully created: ${logFilePath}`);
    } catch (error) {
        console.error(`Error writing log file ${logFilePath}:`, error.message);
    }
}

// Main function to generate the component report
async function generateComponentReport(fileIds) {
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(fileIds.length, 0);

    for (const fileId of fileIds) {
        const startTime = performance.now();
        console.log(`Processing file with ID: ${fileId}`);

        const libraryName = await fetchFileMetadata(fileId);
        const components = await fetchComponents(fileId);
        const componentActions = await fetchComponentActions(fileId);
        const componentUsages = await fetchComponentUsages(fileId);

        if (!components || components.length === 0) {
            console.warn(`No components found for file ${fileId}.`);
            progressBar.increment();
            continue;
        }

        const timestamp = moment().format('YYYY-MM-DD_HH_mm_ss');
        const fileName = `figma_lib_report_${libraryName}_${timestamp}`;

        // Create the structure for CSV
        let componentsData;
        if (INCLUDE_VARIANTS) {
            componentsData = components.map(component => {
                const action = componentActions.find(a => a.component_key === component.key);
                const usage = componentUsages.find(u => u.component_key === component.key);
                return {
                    component_name: component.containing_frame?.containingStateGroup?.name || component.name,
                    component_variant: component.name,
                    component_key: component.key,
                    insertions: action ? action.insertions : 0,
                    detachments: action ? action.detachments : 0,
                    usages: usage ? usage.usages : 0,
                    updated_at: moment(component.updated_at).format('YYYY-MM-DD'),
                    created_at: moment(component.created_at).format('YYYY-MM-DD'),
                };
            });
        } else {
            const componentGroups = components.reduce((acc, component) => {
                const componentName = component.containing_frame?.containingStateGroup?.name || component.name;
                if (!acc[componentName]) {
                    const relatedActions = componentActions.filter(a => a.component_set_name === componentName);
                    const relatedUsages = componentUsages.filter(u => u.component_set_name === componentName);
                    acc[componentName] = {
                        component_name: componentName,
                        total_variants: 0,
                        usages: relatedUsages.reduce((sum, u) => sum + (u.usages || 0), 0),
                        insertions: relatedActions.reduce((sum, a) => sum + (a.insertions || 0), 0),
                        detachments: relatedActions.reduce((sum, a) => sum + (a.detachments || 0), 0),
                        updated_at: moment(component.updated_at).format('YYYY-MM-DD'),
                        created_at: moment(component.created_at).format('YYYY-MM-DD'),
                    };
                }
                acc[componentName].total_variants++;
                return acc;
            }, {});

            componentsData = Object.values(componentGroups);
        }

        // Generate CSV
        await extractDataToCSV(componentsData, fileName);

        // Calculate execution time
        const endTime = performance.now();
        const executionTime = ((endTime - startTime) / 1000).toFixed(2);

        // Last valid closed week
        const lastValidWeek = moment().subtract(1, 'week').endOf('week').format('YYYY-MM-DD');

        // Save log in Markdown
        await saveLogMarkdown(fileName, libraryName, components.length, componentsData.length, executionTime, period, lastValidWeek);

        // Display information in console
        console.log(`
--- Report Summary ---
`);
        console.log(`Library Name: ${libraryName}`);
        console.log(`Total Components: ${components.length}`);
        console.log(`Total Variants: ${componentsData.length}`);
        console.log(`Generation Date: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`Selected Period: ${period}`);
        console.log(`Last Valid Closed Week: ${lastValidWeek}`);
        console.log(`Total Execution Time: ${executionTime} seconds`);

        progressBar.increment();
    }

    progressBar.stop();
}

// Start report generation process
(async () => {
    if (fileIds.length === 0) {
        console.error('Error: No file ID provided. Provide at least one file ID to generate the report.');
        process.exit(1);
    }
    await generateComponentReport(fileIds);
})();

