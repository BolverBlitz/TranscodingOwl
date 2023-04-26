const { executeCommand } = require("./misc");

const Events = require('events');

const internal_events = new Events();

const path = require('path');
const fs = require('fs');
const os = require('os');

let GlobffmpegPath;

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

class TaskHandler {
    constructor(encoders, encoders_config, log) {
        this.tasks = [];
        this.encoders = encoders;
        this.encoders_config = encoders_config;

        this.quality_setting = 28;
        this.quality_preset = 1;

        this.isExitting = false;
        this.log = log;

        // Fill with null for every encoder
        this.encoders_free = this.encoders.map(() => null);

        setInterval(() => {
            const freeEncoders = this.#checkFreeEncoders();

            if (this.isExitting) return;
            if (this.tasks.length === 0) return; // Return if no tasks are avaible...

            for (let i = 0; i < freeEncoders.length; i++) {
                if (this.tasks.length > 0) {
                    const task = this.tasks[0];
                    this.tasks.splice(0, 1);
                    this.#start(freeEncoders[i], task);
                }
            }
        }, 1000);

        internal_events.on('kill_children', () => {
            this.isExitting = true;
        });
    }

    /**
     * Return all free encoders
     * @returns {Array} Array with free encoders
     */
    #checkFreeEncoders() {
        let freeEncoders = [];
        for (let i = 0; i < this.encoders_free.length; i++) {
            if (this.encoders_free[i] === null) {
                freeEncoders.push(this.encoders[i]);
            }
        }

        if (freeEncoders.length > 0) {
            return freeEncoders;
        } else {
            return 0;
        }
    }

    /**
     * Generate the command for ffmpeg
     * @param {Object} encoder_config
     * @param {String} task 
     * @returns {String} Command for ffmpeg
     */
    #generateFFMPEGCommand(encoder_config, task) {
        let encoder_specific = []
        if (encoder_config.quality_command) {
            encoder_specific.push(encoder_config.quality_command);
        }

        for (let i = 0; i < encoder_config.quality_constract.length; i++) {
            encoder_specific.push(`${encoder_config.quality_constract[i]} ${this.quality_setting}`);
        }

        encoder_specific.push(`${encoder_config.quality_preset_command} ${encoder_config.quality_preset_constract[this.quality_preset]}`);

        return `"${GlobffmpegPath}" -i "${task}" -c:v ${encoder_config.name} ${encoder_specific.join(" ")} -c:a copy -c:s copy "${task.split('.')[0]}-encoded.mp4"`;
    }

    /**
     * Start a task on some encoder
     * @param {String} encoder Encoder name
     * @param {String} task Path to file
     */
    async #start(encoder, task) {
        //console.log(this.encoders_config[this.encoders.indexOf(encoder)])
        //console.log(`Starting task ${task} on encoder ${encoder}`)
        this.encoders_free[this.encoders.indexOf(encoder)] = task;
        //console.log(this.#generateFFMPEGCommand(this.encoders_config[this.encoders.indexOf(encoder)], task))
        const ffmpeg_result = await executeCommand(this.#generateFFMPEGCommand(this.encoders_config[this.encoders.indexOf(encoder)], task), "./", internal_events);
        //console.log(ffmpeg_result);
        if (ffmpeg_result.code !== 0) {
            //console.log(ffmpeg_result);
            this.log('red', `Error while encoding ${task} on encoder ${encoder}`);
        }
        this.encoders_free[this.encoders.indexOf(encoder)] = null;
    }

    /**
     * Add a task to the task handler
     * @param {String} task 
     */
    addTask(task) {
        this.tasks.push(task);
    }

    /**
     * Remove a task from the task handler
     * @param {String} task 
     */
    removeTask(task) {
        this.tasks.splice(this.tasks.indexOf(task), 1);
    }

    /**
     * Set the quality for the encoder
     * @param {Number} quality 
     */
    setQuality(quality) {
        this.quality_setting = quality;
    }

    /**
     * Index of the quality preset (0: fast, 1: default, 2: slow)
     * @param {Number} preset 
     */
    setPresets(preset) {
        this.quality_preset = preset;
    }
}

module.exports = {
    TaskHandler,
    internal_events
};