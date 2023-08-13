const { executeCommand, humanFileSize, setTerminalTitle, template } = require("./misc");
const _progress = require('cli-progress');

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
        console.log('red', 'ffmpeg.exe not found, please download it from https://ffmpeg.org/download.html and place it in the bin folder');
        process.exit(1);
    }
} else {
    const ffmpegPath = path.join(__dirname, '..', 'bin', 'ffmpeg');
    GlobffmpegPath = ffmpegPath;
    if (!fs.existsSync(ffmpegPath)) {
        console.log('red', 'ffmpeg not found, please download it from https://ffmpeg.org/download.html and place it in the bin folder');
        process.exit(1);
    }
}

class TaskHandler extends Events {
    constructor(encoders, encoders_config, log, reEncode) {
        super();
        this.tasks = [];
        this.encoders = encoders;
        this.encoders_config = encoders_config;

        this.reEncode = reEncode;

        this.quality_setting = 28;
        this.quality_preset = 1;

        this.tasklessRun = 0;

        this.isExitting = false;
        this.log = log;

        // Bars and controls for bars
        this.multibar = new _progress.MultiBar({
            format: '{percentage}% \t [\u001b[32m{bar}\u001b[0m] {eta_formatted} >> {file} \t | {value}/{total} | {encoder}',
            hideCursor: true,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            clearOnComplete: true,
            stopOnComplete: true,
            noTTYOutput: true
        });
        this.jobs_list = {};
        this.active_bars = [];

        this.new_size = 0;

        // Fill with null for every encoder
        this.encoders_free = this.encoders.map(() => null);

        this.internLoop = setInterval(() => {
            const freeEncoders = this.#checkFreeEncoders();

            if (this.isExitting) return;
            if (this.tasks.length === 0) {

                if (freeEncoders.length === this.encoders.length) {
                    this.tasklessRun++;
                }

                if (this.tasklessRun > 5) {
                    this.emit('all_tasks_done');
                    clearInterval(this.internLoop);
                }
                return
            }; // Return if no tasks are avaible...

            for (let i = 0; i < freeEncoders.length; i++) {
                setTerminalTitle(`OwlMedia - ${this.tasks.length} tasks left`);
                if (this.tasks.length > 0) {
                    const task = this.tasks[0];
                    this.tasks.splice(0, 1);
                    try {
                        this.#start(freeEncoders[i], task);
                    } catch (e) {
                        this.log('red', `I've ran into a huge ERROR while starting task ${task}`)
                        console.log(e)
                    }
                }
            }



        }, 1000);

        internal_events.on('kill_children', () => {
            this.isExitting = true;
        });

        internal_events.on('ffmpeg_status', (data) => {
            if (this.isExitting) return;
            if (data.type === "duration") {
                this.active_bars.push(this.multibar.create(data.duration, 0, { file: this.jobs_list[data.task].name, encoder: this.jobs_list[data.task].encoder }));
            }

            if (data.type === "time") {
                const bar = this.active_bars.filter(bar => bar.payload.file === this.jobs_list[data.task].name)[0]

                // check if Bar is already finished
                if (bar === undefined) return;
                if (bar.value < bar.total) {
                    bar.update(parseInt(data.time, 10));
                }
            }
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

        const metaDataTag = `-metadata OWLMEDIA="${encoder_config.name},${this.quality_setting},${this.quality_preset}"`;

        return `"${GlobffmpegPath}" -y -i "${task}" ${metaDataTag} -c:v ${encoder_config.name} ${encoder_specific.join(" ")} -c:a copy -c:s copy "${task.substring(0, task.lastIndexOf('.'))}-encoded.mkv"`;
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
        this.jobs_list[this.#generateFFMPEGCommand(this.encoders_config[this.encoders.indexOf(encoder)], task)] = {
            name: task.split('\\')[task.split('\\').length - 1],
            encoder: encoder
        }

        // Lets check if we already encoded the file
        const metaCheck = await executeCommand(`"${GlobffmpegPath}" -i "${task}"`, "./");
        if (metaCheck.code === 1) {
            const meta = metaCheck.hasFailedMessage.split('\n');
            for (const line of meta) {
                // Old detection for meta data
                if (line.trim().startsWith('title')) {
                    if (line.includes('OwlMedia')) {
                        if (this.reEncode) {
                            this.log('magenta', `File ${task} is already encoded, but can't be re-encoded because of unsuported metadata format`);
                            fs.appendFileSync('log.txt', `${task} is already encoded, but can't be re-encoded because of unsuported metadata format\n`);
                        } else {
                            this.log('magenta', `File ${task} is already encoded`);
                            fs.appendFileSync('log.txt', `${task} is already encoded\n`);
                        }
                        const original_size = fs.statSync(task).size;
                        this.new_size = Number(this.new_size) + Number(original_size);
                        this.encoders_free[this.encoders.indexOf(encoder)] = null; // Set encoder to free
                        return;
                    }
                }

                // New detection for meta data
                if (line.trim().startsWith('OWLMEDIA')) {
                    const match = line.match(/:\s*(.+)/);
                    if (match) {
                        const values = match[1];
                        const [oldEncoder, oldQuality, oldPreset] = values.split(',');
                        if (this.reEncode && this.quality_setting > oldQuality) {
                            this.log('magenta', `Re-Encode: ${task} will be re-encoded with less quality ${oldQuality}->${this.quality_setting}`);
                            fs.appendFileSync('log.txt', `${task} will be re-encoded with less quality ${oldQuality}->${this.quality_setting}\n`);
                        } else {
                            this.log('magenta', `File ${task} is already encoded with ${oldEncoder} and a quality of ${oldQuality} using preset ${oldPreset}`);
                            fs.appendFileSync('log.txt', `${task} is already encoded with ${oldEncoder} and a quality of ${oldQuality} using preset ${oldPreset}\n`);
                            const original_size = fs.statSync(task).size;
                            this.new_size = Number(this.new_size) + Number(original_size);
                            this.encoders_free[this.encoders.indexOf(encoder)] = null; // Set encoder to free
                            return;
                        }
                    }

                }
            }
        }
        //console.log(this.#generateFFMPEGCommand(this.encoders_config[this.encoders.indexOf(encoder)], task))
        const ffmpeg_result = await executeCommand(this.#generateFFMPEGCommand(this.encoders_config[this.encoders.indexOf(encoder)], task), "./", internal_events);
        if (ffmpeg_result.code !== 0) {
            this.log('red', `Error while encoding ${task} on encoder ${encoder}`);
            fs.appendFileSync('log.txt', `${task.substring(0, task.lastIndexOf('.'))}: Error while encoding\n`);
        } else {
            setTimeout(() => {
                const original_size = fs.statSync(task).size;
                const new_size = fs.statSync(`${task.substring(0, task.lastIndexOf('.'))}-encoded.mkv`).size;
                this.new_size = Number(this.new_size) + Number(new_size);
                fs.appendFileSync('log.txt', `${task.substring(0, task.lastIndexOf('.'))}: ${humanFileSize(original_size)} -> ${humanFileSize(new_size)} (${Math.round((new_size / original_size) * 100)}%)\n`);
                if ('t' in process.minimist || 'tasknotify' in process.minimist) {
                    const variables = {
                        task: task,
                        hostname: os.hostname(),
                        original_size: humanFileSize(original_size),
                        new_size: humanFileSize(new_size),
                        saved: humanFileSize(original_size - new_size),
                        saved_percent: Math.round((new_size / original_size) * 100),
                        encoder: encoder,
                        encoder_name: this.encoders_config[this.encoders.indexOf(encoder)].name,
                        encoder_quality: this.quality_setting,
                        encoder_preset: this.quality_preset,
                    }
                    try {
                        fetch(template(process.minimist.t || process.minimist.tasknotify, variables))
                    } catch (e) {
                        this.log('red', `Error while sending notification: ${e.message}`);
                    }
                }

                try {
                    fs.unlinkSync(task);
                    fs.renameSync(`${task.substring(0, task.lastIndexOf('.'))}-encoded.mkv`, `${task.substring(0, task.lastIndexOf('.'))}.mkv`);
                } catch (e) {
                    this.log('red', `Error during IO. File deletion or renaming failed. FIX MANUALY!`);
                    fs.appendFileSync('error.txt', `${task.substring(0, task.lastIndexOf('.'))}: Error during IO. File deletion or renaming failed. FIX MANUALY!\n`);
                }
            }, 15 * 1000);
        }

        this.encoders_free[this.encoders.indexOf(encoder)] = null; // Set encoder to free
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

    /**
     * Get the new size (in bytes) of all encoded files
     * @returns {Number} New size in bytes
     */
    getNewSize() {
        return this.new_size;
    }
}

module.exports = {
    TaskHandler,
    internal_events
};