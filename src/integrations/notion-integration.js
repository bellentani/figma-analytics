const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function createNotionDatabase(parentPageId, period = '30d', libraryName, reportDate) {
    try {
        console.log('Creating Notion database...');
        
        // Format the date
        const formattedDate = reportDate 
            ? new Date(reportDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

        // Create database title
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
                    title: {},
                    name: 'Component Name'
                },
                'Total Variants': {
                    number: {},
                    name: 'Total Variants'
                },
                'Usages': {
                    number: {},
                    name: 'Usages'
                },
                'Insertions': {
                    number: {},
                    name: `Insertions (${period})`
                },
                'Detachments': {
                    number: {},
                    name: `Detachments (${period})`
                },
                'Type': {
                    select: {
                        options: [
                            { name: 'Single', color: 'blue' },
                            { name: 'Set', color: 'green' }
                        ]
                    },
                    name: 'Type'
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
        console.log('Total components to add:', components.length);

        const batchSize = 10;
        for (let i = 0; i < components.length; i += batchSize) {
            const batch = components.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(components.length/batchSize)}`);

            await Promise.all(batch.map(async (component) => {
                try {
                    await notion.pages.create({
                        parent: { database_id: databaseId },
                        properties: {
                            'Component Name': {
                                title: [{ text: { content: component.component_name } }]
                            },
                            'Total Variants': {
                                number: component.total_variants === 'N/A' ? 0 : component.total_variants
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
                            'Type': {
                                select: { name: component.type }
                            }
                        }
                    });
                } catch (error) {
                    console.error(`Error adding component ${component.component_name}:`, error.message);
                }
            }));

            if (i + batchSize < components.length) {
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