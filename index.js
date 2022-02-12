const robot = require("robotjs");

// store information about what thresholds/actions the user selected
let thresholds = null;
let actions = null;
let actionTypes = null;
let thresholdTypes = null;
let thresholdParameters = null;

// variable to hold the MyCyton board class instance
let myCyton = null;

// create webserver
const MyWebServers = require("./mywebserver");
const myWebServer = new MyWebServers(
    (newThresholds, newActions, newActionTypes,
     newThresholdTypes, newThresholdParameters, boardType, boardName) => {
        // anonymous function to take user inputs and save them in global variables
        thresholds = newThresholds;
        actions = newActions;
        actionTypes = newActionTypes;
        thresholdTypes = newThresholdTypes;
        thresholdParameters = newThresholdParameters;
        // send thresholds to MyCyton so that it can do the calculations on the live samples
        myCyton.setThresholdTypes(thresholdTypes, thresholdParameters, boardType, boardName);
    }, () => {
        // when the user clicks 'reconnect', MyCyton should try to reconnect, i.e. disconnect and attempt to connect again
        myCyton.tryConnectBoard();
    }, () => {
        // when the user clicks 'disconnect', MyCyton should disconnect
        myCyton.disconnectBoard();
    }, () => {
        // when the user clicks 'terminate', MyCyton will terminate first, followed by the web server
        // to make sure that the physical board isn't left half-connected which could cause issues
        myCyton.terminate();
    }, allowSim => {
        // if user says simulated data is OK, then MyCyton should be notified
        myCyton.onAllowSim(allowSim);
    });

// the last known state (up or down/active or not active/above or below threshold) for each channel
let wDown = [];

const MyCyton = require("./mycyton");
myCyton = new MyCyton(status => {
    // when the connection status of the board changes, the user should be notified
    myWebServer.connectionStatusUpdate(status);
}, sample => {
    // function to calculate the key presses for each channel
    if (thresholds != null) for (let channel = 0; channel < sample.length; channel++) {
        if (sample[channel] > thresholds[channel]) {
            if (wDown[channel] === undefined || !wDown[channel]) {
                // if the key wasn't already pressed down
                if (actionTypes[channel] === 'toggle') robot.keyToggle(actions[channel], "down");
                else if (actionTypes[channel] === 'tap') robot.keyTap(actions[channel]);
                wDown[channel] = true;
            }
            if (actionTypes[channel] === 'feather') {
                if (Date.now() % 500 > 250) robot.keyToggle(actions[channel], "down");
                else robot.keyToggle(actions[channel], "up");
            }
        } else if (sample[channel] < thresholds[channel] && wDown[channel]) {
            if (actionTypes[channel] === 'toggle') robot.keyToggle(actions[channel], "up");
            wDown[channel] = false;
        }
    }
    myWebServer.onSample(sample);
});