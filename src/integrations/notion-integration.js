const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

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
        
        const formatDate = (dateString) => {
            if (!dateString) return null;
            const [year, month, day, hour, minute] = dateString.split(/[-:]/).map(Number);
            return new Date(year, month - 1, day, hour, minute).toISOString();
        };

        const sortedComponents = [...components].sort((a, b) => 
            b.component_name.localeCompare(a.component_name)
        );
        
        console.log('Total components to add:', sortedComponents.length);

        for (let i = 0; i < sortedComponents.length; i++) {
            const component = sortedComponents[i];
            console.log(`Adding component ${i + 1}/${sortedComponents.length}: ${component.component_name}`);

            try {
                await notion.pages.create({
                    parent: { database_id: databaseId },
                    properties: {
                        "1. Component Name": {
                            title: [{ text: { content: component.component_name } }]
                        },
                        "2. Total Variants": {
                            number: component.total_variants || 0
                        },
                        "3. Usages": {
                            number: component.usages || 0
                        },
                        "4. Insertions": {
                            number: component.insertions || 0
                        },
                        "5. Detachments": {
                            number: component.detachments || 0
                        },
                        "6. Created At": {
                            date: { 
                                start: formatDate(component.created_at)
                            }
                        },
                        "7. Updated At": {
                            date: { 
                                start: formatDate(component.updated_at)
                            }
                        },
                        "8. Type": {
                            select: { name: component.type }
                        }
                    }
                });

                await new Promise(resolve => setTimeout(resolve, 250));
                
            } catch (error) {
                console.error(`Error adding component ${component.component_name}:`, error.message);
                console.error('Component data:', {
                    name: component.component_name,
                    created: component.created_at,
                    updated: component.updated_at,
                    formatted_created: formatDate(component.created_at),
                    formatted_updated: formatDate(component.updated_at)
                });
            }
        }

        console.log('All components added successfully to Notion');
        
        // Note: Column renaming was removed due to Notion API limitations
        // The columns will maintain their numeric prefixes to ensure correct ordering
        
    } catch (error) {
        console.error('Error adding components to Notion:', error.message);
        throw error;
    }
}

module.exports = {
    createNotionDatabase,
    addComponentsToNotion
}; 