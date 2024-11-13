const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function createNotionDatabase(parentPageId, period = '30d', libraryName, reportDate) {
    try {
        console.log('Creating Notion database...');
        
        // Format the date and time
        const now = reportDate ? new Date(reportDate) : new Date();
        const formattedDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} - ${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

        const databaseTitle = `Figma Component Report - ${libraryName} - ${formattedDateTime} - ${period}`;
        
        console.log('Creating database with title:', databaseTitle);

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
                'Component Name': {
                    title: {}
                },
                'Total Variants': {
                    number: {
                        format: 'number'
                    }
                },
                'Usages': {
                    number: {}
                },
                'Insertions': {
                    number: {
                        format: 'number'
                    }
                },
                'Detachments': {
                    number: {
                        format: 'number'
                    }
                },
                'Created At': {
                    date: {}
                },
                'Updated At': {
                    date: {}
                },
                'Type': {
                    select: {
                        options: [
                            { name: 'Single', color: 'blue' },
                            { name: 'Set', color: 'green' }
                        ]
                    }
                }
            }
        });

        await notion.databases.update({
            database_id: response.id,
            sorts: [
                {
                    property: 'Component Name',
                    direction: 'ascending'
                }
            ]
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
        
        // Format date to ISO 8601
        const formatDate = (dateString) => {
            if (!dateString) return null;
            const [year, month, day, hour, minute] = dateString.split(/[-:]/).map(Number);
            return new Date(year, month - 1, day, hour, minute).toISOString();
        };

        // Sort components in reverse alphabetical order (Z->A)
        const sortedComponents = [...components].sort((a, b) => 
            b.component_name.localeCompare(a.component_name)
        );
        
        console.log('Total components to add:', sortedComponents.length);
        console.log('First component to be added:', sortedComponents[0].component_name);
        console.log('Last component to be added:', sortedComponents[sortedComponents.length - 1].component_name);

        // Process one component at a time in reverse order
        for (let i = 0; i < sortedComponents.length; i++) {
            const component = sortedComponents[i];
            console.log(`Adding component ${i + 1}/${sortedComponents.length}: ${component.component_name}`);

            try {
                await notion.pages.create({
                    parent: { database_id: databaseId },
                    properties: {
                        'Component Name': {
                            title: [{ text: { content: component.component_name } }]
                        },
                        'Total Variants': {
                            number: component.total_variants || 0
                        },
                        'Usages': {
                            number: component.usages || 0
                        },
                        'Insertions': {
                            number: component.insertions || 0
                        },
                        'Detachments': {
                            number: component.detachments || 0
                        },
                        'Created At': {
                            date: { 
                                start: formatDate(component.created_at)
                            }
                        },
                        'Updated At': {
                            date: { 
                                start: formatDate(component.updated_at)
                            }
                        },
                        'Type': {
                            select: { name: component.type }
                        }
                    }
                });

                // Add a small delay between requests to avoid rate limits
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
    } catch (error) {
        console.error('Error adding components to Notion:', error.message);
        throw error;
    }
}

module.exports = {
    createNotionDatabase,
    addComponentsToNotion
}; 