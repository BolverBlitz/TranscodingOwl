const fs = require('fs');
const path = require('path');

const terminal = require('./lib/terminal');

const args = require('minimist')(process.argv.slice(2));

const { folderPaths, getFileExtension, getTotalSize, humanFileSize, setTerminalTitle } = require('./lib/misc');
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

if ('i' in args || 'input' in args) {
    encoderfolder = args.i || args.input;
} else {
    console.log("No input folder provided");
    process.exit(3);
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
        if(results.length === 0) {
            terminal.log('red', `No files found!`);
            process.exit(1);
        }

        const toatlStartSice = await getTotalSize(results);

        //console.log(results)

        const correctFiles = await terminal.QuestionfileConfirm(results.length, humanFileSize(toatlStartSice), [...new Set(allFileExtentions)]);
        if (!correctFiles) process.exit(1);

        terminal.log('cyan', `Testing encoders. This might take some time...`);

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
        const taskHandler = new TaskHandler(choosenEncoders_name, choosenEncoders_config, terminal.log);

        taskHandler.setQuality(setQuality);
        taskHandler.setPresets(setPresets);

        for (let i = 0; i < results.length; i++) {
            taskHandler.addTask(results[i]);
        }

        taskHandler.on('all_tasks_done', async () => {
            setTerminalTitle('Waiting for pending file IO...');
            terminal.log('green', `\nAll tasks done!`);
            await delay(15 * 1000, `Waiting for pending file IO...`); // Await pending file IO
            const toatlEndSice = await getTotalSize(results);
            terminal.log('green', `Total size before: ${humanFileSize(toatlStartSice)}`);
            terminal.log('green', `Total size after: ${humanFileSize(toatlEndSice)} (${Math.round((toatlEndSice / toatlStartSice) * 100)}%)`);
            terminal.log('green', `Saved: ${humanFileSize(toatlStartSice - toatlEndSice)}`);
            process.exit(0);
        });

    });
};

main();