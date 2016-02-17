/**
 * Created by aborovsky on 27.08.2015.
 */

var util = require('util');
var DEBUG = false;
var connectionFSM = require('./lib/connectionFSM.js');

module.exports = function (RED) {

    /**
     * ====== Denon-controller ================
     * Holds configuration for denonjs host+port,
     * initializes new denonjs connections
     * =======================================
     */
    function DenonControllerNode(config) {
        RED.nodes.createNode(this, config);
        this.name = config.name;
        this.host = config.host;
        this.port = config.port;
        this.denon = null;
        var node = this;

        /**
         * Initialize an denonjs socket, calling the handler function
         * when successfully connected, passing it the denonjs connection
         */
        this.initializeDenonConnection = function (handler) {
            if (node.denon) {
                DEBUG && RED.comms.publish("debug", {
                    name: node.name,
                    msg: 'already configured connection to Denon player at ' + config.host + ':' + config.port
                });
                if (handler && (typeof handler === 'function')) {
                    if (node.denon.connection)
                        handler(node.denon);
                    else
                        node.denon.on('connected', function () {
                            handler(node.denon);
                        });
                }
                return node.denon;
            }
            node.log('configuring connection to Denon player at ' + config.host + ':' + config.port);
            node.denon = new connectionFSM({
                host: config.host,
                port: config.port,
                debug: DEBUG
            });
            if (handler && (typeof handler === 'function')) {
                node.denon.on('connected', function () {
                    handler(node.denon);
                });
            }
            node.denon.connect();
            DEBUG && RED.comms.publish("debug", {
                name: node.name,
                msg: 'Denon: successfully connected to ' + config.host + ':' + config.port
            });

            return node.denon;
        };
        this.on("close", function () {
            node.log('disconnecting from denonjs server at ' + config.host + ':' + config.port);
            node.denon && node.denon.disconnect && node.denon.disconnect();
            node.denon = null;
        });
    }

    RED.nodes.registerType("denon-controller", DenonControllerNode);

    /**
     * ====== Denon-out =======================
     * Sends outgoing Denon player from
     * messages received via node-red flows
     * =======================================
     */
    function DenonOut(config) {
        RED.nodes.createNode(this, config);
        this.name = config.name;
        var controllerNode = RED.nodes.getNode(config.controller);
        this.unit_number = config.unit_number;
        this.denoncommand = config.denoncommand;
        var node = this;
        //node.log('new Denon-out, config: ' + util.inspect(config));
        //
        this.on("input", function (msg) {
            DEBUG && RED.comms.publish("debug", {
                name: node.name,
                msg: 'denonout.onInput msg[' + util.inspect(msg) + ']'
            });
            //node.log('denonout.onInput msg[' + util.inspect(msg) + ']');
            if (!(msg && msg.hasOwnProperty('payload'))) return;
            var payload = msg.payload;
            if (typeof(msg.payload) === "object") {
                payload = msg.payload;
            } else if (typeof(msg.payload) === "string") {
                try {
                    payload = JSON.parse(msg.payload);
                    if (typeof (payload) === 'number')
                        payload = {cmd: msg.payload.toString()};
                } catch (e) {
                    payload = {cmd: msg.payload.toString()};
                }
            }
            if (payload == null) {
                node.log('denonout.onInput: illegal msg.payload!');
                return;
            }

            //If msg.topic is filled, than set it as cmd
            if (msg.topic) {
                if(payload.value===null || payload.value===undefined)
                    payload.value = payload.cmd;
                payload.cmd = msg.topic.toString();
            }

            if (node.denoncommand && node.denoncommand !== 'empty') {
                try {
                    payload = JSON.parse(node.denoncommand);
                    if (typeof (payload) === 'number')
                        payload.cmd = node.denoncommand.toString();
                } catch (e) {
                    payload.cmd = node.denoncommand.toString();
                }
            }

            node.send(payload, function (err) {
                if (err) {
                    node.error('send error: ' + err);
                }
                if (typeof(msg.cb) === 'function')
                    msg.cb(err);
            });

        });
        this.on("close", function () {
            node.log('denonOut.close');
        });

        node.status({fill: "yellow", shape: "dot", text: "inactive"});

        function nodeStatusConnected() {
            node.status({fill: "green", shape: "dot", text: "connected"});
        }

        function nodeStatusDisconnected() {
            node.status({fill: "red", shape: "dot", text: "disconnected"});
        }

        function nodeStatusReconnect() {
            node.status({fill: "yellow", shape: "ring", text: "reconnecting"});
        }

        function nodeStatusConnecting() {
            node.status({fill: "green", shape: "ring", text: "connecting"});
        }

        controllerNode.initializeDenonConnection(function (fsm) {
            if (fsm.connected)
                nodeStatusConnected();
            else
                nodeStatusDisconnected();
            fsm.off('connecting', nodeStatusConnecting);
            fsm.on('connecting', nodeStatusConnecting);
            fsm.off('connected', nodeStatusConnected);
            fsm.on('connected', nodeStatusConnected);
            fsm.off('disconnected', nodeStatusDisconnected);
            fsm.on('disconnected', nodeStatusDisconnected);
            fsm.off('reconnect', nodeStatusReconnect);
            fsm.on('reconnect', nodeStatusReconnect);
        });

        this.send = function (data, callback) {
            DEBUG && RED.comms.publish("debug", {name: node.name, msg: 'send data[' + JSON.stringify(data) + ']'});
            //node.log('send data[' + data + ']');
            // init a new one-off connection from the effectively singleton DenonController
            // there seems to be no way to reuse the outgoing conn in adreek/node-denonjs
            controllerNode.initializeDenonConnection(function (fsm) {
                try {
                    DEBUG && RED.comms.publish("debug", {name: node.name, msg: "send:  " + JSON.stringify(data)});
                    data.cmd = data.cmd || data.method;
                    data.args = data.args || data.params;
                    fsm.connection.run(data.cmd, data.args).then(function () {
                        callback && callback(err);
                    }, function (err) {
                        callback && callback(err);
                    });
                }
                catch (err) {
                    node.error('error calling send: ' + err);
                    callback(err);
                }
            });
        }
    }

    //
    RED.nodes.registerType("denon-out", DenonOut);

    /**
     * ====== Denon-IN ========================
     * Handles incoming Global Cache, injecting
     * json into node-red flows
     * =======================================
     */
    function DenonIn(config) {
        RED.nodes.createNode(this, config);
        this.name = config.name;
        this.connection = null;
        var node = this;
        //node.log('new DenonIn, config: %j', config);
        var controllerNode = RED.nodes.getNode(config.controller);

        /* ===== Node-Red events ===== */
        function nodeStatusConnecting() {
            node.status({fill: "green", shape: "ring", text: "connecting"});
        }

        function nodeStatusConnected() {
            node.status({fill: "green", shape: "dot", text: "connected"});
        }

        function nodeStatusDisconnected() {
            node.status({fill: "red", shape: "dot", text: "disconnected"});
        }

        function nodeStatusReconnect() {
            node.status({fill: "yellow", shape: "ring", text: "reconnecting"});
        }

        function bindNotificationListeners(connection) {
            function getListenerForNotification(notification) {
                return function (data) {
                    node.receiveNotification(notification, data);
                }
            }

            Object.keys(connection.schema.schema.notifications).forEach(function (method) {
                connection.schema.schema.notifications[method](getListenerForNotification(method));
            });
        }

        node.receiveNotification = function (notification, data) {
            DEBUG && RED.comms.publish("debug", {
                name: node.name,
                msg: 'denon event data[' + JSON.stringify(data) + ']'
            });
            node.send({
                topic: 'denon',
                payload: {
                    'notification': notification,
                    'data': data
                }
            });
        };

        controllerNode.initializeDenonConnection(function (fsm) {
            bindNotificationListeners(fsm.connection);

            if (fsm.connected)
                nodeStatusConnected();
            else
                nodeStatusDisconnected();
            fsm.off('connecting', nodeStatusConnecting);
            fsm.on('connecting', nodeStatusConnecting);
            fsm.off('connected', nodeStatusConnected);
            fsm.on('connected', nodeStatusConnected);
            fsm.off('disconnected', nodeStatusDisconnected);
            fsm.on('disconnected', nodeStatusDisconnected);
            fsm.off('reconnect', nodeStatusReconnect);
            fsm.on('reconnect', nodeStatusReconnect);
        });
    }

    RED.nodes.registerType("denon-in", DenonIn);
}