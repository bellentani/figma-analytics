const axios = require('axios');
const { FIGMA_API_URL, FIGMA_ANALYTICS_URL, FIGMA_TOKEN } = require('./config');

async function fetchFigmaFile(fileId) {
  try {
    console.log('fileId:', fileId);
      const response = await axios.get(`${FIGMA_API_URL}${fileId}`, {
          headers: {
              'X-Figma-Token': FIGMA_TOKEN
          }
      });
      return response.data;
  } catch (error) {
      console.error(`Error fetching Figma file ${fileId}:`, error.message);
      if (error.response) {
          console.error('Status:', error.response.status);
          console.error('Data:', error.response.data);
      }
      throw error;
  }
}

async function fetchFigmaAnalytics(libraryId) {
    const response = await axios.get(`${FIGMA_ANALYTICS_URL}${libraryId}/components`, {
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