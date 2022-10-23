let socket = null;
let serverData = null;

function setup() {
    $("#navbar").load("/navbar.html");
    getConnStatusRepeat(true);
    attemptSocketConnect();
}

function getChannels(callback) {
    // getServerData((data) => {
    //     callback(data.channels);
    // })
    const ret = [];
    for (let i = 0; i < 8; i++) {
        ret.push({
            id: i,
            average: Math.random(),
            threshold: 0.4,
            threshold_type: 'average',
            threshold_type_parameter: 500,
            limit: 0.8,
            action: 'A',
            action_type: 'tap'
        })
    }
    callback(ret);
}

function getWs(callback) {
    callback(socket);
}

function getServerData(callback) {
    callback(serverData);
}

function setIndicator(status) {
    if (!status) return;
    let cl = status;
    let txt = '';
    switch (status) {
        case "success":
            txt = 'Connected'
            break
        case "warning":
            txt = 'Connecting...'
            break
        case "danger":
            txt = 'Disconnected'
            break
    }
    const badge = $("#connectionBadge");
    badge.removeClass('bg-warning bg-danger bg-success');
    badge.addClass('bg-' + cl);
    badge.text(txt);
}

function getConnStatusRepeat(repeat) {
    getConnStatus(setIndicator);
    if (repeat) setTimeout(getConnStatusRepeat, 500, repeat);
}

function getConnStatus(callback) {
    // if (!serverData) callback(null);
    // else setTimeout(callback, 200, serverData.connectionStatus);
    setTimeout(callback, 200, 'danger');
}

function procWsMsg(msg) {
    // if (data['indicators'] != null) {
    //     indicators.deviceConnectionStatus.status = data['indicators'].deviceConnectionStatus.status
    //     if (indicators.deviceConnectionStatus.status === 0) {
    //         $(".channelRow").remove();
    //         numChannels = null;
    //     }
    //     updateIndicators(false);
    // }
    // if (indicators.deviceConnectionStatus.status !== 0 && data['sample'] != null) {
    //     console.log(data);
    //     if (numChannels == null) {
    //         numChannels = data['sample'].length;
    //         for (let i = 0; i < numChannels; i++) {
    //             graphLimits[i] = 0.0001;
    //             thresholds[i] = 0;
    //             actions[i] = "a";
    //             actionTypes[i] = "tap";
    //             thresholdTypes[i] = "average";
    //             thresholdParameters[i] = 500;
    //             buildChannelRow(i);
    //             $("#channel"+i+" .slider").click(clickSlider);
    //         }
    //     }
    //     // let s = "<table id=\"sampleTable\">\n" +
    //     //     "    <tr><th>Channel</th><th>Value</th><th>Pressed?</th><th>Threshold</th></tr>\n";
    //     for (let i = 0; i < data['sample'].length; i++) {
    //         // s += "<tr><td>" + i + "</td><td class='channel_value'>" + data['sample'][i] + "</td><td><div class='indicatorLight' id='indicatorLightChannel"+i+"' style='background-color: "+(data['sample'][i] > parseFloat($("#thresholdChooser").val()) ? "green" : "red")+"'></div></td><td><input type='number' value='" + $("#thresholdChooser").val() + "'></td></tr>"
    //         $("#channel" + i + " .sliderGraph").css("width", ((data['sample'][i]/graphLimits[i])*sliderSize) + "px");
    //         $("#channel" + i + " .advancedData .avg").text(thresholdTypes[i] + " of " + thresholdParameters[i] + ": " + data['sample'][i]);
    //     }
    //     // s += "</table>";
    //     // $("#sampleTable").remove();
    //     // $("body").append(s);
    // }
}

function attemptSocketConnect() {
    socket = new WebSocket("ws://localhost:8080");

    socket.onopen = function() {
        console.log("[open] Connection established");
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        // console.log(data);
        procWsMsg(data);

        socket.send(JSON.stringify({
            // thresholds: thresholds,
            // actions: actions,
            // actionTypes: actionTypes,
            // thresholdTypes: thresholdTypes,
            // thresholdParameters: thresholdParameters,
            // boardType: boardType,
            // boardName: boardName
        }));
    };

    socket.onclose = function(event) {
        if (event.wasClean) {
            console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
            //window.location.reload();
        } else {
            // e.g. server process killed or network down
            // event.code is usually 1006 in this case
            console.log('[close] Connection died');
            setTimeout(attemptSocketConnect, 50);
        }
    };

    socket.onerror = function(error) {
        console.log(`[error] ${error.message}`);
        setTimeout(attemptSocketConnect, 50);
    };
}