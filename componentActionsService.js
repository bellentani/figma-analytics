const axios = require('axios');
const { FIGMA_ANALYTICS_URL, FIGMA_TOKEN } = require('./config');

async function fetchComponentActionsFromAPI(fileId, startDate, endDate) {
    const response = await axios.get(
        `${FIGMA_ANALYTICS_URL}${fileId}/component/actions`,
        {
            headers: {
                'X-Figma-Token': FIGMA_TOKEN
            },
            params: {
                group_by: 'component',
                start_date: startDate,
                end_date: endDate
            }
        }
    );
    return response.data;
}

function logResponseStructure(response, startDate, endDate) {
    console.log('Response structure:', {
        cursor: response?.cursor,
        next_page: response?.next_page,
        total_rows: response?.rows?.length,
        period: `${startDate} to ${endDate}`
    });
}

function groupActionsByKey(rows) {
    return rows.reduce((acc, row) => {
        const key = row.component_key;
        
        if (!acc[key]) {
            acc[key] = {
                insertions: 0,
                detachments: 0
            };
        }

        acc[key].insertions += Number(row.insertions || 0);
        acc[key].detachments += Number(row.detachments || 0);

        return acc;
    }, {});
}

async function fetchComponentActions(fileId, startDate, endDate) {
    try {
        console.log('\n=== COMPONENT ACTIONS DATA ===');
        console.log('Fetching actions for period:', { startDate, endDate });
        
        const response = await fetchComponentActionsFromAPI(fileId, startDate, endDate);
        logResponseStructure(response, startDate, endDate);

        const actionsByKey = groupActionsByKey(response?.rows || []);

        console.log('\nFirst 3 processed actions:', Object.entries(actionsByKey).slice(0, 3).map(([key, data]) => ({
            key,
            insertions: data.insertions,
            detachments: data.detachments
        })));

        return actionsByKey;
    } catch (error) {
        console.error('Error fetching component actions:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
        }
        throw error;
    }
}

module.exports = {
    fetchComponentActions
};