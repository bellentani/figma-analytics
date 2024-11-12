const cliProgress = require('cli-progress');

class ProgressBar {
    constructor() {
        this.bar = new cliProgress.SingleBar({
            format: 'Progress |{bar}| {percentage}% || {value}/{total} Files',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
    }

    start(total) {
        this.bar.start(total, 0);
    }

    update(value) {
        this.bar.update(value);
    }

    stop() {
        this.bar.stop();
    }
}

module.exports = new ProgressBar(); 