const axios = require('axios');
const https = require('https');

const FIGMA_API_URL = 'https://api.figma.com/v1';
const DEBUG = process.argv.includes('debug') || process.argv.includes('--debug');

// Criar instância do Axios com configuração base
const figmaApi = axios.create({
    baseURL: FIGMA_API_URL,
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
    timeout: 30000,
    headers: {
        'X-Figma-Token': process.env.FIGMA_TOKEN
    }
});

async function fetchFileMetadata(fileId) {
    try {
        if (DEBUG) {
            console.log('Fetching file metadata for:', fileId);
        }

        const response = await figmaApi.get(`/files/${fileId}`);
        
        if (DEBUG) {
            console.log('File metadata response:', response.data);
        }
        
        return response.data;
    } catch (error) {
        console.error('Error fetching file metadata:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            url: `/files/${fileId}`
        });
        throw error;
    }
}

async function fetchComponents(fileId) {
    try {
        if (DEBUG) {
            console.log('Fetching components for:', fileId);
        }

        const response = await figmaApi.get(`/files/${fileId}/components`);
        
        if (DEBUG) {
            console.log('Components response:', response.data);
        }
        
        return response.data?.meta?.components || [];
    } catch (error) {
        console.error('Error fetching components:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            url: `/files/${fileId}/components`
        });
        throw error;
    }
}

async function fetchComponentActions(fileId, startDate, endDate) {
    try {
        if (DEBUG) {
            console.log('Fetching component actions:', { fileId, startDate, endDate });
        }

        const response = await figmaApi.get(`/analytics/files/${fileId}/component/actions`, {
            params: {
                group_by: 'component',
                start_date: startDate,
                end_date: endDate
            }
        });
        
        if (DEBUG) {
            console.log('Component actions response:', response.data);
        }
        
        const actionsData = {};
        if (response.data && Array.isArray(response.data)) {
            response.data.forEach(action => {
                if (!actionsData[action.component_name]) {
                    actionsData[action.component_name] = {
                        insertions: 0,
                        detachments: 0
                    };
                }
                
                if (action.action_type === 'INSERT') {
                    actionsData[action.component_name].insertions += action.count || 0;
                } else if (action.action_type === 'DETACH') {
                    actionsData[action.component_name].detachments += action.count || 0;
                }
            });
        }
        
        return actionsData;
    } catch (error) {
        console.error('Error fetching component actions:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            url: `/analytics/files/${fileId}/component/actions`
        });
        return {};
    }
}

async function fetchComponentUsages(fileId) {
    try {
        if (DEBUG) {
            console.log('Fetching component usages for:', fileId);
        }

        const response = await figmaApi.get(`/files/${fileId}/component_usage`);
        
        if (DEBUG) {
            console.log('Component usages response:', response.data);
        }
        
        return response.data || {};
    } catch (error) {
        console.error('Error fetching component usages:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            url: `/files/${fileId}/component_usage`
        });
        return {};
    }
}

module.exports = {
    fetchFileMetadata,
    fetchComponents,
    fetchComponentActions,
    fetchComponentUsages
}; 