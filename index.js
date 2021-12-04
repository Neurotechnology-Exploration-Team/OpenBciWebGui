const robot = require("robotjs");

let thresholds = null;
let actions = null;
let actionTypes = null;
let thresholdTypes = null;
let thresholdParameters = null;

let myCyton = null;

const MyWebServers = require("./mywebserver");
const myWebServer = new MyWebServers((newThresholds, newActions, newActionTypes, newThresholdTypes, newThresholdParameters) => {
    thresholds = newThresholds;
    actions = newActions;
    actionTypes = newActionTypes;
    thresholdTypes = newThresholdTypes;
    thresholdParameters = newThresholdParameters;
    myCyton.setThresholdTypes(thresholdTypes, thresholdParameters);
}, () => {
    myCyton.tryConnectBoard();
}, allowSim => {
    myCyton.onAllowSim(allowSim);
});

let wDown = [];

const MyCyton = require("./mycyton");
myCyton = new MyCyton(status => {
    myWebServer.connectionStatusUpdate(status);
}, sample => {
    if (thresholds != null) for (let channel = 0; channel < sample.length; channel++) {
        if (sample[channel] > thresholds[channel]) {
            if (wDown[channel] === undefined || !wDown[channel]) {
                if (actionTypes[channel] === 'toggle') robot.keyToggle(actions[channel], "down");
                else if (actionTypes[channel] === 'tap') robot.keyTap(actions[channel]);
                wDown[channel] = true;
            }
            if (actionTypes[channel] === 'feather') {
                if (Date.now() % 500 > 250) robot.keyToggle(actions[channel], "down");
                else robot.keyToggle(actions[channel], "up");
            }
        }
        else if (sample[channel] < thresholds[channel] && wDown[channel]) {
            if (actionTypes[channel] === 'toggle') robot.keyToggle(actions[channel], "up");
            wDown[channel] = false;
        }
    }
    myWebServer.onSample(sample);
});