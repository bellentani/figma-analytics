const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function createNotionDatabase(parentPageId, period = '30d', libraryName, reportDate) {
    try {
        console.log('Creating Notion database...');
        
        const formattedDate = reportDate 
            ? new Date(reportDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

        const databaseTitle = `Figma Component Report - ${libraryName} - ${formattedDate} - ${period}`;
        
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
        
        const formatDate = (dateString) => {
            if (!dateString) return null;
            const [year, month, day, hour, minute] = dateString.split(/[-:]/).map(Number);
            return new Date(year, month - 1, day, hour, minute).toISOString();
        };

        const sortedComponents = [...components].sort((a, b) => 
            a.component_name.localeCompare(b.component_name)
        );
        
        console.log('Total components to add:', sortedComponents.length);

        const batchSize = 10;
        for (let i = 0; i < sortedComponents.length; i += batchSize) {
            const batch = sortedComponents.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(sortedComponents.length/batchSize)}`);

            await Promise.all(batch.map(async (component) => {
                try {
                    await notion.pages.create({
                        parent: { database_id: databaseId },
                        properties: {
                            'Component Name': {
                                title: [{ text: { content: component.component_name } }]
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
            }));

            if (i + batchSize < sortedComponents.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
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