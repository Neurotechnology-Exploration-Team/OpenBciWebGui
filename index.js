const robot = require("robotjs");

let threshold = null;

const MyWebServers = require("./mywebserver");
const myWebServer = new MyWebServers(newThreshold => {
    threshold = newThreshold;
});

let wDown = false;

const MyCyton = require("./mycyton");
const myCyton = new MyCyton(status => {
    myWebServer.connectionStatusUpdate(status);
}, sample => {
    if (sample[0] > threshold && !wDown) {
        robot.keyToggle("a", "down");
        wDown = true;
    }
    else if (wDown) {
        robot.keyToggle("a", "up");
        wDown = false;
    }
    myWebServer.onSample(sample);
});