const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const moment = require('moment');

let consolidatedDatabaseId = null;

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
        
        const sortedComponents = [...components]
            .sort((a, b) => {
                const nameA = a.component_name.toLowerCase();
                const nameB = b.component_name.toLowerCase();
                return nameA.localeCompare(nameB);
            })
            .reverse();
        
        console.log('Total components to add:', sortedComponents.length);
        
        // Função auxiliar para converter data para ISO 8601
        const formatToISO = (dateString) => {
            if (!dateString) return moment().format('YYYY-MM-DD');
            
            // Se a data estiver no formato YYYY-MM-DD-HH-mm
            const parts = dateString.split('-');
            if (parts.length === 5) {
                return `${parts[0]}-${parts[1]}-${parts[2]}`;
            }
            
            // Se já for uma data ISO válida, retorna como está
            if (moment(dateString, moment.ISO_8601, true).isValid()) {
                return dateString;
            }
            
            // Fallback para data atual
            return moment().format('YYYY-MM-DD');
        };
        
        for (let i = 0; i < sortedComponents.length; i++) {
            const component = sortedComponents[i];
            console.log(`Adding component ${i + 1}/${sortedComponents.length}: ${component.component_name}`);
            
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
                                start: formatToISO(component.created_at)
                            }
                        },
                        "7. Updated At": {
                            date: { 
                                start: formatToISO(component.updated_at)
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
                console.error('Component data:', {
                    component_name: component.component_name,
                    created_at: component.created_at,
                    updated_at: component.updated_at
                });
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

async function createConsolidatedNotionDatabase(parentPageId, period, reportDate) {
    try {
        console.log('Creating consolidated Notion database...');
        
        const timestamp = moment().format('YYYY-MM-DD-HH-mm-ss');
        const databaseTitle = `Report Consolidated - All - ${period} - ${timestamp}`;
        
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
                "01. Component Name": {
                    title: {}
                },
                "02. Total Variants": {
                    number: {
                        format: "number"
                    }
                },
                "03. Usages": {
                    number: {
                        format: "number"
                    }
                },
                "04. Insertions": {
                    number: {
                        format: "number"
                    }
                },
                "05. Detachments": {
                    number: {
                        format: "number"
                    }
                },
                "06. Created At": {
                    date: {}
                },
                "07. Updated At": {
                    date: {}
                },
                "08. Type": {
                    select: {
                        options: [
                            { name: 'Single', color: 'blue' },
                            { name: 'Set', color: 'green' }
                        ]
                    }
                },
                "09. Report Creation Date": {
                    date: {}
                },
                "10. Lib File": {
                    multi_select: {}
                }
            }
        });

        consolidatedDatabaseId = response.id;
        console.log('Consolidated database created successfully:', databaseTitle);
        return response.id;
    } catch (error) {
        console.error('Error creating consolidated Notion database:', error);
        throw error;
    }
}

async function addComponentToConsolidatedNotion(component) {
    if (!consolidatedDatabaseId) {
        console.error('Consolidated database ID not found');
        return;
    }

    try {
        console.log(`Adding component to consolidated database: ${component.component_name}`);
        
        // Helper function to ensure valid ISO date
        const formatToValidISO = (dateString) => {
            if (!dateString) {
                return moment().format('YYYY-MM-DD');
            }
            
            // Handle YYYY-MM-DD-HH-MM format
            const matches = dateString.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/);
            if (matches) {
                const [_, year, month, day, hour, minute] = matches;
                return `${year}-${month}-${day}`;
            }
            
            // Try parsing as regular date
            const date = moment(dateString);
            if (!date.isValid()) {
                console.warn(`Invalid date found for component ${component.component_name}:`, dateString);
                return moment().format('YYYY-MM-DD');
            }
            
            return date.format('YYYY-MM-DD');
        };

        const pageData = {
            parent: { database_id: consolidatedDatabaseId },
            properties: {
                "01. Component Name": {
                    title: [{ text: { content: component.component_name || 'Unnamed Component' } }]
                },
                "02. Total Variants": {
                    number: component.total_variants === 'N/A' ? 0 : Number(component.total_variants) || 0
                },
                "03. Usages": {
                    number: Number(component.usages) || 0
                },
                "04. Insertions": {
                    number: Number(component.insertions) || 0
                },
                "05. Detachments": {
                    number: Number(component.detachments) || 0
                },
                "06. Created At": {
                    date: { 
                        start: formatToValidISO(component.created_at)
                    }
                },
                "07. Updated At": {
                    date: { 
                        start: formatToValidISO(component.updated_at)
                    }
                },
                "08. Type": {
                    select: {
                        name: component.type || 'Unknown'
                    }
                },
                "09. Report Creation Date": {
                    date: { 
                        start: moment().format('YYYY-MM-DD')
                    }
                },
                "10. Lib File": {
                    multi_select: [
                        { name: component.lib_file || 'Unknown Library' }
                    ]
                }
            }
        };

        await notion.pages.create(pageData);
        console.log(`✓ Component ${component.component_name} added to consolidated database`);
    } catch (error) {
        console.error(`Error adding component ${component.component_name} to consolidated database:`, error.message);
        if (error.message.includes('date')) {
            console.error('Date values:', {
                created_at: component.created_at,
                updated_at: component.updated_at,
                formatted_created: formatToValidISO(component.created_at),
                formatted_updated: formatToValidISO(component.updated_at)
            });
        }
    }
}

async function finalizeConsolidatedDatabase() {
    if (!consolidatedDatabaseId) {
        console.error('No consolidated database to finalize');
        return;
    }

    try {
        const timestamp = moment().format('YYYY-MM-DD-HH-mm-ss');
        const newTitle = `Report Consolidated - All - ${period} - ${timestamp} - Done`;

        await notion.databases.update({
            database_id: consolidatedDatabaseId,
            title: [
                {
                    type: 'text',
                    text: {
                        content: newTitle
                    }
                }
            ]
        });

        console.log('Consolidated database finalized successfully');
    } catch (error) {
        console.error('Error finalizing consolidated database:', error);
    }
}

module.exports = {
    createNotionDatabase,
    addComponentsToNotion,
    handleReportSummaryDatabase,
    createConsolidatedNotionDatabase,
    addComponentToConsolidatedNotion,
    finalizeConsolidatedDatabase
}; 