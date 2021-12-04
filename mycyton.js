// --------------------------------------- Cyton stuff ---------------------------------------

const Cyton = require('@openbci/cyton'); // requires node <= v9

class MyCyton {
    constructor(onConnectionStatusChange, onSample) {
        this.onConnectionStatusChange = onConnectionStatusChange;
        this.onSample = onSample;
        this.timeout = null;
        this.portNum = null;

        this.savedSamples = [];
        this.samplesPerAverage = 500;
        // this.emitSamples();
        this.lastEmitted = 0;
        this.lastSampleTime = 0;

        this.allowSim = false;
        this.thresholdTypes = null;
        this.thresholdParameters = null;

        this.checkConnection();
    }

    emitSamples() {
        this.lastEmitted = Date.now();
        if (this.savedSamples.length > 0) {
            if (this.thresholdTypes == null) {
                this.thresholdTypes = [];
                this.thresholdParameters = [];
                for (let i = 0; i < this.savedSamples[0].length; i++) {
                    this.thresholdTypes.push("average");
                    this.thresholdParameters.push(500);
                }
            }
            if (this.savedSamples.length > this.samplesPerAverage) this.savedSamples = this.savedSamples.slice(this.savedSamples.length - this.samplesPerAverage);
            let calculatedSample = [];
            for (let c = 0; c < this.ourBoard.numberOfChannels(); c++) {
                let calculatedSampleChannel = 0;
                if (this.thresholdTypes[c] === "average") {
                    for (let i = this.savedSamples.length - 1; i >= Math.max(0, this.savedSamples.length - this.thresholdParameters[c]); i--) calculatedSampleChannel += Math.abs(this.savedSamples[i][c]);
                    calculatedSampleChannel /= Math.min(this.savedSamples.length, this.thresholdParameters[c]);
                } else if (this.thresholdTypes[c] === "max") {
                    for (let i = this.savedSamples.length - 1; i >= Math.max(0, this.savedSamples.length - this.thresholdParameters[c]); i--) calculatedSampleChannel = Math.max(calculatedSampleChannel, Math.abs(this.savedSamples[i][c]));
                } else if (this.thresholdTypes[c] === "last") {
                    calculatedSampleChannel += Math.abs(this.savedSamples[this.savedSamples.length - 1][c]);
                }
                calculatedSample.push(calculatedSampleChannel.toFixed(8));
            }
            this.onSample(calculatedSample);
        }
        // setTimeout(this.emitSamples.bind(this), 50);
    }

    tryConnectBoard() {
        if (this.ourBoard != null && this.ourBoard.isConnected()) this.ourBoard.disconnect().then(this.tryConnectBoard2.bind(this));
        else this.tryConnectBoard2();
    }

    tryConnectBoard2() {
        this.savedSamples = [];
        this.ourBoard = new Cyton({});
        this.ourBoard.listPorts().then(ports => {
            // console.log(ports);
            this.portNum = null;
            for (let i = 0; i < ports.length; i++) if (ports[i].productId === '6015') {
                this.portNum = i;
                console.log('I think the board is on port ' + i);
            }
            if (this.portNum == null && this.allowSim) for (let i = 0; i < ports.length; i++) if (ports[i].comName === 'OpenBCISimulator') {
                this.portNum = i;
                console.log('Using simulator on port ' + i);
            }
            if (this.portNum != null) this.attemptConnect(ports, () => {
                console.log('Connected!');


                this.ourBoard.streamStart();
                // setTimeout(function () {console.log(this.ourBoard.isStreaming())}.bind(this), 1000);
                this.count = 0;
                this.startCountTime = Date.now();
                this.ourBoard.on('sample', (sample) => {
                    this.lastSampleTime = Date.now();
                    // console.log(Date.now());
                    /** Work with sample */
                    this.count++;
                    if (Date.now() - this.startCountTime > 1000) {
                        // console.log(this.count);
                        this.count = 0;
                        this.startCountTime = Date.now();
                    }
                    this.mySample = [];
                    for (let i = 0; i < this.ourBoard.numberOfChannels(); i++) {
                        this.mySample.push(sample.channelData[i]);
                        // console.log("Channel " + (i + 1) + ": " + sample.channelData[i].toFixed(8) + " Volts.");
                        // prints to the console
                        //  "Channel 1: 0.00001987 Volts."
                        //  "Channel 2: 0.00002255 Volts."
                        //  ...
                        //  "Channel 8: -0.00001875 Volts."
                    }
                    this.savedSamples.push(this.mySample);
                    if (Date.now() - this.lastEmitted > 20) this.emitSamples();
                });
            });
            else {
                console.log('No device found.');
                this.onConnectionStatusChange(0);
            }
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
                // if (this.portNum + 1 < ports.length) {
                //     this.portNum++;
                //     console.log('Attempting next port... ' + ports[this.portNum].comName);
                //     this.timeout = this.portNum;
                //     setTimeout(this.checkTimeout.bind(this), 10000, this.portNum, function () {
                //         console.log('Timeout on port ' + ports[this.portNum].comName);
                //         this.portNum++;
                //         this.attemptConnect(ports, onsuccess);
                //     }.bind(this));
                //     setTimeout(this.attemptConnect.bind(this), 1000, ports, onsuccess);
                // }
                // else {
                    console.log('No device found.');
                    this.onConnectionStatusChange(0);
                // }
            });
    }

    checkTimeout(badValue, onBadTimeout) {
        if (this.timeout === badValue) onBadTimeout();
    }

    onAllowSim(allowSim) {
        this.allowSim = allowSim;
    }

    checkConnection() {
        if (Date.now() - this.lastSampleTime > 3000) {
            console.log('No data is coming! Attempting to reconnect...');
            this.tryConnectBoard();
            setTimeout(this.checkConnection.bind(this), 5000);
        } else setTimeout(this.checkConnection.bind(this), 500);
    }

    setThresholdTypes(thresholdTypes, thresholdParameters) {
        this.thresholdTypes = thresholdTypes;
        this.thresholdParameters = thresholdParameters;
    }
}

module.exports = MyCyton;