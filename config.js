const dotenv = require('dotenv');
dotenv.config();

const FIGMA_API_URL = 'https://api.figma.com/v1/files/';
const FIGMA_ANALYTICS_URL = 'https://api.figma.com/v1/analytics/libraries/';
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;

if (!FIGMA_TOKEN) {
    console.error('Error: FIGMA_TOKEN not found. Check the .env file and the value of the environment variable.');
    process.exit(1);
}

module.exports = {
    FIGMA_API_URL,
    FIGMA_ANALYTICS_URL,
    FIGMA_TOKEN
};