require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env
const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment'); // Para manipulação de datas
const fs = require('fs');

// Configurações da API do Figma
const FIGMA_API_URL = 'https://api.figma.com/v1/files/';
const FIGMA_TOKEN = process.env.FIGMA_TOKEN; // Obtém o token da variável de ambiente

// Verifique se o token foi carregado corretamente
if (!FIGMA_TOKEN) {
    console.error('Erro: FIGMA_TOKEN não foi encontrado. Verifique o arquivo .env e o valor da variável de ambiente.');
    process.exit(1);
}

// Apenas para depuração - certifique-se de remover isso depois!
console.log('Token Figma utilizado:', FIGMA_TOKEN);

// Cria a pasta de relatórios se não existir
const REPORTS_DIR = './reports';
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR);
}

// Parâmetro de debug e de variantes
const args = process.argv.slice(2);
const DEBUG = args.includes('--debug');
const INCLUDE_VARIANTS = args.includes('--include-variants');

// Remove '--debug' e '--include-variants' dos argumentos se estiverem presentes
const fileIds = args.filter(arg => arg !== '--debug' && arg !== '--include-variants');

// Função para fazer a chamada de API ao endpoint Components
async function fetchComponents(libraryFileKey) {
    try {
        const response = await axios.get(`${FIGMA_API_URL}${libraryFileKey}/components`, {
            headers: {
                'X-Figma-Token': FIGMA_TOKEN,
            },
        });

        // Exibir a resposta completa da API para diagnóstico
        if (DEBUG) {
            console.log('Resposta completa da API de Components:', JSON.stringify(response.data, null, 2));
        }

        if (response.data && response.data.meta && response.data.meta.components) {
            return response.data.meta.components;
        } else {
            console.warn(`Resposta inesperada ao buscar componentes do arquivo ${libraryFileKey}`);
            return [];
        }
    } catch (error) {
        if (error.response) {
            // A resposta foi recebida, mas o servidor respondeu com um status de erro
            console.error(`Erro ao buscar componentes do arquivo ${libraryFileKey}: Status ${error.response.status}`);
            console.error('Dados da resposta de erro:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            // A solicitação foi feita, mas não houve resposta
            console.error('Nenhuma resposta recebida da API:', error.request);
        } else {
            // Algo deu errado na configuração da solicitação
            console.error('Erro ao configurar a solicitação:', error.message);
        }
        return [];
    }
}

// Função para salvar os nomes dos componentes em um CSV
async function extractDataToCSV(components, fileName) {
    if (components.length === 0) {
        console.warn('Nenhum componente encontrado para gerar o CSV.');
        return;
    }

    const csvWriter = createCsvWriter({
        path: `${REPORTS_DIR}/${fileName}.csv`,
        header: INCLUDE_VARIANTS ? [
            { id: 'component_name', title: 'Component Name' },
            { id: 'component_variant', title: 'Component Variant' },
            { id: 'component_key', title: 'Component Key' },
            { id: 'updated_at', title: 'Updated At' },
            { id: 'created_at', title: 'Created At' },
        ] : [
            { id: 'component_name', title: 'Component Name' },
            { id: 'updated_at', title: 'Updated At' },
            { id: 'created_at', title: 'Created At' },
        ],
    });

    try {
        await csvWriter.writeRecords(components);
        console.log(`Relatório CSV gerado com sucesso: ${REPORTS_DIR}/${fileName}.csv`);
    } catch (error) {
        console.error(`Erro ao escrever o arquivo CSV ${fileName}:`, error.message);
    }
}

// Função principal para gerar o relatório de componentes
async function generateComponentReport(fileIds) {
    for (const fileId of fileIds) {
        console.log(`Processando o arquivo com ID: ${fileId}`);

        const components = await fetchComponents(fileId);

        if (!components || components.length === 0) {
            console.warn(`Nenhum componente encontrado no arquivo ${fileId}.`);
            continue;
        }

        // Criar a estrutura para o CSV
        let componentsData;
        if (INCLUDE_VARIANTS) {
            componentsData = components.map(component => ({
                component_name: component.containing_frame?.containingStateGroup?.name || component.name,
                component_variant: component.name,
                component_key: component.key,
                updated_at: moment(component.updated_at).format('YYYY-MM-DD'),
                created_at: moment(component.created_at).format('YYYY-MM-DD'),
            }));
        } else {
            const uniqueComponents = Array.from(new Set(components.map(component => component.containing_frame?.containingStateGroup?.name || component.name)));
            componentsData = uniqueComponents.map(componentName => {
                const component = components.find(c => (c.containing_frame?.containingStateGroup?.name || c.name) === componentName);
                return {
                    component_name: componentName,
                    updated_at: moment(component.updated_at).format('YYYY-MM-DD'),
                    created_at: moment(component.created_at).format('YYYY-MM-DD'),
                };
            });
        }

        // Ordenar os componentes por nome
        componentsData.sort((a, b) => a.component_name.localeCompare(b.component_name));

        // Imprimindo os nomes dos componentes para diagnóstico
        console.log('Componentes encontrados:');
        componentsData.forEach(component => console.log(`- ${component.component_name}`));

        // Nome do arquivo CSV
        const libraryName = `components_report_${fileId}_${getFormattedDate()}_${getFormattedTime()}`;
        await extractDataToCSV(componentsData, libraryName);
    }
}

function getFormattedDate() {
    return moment().format('YYYY-MM-DD'); // Formato de data: ano-mês-dia
}

function getFormattedTime() {
    return moment().format('HH-mm'); // Formato de hora e minuto: hora-minuto
}

// Verifica se há arquivos fornecidos
if (fileIds.length === 0) {
    console.log('Por favor, forneça pelo menos um ID de arquivo como argumento.');
    process.exit(1);
}

// Gera o relatório com os nomes dos componentes
generateComponentReport(fileIds);
