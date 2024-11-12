const yargs = require('yargs');

function parseArguments() {
    return yargs
        .option('files', {
            alias: 'f',
            description: 'Comma-separated Figma file keys',
            type: 'string',
            demandOption: true
        })
        .option('period', {
            alias: 'p',
            description: 'Analysis period (30d, 60d, 90d, 1y)',
            type: 'string',
            default: '30d'
        })
        .option('debug', {
            description: 'Enable debug mode',
            type: 'boolean',
            default: false
        })
        .help()
        .argv;
}

module.exports = { parseArguments }; 