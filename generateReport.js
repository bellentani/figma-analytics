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

// Função para buscar e processar ações (insertions e detachments)
async function fetchComponentActions(fileId, startDate, endDate) {
    console.log('Component Actions WIP');
    return {};
}

// Função para buscar e processar usages
async function fetchComponentUsages(fileId) {
    try {
        console.log('\n=== DADOS DO ENDPOINT COMPONENT/USAGES ===');
        
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

        console.log('Primeiras 3 linhas da resposta:');
        console.log(response.data?.rows?.slice(0, 3).map(row => ({
            component_key: row.component_key,
            component_name: row.component_name,
            component_set_name: row.component_set_name,
            usages: row.usages
        })));

        // Processa os usages por component_key
        const usagesByKey = {};
        (response.data?.rows || []).forEach(row => {
            if (!row.component_key) return;
            usagesByKey[row.component_key] = {
                usages: parseInt(row.usages) || 0
            };
        });

        console.log('\nPrimeiros 3 usages processados:');
        console.log(Object.entries(usagesByKey).slice(0, 3));

        return usagesByKey;
    } catch (error) {
        console.error('Erro ao buscar usages dos componentes:', error.message);
        return {};
    }
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
        
        // Adicione log de todos os componentes
        console.log('Lista completa de componentes:');
        components.forEach(comp => {
            console.log({
                component_name: comp.component_name,
                total_variants: comp.total_variants,
                usages: comp.usages,
                insertions: comp.insertions,
                detachments: comp.detachments,
                updated_at: comp.updated_at,
                created_at: comp.created_at
            });
        });

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
    try {
        console.log('Buscando ações para o período:', { startDate, endDate });
        
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

        if (DEBUG) {
            console.log('Resposta da API de ações:', {
                status: response.status,
                estrutura: response.data ? Object.keys(response.data) : 'sem dados',
                temRows: !!response.data?.rows,
                quantidadeRows: response.data?.rows?.length
            });
        }

        const actions = response.data?.rows || [];
        return actions.map(action => ({
            component_key: action.component_key,
            insertions: parseInt(action.insertions) || 0,
            detachments: parseInt(action.detachments) || 0
        }));
    } catch (error) {
        console.error('Erro ao buscar aões dos componentes:', error.message);
        return [];
    }
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

// Função para processar e agregar componentes
function processComponents(components, actions, usages) {
    console.log('\n=== COMPONENT LIST ===');
    console.log('Total de componentes recebidos:', components.length);

    // Agrupar por containing_frame.containingStateGroup.name ou component_name
    const groupedComponents = components.reduce((acc, component) => {
        // Tenta pegar o nome do state group primeiro, depois o frame name
        const stateGroupName = component.containing_frame?.containingStateGroup?.name;
        const frameName = component.containing_frame?.name;
        const componentName = component.name;
        const componentKey = component.key;
        
        // Define qual nome usar (prioridade: stateGroup > frame > component)
        const name = stateGroupName || frameName || componentName;
        
        if (!acc[name]) {
            acc[name] = {
                component_name: name,
                total_variants: 0,
                usages: 0,
                insertions: 'N/A',
                detachments: 'N/A',
                updated_at: component.updated_at || 'N/A',
                created_at: component.created_at || 'N/A',
                component_keys: new Set(),
                is_set: !!(stateGroupName || frameName)
            };
        }

        acc[name].component_keys.add(componentKey);

        // Adiciona os usos
        const usageData = usages[componentKey];
        if (usageData) {
            acc[name].usages += usageData.usages || 0;
        }

        return acc;
    }, {});

    // Log dos tipos de componentes
    const sets = Object.values(groupedComponents).filter(c => c.is_set);
    const individuals = Object.values(groupedComponents).filter(c => !c.is_set);
    
    console.log('\nEstatísticas:');
    console.log(`Total de component sets: ${sets.length}`);
    console.log(`Total de componentes individuais: ${individuals.length}`);

    // Calcula o total de variantes
    Object.values(groupedComponents).forEach(group => {
        group.total_variants = group.is_set ? group.component_keys.size : 1;
        delete group.component_keys;
        delete group.is_set;
    });

    // Converte para array e ordena
    let result = Object.values(groupedComponents);
    result.sort((a, b) => {
        const nameA = a.component_name.toLowerCase();
        const nameB = b.component_name.toLowerCase();
        
        // Coloca componentes deprecados no final
        if (nameA.startsWith('🚫') && !nameB.startsWith('🚫')) return 1;
        if (!nameA.startsWith('🚫') && nameB.startsWith('🚫')) return -1;
        
        return nameA.localeCompare(nameB);
    });

    // Log dos componentes processados
    console.log('\nComponentes processados:');
    console.log('Component Name | Total Variants | Usages | Type');
    console.log('------------------------------------------------');
    result.forEach(comp => {
        const type = sets.includes(comp) ? 'SET' : 'INDIVIDUAL';
        console.log(`${comp.component_name} | ${comp.total_variants} | ${comp.usages} | ${type}`);
    });

    return result;
}

// Main function to generate component report
async function generateComponentReport(fileId, startDate, endDate, debug = false) {
    try {
        console.log('Iniciando geração do relatório...');
        
        // Busca o nome da biblioteca
        const libraryName = await fetchFileMetadata(fileId);
        console.log('Nome da biblioteca:', libraryName);

        // Busca os componentes
        const components = await fetchComponents(fileId);
        console.log('Componentes encontrados:', components.length);

        // Busca todas as ações
        const actions = await fetchAllComponentActions(fileId, startDate, endDate);
        console.log('Ações encontradas:', actions.length);
        
        // Busca os dados de uso
        const usages = await fetchComponentUsages(fileId);
        console.log('Dados de uso encontrados:', Object.keys(usages).length);

        if (DEBUG) {
            console.log('Amostra de dados:');
            console.log('- Primeiro componente:', components[0]);
            console.log('- Primeira ação:', actions[0]);
            console.log('- Primeiro uso:', Object.entries(usages)[0]);
        }

        // Processa os dados das ações em um formato mais fácil de usar
        const processedActions = actions.reduce((acc, action) => {
            acc[action.component_key] = {
                insertions: action.insertions || 0,
                detachments: action.detachments || 0
            };
            return acc;
        }, {});

        // Processa e agrega os componentes
        const reportData = processComponents(components, processedActions, usages);
        console.log('Dados do relatório preparados:', reportData.length);

        // Gera o nome do arquivo
        const fileName = `${normalizeString(libraryName)}_${moment().format('YYYY-MM-DD')}`;
        
        // Gera o CSV
        await extractDataToCSV(reportData, fileName);
        
        // Gera o MD
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

