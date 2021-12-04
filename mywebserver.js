// ------------------------- Web Servers ----------------------------


const WebSocketServer = require("ws").WebSocketServer;
const express = require("express");

class MyWebServers {
    constructor(onThresholdChange) {

        this.onThresholdChange = onThresholdChange;

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
            this.refreshClient(true);
            this.ws.on('message', function incoming(message) {
                try {
                    const data = JSON.parse(message);
                    this.onThresholdChange(data['thresholds'], data['actions']);
                } catch (e) {
                    console.log('bad message: ' + message);
                }
            }.bind(this));
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

    onSample(sample) {
        this.currentStatus['sample'] = sample;
    }

    refreshClient(repeat) {
        if (this.ws != null) this.ws.send(JSON.stringify(this.currentStatus));
        if (repeat) setTimeout(this.refreshClient.bind(this), 50, repeat);
    }
}

module.exports = MyWebServers;