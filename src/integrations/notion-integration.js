const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function createNotionDatabase(parentPageId) {
    try {
        console.log('Creating Notion database...');
        
        const response = await notion.databases.create({
            parent: {
                type: 'page_id',
                page_id: parentPageId
            },
            title: [
                {
                    type: 'text',
                    text: {
                        content: 'Figma Components Analytics'
                    }
                }
            ],
            properties: {
                'Component Name': {
                    title: {}
                },
                'Total Variants': {
                    rich_text: {}
                },
                'Usages': {
                    number: {}
                },
                'Insertions': {
                    number: {}
                },
                'Detachments': {
                    number: {}
                },
                'Updated At': {
                    rich_text: {}
                },
                'Created At': {
                    rich_text: {}
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

        console.log('Database created successfully');
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

        // Process components in batches to avoid rate limits
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
                                rich_text: [{ text: { content: String(component.total_variants) } }]
                            },
                            'Usages': {
                                number: component.usages
                            },
                            'Insertions': {
                                number: component.insertions
                            },
                            'Detachments': {
                                number: component.detachments
                            },
                            'Updated At': {
                                rich_text: [{ text: { content: component.updated_at } }]
                            },
                            'Created At': {
                                rich_text: [{ text: { content: component.created_at } }]
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

            // Add delay between batches to respect rate limits
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