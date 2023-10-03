const term = require('terminal-kit').terminal;
const encoders_config = require('../config/encoders');

const { internal_events } = require('./taskhandler');

const spawn = require('child_process').spawn;
const os = require('os');

let encoders_config_array = Object.entries(encoders_config);

const active_child_pids = [];

term.on('key', function (name, matches, data) {
    if (name === 'CTRL_C') {
        internal_events.emit('kill_children');
        term.red('\nCTRL-C erkannt. Programm wird beendet...\n');

        for (let i = 0; i < active_child_pids.length; i++) {
            if (os.platform() == "win32") {
                spawn('taskkill', ['/pid', active_child_pids[i], '/f', '/t']);
            } else {
                spawn('kill', ['-9', active_child_pids[i]]);
            }
        }
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }
});

internal_events.on('pid_update', (data) => {
    if (data.type === "add") {
        active_child_pids.push(data.pid);
    }

    if (data.type === "rem") {
        active_child_pids.splice(active_child_pids.indexOf(data.pid), 1);
    }
});

/**
 * Logs messages with the terminal-kit terminal
 * @param {String} color 
 * @param {String} message 
 */
const log = (color, message) => {
    term[color](`${message}\n`);
}

/**
 * Ask if the files found are correct
 * @param {Number} amount
 * @param {String} disktotal
 * @param {Array} filesFound 
 * @returns {Promise<Boolean>} Awnser
 */
const QuestionfileConfirm = (amount, disktotal, filesFound) => {
    return new Promise((resolve, reject) => {
        term.yellow(`Found ${amount} files (${disktotal}) with followong types: ${filesFound.join(", ")}\nIs this correct? (y/n)\n`);

        // Exit on y and ENTER key
        // Ask again on n
        term.yesOrNo({ yes: ['y', 'ENTER'], no: ['n'] }, function (error, result) {

            if (result) {
                term.green("'Yes' detected!\n");
                resolve(true);
            }
            else {
                term.red("'No' detected, exiting...\n");
                resolve(false);
            }
        });
    });
}

const TerminalInput = (message) => {
    return new Promise((resolve, reject) => {
        term.yellow(message);

        term.inputField(function (error, input) {

            term.green("\n>> '%s'\n", input);
            resolve(input);
        }
        );
    });
}

const EncoderSelect = (encoders) => {
    const encoderArray = []
    for (let i = 0; i < encoders.length; i++) {
        encoderArray.push(encoders[i].encoder)
    }

    encoders_config_array = encoders_config_array.filter((item) => {
        return encoderArray.includes(item[0]);
    });

    return new Promise((resolve, reject) => {
        term.yellow('Select the encoder you wanna use. (Failed just refers to the benchmark, do not worry)\n');
        const items_human = ["ALL"];
        const items = ["ALL"];

        for (let i = 0; i < encoders.length; i++) {
            if (encoders[i].encoder in encoders_config) {
                if (items_human.includes(`${encoders_config[encoders[i].encoder].type} ONLY`)) continue;
                items_human.push(`${encoders_config[encoders[i].encoder].type} ONLY`)

                items.push(encoders_config[encoders[i].encoder].type)
            }
        }

        for (let i = 0; i < encoders.length; i++) {
            items_human.push(`${encoders_config[encoders[i].encoder].type}: ${encoders[i].encoder} @ ${encoders[i].speed}`);
            items.push(encoders[i].encoder);
        }

        term.singleColumnMenu(items_human, function (error, response) {
            term('\n').eraseLineAfter.green(
                "#%s selected: %s\n\n",
                response.selectedIndex,
                items[response.selectedIndex]
            );

            if (items[response.selectedIndex] === "ALL") {
                resolve(encoders_config_array);
            }

            if (items[response.selectedIndex] === "CPU") {
                resolve(encoders_config_array.filter((item) => {
                    return encoders_config[item[0]].type === "CPU";
                }));
            }

            if (items[response.selectedIndex] === "GPU") {
                resolve(encoders_config_array.filter((item) => {
                    return encoders_config[item[0]].type === "GPU";
                }));
            }

            resolve(encoders_config_array.filter((item) => {
                return encoders_config[item[0]].cname === items[response.selectedIndex];
            }));

        });
    })
};

const EncoderSelect_param = (encoders, target) => {
    // Check if target is ALL, CPU oder GPU
    if (!["ALL", "CPU", "GPU"].includes(target)) {
        throw new Error("Target must be ALL, CPU or GPU");
    }
    const encoderArray = []
    for (let i = 0; i < encoders.length; i++) {
        encoderArray.push(encoders[i].encoder)
    }

    encoders_config_array = encoders_config_array.filter((item) => {
        return encoderArray.includes(item[0]);
    });

    return new Promise((resolve, reject) => {
        const items_human = ["ALL"];
        const items = ["ALL"];

        for (let i = 0; i < encoders.length; i++) {
            if (encoders[i].encoder in encoders_config) {
                if (items_human.includes(`${encoders_config[encoders[i].encoder].type} ONLY`)) continue;
                items_human.push(`${encoders_config[encoders[i].encoder].type} ONLY`)

                items.push(encoders_config[encoders[i].encoder].type)
            }
        }

        for (let i = 0; i < encoders.length; i++) {
            items_human.push(`${encoders_config[encoders[i].encoder].type}: ${encoders[i].encoder} @ ${encoders[i].speed}`);
            items.push(encoders[i].encoder);
        }

        if (target === "ALL") {
            resolve(encoders_config_array);
        }

        if (target === "CPU") {
            resolve(encoders_config_array.filter((item) => {
                return encoders_config[item[0]].type === "CPU";
            }));
        }

        if (target === "GPU") {
            resolve(encoders_config_array.filter((item) => {
                return encoders_config[item[0]].type === "GPU";
            }));
        }
    })
};

module.exports = {
    TerminalInput,
    QuestionfileConfirm,
    EncoderSelect,
    EncoderSelect_param,
    log
}