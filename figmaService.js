const axios = require('axios');
const { FIGMA_API_URL, FIGMA_ANALYTICS_URL, FIGMA_TOKEN } = require('./config');

async function fetchFigmaFile(fileId) {
    const response = await axios.get(`${FIGMA_API_URL}${fileId}`, {
        headers: {
            'X-Figma-Token': FIGMA_TOKEN
        }
    });
    return response.data;
}

async function fetchFigmaAnalytics(libraryId) {
    const response = await axios.get(`${FIGMA_ANALYTICS_URL}${libraryId}`, {
        headers: {
            'X-Figma-Token': FIGMA_TOKEN
        }
    });
    return response.data;
}

module.exports = {
    fetchFigmaFile,
    fetchFigmaAnalytics
};