const robot = require("robotjs");

const MyWebServers = require("./mywebserver");
const myWebServer = new MyWebServers();

const MyCyton = require("./mycyton");
const myCyton = new MyCyton(status => {
    myWebServer.connectionStatusUpdate(status);
}, sample => {
    myWebServer.onSample(sample);
});