const fs = require('fs');
const path = require('path');

const args = require('minimist')(process.argv.slice(2));

const { folderPaths, executeCommand, getFileExtension } = require('./lib/misc');
const { test_encoder, check_ffmpeg } = require('./lib/encoder_detect');
const terminal = require('./lib/terminal');

const { TaskHandler } = require('./lib/taskhandler');

const videoextentions = require('./config/videoextentions');

let encoderfolder;

if ('i' in args || 'input' in args) {
    encoderfolder = args.i || args.input;
} else {
    console.log("No input folder provided");
    process.exit(3);
}

const main = async () => {
    check_ffmpeg();
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

        //console.log(results)

        const correctFiles = await terminal.QuestionfileConfirm(results.length, [...new Set(allFileExtentions)]);
        if (!correctFiles) process.exit(1);

        terminal.log('cyan', `Testing encoders. This might take some time...`);

        const encoders = await test_encoder();

        const choosenEncoders = await terminal.EncoderSelect(encoders)

        const choosenEncoders_name = choosenEncoders.map((encoder) => encoder[0]);
        const choosenEncoders_config = choosenEncoders.map((encoder) => encoder[1]);

        const taskHandler = new TaskHandler(choosenEncoders_name, choosenEncoders_config, terminal.log);

        taskHandler.setQuality(28);
        taskHandler.setPresets(1);

        for(let i = 0; i < results.length; i++) {
            taskHandler.addTask(results[i]);
        }

    });
};

main();