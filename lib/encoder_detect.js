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
            process.exit(1);
        }
    } else {
        const ffmpegPath = path.join(__dirname, '..', 'bin', 'ffmpeg');
        GlobffmpegPath = ffmpegPath;
        if (!fs.existsSync(ffmpegPath)) {
            log('red', 'ffmpeg not found, please download it from https://ffmpeg.org/download.html and place it in the bin folder');
            process.exit(1);
        }
    }
}

const test_encoder = async () => {
    let availableEncoders = [];
    for (const [encoder] of Object.entries(encoders)) {
        const output = await executeCommand(`"${GlobffmpegPath}" -f lavfi -i color=size=1920x1080:rate=1:duration=600 -c:v ${encoders[encoder].name} -f null -`, "./")
        if (output.code === 0) {
            const match = regexSpeedMatcher.exec(output.hasSucceededMessage);
            if (match !== null) {
                availableEncoders.push({ encoder, speed: `${match[1]}x` });
            } else {
                availableEncoders.push({ encoder, speed: 'Failed' });
            }
        }
    };

    return availableEncoders;
}

module.exports = {
    check_ffmpeg,
    test_encoder
}