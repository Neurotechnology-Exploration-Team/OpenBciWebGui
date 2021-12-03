// ------------------------- Web Servers ----------------------------


const WebSocketServer = require("ws").WebSocketServer;
const express = require("express");

class MyWebServers {
    constructor() {

        // http

        this.wss = new WebSocketServer({ port: 8080 });

        this.wss.on('connection', function connection(ws) {
            console.log('connected');
            ws.on('message', function incoming(message) {

            });
        });

        // express

        this.app = express()
        this.port = 3000

        this.app.use(express.static('public'));

        this.app.listen(this.port, () => {
            console.log(`Example app listening at http://localhost:${this.port}`)
        });
    }
}

module.exports = MyWebServers;