const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;
const os = require('os');

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
            internal_events.on('kill_children', () => {
                // Check os and use nativ OS kill command
                if (os.platform() == "win32") {
                    spawn('taskkill', ['/pid', child.pid, '/f', '/t']);
                } else {
                    spawn('kill', ['-9', child.pid]);
                }
            });
        }

        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (data) => {
            hasSucceededMessage += data.toString();
        });
        child.stderr.on('data', (data) => {
            console.log(data.toString());
            hasFailedMessage += data.toString();
            hasSucceededMessage += data.toString();
            hasFailed = true;
        });
        child.on('close', (code) => {
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
    const fileExtension = path.split('.').pop();
    return fileExtension;
}

module.exports = {
    folderPaths,
    executeCommand,
    getFileExtension
}