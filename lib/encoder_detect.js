const { executeCommand } = require('./misc');
const { log } = require('./terminal');
const encoders = require('../config/encoders');
const path = require('path');
const fs = require('fs');
const os = require('os');

const regexSpeedMatcher = /speed=\s*(\d+(?:\.\d+)?)x/gm;

// To get encoder info: .\ffmpeg.exe -h encoder=hevc_amf

let GlobffmpegPath;

const check_ffmpeg = async () => {
    if (os.platform() == 'win32') {
        const ffmpegPath = path.join(__dirname, '..', 'bin', 'ffmpeg.exe');
        GlobffmpegPath = ffmpegPath;
        if (!fs.existsSync(ffmpegPath)) {
            log('red', 'ffmpeg.exe not found, please download it from https://ffmpeg.org/download.html and place it in the bin folder');
            console.error('ffmpeg.exe not found, please download it from https://ffmpeg.org/download.html and place it in the bin folder');
            process.exit(1);
        }
    } else {
        const ffmpegPath = path.join(__dirname, '..', 'bin', 'ffmpeg');
        GlobffmpegPath = ffmpegPath;
        if (!fs.existsSync(ffmpegPath)) {
            log('red', 'ffmpeg not found, please download it from https://ffmpeg.org/download.html and place it in the bin folder');
            console.error('ffmpeg not found, please download it from https://ffmpeg.org/download.html and place it in the bin folder');
            process.exit(1);
        }
    }
}

const test_encoder = async () => {
    let availableEncoders = [];
    let readavaibleEncoders = [];

    if(fs.existsSync(path.join(__dirname, '..', 'bin', 'availableEncoders.json'))) {
        readavaibleEncoders = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bin', 'availableEncoders.json')));
    }

    for (const [encoder] of Object.entries(encoders)) {

        // Check if encoder is already tested and test is not older than 7 days and has a speed value
        const encoderTest = readavaibleEncoders.find(e => e.encoder === encoder);
        if (encoderTest && encoderTest.timestamp > Date.now() - 604800000 && encoderTest.speed !== 'Failed') {
            availableEncoders.push(encoderTest);
            continue;
        }

        const output = await executeCommand(`"${GlobffmpegPath}" -f lavfi -i color=size=1920x1080:rate=1:duration=600 -c:v ${encoders[encoder].name} -f null -`, "./")
        if (output.code === 0) {
            const output_lines = output.hasSucceededMessage.split('\n');
            let speed = false;
            for (const line of output_lines) {
                const match = regexSpeedMatcher.exec(line);
                if (match) {
                    speed = match[1];
                }
            }
            if (speed) {
                availableEncoders.push({ encoder, speed: `${speed}x`, timestamp: Date.now()});
            } else {
                availableEncoders.push({ encoder, speed: 'Failed', timestamp: Date.now() });
            }
        }
    };
    
    // Save benchmark results to file
    await fs.writeFileSync(path.join(__dirname, '..', 'bin', 'availableEncoders.json'), JSON.stringify(availableEncoders, null, 4));
    
    return availableEncoders;
}

module.exports = {
    check_ffmpeg,
    test_encoder
}