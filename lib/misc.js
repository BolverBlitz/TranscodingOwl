const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;

const durationRegex = /Duration: (\d{2}):(\d{2}):(\d{2})\.\d{2}/;
const timeRegex = /time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/;

/**
 * Get all files in a directory recursively
 * @param {String} dir | The directory to search in
 * @param {Function} done | Callback function
 */
const folderPaths = function (dir, done) {
    var results = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        var pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function (file) {
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    folderPaths(file, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    results.push(file);
                    if (!--pending) done(null, results);
                }
            });
        });
    });
};


/**
 * Run a cli command within node as async function in a specific directory
 * @param {String} command | The command to execute
 * @param {String} cwd | Path to execute the command in
 * @param {EventEmitter} internal_events | Internal events
 * @returns 
 */
function executeCommand(command, cwd, internal_events = null) {
    return new Promise(function (resolve, reject) {
        let hasFailed = false;
        let hasFailedMessage = '';
        let hasSucceededMessage = '';
        const child = spawn(command, { cwd: cwd, shell: true });

        if (internal_events !== null) {
            internal_events.emit('pid_update', { type: "add", pid: child.pid });
        }

        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (data) => {
            hasSucceededMessage += data.toString();
        });
        child.stderr.on('data', (data) => {
            if (internal_events !== null) {
                const duration_match = data.toString().match(durationRegex);
                const time_match = data.toString().match(timeRegex);

                if (duration_match) {
                    const hours = parseInt(duration_match[1], 10);
                    const minutes = parseInt(duration_match[2], 10);
                    const seconds = parseInt(duration_match[3], 10);

                    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                    internal_events.emit('ffmpeg_status', { task: command, type: "duration", duration: totalSeconds })
                }

                if (time_match) {
                    const hours = parseInt(time_match[1], 10);
                    const minutes = parseInt(time_match[2], 10);
                    const seconds = parseFloat(time_match[3]);

                    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                    internal_events.emit('ffmpeg_status', { task: command, type: "time", time: totalSeconds })
                }
            }
            hasFailedMessage += data.toString();
            hasSucceededMessage += data.toString();
            hasFailed = true;
        });
        child.on('close', (code) => {
            if (internal_events !== null) {
                internal_events.emit('pid_update', { type: "rem", pid: child.pid });
            }
            if (!hasFailed || code == 0) {
                resolve({ code, hasSucceededMessage })
            } else {
                resolve({ code, hasFailedMessage })
            }
        });
    });
}

/**
 * Gets the file extention of a JS path
 * @param {String} path 
 * @returns 
 */
function getFileExtension(path) {
    const fileExtension = path.split('.').pop().toLocaleLowerCase();
    return fileExtension;
}

/**
 * Get total file size of an array of paths
 * @param {Array} paths 
 */
function getTotalSize(paths) {
    return new Promise((resolve, reject) => {
        let totalSize = 0;
        let count = 0;

        paths.forEach((path) => {
            fs.stat(path, (err, stats) => {
                if (err) {
                    console.error(`Error while trying to get file size of ${path}: ${err}`);
                    totalSize += 0;
                    count++;
                }

                totalSize += stats.size;
                count++;

                if (count === paths.length) {
                    resolve(totalSize);
                }
            });
        });
    });
}

/**
 * Format bytes as human-readable text.
 * 
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use 
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 * 
 * @return Formatted string.
 */
function humanFileSize(bytes, si = false, dp = 1) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }

    const units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


    return bytes.toFixed(dp) + ' ' + units[u];
}

/**
 * Set the terminal title
 * @param {String} title 
 */
function setTerminalTitle(title) {
    process.stdout.write(
        String.fromCharCode(27) + "]0;" + title + String.fromCharCode(7)
    );
}

/**
 * Will replace all {{Variables}} with the corresponding value of the Key
 * @param {String} templateid 
 * @param {Object} data 
 * @returns {String}
 */
function template(templateid, data) {
    if (typeof (templateid) !== 'string' || typeof (data) !== 'object') { throw new Error('Template expects string and object'); }
    return templateid
        .replace(
            /{{2}(\w*)}{2}/g,
            function (m, key) {
                return data.hasOwnProperty(key) ? data[key] : "NULL";
            }
        );
}

module.exports = {
    folderPaths,
    executeCommand,
    getFileExtension,
    getTotalSize,
    humanFileSize,
    setTerminalTitle,
    template
}