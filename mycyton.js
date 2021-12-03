// --------------------------------------- Cyton stuff ---------------------------------------

const Cyton = require('@openbci/cyton'); // requires node <= v9

class MyCyton {
    constructor(onConnectionStatusChange, onSample) {
        this.onConnectionStatusChange = onConnectionStatusChange;
        this.onSample = onSample;
        this.timeout = null;
        this.portNum = 2;

        this.ourBoard = new Cyton({});
        this.ourBoard.listPorts().then(ports => {
            // console.log(ports);
            this.attemptConnect(ports, () => {
                console.log('Connected!');

                this.ourBoard.streamStart();
                this.count = 0;
                this.startCountTime = Date.now();
                this.ourBoard.on('sample', (sample) => {
                    /** Work with sample */
                    this.count++;
                    if (Date.now() - this.startCountTime > 1000) {
                        // console.log(this.count);
                        this.count = 0;
                        this.startCountTime = Date.now();
                    }
                    this.mySample = [];
                    for (let i = 0; i < this.ourBoard.numberOfChannels(); i++) {
                        this.mySample.push(sample.channelData[i].toFixed(8));
                        // console.log("Channel " + (i + 1) + ": " + sample.channelData[i].toFixed(8) + " Volts.");
                        // prints to the console
                        //  "Channel 1: 0.00001987 Volts."
                        //  "Channel 2: 0.00002255 Volts."
                        //  ...
                        //  "Channel 8: -0.00001875 Volts."
                    }
                    this.onSample(this.mySample);
                });
            });
        });
    }

    attemptConnect(ports, onsuccess) {
        this.onConnectionStatusChange(1);
        this.ourBoard = new Cyton({});
        this.ourBoard.connect(ports[this.portNum].comName) // Port name is a serial port name, see `.listPorts()`
            .then(() => {
                this.timeout = null;
                this.onConnectionStatusChange(2);
                onsuccess();
            })
            .catch(err => {
                this.timeout = null;
                console.log('Caught error connecting: ' + err + '; this usually means there is no device on this port, please wait.');
                if (this.portNum + 1 < ports.length) {
                    this.portNum++;
                    console.log('Attempting next port... ' + ports[this.portNum].comName);
                    this.timeout = this.portNum;
                    setTimeout(this.checkTimeout.bind(this), 10000, this.portNum, function () {
                        console.log('Timeout on port ' + ports[this.portNum].comName);
                        this.portNum++;
                        this.attemptConnect(ports, onsuccess);
                    }.bind(this));
                    setTimeout(this.attemptConnect.bind(this), 1000, ports, onsuccess);
                }
                else {
                    console.log('No device found.');
                    this.onConnectionStatusChange(0);
                }
            });
    }

    checkTimeout(badValue, onBadTimeout) {
        if (this.timeout === badValue) onBadTimeout();
    }
}

module.exports = MyCyton;