// ------------------------- Web Servers ----------------------------
const open = require('open');

const WebSocketServer = require("ws").WebSocketServer;
const express = require("express");

class MyWebServers {
    constructor(onThresholdChange, onReconnect, onDisconnect, onTerminate, onAllowSim) {

        this.onThresholdChange = onThresholdChange;
        this.onReconnect = onReconnect;
        this.onDisconnect = onDisconnect;
        this.onTerminate = onTerminate;
        this.onAllowSim = onAllowSim;

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
            // console.log('socket connected');
            this.ws = ws;
            this.ws.send(JSON.stringify(this.currentStatus));
            this.refreshClient(true);
            this.ws.on('message', function incoming(message) {
                try {
                    const data = JSON.parse(message);
                    if (data['thresholds'] !== undefined) this.onThresholdChange(data['thresholds'], data['actions'], data['actionTypes'], data['thresholdTypes'], data['thresholdParameters'], data['boardType'], data['boardName']);
                    if (data['reconnect'] !== undefined) this.onReconnect();
                    if (data['disconnect'] !== undefined) this.onDisconnect();
                    if (data['terminate'] !== undefined) {
                        if (this.expressServer !== undefined && this.expressServer.close !== undefined) this.expressServer.close();
                        this.onTerminate();
                        console.log('terminating, please wait...');
                        this.wss.close();
                    }
                    if (data['allowSim'] !== undefined) this.onAllowSim(data['allowSim']);
                } catch (e) {
                    console.log('bad message: ' + message);
                }
            }.bind(this));
        }.bind(this));

        // express

        this.app = express()
        this.port = 3000

        this.app.use(express.static('public'));

        this.expressServer = this.app.listen(this.port, () => {
            console.log(`Example app listening at http://localhost:${this.port}`);
            open(`http://localhost:${this.port}`);

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
        this.ws.send(JSON.stringify(this.currentStatus));
    }

    refreshClient(repeat) {
        // if (this.ws != null)
        // if (repeat) setTimeout(this.refreshClient.bind(this), 50, repeat);
    }
}

module.exports = MyWebServers;