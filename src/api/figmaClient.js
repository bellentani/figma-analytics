const axios = require('axios');
require('dotenv').config();

const FIGMA_API_URL = 'https://api.figma.com/v1/files/';
const FIGMA_ANALYTICS_URL = 'https://api.figma.com/v1/analytics/libraries/';
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;

class FigmaClient {
    constructor() {
        this.validateToken();
    }

    validateToken() {
        if (!FIGMA_TOKEN) {
            throw new Error('FIGMA_TOKEN not found. Please check your .env file.');
        }
    }

    async fetchFileMetadata(fileId) {
        const response = await axios.get(`${FIGMA_API_URL}${fileId}`, {
            headers: { 'X-Figma-Token': FIGMA_TOKEN }
        });
        return response.data.name;
    }

    async fetchComponents(fileId) {
        const response = await axios.get(`${FIGMA_API_URL}${fileId}/components`, {
            headers: { 'X-Figma-Token': FIGMA_TOKEN }
        });
        return response.data.meta.components;
    }

    async fetchComponentActions(fileId, startDate, endDate) {
        const response = await axios.get(
            `${FIGMA_ANALYTICS_URL}${fileId}/component/actions`,
            {
                headers: { 'X-Figma-Token': FIGMA_TOKEN },
                params: {
                    group_by: 'component',
                    start_date: startDate,
                    end_date: endDate
                }
            }
        );
        return response.data.rows || [];
    }

    async fetchComponentUsages(fileId) {
        const response = await axios.get(
            `${FIGMA_ANALYTICS_URL}${fileId}/component/usages`,
            {
                headers: { 'X-Figma-Token': FIGMA_TOKEN },
                params: { group_by: 'component' }
            }
        );
        return response.data.rows || [];
    }
}

module.exports = new FigmaClient(); 