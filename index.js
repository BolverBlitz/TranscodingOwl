const os = require('os');

const terminal = require('./lib/terminal');

const args = require('minimist')(process.argv.slice(2));
process.minimist = args;

let reEncode = false; // Re-encode files that are already encoded

const { folderPaths, getFileExtension, getTotalSize, humanFileSize, setTerminalTitle, template } = require('./lib/misc');
const { test_encoder, check_ffmpeg } = require('./lib/encoder_detect');


const { TaskHandler } = require('./lib/taskhandler');

const videoextentions = require('./config/videoextentions');

const delay = async (ms, message) => {
    return new Promise((resolve, reject) => {
        if (message) terminal.log('cyan', message);
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

let encoderfolder;

if ('h' in args || 'help' in args) {
    console.log(`
    Usage: node index.js -i <input folder> [-r]
    -i, --input     Input folder
    -r, --recode    Re-encode files that are already encoded, only if the target quality is less than the current quality
    -n, --notify Call this http(s) url when done, supports template variables (see readme)
    -t, --tasknotify Call this http(s) url when a task is done, supports template variables (see readme)
    -v, --version   Show version
    -h, --help      Show this help
    `);
    process.exit(0);
}

if ('v' in args || 'version' in args) {
    console.log(`v${require('./package.json').version}`);
    process.exit(0);
}

if('n' in args || 'notify' in args) {
    if(typeof args.n !== 'string' && !args.notify) {
        console.log("No notify url provided.\n\nUse -h or --help for help and check the readme.");
        process.exit(3);
    }
}

if('t' in args || 'tasknotify' in args) {
    if(typeof args.t !== 'string' && !args.tasknotify) {
        console.log("No tasknotify url provided.\n\nUse -h or --help for help and check the readme.");
        process.exit(3);
    }
}

if ('i' in args || 'input' in args) {
    encoderfolder = args.i || args.input;
} else {
    console.log("No input folder provided.\n\nUse -h or --help for help.");
    process.exit(3);
}

if ('r' in args || 'recode' in args) {
    reEncode = true;
}

const main = async () => {

    terminal.log('brightRed', `This application is written in a very async way.\nThis means, if you manualy stop it, it will brick some part of your media library.\n\nYou can look at log.txt and console to work out what broke and fix it before running it again!\n`)

    setTerminalTitle('Checking ffmpeg...');
    check_ffmpeg();

    setTerminalTitle('Scanning folder(s)...');
    folderPaths(encoderfolder, async (err, results) => {
        if (err) {
            console.log(err);
            process.exit(1);
        }

        // Subscrect paths from results
        let allFileExtentions = [];
        for (let i = 0; i < results.length; i++) {
            if (!results[i]) continue;
            if (!videoextentions.avaible.includes(getFileExtension(results[i]))) continue;
            allFileExtentions.push(getFileExtension(results[i]));
            //console.log(results[i].split('\\').pop().split('/').pop())
        };

        // Filter only allowed video file extentions
        results = results.filter((file, index) => videoextentions.avaible.includes(getFileExtension(file)));
        if (results.length === 0) {
            terminal.log('red', `No files found!`);
            process.exit(1);
        }

        const totalStartSize = await getTotalSize(results);

        //console.log(results)

        const correctFiles = await terminal.QuestionfileConfirm(results.length, humanFileSize(totalStartSize), [...new Set(allFileExtentions)]);
        if (!correctFiles) process.exit(1);

        terminal.log('cyan', `Testing encoders. This might take some time...`);

        setTerminalTitle('Testing encoder(s)...');
        const encoders = await test_encoder();

        const choosenEncoders = await terminal.EncoderSelect(encoders);

        const choosenEncoders_name = choosenEncoders.map((encoder) => encoder[0]);
        const choosenEncoders_config = choosenEncoders.map((encoder) => encoder[1]);

        setTerminalTitle('Asking for settings...');
        const setQuality = await terminal.TerminalInput('Set quality (0-51, 0 is lossless, 51 is worst quality): ');
        const setPresets = await terminal.TerminalInput('Set preset (0: fast, 1: default, 2: slow): ');

        if (setQuality < 0 || setQuality > 51) {
            terminal.log('red', `Quality must be between 0 and 51`);
            process.exit(1);
        }

        if (setPresets < 0 || setPresets > 2) {
            terminal.log('red', `Preset must be between 0 and 2`);
            process.exit(1);
        }

        setTerminalTitle('Preparing tasks...')
        const taskHandler = new TaskHandler(choosenEncoders_name, choosenEncoders_config, terminal.log, reEncode);

        taskHandler.setQuality(setQuality);
        taskHandler.setPresets(setPresets);

        for (let i = 0; i < results.length; i++) {
            taskHandler.addTask(results[i]);
        }

        taskHandler.on('all_tasks_done', async () => {
            setTerminalTitle('Waiting for pending file IO...');
            terminal.log('green', `\nAll tasks done!`);
            await delay(15 * 1000, `Waiting for pending file IO...`); // Await pending file IO
            /*
                A quick side note about a very unlikely senario:
                In case there is test.mp4 and test.mkv (The test.mkv was already encoded) in the same folder, the script will count this file twice.
                This can be fixed by checking witch files where envced already, but i don´t see this as a problem as of now.
            */
            const totalEndSize = taskHandler.getNewSize();
            terminal.log('green', `Total size before: ${humanFileSize(totalStartSize)}`);
            terminal.log('green', `Total size after: ${humanFileSize(totalEndSize)} (${Math.round((totalEndSize / totalStartSize) * 100)}%)`);
            terminal.log('green', `Saved: ${humanFileSize(totalStartSize - totalEndSize)}`);

            if ('n' in args || 'notify' in args) {
                const variables = {
                    totalSizeBefore: humanFileSize(totalStartSize),
                    totalSizeAfter: humanFileSize(totalEndSize),
                    saved: humanFileSize(totalStartSize - totalEndSize),
                    saved_percent: Math.round((totalEndSize / totalStartSize) * 100),
                    hostname: os.hostname(),
                    path: encoderfolder
                }
                fetch(template(args.n || args.notification, variables)).then(() => {
                    terminal.log('green', `Notification sent!`);
                    process.exit(0);
                }).catch((err) => {
                    terminal.log('red', `Error sending notification!`);
                    console.log(err);
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        });

    });
};

main();