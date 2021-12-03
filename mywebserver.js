// ------------------------- Web Servers ----------------------------


const WebSocketServer = require("ws").WebSocketServer;
const express = require("express");

class MyWebServers {
    constructor() {

        this.currentStatus = {
            "indicators": {
                deviceConnectionStatus: {
                    status: 0
                }
            }
        }

        // http

        this.wss = new WebSocketServer({ port: 8080 });
        this.ws = null;

        this.wss.on('connection', function connection(ws) {
            console.log('socket connected');
            this.ws = ws;
            this.ws.send(JSON.stringify(this.currentStatus));
            this.ws.on('message', function incoming(message) {

            });
        }.bind(this));

        // express

        this.app = express()
        this.port = 3000

        this.app.use(express.static('public'));

        this.app.listen(this.port, () => {
            console.log(`Example app listening at http://localhost:${this.port}`)
        });
    }

    connectionStatusUpdate(status) {
        if (this.ws == null) setTimeout(this.connectionStatusUpdate.bind(this), 100, status);
        else {
            this.currentStatus["indicators"].deviceConnectionStatus.status = status;
            this.ws.send(JSON.stringify(this.currentStatus));
        }
    }
}

module.exports = MyWebServers;