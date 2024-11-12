#!/usr/bin/env node

const { spawn } = require('child_process');

// Function to parse arguments
function parseArgs(args) {
    const params = {};
    
    args.forEach(arg => {
        if (arg.startsWith('files=')) {
            params.files = arg.split('=')[1];
        }
        else if (arg.startsWith('period=')) {
            params.period = arg.split('=')[1];
        }
        else if (arg === '--debug') {
            params.debug = true;
        }
    });

    return params;
}

const args = process.argv.slice(2);
const params = parseArgs(args);

// Build command with default period if not provided
const command = `node src/index.js --files="${params.files}" --period="${params.period || '30d'}" ${params.debug ? '--debug' : ''}`;

spawn(command, { shell: true, stdio: 'inherit' }); 