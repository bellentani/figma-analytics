require('dotenv').config(); // Load environment variables from the .env file
const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment'); // For date manipulation
const fs = require('fs');
const { performance } = require('perf_hooks'); // For measuring execution time
const { createNotionDatabase, addComponentsToNotion, handleReportSummaryDatabase } = require('./src/integrations/notion-integration');
const https = require('https');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
            console.log('Components API response:', JSON.stringify(response.data, null, 2));
        }

        if (response.data && response.data.meta && response.data.meta.components) {
            return response.data.meta.components.map(component => ({
                ...component,
                // Usar as datas retornadas pela API do Figma
                created_at: component.created_at,
                updated_at: component.updated_at,
                // Manter os outros campos
                component_name: component.name,
                key: component.key,
                description: component.description,
                // ... outros campos
            }));
        }

        return [];
    } catch (error) {
        console.error('Error fetching components:', error.message);
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

        // Group actions by set name or component name
        const actionsByName = (response.data?.rows || []).reduce((acc, row) => {
            // Use component_set_name if available (for Sets) or component_name (for Singles)
            const key = row.component_set_name || row.component_name;
            
            if (!acc[key]) {
                acc[key] = {
                    insertions: 0,
                    detachments: 0,
                    type: row.component_set_name ? 'Set' : 'Single'
                };
            }

            acc[key].insertions += Number(row.insertions || 0);
            acc[key].detachments += Number(row.detachments || 0);

            return acc;
        }, {});

        // Debug log for processed data
        console.log('\nFirst 3 processed actions:');
        console.log(Object.entries(actionsByName).slice(0, 3).map(([name, data]) => ({
            name,
            type: data.type,
            insertions: data.insertions,
            detachments: data.detachments
        })));

        return actionsByName;
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
                { id: 'created_at', title: 'Created At' },
                { id: 'updated_at', title: 'Updated At' },
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
                insertions: comp.insertions, //|| 'N/A'
                detachments: comp.detachments, //|| 'N/A'
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
        .replace(/^_|_$/g, '')              // Remove leading/trailing underscores
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
        // Verifica se é um Set baseado no containingStateGroup
        const isSet = component.containing_frame?.containingStateGroup;
        const componentName = isSet 
            ? component.containing_frame.containingStateGroup.name 
            : component.name;
        
        // Initialize component if not exists
        if (!acc[componentName]) {
            acc[componentName] = {
                component_name: componentName,
                total_variants: 0,
                usages: 0,
                insertions: 0,
                detachments: 0,
                updated_at: moment(component.updated_at).format('YYYY-MM-DD-HH-mm'),
                created_at: moment(component.created_at).format('YYYY-MM-DD-HH-mm'),
                type: isSet ? 'Set' : 'Single'
            };
        }

        // Atualiza contagem de variantes apenas se for Set
        if (isSet) {
            acc[componentName].total_variants++;
        } else {
            acc[componentName].total_variants = 'N/A';
        }

        // Add usage data based on component key
        acc[componentName].usages += Number(usages[component.key]?.usages || 0);

        // Add actions data based on set name or component name
        const actionKey = isSet ? componentName : component.name;
        if (actionsData[actionKey]) {
            acc[componentName].insertions = Number(actionsData[actionKey].insertions || 0);
            acc[componentName].detachments = Number(actionsData[actionKey].detachments || 0);
        }

        return acc;
    }, {});

    // Sort results
    const result = Object.values(processedComponents)
        .sort((a, b) => a.component_name.toLowerCase().localeCompare(b.component_name.toLowerCase()));

    // Debug log for component data
    console.log('\nComponents with actions:');
    result.forEach(comp => {
        if (comp.insertions > 0 || comp.detachments > 0) {
            console.log(`${comp.component_name} (${comp.type}):`, {
                variants: comp.total_variants === 'N/A' ? 'N/A' : comp.total_variants,
                insertions: comp.insertions,
                detachments: comp.detachments || 0
            });
        }
    });

    // Component listing
    console.log('\n=== COMPONENT LIST ===');
    console.log('Component Name | Total Variants | Usages (total) | Inserts (period) | Detachs (period) | Type');
    console.log('-----------------------------------------------------------------------------------------');
    result.forEach(comp => {
        console.log(
            `${comp.component_name.padEnd(20)} | ` +
            `${(comp.total_variants === 'N/A' ? 'N/A' : String(comp.total_variants)).padEnd(14)} | ` +
            `${String(comp.usages).padEnd(13)} | ` +
            `${String(comp.insertions || 0).padEnd(15)} | ` +
            `${String(comp.detachments || 0).padEnd(14)} | ` +
            `${comp.type}`
        );
    });

    return result;
}

// Array para armazenar dados de todos os relatórios
let allReportData = [];

// Função para gerar relatório consolidado
async function generateConsolidatedReport(allReportData, period) {
    const timestamp = moment().format('YYYY-MM-DD');
    const fileName = `Report Consolidated - All - ${period} - ${timestamp}.csv`;

    const csvWriter = createCsvWriter({
        path: `${REPORTS_DIR}/${fileName}`,
        header: [
            { id: 'component_name', title: 'Component Name' },
            { id: 'total_variants', title: 'Total Variants' },
            { id: 'usages', title: 'Usages' },
            { id: 'insertions', title: 'Insertions' },
            { id: 'detachments', title: 'Detachments' },
            { id: 'created_at', title: 'Created At' },
            { id: 'updated_at', title: 'Updated At' },
            { id: 'type', title: 'Type' },
            { id: 'lib_file', title: 'Lib File' } // Nova coluna
        ]
    });

    console.log('Writing consolidated CSV file...');
    await csvWriter.writeRecords(allReportData);
    console.log(`Consolidated CSV generated successfully: ${REPORTS_DIR}/${fileName}`);
}

// Modifique a função generateComponentReport para adicionar dados ao allReportData
async function generateComponentReport(fileId, startDate, endDate, period, notionPageId, summaryDatabaseId = null, debug = false) {
    const executionStartTime = process.hrtime();
    
    try {
        console.log('Starting report generation...');
        
        // Fetch library name
        const libraryName = await fetchFileMetadata(fileId);
        console.log('Library name:', libraryName);

        // Fetch components
        const components = await fetchComponents(fileId);
        console.log('Components found:', components.length);

        // Fetch component actions
        const actionsData = await fetchComponentActions(fileId, startDate, endDate);
        console.log('Action data found:', Object.keys(actionsData).length);
        
        // Fetch usage data
        const usages = await fetchComponentUsages(fileId);
        console.log('Usage data found:', Object.keys(usages).length);

        // Process and aggregate components
        const reportData = processComponents(components, actionsData, usages);
        console.log('Report data prepared:', reportData.length);

        // Adicione os dados do relatório atual ao allReportData
        reportData.forEach(data => {
            allReportData.push({
                ...data,
                lib_file: libraryName // Adiciona o nome do arquivo de origem
            });
        });

        // Generate filename
        const timestamp = moment().format('YYYY-MM-DD-HH-mm');
        const normalizedLibraryName = normalizeString(libraryName).replace(/_+/g, '_').replace(/^_|_$/g, '');
        const periodStr = period.startsWith('custom') 
            ? `custom_${startDate.replace(/-/g, '')}to${endDate.replace(/-/g, '')}`
            : period;
        const fileName = `report_${normalizedLibraryName}_${periodStr}_${timestamp}`;

        // Generate CSV
        await extractDataToCSV(reportData, fileName);

        // Generate summary before Notion integration
        const summary = await generateReportSummary(
            reportData,
            libraryName,
            startDate,
            endDate,
            period,
            executionStartTime
        );

        // If we have Notion integration
        if (process.env.NOTION_TOKEN && notionPageId) {
            console.log('\nStarting Notion integration...');
            
            // Create/update main database
            const databaseId = await createNotionDatabase(
                notionPageId,
                period,
                libraryName,
                new Date()
            );
            await addComponentsToNotion(databaseId, reportData);
            console.log('All components added successfully to Notion');
            
            // Handle summary database
            await handleReportSummaryDatabase(
                notionPageId,
                summaryDatabaseId,
                summary,
                libraryName
            );
            
            console.log('Summary data successfully added to Notion!');
        }

        console.log('Report generated successfully!');
        return { reportData, summary };
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

async function generateReportSummary(reportData, libraryName, startDate, endDate, period, executionStartTime) {
    // Normalize library name for file usage
    const normalizedLibraryName = normalizeString(libraryName).replace(/_+/g, '_').replace(/^_|_$/g, '');
    const timestamp = moment().format('YYYY-MM-DD-HH-mm');
    
    // Format period for filename
    const periodStr = period.startsWith('custom') 
        ? `custom_${startDate.replace(/-/g, '')}to${endDate.replace(/-/g, '')}`
        : period;

    const baseFileName = `report_${normalizedLibraryName}_${periodStr}_${timestamp}`;

    const summary = {
        libraryName: libraryName,
        totalComponents: reportData.length,
        totalVariants: reportData.reduce((sum, component) => {
            return sum + (component.total_variants === 'N/A' ? 0 : (parseInt(component.total_variants) || 0));
        }, 0),
        totalUsages: reportData.reduce((sum, component) => {
            return sum + (component.usages || 0);
        }, 0),
        totalInsertions: reportData.reduce((sum, component) => {
            return sum + (component.insertions || 0);
        }, 0),
        totalDetachments: reportData.reduce((sum, component) => {
            return sum + (component.detachments || 0);
        }, 0),
        generationDate: moment().format('YYYY-MM-DD HH:mm:ss'),
        selectedPeriod: `${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`,
        lastClosedValidWeek: moment().subtract(1, 'week').endOf('week').format('YYYY-MM-DD'),
        executionTime: calculateExecutionTime(executionStartTime)
    };

    // Add to CSV
    await addSummaryToCSV(summary, reportData);
    
    // Generate MD with same base name as CSV
    await generateSummaryMD(summary, baseFileName);

    return summary;
}

function calculateExecutionTime(startTime) {
    const endTime = process.hrtime(startTime);
    const seconds = endTime[0];
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

async function addSummaryToCSV(summary, reportData) {
    // Add blank lines and summary at the beginning of CSV
    const summaryRows = [
        ['REPORT SUMMARY'],
        ['Library Name', summary.libraryName],
        ['Total Components', summary.totalComponents],
        ['Total Variants', summary.totalVariants],
        ['Usage (total)', summary.totalUsages],
        ['Insertions (total)', summary.totalInsertions],
        ['Detachments (total)', summary.totalDetachments],
        ['Generation Date', summary.generationDate],
        ['Selected Period', summary.selectedPeriod],
        ['Last Closed Valid Week', summary.lastClosedValidWeek],
        [], // Blank line
        [], // Blank line
        ['COMPONENT DATA'] // Header for component data
    ];

    // Combine summary with existing data
    return [...summaryRows, ...reportData];
}

async function generateSummaryMD(summary, baseFileName) {
    const mdContent = `# Report Summary

## Library Information
- **Library Name:** ${summary.libraryName}
- **Total Components:** ${summary.totalComponents}
- **Total Variants (SUM):** ${summary.totalVariants}

## Usage Statistics
- **Usage (total):** ${summary.totalUsages}
- **Insertions (total):** ${summary.totalInsertions}
- **Detachments (total):** ${summary.totalDetachments}

## Report Information
- **Generation Date:** ${summary.generationDate}
- **Selected Period:** ${summary.selectedPeriod}
- **Last Closed Valid Week:** ${summary.lastClosedValidWeek}
- **Total Execution Time:** ${summary.executionTime}

---
Generated by Figma Library Report Tool
`;

    // Save MD file using the same naming pattern as CSV
    await fs.promises.writeFile(`${REPORTS_DIR}/${baseFileName}.md`, mdContent);
}

// Start the report generation process
(async () => {
    // Get all command line arguments
    const args = process.argv.slice(2);
    
    // Parse arguments
    const params = {};
    const flags = new Set();
    
    args.forEach(arg => {
        if (arg.startsWith('--')) {
            // It's a flag
            flags.add(arg.slice(2));
        } else if (arg.includes('=')) {
            // It's a parameter
            const [key, value] = arg.split('=');
            // Remove quotes if present
            params[key] = value.replace(/^["']|["']$/g, '');
        }
    });

    try {
        // Process file IDs
        if (!params.files) {
            console.error('Error: files parameter is required. Use: files="fileId1,fileId2"');
            process.exit(1);
        }

        const fileIds = params.files
            .split(',')
            .map(id => id.trim())
            .filter(id => id);

        if (fileIds.length === 0) {
            console.error('Error: No valid file IDs provided.');
            process.exit(1);
        }

        // Calculate period dates
        const { startDate, endDate } = parsePeriod(params.period || '30d');

        console.log('\n=== INICIANDO GERAÇÃO DE RELATÓRIO EM LOTE ===');
        console.log('Arquivos para processar:', fileIds.length);
        console.log('Período:', { period: params.period || '30d', startDate, endDate });
        console.log('Modo debug:', flags.has('debug'));

        // Process each file sequentially
        for (let i = 0; i < fileIds.length; i++) {
            const fileId = fileIds[i];
            console.log(`\n[${i + 1}/${fileIds.length}] Processing file ID: ${fileId}`);
            
            try {
                await generateComponentReport(
                    fileId, 
                    startDate, 
                    endDate, 
                    params.period || '30d',
                    params.notion,
                    params.summary,
                    flags.has('debug')
                );
                console.log(`✓ Report generated successfully for file ID: ${fileId}`);
            } catch (error) {
                console.error(`✗ Error generating report for file ID ${fileId}:`, error.message);
                continue;
            }
        }

        // Após processar todos os arquivos, gerar o relatório consolidado
        await generateConsolidatedReport(allReportData, params.period || '30d');

        console.log('\n=== GERAÇÃO DE RELATÓRIO EM LOTE CONCLUÍDA ===');
        console.log(`Total de arquivos processados: ${fileIds.length}`);
    } catch (error) {
        console.error('Error in batch processing:', error);
        process.exit(1);
    }
})();
