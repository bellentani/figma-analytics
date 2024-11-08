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
                    end_date: endDate,
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

// Function to save component names in a CSV
async function extractDataToCSV(components, fileName) {
    console.log('Iniciando geração do CSV...');
    console.log('Componentes recebidos:', components.length);

    if (components.length === 0) {
        console.warn('Nenhum componente encontrado para gerar CSV.');
        return;
    }

    try {
        // Verifique se o diretório reports existe
        if (!fs.existsSync(REPORTS_DIR)) {
            console.log('Criando diretório reports...');
            fs.mkdirSync(REPORTS_DIR);
        }

        console.log('Preparando dados para CSV...');
        
        // Adicione log dos dados antes de ordenar
        console.log('Primeiros 3 componentes:', components.slice(0, 3));

        // Sorting components
        components.sort((a, b) => {
            const nameA = (a.component_name || '').toLowerCase();
            const nameB = (b.component_name || '').toLowerCase();
            if (nameA.startsWith('🚫') && !nameB.startsWith('🚫')) return 1;
            if (!nameA.startsWith('🚫') && nameB.startsWith('🚫')) return -1;
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });

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

        console.log('Escrevendo arquivo CSV...');
        await csvWriter.writeRecords(components);
        console.log(`CSV gerado com sucesso: ${REPORTS_DIR}/${fileName}.csv`);
    } catch (error) {
        console.error('Erro ao gerar CSV:', error);
        throw error; // Re-throw para capturar no processo principal
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

// Nova função para normalizar caracteres especiais
function normalizeString(string) {
    return string
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]/gi, '_') // Substitui caracteres não alfanuméricos por _
        .toLowerCase();
}

// Função para validar formato de data
function isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
}

// Função para processar o período
function parsePeriod(periodStr) {
    const validPeriods = {
        '30d': 30,
        '60d': 60,
        '90d': 90,
        '1y': 365
    };

    // Remove aspas se houver
    periodStr = (periodStr || '30d').replace(/['"]/g, '');

    // Verifica se é um período customizado
    if (periodStr.includes(',')) {
        const [startStr, endStr] = periodStr.split(',').map(d => d.trim());
        return {
            startDate: startStr,
            endDate: endStr
        };
    }

    // Verifica se é um período válido
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

// Função para buscar todas as páginas de ações dos componentes
async function fetchAllComponentActions(fileId, startDate, endDate) {
    let allRows = [];
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
        try {
            const response = await axios.get(
                `${FIGMA_ANALYTICS_URL}${fileId}/component/actions`,
                {
                    headers: {
                        'X-Figma-Token': FIGMA_TOKEN
                    },
                    params: {
                        group_by: 'component',
                        start_date: startDate,
                        end_date: endDate,
                        ...(cursor && { cursor })
                    }
                }
            );

            const { rows, next_page, cursor: nextCursor } = response.data;
            allRows = allRows.concat(rows || []);
            
            hasNextPage = next_page;
            cursor = nextCursor;

            if (DEBUG) {
                console.log(`Fetched ${rows.length} actions. Has next page: ${hasNextPage}`);
            }

        } catch (error) {
            console.error('Error fetching component actions:', error.message);
            throw error;
        }
    }

    return allRows;
}

// Função para processar os dados das ações
function processComponentActions(actions) {
    // Agrupa as ações por componente
    return actions.reduce((acc, row) => {
        const key = row.component_key;
        
        if (!acc[key]) {
            acc[key] = {
                component_name: row.component_set_name || row.component_name,
                component_key: key,
                insertions: 0,
                detachments: 0
            };
        }

        acc[key].insertions += row.insertions || 0;
        acc[key].detachments += row.detachments || 0;

        return acc;
    }, {});
}

// Main function to generate component report
async function generateComponentReport(fileId, startDate, endDate, debug = false) {
    try {
        console.log('Iniciando geração do relatório...');
        
        // Busca o nome da biblioteca
        const libraryName = await fetchFileMetadata(fileId);
        console.log('Nome da biblioteca:', libraryName);

        // Busca todas as ações (com paginação)
        const actions = await fetchAllComponentActions(fileId, startDate, endDate);
        console.log('Ações encontradas:', actions.length);
        
        // Busca os dados de uso
        const usages = await fetchComponentUsages(fileId);
        console.log('Dados de uso encontrados:', Object.keys(usages).length);

        // Processa os dados
        const processedActions = processComponentActions(actions);
        console.log('Ações processadas:', Object.keys(processedActions).length);

        // Prepara os dados para o relatório
        const reportData = Object.values(processedActions).map(action => ({
            ...action,
            usages: usages[action.component_key]?.usages || 0
        }));
        console.log('Dados do relatório preparados:', reportData.length);

        // Gera o nome do arquivo baseado na data e nome da biblioteca
        const fileName = `${normalizeString(libraryName)}_${moment().format('YYYY-MM-DD')}`;
        
        // Gera o CSV
        await extractDataToCSV(reportData, fileName);
        
        // Gera o MD
        const executionTime = process.hrtime()[0];
        await saveLogMarkdown(
            fileName,
            libraryName,
            reportData.length,
            reportData.reduce((acc, curr) => acc + (curr.total_variants || 1), 0),
            executionTime,
            `${startDate} to ${endDate}`,
            moment().subtract(1, 'week').format('YYYY-MM-DD')
        );

        console.log('Relatório gerado com sucesso!');
        return reportData;
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        throw error;
    }
}

// Start the report generation process
(async () => {
    const argv = yargs
        .option('files', {
            alias: 'f',
            description: 'Figma file key(s)',
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

    // Função para calcular o período
    function calculatePeriod(periodStr) {
        const validPeriods = {
            '30d': 30,
            '60d': 60,
            '90d': 90,
            '1y': 365
        };

        // Remove aspas se houver
        const cleanPeriod = periodStr.replace(/['"]/g, '');

        // Verifica se é um período válido
        if (!validPeriods[cleanPeriod]) {
            console.error('Invalid period. Using default (30d)');
            return validPeriods['30d'];
        }

        return validPeriods[cleanPeriod];
    }

    // Função para formatar data como YYYY-MM-DD
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Processa os IDs dos arquivos
    const fileIds = argv.files
        .replace(/['"]/g, '')
        .split(',')
        .map(id => id.trim())
        .filter(id => id);

    // Calcula as datas do período
    const days = calculatePeriod(argv.period);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Formata as datas para a API
    const periodDates = {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };

    if (argv.debug) {
        console.log('Period:', {
            days,
            startDate: periodDates.startDate,
            endDate: periodDates.endDate
        });
    }

    if (fileIds.length === 0) {
        console.error('Error: No file ID provided. Please provide at least one file ID to generate the report.');
        process.exit(1);
    }
    await generateComponentReport(fileIds, periodDates.startDate, periodDates.endDate, argv.debug);
})();

