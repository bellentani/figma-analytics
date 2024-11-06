const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment'); // Para manipulação de datas
const fs = require('fs');

// Configurações da API do Figma
const FIGMA_API_URL = 'https://api.figma.com/v1/files/';
const FIGMA_TOKEN = 'YOUR_FIGMA_TOKEN_HERE'; // Substitua pelo seu token da API do Figma

// Cria a pasta de relatórios se não existir
const REPORTS_DIR = './reports';
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR);
}

async function fetchFileData(fileId) {
    const response = await axios.get(`${FIGMA_API_URL}${fileId}`, {
        headers: {
            'X-Figma-Token': FIGMA_TOKEN,
        },
    });
    return response.data;
}

function getFormattedDate() {
    return moment().format('YYYY-MM-DD'); // Formato de data: ano-mês-dia
}

function extractDataToCSV(components, fileName) {
    const csvWriter = createCsvWriter({
        path: `${REPORTS_DIR}/${fileName}.csv`,
        header: [
            { id: 'componentName', title: 'Component Name' },
            { id: 'totalVariants', title: 'Total Variants' },
            { id: 'totalInstances', title: 'Total Instances' },
            { id: 'inserts', title: 'Inserts' },
            { id: 'detaches', title: 'Detaches' },
        ],
    });

    return csvWriter.writeRecords(components);
}

function filterComponentsByDate(components, startDate, endDate) {
    return components.filter(component => {
        const createdAt = moment(component.lastUsed); // Ajuste isso para a propriedade correta
        return createdAt.isBetween(startDate, endDate, null, '[]');
    });
}

async function generateReport(fileIds, timeFrame) {
    const now = moment();
    let startDate, endDate;

    switch (timeFrame) {
        case '30days':
            startDate = now.subtract(30, 'days');
            break;
        case '60days':
            startDate = now.subtract(60, 'days');
            break;
        case '90days':
            startDate = now.subtract(90, 'days');
            break;
        case '1year':
            startDate = now.subtract(1, 'years');
            break;
        case 'custom':
            startDate = moment(process.argv[3]);
            endDate = moment(process.argv[4]);
            break;
        default:
            console.log('Período de tempo inválido. Use 30days, 60days, 90days, 1year ou custom.');
            return;
    }

    for (const fileId of fileIds) {
        try {
            const fileData = await fetchFileData(fileId);
            const components = fileData.document.children.filter(child => child.type === 'COMPONENT'); // Ajuste conforme a estrutura do JSON
            const filteredComponents = filterComponentsByDate(components, startDate, endDate);

            const componentsData = filteredComponents.map(component => ({
                componentName: component.name,
                totalVariants: component.variants ? component.variants.length : 0,
                totalInstances: component.instances ? component.instances.length : 0,
                inserts: component.inserts || 0, // Ajuste conforme necessário
                detaches: component.detaches || 0, // Ajuste conforme necessário
            }));

            const dateSuffix = getFormattedDate();
            const reportFileName = `${fileId}_${dateSuffix}`;
            await extractDataToCSV(componentsData, reportFileName);
            console.log(`Relatório gerado: ${REPORTS_DIR}/${reportFileName}.csv`);
        } catch (error) {
            console.error(`Erro ao processar o arquivo ${fileId}: ${error.message}`);
        }
    }
}

// Escolha entre um único arquivo ou múltiplos
const fileIds = process.argv.slice(2, -1); // IDs dos arquivos
const timeFrame = process.argv[process.argv.length - 1]; // Período de tempo
if (fileIds.length === 0) {
    console.log('Por favor, forneça pelo menos um ID de arquivo como argumento.');
    process.exit(1);
}

generateReport(fileIds, timeFrame);
