// --------------------------------------- Cyton stuff ---------------------------------------

const Cyton = require('@openbci/cyton'); // requires node <= v9
const Ganglion = require('@openbci/ganglion'); // requires node <= v9
const WifiCyton = require('@openbci/wifi'); // requires node <= v9
const OpenBCIUtilities = require('@openbci/utilities'); // requires node <= v9
const k = OpenBCIUtilities.constants;

class MyCyton {
    constructor(onConnectionStatusChange, onSample) {
        // do this when the connection status (connected vs connecting vs not connected) changes
        this.onConnectionStatusChange = onConnectionStatusChange;
        // do this when a sample is received; collates samples into groups and averages them first
        this.onSample = onSample;

        // internal, keeps track of the last sample time so that if no data is received the program can
        // try to reconnect. Obsolete?
        this.timeout = null;
        // for Cyton bluetooth boards, keeps track of the COM port of the current connection
        this.portNum = null;

        // array where sampled are collected so that a number of them can be averaged
        // could do with being a ring buffer to save on time complexity
        this.savedSamples = [];
        // determined by the user, the number of samples from savedSamples that will be averaged to generate
        // the value used by the key press portion of the program
        this.samplesPerAverage = 500;
        // we want to make sure we aren't sending an "average of 1" of every single sample, overloading the
        // front end, so we wait until it has been a certain (small) amount of time from this saved epoch to send new data
        this.lastEmitted = 0;
        // internal, keeps track of the last sample time so that if no data is received the program can
        // try to reconnect
        this.lastSampleTime = 0;

        // controlled by user, monitored by all infinite loops so that program can exit as cleanly as possible
        this.notTerminated = true;

        // controlled by user; in the absence of the specified board type, should the program use simulated data?
        this.allowSim = false;
        // the user's desired board type
        this.boardType = "Cyton";
        // if a wifi board, the name of the user's board (required for connection)
        this.boardName = "OpenBCI-6D58"
        // the thresholds, as determined by the user
        this.thresholdTypes = null;
        this.thresholdParameters = null;

        // start checking for lack of data from the board - will trigger the first attempt to connect
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
            for (let c = 0; c < 8; c++) {
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
        if (this.notTerminated) {
            if (this.ourBoard != null && this.ourBoard.isConnected()) this.ourBoard.disconnect().then(this.tryConnectBoard2.bind(this));
            else this.tryConnectBoard2();
        }
    }

    disconnectBoard() {
        if (this.ourBoard != null && this.ourBoard.isConnected()) this.ourBoard.disconnect().then(() => {
            this.onConnectionStatusChange(0);
            if (!this.notTerminated) {
                this.ourBoard = null;
            }
        });
        else this.onConnectionStatusChange(0);
    }

    terminate() {
        this.notTerminated = false;
        this.disconnectBoard();
        setTimeout(process.exit, 5000);
    }

    tryConnectBoard2() {

        const onSample = (sample) => {
            // console.log('is this happening?' + Date.now());

            // console.log(Date.now());
            /** Work with sample */
            this.count++;
            if (Date.now() - this.startCountTime > 1000) {
                // console.log(this.count);
                this.count = 0;
                this.startCountTime = Date.now();
            }
            this.mySample = [];
            // if (this.ourBoard !== null && this.ourBoard !== undefined) {
                let numChannels = 8;
                if (this.boardType === "Ganglion") numChannels = this.ourBoard.numberOfChannels();
                for (let i = 0; i < numChannels; i++) {
                    if (sample.channelData[i] !== 0) this.lastSampleTime = Date.now();
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
            // }
        }

        this.savedSamples = [];
        switch (this.boardType) {
            case "Cyton":
                this.ourBoard = new Cyton({});
                break;
            case "WifiCyton":
                this.ourBoard = new WifiCyton({debug: false, verbose: true, latency: 10000});
                break;
            case "Ganglion":
                this.ourBoard = new Ganglion();
                break;
        }
        if (this.boardType === "Cyton") this.ourBoard.listPorts().then(ports => {
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
                this.ourBoard.on('sample', onSample.bind(this));
            });
            else {
                console.log('No device found.');
                this.onConnectionStatusChange(0);
            }
        });
        else if (this.boardType === "WifiCyton") {
            this.onConnectionStatusChange(1);
            console.log('Attempting wifi connect...');
            this.lastSampleTime = Date.now();
            this.ourBoard.on(k.OBCIEmitterSample, onSample.bind(this));

            this.ourBoard.searchToStream({
                sampleRate: 1000, // Custom sample rate
                shieldName: this.boardName, // Enter the unique name for your wifi shield
                streamStart: true // Call to start streaming in this function
            }).catch((result) => {
                this.onConnectionStatusChange(0);
                console.log(result);
                console.log('caught');
            }).then(() => {
                if (this.ourBoard.isConnected()) {
                    this.onConnectionStatusChange(2);
                    this.count = 0;
                    this.startCountTime = Date.now();

                    console.log('Connected!');
                }
            });
        }
        else if (this.boardType === "Ganglion") {
            this.onConnectionStatusChange(1);
            console.log('Attempting Ganglion connect');
            this.lastSampleTime = Date.now();

            this.ourBoard.once("ganglionFound", peripheral => {
                this.onConnectionStatusChange(2);
                this.count = 0;
                this.startCountTime = Date.now();
                console.log('Connected!');

                // Stop searching for BLE devices once a ganglion is found.
                this.ourBoard.searchStop();
                this.ourBoard.on("sample", onSample.bind(this));
                this.ourBoard.once("ready", () => {
                    this.ourBoard.streamStart();
                });
                this.ourBoard.connect(peripheral);
            });
            // Start scanning for BLE devices
            this.ourBoard.searchStart().then(() => {
                if (!this.ourBoard.isConnected()) {
                    this.onConnectionStatusChange(0);
                }
            }).catch((result) => {
                this.onConnectionStatusChange(0);
                console.log(result);
                console.log('caught');
            });
        }
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
        if (Date.now() - this.lastSampleTime > (this.boardType === 'WifiCyton' ? 13000 : 3000)) {
            console.log('No data is coming! Attempting to reconnect ' + this.boardType + '...');
            this.tryConnectBoard();
            // else console.log('This board type doesn\'t allow automatic reconnection!');
            if (this.notTerminated) setTimeout(this.checkConnection.bind(this), 5000);
        } else if (this.notTerminated) setTimeout(this.checkConnection.bind(this), 500);
    }

    setThresholdTypes(thresholdTypes, thresholdParameters, boardType, boardName) {
        this.thresholdTypes = thresholdTypes;
        this.thresholdParameters = thresholdParameters;
        this.boardType = boardType;
        this.boardName = boardName;
    }
}

module.exports = MyCyton;