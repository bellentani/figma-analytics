const figmaClient = require('../api/figmaClient');
const csvGenerator = require('../generators/csvGenerator');
const markdownGenerator = require('../generators/markdownGenerator');
const { formatDate } = require('../utils/dateHelper');
const Logger = require('../cli/logger');

class ReportService {
    constructor(debug = false) {
        this.logger = new Logger(debug);
    }

    normalizeString(string) {
        return string
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/gi, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .toLowerCase();
    }

    processComponents(components, actionsData, usages) {
        const processedComponents = components.reduce((acc, component) => {
            const setName = component.containing_frame?.name || component.name;
            const componentName = component.name;
            
            if (!acc[setName]) {
                acc[setName] = {
                    component_name: setName,
                    total_variants: 0,
                    usages: 0,
                    insertions: 0,
                    detachments: 0,
                    updated_at: formatDate(component.updated_at),
                    created_at: formatDate(component.created_at),
                    type: 'Single'
                };
            }

            acc[setName].total_variants++;
            if (acc[setName].total_variants > 1) {
                acc[setName].type = 'Set';
            }

            acc[setName].usages += Number(usages[component.key]?.usages || 0);

            const actionKey = acc[setName].type === 'Set' ? setName : componentName;
            if (actionsData[actionKey]) {
                acc[setName].insertions = Number(actionsData[actionKey].insertions || 0);
                acc[setName].detachments = Number(actionsData[actionKey].detachments || 0);
            }

            return acc;
        }, {});

        return Object.values(processedComponents)
            .sort((a, b) => a.component_name.toLowerCase().localeCompare(b.component_name.toLowerCase()));
    }

    async generateReport(fileId, startDate, endDate, period) {
        try {
            const libraryName = await figmaClient.fetchFileMetadata(fileId);
            const components = await figmaClient.fetchComponents(fileId);
            const actionsData = await figmaClient.fetchComponentActions(fileId, startDate, endDate);
            const usages = await figmaClient.fetchComponentUsages(fileId);

            const reportData = this.processComponents(components, actionsData, usages);
            
            const timestamp = formatDate(new Date());
            const normalizedLibraryName = this.normalizeString(libraryName);
            const fileName = `report_${normalizedLibraryName}_${period}_${timestamp}`;

            await csvGenerator.generateReport(reportData, fileName);
            await markdownGenerator.generateReport(fileName, {
                libraryName,
                totalComponents: reportData.length,
                totalVariants: reportData.reduce((acc, curr) => acc + (curr.total_variants === 1 ? 0 : curr.total_variants), 0),
                executionTime: process.hrtime()[0],
                period: `${startDate} to ${endDate}`,
                lastValidWeek: formatDate(new Date())
            });

            return fileName;
        } catch (error) {
            this.logger.error('Error generating report:', error);
            throw error;
        }
    }
}

module.exports = ReportService; 