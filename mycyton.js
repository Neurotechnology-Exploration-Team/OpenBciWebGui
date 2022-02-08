// --------------------------------------- Cyton stuff ---------------------------------------

const Cyton = require('@openbci/cyton'); // requires node <= v9
const Ganglion = require('@openbci/ganglion'); // requires node <= v9
const WifiCyton = require('@openbci/wifi'); // requires node <= v9
const OpenBCIUtilities = require('@openbci/utilities'); // requires node <= v9
const k = OpenBCIUtilities.constants;

class MyCyton {
    /**
     * Function: constructor
     * ---------------------
     * Create a new MyCyton class given the below event functions; attempt connection with default settings
     *
     * @param onConnectionStatusChange  called when the connection status (connected vs connecting vs not connected) changes
     * @param onSample                  called after a sample is received; collates simple samples into groups and averages them first
     */
    constructor(onConnectionStatusChange, onSample) {
        // do this when the connection status (connected vs connecting vs not connected) changes
        this.onConnectionStatusChange = onConnectionStatusChange;
        // do this when a sample is received; collates simple samples into groups and averages them first
        this.onSample = onSample;

        // for Cyton bluetooth boards, keeps track of the COM port of the current connection
        this.portNum = null;

        // array where simple samples are collected so that a number of them can be averaged
        // could do with being a ring buffer to save on time complexity
        this.savedSamples = [];
        // determined by the user, the number of simple samples from savedSamples that will be averaged to generate
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

    /**
     * Function: emitSamples
     * ---------------------
     * Use the large number of recent simple samples received from the board to generate an average based on user
     * settings for each channel, then send these averages to the webserver.
     *
     * this.thresholdParameters contains the variable ("n") number of simple samples used to calculate the average
     * types below.
     *
     * Average types:
     * "average": take the absolute mean of the last n simple samples
     * "max": take the absolute maximum value of the last n simple samples
     * "last": take the most recent simple sample
     */
    emitSamples() {
        // remember when this was called so that we don't send data too often overloading the front end
        this.lastEmitted = Date.now();

        // if the thresholds have not been explicitly set by the user, initialize some defaults
        if (this.thresholdTypes == null) {
            this.thresholdTypes = [];
            this.thresholdParameters = [];
            for (let i = 0; i < this.savedSamples[0].length; i++) {
                // these are the same values that are the defaults in the front-end GUI,
                // but they are not explicitly synchronized when the program starts
                this.thresholdTypes.push("average");
                this.thresholdParameters.push(500);
            }
        }

        // we only want to keep a (constant) finite number of simple samples so that we don't run out of memory
        if (this.savedSamples.length > this.samplesPerAverage) this.savedSamples = this.savedSamples.slice(this.savedSamples.length - this.samplesPerAverage);

        let calculatedSample = [];
        for (let c = 0; c < 8; c++) {
            let calculatedSampleChannel = 0;
            if (this.thresholdTypes[c] === "average") {
                // "average": take the absolute mean of the last n simple samples
                for (let i = this.savedSamples.length - 1; i >= Math.max(0, this.savedSamples.length - this.thresholdParameters[c]); i--) calculatedSampleChannel += Math.abs(this.savedSamples[i][c]);
                calculatedSampleChannel /= Math.min(this.savedSamples.length, this.thresholdParameters[c]);
            } else if (this.thresholdTypes[c] === "max") {
                // "max": take the absolute maximum value of the last n simple samples
                for (let i = this.savedSamples.length - 1; i >= Math.max(0, this.savedSamples.length - this.thresholdParameters[c]); i--) calculatedSampleChannel = Math.max(calculatedSampleChannel, Math.abs(this.savedSamples[i][c]));
            } else if (this.thresholdTypes[c] === "last") {
                // "last": take the most recent simple sample
                calculatedSampleChannel += Math.abs(this.savedSamples[this.savedSamples.length - 1][c]);
            }
            calculatedSample.push(calculatedSampleChannel.toFixed(8));
        }
        
        // send samples to the web server
        this.onSample(calculatedSample);
    }

    /**
     * Function: disconnectBoard
     * -------------------------
     * Explicitly ensure that the program has no active connection with an external board
     */
    disconnectBoard() {
        // if the board is defined and connected, then call library function to disconnect it
        if (this.ourBoard != null && this.ourBoard.isConnected()) this.ourBoard.disconnect().then(() => {
            // set the GUI indicator to 'not connected'
            this.onConnectionStatusChange(0);
            // if the user isn't trying to end the program
            if (!this.notTerminated) {
                this.ourBoard = null;
            }
        });
        else this.onConnectionStatusChange(0);
    }

    /**
     * Function: terminate
     * -------------------
     * Explicitly terminate this class instance
     */
    terminate() {
        // don't try to reconnect the board
        this.notTerminated = false;
        this.disconnectBoard();
        // as of now, the program doesn't always exit on its own - usually 5 seconds is safe enough, but
        // the cause for the lack of termination should be determined
        setTimeout(process.exit, 5000);
    }

    /**
     * Function: tryConnectBoard
     * -------------------------
     * Attempt to connect the board according to the current settings
     */
    tryConnectBoard() {
        // if the user isn't trying to end the program
        if (this.notTerminated) {
            // make sure board is disconnected before replacing the object, otherwise causes hardware errors
            if (this.ourBoard != null && this.ourBoard.isConnected()) this.ourBoard.disconnect().then(this.tryConnectBoard2.bind(this));
            else this.tryConnectBoard2();
        }
    }

    /**
     * Function: tryConnectBoard2
     * --------------------------
     * Private helper function - attempt to connect the board according to the current settings
     */
    tryConnectBoard2() {

        // define the onSample function that will be called when the board generates a simple sample
        // this is the same for all board types (at least so far)
        const onSample = (sample) => {
            // uncomment below to see if samples are coming/board is connected properly
            // console.log(Date.now());
            /** Work with sample */
            if (Date.now() - this.startCountTime > 1000) {
                this.startCountTime = Date.now();
            }
            // we are only going to collect the values we care about into this list - the board may also supply
            // other values such as accelerometer data; parsing these helps lighten the size of the arrays
            this.mySample = [];
            // board will always be defined, because the board calls this function
            // if (this.ourBoard !== null && this.ourBoard !== undefined) {
                // determine the number of channels depending on the device we are using
                let numChannels = 8;
                if (this.boardType === "Ganglion") numChannels = this.ourBoard.numberOfChannels();
                // for each channel
                for (let i = 0; i < numChannels; i++) {
                    // if nonzero, then remember that connectivity is good
                    if (sample.channelData[i] !== 0) this.lastSampleTime = Date.now();
                    this.mySample.push(sample.channelData[i]);
                    // console.log("Channel " + (i + 1) + ": " + sample.channelData[i].toFixed(8) + " Volts.");
                    // prints to the console
                    //  "Channel 1: 0.00001987 Volts."
                    //  "Channel 2: 0.00002255 Volts."
                    //  ...
                    //  "Channel 8: -0.00001875 Volts."
                }
                // add the simple sample to the class array
                this.savedSamples.push(this.mySample);
                // emit samples if we didn't JUST do so; data comes in batches of large numbers of simple samples,
                // so onSample is called many times in succession, so we should introduce delay between evaluating
                // averages
                if (Date.now() - this.lastEmitted > 20) this.emitSamples();
            // }
        }

        // we are reconnecting the board - erase samples from previous connections
        this.savedSamples = [];
        // create the ourBoard object depending on which board the user wants to use
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
        // initialize the board in different ways depending on which board the user wants to use
        if (this.boardType === "Cyton") this.ourBoard.listPorts().then(ports => {
            // console.log(ports);
            this.portNum = null;
            // look for cyton product id 6015 in the COM port description; this guess has always been correct,
            // though I would love for it to be changeable from the GUI
            for (let i = 0; i < ports.length; i++) if (ports[i].productId === '6015') {
                this.portNum = i;
                console.log('I think the board is on port ' + i);
            }
            // if we can't find an appropriate port, but the user has allowed the simulator, use the sim
            if (this.portNum == null && this.allowSim) for (let i = 0; i < ports.length; i++) if (ports[i].comName === 'OpenBCISimulator') {
                this.portNum = i;
                console.log('Using simulator on port ' + i);
            }
            // if a suitable device has been found, attempt connection via library function
            if (this.portNum != null) this.attemptConnect(ports, () => {
                // on success
                console.log('Connected!');

                // I believe this is the equivalent of 'start data stream' in the OpenBCI GUI
                this.ourBoard.streamStart();
                // setTimeout(function () {console.log(this.ourBoard.isStreaming())}.bind(this), 1000);
                this.startCountTime = Date.now();
                this.ourBoard.on('sample', onSample.bind(this));
            });
            else {
                // if no suitable device was found
                console.log('No device found.');
                this.onConnectionStatusChange(0);
            }
        });
        else if (this.boardType === "WifiCyton") {
            this.onConnectionStatusChange(1);
            console.log('Attempting wifi connect...');
            this.lastSampleTime = Date.now();
            this.ourBoard.on(k.OBCIEmitterSample, onSample.bind(this));

            // the library function will do most of the searching for us
            this.ourBoard.searchToStream({
                sampleRate: 1000, // Custom sample rate
                shieldName: this.boardName, // Enter the unique name for your wifi shield
                streamStart: true // Call to start streaming in this function
            }).catch((result) => {
                this.onConnectionStatusChange(0);
                console.log(result);
                // this 'caught' is rare
                console.log('caught');
            }).then(() => {
                // on success (usually)
                if (this.ourBoard.isConnected()) {
                    this.onConnectionStatusChange(2);
                    this.startCountTime = Date.now();

                    console.log('Connected!');
                }
            });
        }
        else if (this.boardType === "Ganglion") {
            this.onConnectionStatusChange(1);
            console.log('Attempting Ganglion connect');
            this.lastSampleTime = Date.now();

            // the ganglion board starts searching when it is initialized - this event will be called
            // if it finds a board... which has never happened because I can't get my computer to
            // recognize the ganglion dongle
            this.ourBoard.once("ganglionFound", peripheral => {
                this.onConnectionStatusChange(2);
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

    /**
     * Function: attemptConnect
     * ------------------------
     * Attempt to connect to a Cyton bluetooth board
     *
     * @param ports      a list of COM ports
     * @param onsuccess  a function to execute if successfully connects
     */
    attemptConnect(ports, onsuccess) {
        this.onConnectionStatusChange(1);
        this.ourBoard = new Cyton({});
        this.ourBoard.connect(ports[this.portNum].comName) // Port name is a serial port name, see `.listPorts()`
            .then(() => {
                this.onConnectionStatusChange(2);
                onsuccess();
            })
            .catch(err => {
                console.log('Caught error connecting: ' + err + '; this usually means there is no device on this port.');

                console.log('No device found.');
                this.onConnectionStatusChange(0);
            });
    }

    // called when the user clicks or unclicks the 'allow simulator' checkbox in the GUI
    onAllowSim(allowSim) {
        this.allowSim = allowSim;
    }

    /**
     * Function: checkConnection
     * -------------------------
     * Use the time since the last nonzero sample to determine if we should try to reconnect to the board
     */
    checkConnection() {
        // if it has been too long
        if (Date.now() - this.lastSampleTime > (this.boardType === 'WifiCyton' ? 13000 : 3000)) {
            console.log('No data is coming! Attempting to reconnect ' + this.boardType + '...');
            // try to reconnect
            this.tryConnectBoard();
            // check again after giving some time to try reconnecting
            if (this.notTerminated) setTimeout(this.checkConnection.bind(this), 5000);
        } else if (this.notTerminated) setTimeout(this.checkConnection.bind(this), 500);
    }

    /**
     * Function: setThresholdTypes
     * ---------------------------
     * Set the types and parameters of thresholds, and the type and name for boards
     * @param thresholdTypes       'average', 'max', or 'last' for each channel
     * @param thresholdParameters  a number for each channel representing the number of simple samples that should be used to calculate the average
     * @param boardType            'Cyton' or 'WifiCyton'
     * @param boardName            If wifi board, the name of the wifi board - something like 'OpenBCI-1234'
     */
    setThresholdTypes(thresholdTypes, thresholdParameters, boardType, boardName) {
        this.thresholdTypes = thresholdTypes;
        this.thresholdParameters = thresholdParameters;
        this.boardType = boardType;
        this.boardName = boardName;
    }
}

module.exports = MyCyton;