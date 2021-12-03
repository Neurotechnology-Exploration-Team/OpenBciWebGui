// --------------------------------------- Cyton stuff ---------------------------------------

const Cyton = require('@openbci/cyton'); // requires node <= v9

class MyCyton {
    constructor() {
        this.ourBoard = new Cyton();
        this.ourBoard.connect(portName) // Port name is a serial port name, see `.listPorts()`
            .then(() => {
                this.ourBoard.streamStart();
                this.ourBoard.on('sample',(sample) => {
                    /** Work with sample */
                    for (let i = 0; i < this.ourBoard.numberOfChannels(); i++) {
                        console.log("Channel " + (i + 1) + ": " + sample.channelData[i].toFixed(8) + " Volts.");
                        // prints to the console
                        //  "Channel 1: 0.00001987 Volts."
                        //  "Channel 2: 0.00002255 Volts."
                        //  ...
                        //  "Channel 8: -0.00001875 Volts."
                    }
                });
            });
    }
}

module.exports = MyCyton;