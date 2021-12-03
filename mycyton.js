// --------------------------------------- Cyton stuff ---------------------------------------

const Cyton = require('@openbci/cyton'); // requires node <= v9

class MyCyton {
    constructor(onConnectionStatusChange) {
        this.onConnectionStatusChange = onConnectionStatusChange

        this.ourBoard = new Cyton({});
        this.ourBoard.listPorts().then(ports => {
            // console.log(ports);
            this.attemptConnect(ports, 0, () => {
                console.log('Connected!');
                this.ourBoard.streamStart();
                this.ourBoard.on('sample', (sample) => {
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
        });
    }

    attemptConnect(ports, index, onsuccess) {
        this.onConnectionStatusChange(1);
        this.ourBoard.connect(ports[index].comName) // Port name is a serial port name, see `.listPorts()`
            .then(() => {
                this.onConnectionStatusChange(2);
                onsuccess();
            })
            .catch(err => {
                console.log('Caught error connecting: ' + err + '; this usually means there is no device on this port, please wait.');
                if (index + 1 < ports.length) {
                    console.log('Attempting next port... ' + ports[index + 1].comName);
                    this.attemptConnect(ports, index + 1, onsuccess);
                }
                else {
                    console.log('No device found.');
                    this.onConnectionStatusChange(0);
                }
            });
    }
}

module.exports = MyCyton;