const robot = require("robotjs");

let thresholds = null;
let actions = null;

const MyWebServers = require("./mywebserver");
const myWebServer = new MyWebServers((newThresholds, newActions) => {
    thresholds = newThresholds;
    actions = newActions;
});

let wDown = [];

const MyCyton = require("./mycyton");
const myCyton = new MyCyton(status => {
    myWebServer.connectionStatusUpdate(status);
}, sample => {
    if (thresholds != null) for (let channel = 0; channel < sample.length; channel++) {
        if (sample[channel] > thresholds[channel] && (wDown[channel] === undefined || !wDown[channel])) {
            robot.keyToggle(actions[channel], "down");
            wDown[channel] = true;
        }
        else if (sample[channel] < thresholds[channel] && wDown[channel]) {
            robot.keyToggle(actions[channel], "up");
            wDown[channel] = false;
        }
    }
    myWebServer.onSample(sample);
});