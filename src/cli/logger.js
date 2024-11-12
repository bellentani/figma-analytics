class Logger {
    constructor(debug = false) {
        this.debug = debug;
    }

    log(message) {
        console.log(message);
    }

    debug(message) {
        if (this.debug) {
            console.log('[DEBUG]', message);
        }
    }

    error(message, error) {
        console.error(message, error);
    }

    success(message) {
        console.log('✓', message);
    }

    progress(current, total, message) {
        console.log(`[${current}/${total}] ${message}`);
    }
}

module.exports = Logger; 