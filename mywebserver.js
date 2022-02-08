// ------------------------- Web Servers ----------------------------
const open = require('open');

const WebSocketServer = require("ws").WebSocketServer;
const express = require("express");

class MyWebServers {
    /**
     * Function: constructor
     * ---------------------
     * Create a new MyWebServers object given event functions, and start web server
     *
     * @param onThresholdChange  Called when the user changed the thresholds
     * @param onReconnect        Called when the user intends to reconnect the board
     * @param onDisconnect       Called when the user intends to disconnect the board
     * @param onTerminate        Called when the user intends to exit the program
     * @param onAllowSim         Called when the user wishes to allow/disallow simulated data
     */
    constructor(onThresholdChange, onReconnect, onDisconnect, onTerminate, onAllowSim) {

        // set external event functions
        this.onThresholdChange = onThresholdChange;
        this.onReconnect = onReconnect;
        this.onDisconnect = onDisconnect;
        this.onTerminate = onTerminate;
        this.onAllowSim = onAllowSim;

        // stores the connectivity status of the cyton board
        this.currentStatus = {
            "indicators": {
                deviceConnectionStatus: {
                    status: 0
                }
            }
        }

        // create http server
        this.wss = new WebSocketServer({ port: 8080 });
        this.ws = null;

        // when the GUI tries to connect to the server
        this.wss.on('connection', function connection(ws) {
            // console.log('socket connected');
            // remember the websocket object so that it can be sent messages later
            this.ws = ws;
            // send the current status of the board
            this.ws.send(JSON.stringify(this.currentStatus));
            // when we receive a message from the client
            this.ws.on('message', function incoming(message) {
                try {
                    const data = JSON.parse(message);
                    // send events to other classes
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

        // express server to host HTML file
        this.app = express()
        this.port = 3000

        this.app.use(express.static('public'));

        this.expressServer = this.app.listen(this.port, () => {
            console.log(`Example app listening at http://localhost:${this.port}`);
            open(`http://localhost:${this.port}`);
        });
    }

    /**
     * Function: connectionStatusUpdate
     * --------------------------------
     * Send a new connection status to the client
     *
     * @param status  The new connection status
     */
    connectionStatusUpdate(status) {
        // wait until there is a valid client; WHY ARE WE DOING THIS???
        if (this.ws == null) setTimeout(this.connectionStatusUpdate.bind(this), 100, status);
        else {
            // update the indicator object and send to client
            this.currentStatus["indicators"].deviceConnectionStatus.status = status;
            this.ws.send(JSON.stringify(this.currentStatus));
        }
    }

    /**
     * Function: onSample
     * ------------------
     * Send a new sample (average, not simple) to the client
     *
     * @param sample  The sample to send to the client
     */
    onSample(sample) {
        this.currentStatus['sample'] = sample;
        // could this result in an error if no client is connected??
        this.ws.send(JSON.stringify(this.currentStatus));
    }
}

module.exports = MyWebServers;