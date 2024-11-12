const fs = require('fs');
const moment = require('moment');

class MarkdownGenerator {
    constructor(reportsDir = './reports') {
        this.reportsDir = reportsDir;
    }

    async generateReport(fileName, {
        libraryName,
        totalComponents,
        totalVariants,
        executionTime,
        period,
        lastValidWeek
    }) {
        const logContent = `# CSV Generation Report

- **Library Name**: ${libraryName}
- **Total Components**: ${totalComponents}
- **Total Variants**: ${totalVariants}
- **Generation Date**: ${moment().format('YYYY-MM-DD HH:mm:ss')}
- **Selected Period**: ${period}
- **Last Closed Valid Week**: ${lastValidWeek}
- **Total Execution Time**: ${executionTime} seconds
`;

        try {
            fs.writeFileSync(`${this.reportsDir}/${fileName}.md`, logContent);
            return `${this.reportsDir}/${fileName}.md`;
        } catch (error) {
            throw new Error(`Error generating Markdown: ${error.message}`);
        }
    }
}

module.exports = new MarkdownGenerator(); 