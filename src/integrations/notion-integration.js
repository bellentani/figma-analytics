const { Client } = require('@notionhq/client');
const https = require('https');
const moment = require('moment');

// Criar cliente Notion com configuração SSL personalizada
const notion = new Client({ 
    auth: process.env.NOTION_TOKEN,
    agent: new https.Agent({
        rejectUnauthorized: false
    })
});

// Função auxiliar para debug
const DEBUG = process.argv.includes('--debug');

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

// Função para validar dados do componente
function validateComponentData(component) {
    if (DEBUG) {
        console.log('Validating component data:', component);
    }

    return {
        component_name: component.component_name || 'Unnamed Component',
        total_variants: typeof component.total_variants === 'number' ? component.total_variants : 0,
        usages: typeof component.usages === 'number' ? component.usages : 0,
        insertions: typeof component.insertions === 'number' ? component.insertions : 0,
        detachments: typeof component.detachments === 'number' ? component.detachments : 0,
        created_at: component.created_at || new Date().toISOString(),
        updated_at: component.updated_at || new Date().toISOString(),
        type: component.type || 'Unknown'
    };
}

async function addComponentsToNotion(databaseId, components) {
    try {
        console.log('Adding components to Notion database...');
        console.log('Total components to add:', components.length);
        
        for (let i = 0; i < components.length; i++) {
            const component = components[i];
            const validatedData = validateComponentData(component);
            
            if (DEBUG) {
                console.log(`Adding component ${i + 1}/${components.length}:`, validatedData);
            }
            
            try {
                const pageData = {
                    parent: { database_id: databaseId },
                    properties: {
                        "1. Component Name": {
                            title: [{ text: { content: validatedData.component_name } }]
                        },
                        "2. Total Variants": {
                            number: validatedData.total_variants
                        },
                        "3. Usages": {
                            number: validatedData.usages
                        },
                        "4. Insertions": {
                            number: validatedData.insertions
                        },
                        "5. Detachments": {
                            number: validatedData.detachments
                        },
                        "6. Created At": {
                            date: { 
                                start: moment(validatedData.created_at).format('YYYY-MM-DD')
                            }
                        },
                        "7. Updated At": {
                            date: { 
                                start: moment(validatedData.updated_at).format('YYYY-MM-DD')
                            }
                        },
                        "8. Type": {
                            select: {
                                name: validatedData.type
                            }
                        }
                    }
                };

                await notion.pages.create(pageData);
                
                if (DEBUG) {
                    console.log(`✓ Component added successfully: ${validatedData.component_name}`);
                }
            } catch (error) {
                console.error(`Error adding component ${validatedData.component_name}:`, error.message);
                if (DEBUG) {
                    console.error('Full error:', error);
                    console.error('Component data:', validatedData);
                }
            }
        }

        console.log('All components added successfully to Notion');
    } catch (error) {
        console.error('Error adding components to Notion:', error.message);
        if (DEBUG) {
            console.error('Full error:', error);
        }
        throw error;
    }
}

async function handleReportSummaryDatabase(notionPageId, summaryDatabaseId, reportSummary, libraryName, period, reportDate) {
    try {
        let databaseId = summaryDatabaseId;

        if (!databaseId) {
            console.log('Creating new summary database...');
            databaseId = await createSummaryDatabase(notionPageId, libraryName, period, reportDate);
        }

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
                "02. Lib Tag Name": {
                    select: {
                        options: []
                    }
                },
                "03. Total Components": {
                    number: {
                        format: "number"
                    }
                },
                "04. Total Variants": {
                    number: {
                        format: "number"
                    }
                },
                "05. Total Usages": {
                    number: {
                        format: "number"
                    }
                },
                "06. Total Insertions": {
                    number: {
                        format: "number"
                    }
                },
                "07. Total Detachments": {
                    number: {
                        format: "number"
                    }
                },
                "08. Generation Date": {
                    date: {}
                },
                "09. Period Start": {
                    date: {}
                },
                "10. Period End": {
                    date: {}
                },
                "11. Last Valid Week": {
                    date: {}
                },
                "12. Execution Time": {
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
        const [startDate, endDate] = summary.selectedPeriod
            .split(' to ')
            .map(date => date.trim());

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
                "02. Lib Tag Name": {
                    select: {
                        name: summary.libraryName || 'Unnamed Library'
                    }
                },
                "03. Total Components": {
                    number: Number(summary.totalComponents) || 0
                },
                "04. Total Variants": {
                    number: Number(summary.totalVariants) || 0
                },
                "05. Total Usages": {
                    number: Number(summary.totalUsages) || 0
                },
                "06. Total Insertions": {
                    number: Number(summary.totalInsertions) || 0
                },
                "07. Total Detachments": {
                    number: Number(summary.totalDetachments) || 0
                },
                "08. Generation Date": {
                    date: { 
                        start: moment(summary.generationDate).format('YYYY-MM-DD')
                    }
                },
                "09. Period Start": {
                    date: { 
                        start: moment(startDate).format('YYYY-MM-DD')
                    }
                },
                "10. Period End": {
                    date: { 
                        start: moment(endDate).format('YYYY-MM-DD')
                    }
                },
                "11. Last Valid Week": {
                    date: { 
                        start: moment(summary.lastClosedValidWeek).format('YYYY-MM-DD')
                    }
                },
                "12. Execution Time": {
                    rich_text: [{ 
                        text: { 
                            content: summary.executionTime || '00:00:00'
                        } 
                    }]
                }
            }
        };

        await notion.pages.create(entryData);
        console.log('Summary entry added successfully');
    } catch (error) {
        console.error('Error adding summary entry:', error.message);
        throw error;
    }
}

module.exports = {
    createNotionDatabase,
    addComponentsToNotion,
    handleReportSummaryDatabase
}; 