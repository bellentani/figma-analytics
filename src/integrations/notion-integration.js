const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const moment = require('moment');

async function createNotionDatabase(parentPageId, period = '30d', libraryName, reportDate) {
    try {
        console.log('Creating Notion database...');
        
        const now = reportDate ? new Date(reportDate) : new Date();
        const formattedDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} - ${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

        const databaseTitle = `Figma Component Report - ${libraryName} - ${formattedDateTime} - ${period}`;
        
        const response = await notion.databases.create({
            parent: {
                type: 'page_id',
                page_id: parentPageId
            },
            title: [
                {
                    type: 'text',
                    text: {
                        content: databaseTitle
                    }
                }
            ],
            properties: {
                "1. Component Name": {
                    title: {}
                },
                "2. Total Variants": {
                    number: {
                        format: "number"
                    }
                },
                "3. Usages": {
                    number: {
                        format: "number"
                    }
                },
                "4. Insertions": {
                    number: {
                        format: "number"
                    }
                },
                "5. Detachments": {
                    number: {
                        format: "number"
                    }
                },
                "6. Created At": {
                    date: {}
                },
                "7. Updated At": {
                    date: {}
                },
                "8. Type": {
                    select: {
                        options: [
                            { name: 'Single', color: 'blue' },
                            { name: 'Set', color: 'green' }
                        ]
                    }
                }
            }
        });

        console.log('Database created successfully:', databaseTitle);
        return response.id;
    } catch (error) {
        console.error('Error creating Notion database:', error.message);
        throw error;
    }
}

async function addComponentsToNotion(databaseId, components) {
    try {
        console.log('Adding components to Notion database...');
        
        // Ordenar componentes por nome e depois inverter a ordem
        const sortedComponents = [...components]
            .sort((a, b) => {
                const nameA = a.component_name.toLowerCase();
                const nameB = b.component_name.toLowerCase();
                return nameA.localeCompare(nameB);
            })
            .reverse(); // Inverte a ordem do array
        
        console.log('Total components to add:', sortedComponents.length);
        
        for (let i = 0; i < sortedComponents.length; i++) {
            const component = sortedComponents[i];
            // Ajustando o log para mostrar a ordem reversa
            console.log(`Adding component ${sortedComponents.length - i}/${sortedComponents.length}: ${component.component_name}`);
            
            try {
                const pageData = {
                    parent: { database_id: databaseId },
                    properties: {
                        "1. Component Name": {
                            title: [{ text: { content: component.component_name || 'Unnamed Component' } }]
                        },
                        "2. Total Variants": {
                            number: Number(component.total_variants) || 0
                        },
                        "3. Usages": {
                            number: Number(component.usages) || 0
                        },
                        "4. Insertions": {
                            number: Number(component.insertions) || 0
                        },
                        "5. Detachments": {
                            number: Number(component.detachments) || 0
                        },
                        "6. Created At": {
                            date: { 
                                start: moment(component.formatted_created).format('YYYY-MM-DD')
                            }
                        },
                        "7. Updated At": {
                            date: { 
                                start: moment(component.formatted_updated).format('YYYY-MM-DD')
                            }
                        },
                        "8. Type": {
                            select: { 
                                name: component.type || 'Unknown'
                            }
                        }
                    }
                };

                await notion.pages.create(pageData);
            } catch (error) {
                console.error(`Error adding component ${component.component_name}:`, error.message);
                console.error('Component data:', JSON.stringify(component, null, 2));
            }
        }

        console.log('All components added successfully to Notion');
    } catch (error) {
        console.error('Error adding components to Notion:', error.message);
        throw error;
    }
}

async function handleReportSummaryDatabase(notionPageId, summaryDatabaseId, reportSummary, libraryName, period, reportDate) {
    try {
        let databaseId = summaryDatabaseId;

        // Se não foi fornecido um database ID, criar novo
        if (!databaseId) {
            console.log('Creating new summary database...');
            databaseId = await createSummaryDatabase(notionPageId, libraryName, period, reportDate);
        }

        // Adicionar nova entrada ao database
        await addSummaryEntry(databaseId, reportSummary);

        return databaseId;
    } catch (error) {
        console.error('Error handling summary database:', error);
        throw error;
    }
}

async function createSummaryDatabase(parentPageId, libraryName, period = '30d', reportDate) {
    try {
        console.log('Creating summary database...');
        
        const now = reportDate ? new Date(reportDate) : new Date();
        const formattedDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} - ${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

        // Usar o mesmo padrão do report principal
        const databaseTitle = `Figma Component Report - ${libraryName} - ${formattedDateTime} - ${period} - Summary`;
        
        const response = await notion.databases.create({
            parent: {
                type: 'page_id',
                page_id: parentPageId
            },
            title: [
                {
                    type: 'text',
                    text: {
                        content: databaseTitle
                    }
                }
            ],
            properties: {
                "01. Library Name": {
                    title: {}
                },
                "02. Total Components": {
                    number: {
                        format: "number"
                    }
                },
                "03. Total Variants": {
                    number: {
                        format: "number"
                    }
                },
                "04. Total Usages": {
                    number: {
                        format: "number"
                    }
                },
                "05. Total Insertions": {
                    number: {
                        format: "number"
                    }
                },
                "06. Total Detachments": {
                    number: {
                        format: "number"
                    }
                },
                "07. Generation Date": {
                    date: {}
                },
                "08. Period Start": {
                    date: {}
                },
                "09. Period End": {
                    date: {}
                },
                "10. Last Valid Week": {
                    date: {}
                },
                "11. Execution Time": {
                    rich_text: {}
                }
            }
        });

        console.log('Summary database created:', databaseTitle);
        return response.id;
    } catch (error) {
        console.error('Error creating summary database:', error);
        throw error;
    }
}

async function addSummaryEntry(databaseId, summary) {
    try {
        // Extrair datas do período
        const [startDate, endDate] = summary.selectedPeriod
            .split(' to ')
            .map(date => date.trim());

        // Criar o objeto de entrada antes do try/catch
        const entryData = {
            parent: { database_id: databaseId },
            properties: {
                "01. Library Name": {
                    title: [{ 
                        text: { 
                            content: summary.libraryName || 'Unnamed Library'
                        } 
                    }]
                },
                "02. Total Components": {
                    number: Number(summary.totalComponents) || 0
                },
                "03. Total Variants": {
                    number: Number(summary.totalVariants) || 0
                },
                "04. Total Usages": {
                    number: Number(summary.totalUsages) || 0
                },
                "05. Total Insertions": {
                    number: Number(summary.totalInsertions) || 0
                },
                "06. Total Detachments": {
                    number: Number(summary.totalDetachments) || 0
                },
                "07. Generation Date": {
                    date: { 
                        start: moment(summary.generationDate).format('YYYY-MM-DD')
                    }
                },
                "08. Period Start": {
                    date: { 
                        start: moment(startDate).format('YYYY-MM-DD')
                    }
                },
                "09. Period End": {
                    date: { 
                        start: moment(endDate).format('YYYY-MM-DD')
                    }
                },
                "10. Last Valid Week": {
                    date: { 
                        start: moment(summary.lastClosedValidWeek).format('YYYY-MM-DD')
                    }
                },
                "11. Execution Time": {
                    rich_text: [{ 
                        text: { 
                            content: summary.executionTime || '00:00:00'
                        } 
                    }]
                }
            }
        };

        // Criar a entrada no Notion
        await notion.pages.create(entryData);
        console.log('Summary entry added successfully');
    } catch (error) {
        console.error('Error adding summary entry:', error.message);
        if (error.message.includes('validation_error')) {
            console.error('Entry data that failed:', JSON.stringify(entryData, null, 2));
        }
        throw error;
    }
}

module.exports = {
    createNotionDatabase,
    addComponentsToNotion,
    handleReportSummaryDatabase
}; 