require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env
const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment'); // Para manipulação de datas
const fs = require('fs');
const { performance } = require('perf_hooks'); // Para medir o tempo de execução

// Configurações da API do Figma
const FIGMA_API_URL = 'https://api.figma.com/v1/files/';
const FIGMA_ANALYTICS_URL = 'https://api.figma.com/v1/analytics/libraries/';
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

// Parâmetro de período
let period = '30days';
const periodOptions = ['30days', '60days', '90days', '1year', 'custom'];
args.forEach(arg => {
    if (periodOptions.includes(arg)) {
        period = arg;
    }
});

// Remove '--debug', '--include-variants' e período dos argumentos se estiverem presentes
const fileIds = args.filter(arg => arg !== '--debug' && arg !== '--include-variants' && !periodOptions.includes(arg));

// Função para calcular datas de início e fim com base no período
function calculateDateRange(period) {
    let startDate, endDate;
    switch (period) {
        case '60days':
            startDate = moment().subtract(60, 'days').format('YYYY-MM-DD');
            break;
        case '90days':
            startDate = moment().subtract(90, 'days').format('YYYY-MM-DD');
            break;
        case '1year':
            startDate = moment().subtract(1, 'year').format('YYYY-MM-DD');
            break;
        case 'custom':
            // Custom logic can be implemented aqui se necessário
            startDate = moment().subtract(30, 'days').format('YYYY-MM-DD'); // Placeholder para lógica customizada
            break;
        default:
            startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
    }
    endDate = moment().format('YYYY-MM-DD');
    return { startDate, endDate };
}

const { startDate, endDate } = calculateDateRange(period);

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

// Função para fazer a chamada de API ao endpoint Component Actions
async function fetchComponentActions(libraryFileKey) {
    try {
        const response = await axios.get(`${FIGMA_ANALYTICS_URL}${libraryFileKey}/component/actions`, {
            headers: {
                'X-Figma-Token': FIGMA_TOKEN,
            },
            params: {
                group_by: 'component',
                start_date: startDate,
                end_date: endDate,
            },
        });

        // Exibir a resposta completa da API para diagnóstico
        if (DEBUG) {
            console.log('Resposta completa da API de Component Actions:', JSON.stringify(response.data, null, 2));
        }

        if (response.data && response.data.rows && Array.isArray(response.data.rows)) {
            return response.data.rows;
        } else {
            console.warn(`Resposta inesperada ao buscar ações dos componentes para o arquivo ${libraryFileKey}`);
            return [];
        }
    } catch (error) {
        if (error.response) {
            // A resposta foi recebida, mas o servidor respondeu com um status de erro
            console.error(`Erro ao buscar ações dos componentes para o arquivo ${libraryFileKey}: Status ${error.response.status}`);
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

// Função para fazer a chamada de API ao endpoint Component Usages
async function fetchComponentUsages(libraryFileKey) {
    try {
        const response = await axios.get(`${FIGMA_ANALYTICS_URL}${libraryFileKey}/component/usages`, {
            headers: {
                'X-Figma-Token': FIGMA_TOKEN,
            },
            params: {
                group_by: 'component',
            },
        });

        // Exibir a resposta completa da API para diagnóstico
        if (DEBUG) {
            console.log('Resposta completa da API de Component Usages:', JSON.stringify(response.data, null, 2));
        }

        if (response.data && response.data.rows && Array.isArray(response.data.rows)) {
            return response.data.rows;
        } else {
            console.warn(`Resposta inesperada ao buscar usos dos componentes para o arquivo ${libraryFileKey}`);
            return [];
        }
    } catch (error) {
        if (error.response) {
            // A resposta foi recebida, mas o servidor respondeu com um status de erro
            console.error(`Erro ao buscar usos dos componentes para o arquivo ${libraryFileKey}: Status ${error.response.status}`);
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

    // Ordenação dos componentes
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
        console.log(`Relatório CSV gerado com sucesso: ${REPORTS_DIR}/${fileName}.csv`);
    } catch (error) {
        console.error(`Erro ao escrever o arquivo CSV ${fileName}:`, error.message);
    }
}

// Função para salvar um log em Markdown
async function saveLogMarkdown(fileName, totalComponents, totalVariants, executionTime, period, lastValidWeek) {
    const logFilePath = `${REPORTS_DIR}/${fileName}.md`;
    const logContent = `# Relatório de Geração de CSV

- **Total de Componentes**: ${totalComponents}
- **Total de Variantes**: ${totalVariants}
- **Data da Geração**: ${moment().format('YYYY-MM-DD HH:mm:ss')}
- **Período Selecionado**: ${period}
- **Última Semana Válida Fechada**: ${lastValidWeek}
- **Tempo Total de Execução**: ${executionTime} segundos
`;

    try {
        fs.writeFileSync(logFilePath, logContent);
        console.log(`Log de geração criado com sucesso: ${logFilePath}`);
    } catch (error) {
        console.error(`Erro ao escrever o arquivo de log ${logFilePath}:`, error.message);
    }
}

// Função principal para gerar o relatório de componentes
async function generateComponentReport(fileIds) {
    for (const fileId of fileIds) {
        const startTime = performance.now();
        console.log(`Processando o arquivo com ID: ${fileId}`);

        const components = await fetchComponents(fileId);
        const componentActions = await fetchComponentActions(fileId);
        const componentUsages = await fetchComponentUsages(fileId);

        if (!components || components.length === 0) {
            console.warn(`Nenhum componente encontrado no arquivo ${fileId}.`);
            continue;
        }

        const timestamp = moment().format('YYYY-MM-DD_HH_mm_ss');
        const fileName = `figma_lib_report_${fileId}_${timestamp}`;

        // Criar a estrutura para o CSV
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

        const endTime = performance.now();
        const executionTime = ((endTime - startTime) / 1000).toFixed(2);
        const lastValidWeek = endDate;

        // Extrair os dados para CSV
        await extractDataToCSV(componentsData, fileName);

        // Salvar o log em Markdown
        await saveLogMarkdown(fileName, components.length, INCLUDE_VARIANTS ? components.length : componentsData.length, executionTime, period, lastValidWeek);

        // Exibir informações de log no console
        console.log(`
Resumo da geração do relatório:
- Total de Componentes: ${components.length}
- Total de Variantes: ${INCLUDE_VARIANTS ? components.length : componentsData.length}
- Data da Geração: ${moment().format('YYYY-MM-DD HH:mm:ss')}
- Período Selecionado: ${period}
- Última Semana Válida Fechada: ${lastValidWeek}
- Tempo Total de Execução: ${executionTime} segundos
`);

        console.log(`Processamento do arquivo ${fileId} concluído com sucesso.`);
    }
}

// Executa a função principal
(async () => {
    if (fileIds.length === 0) {
        console.error('Erro: Nenhum ID de arquivo fornecido. Forneça pelo menos um ID de arquivo do Figma.');
        process.exit(1);
    }
    await generateComponentReport(fileIds);
})();