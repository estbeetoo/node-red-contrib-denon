~function (undefined) {
    module.exports = function (options) {
        var denon = require('denon-avr');
        var machina = require('machina');
        var connectionFSM = new machina.Fsm({
            debug: options.debug ? true : false,
            host: options.host || '127.0.0.1',
            port: options.port || 23,
            CONNECT_TIMEOUT: options.connectTimeout || options['connect-timeout'] || 10000,
            PING_TIMEOUT: options.pingTimeout || options['ping-timeout'] || 5000,
            PING_INTERVAL: options.pingInterval || options['ping-interval'] || 20000,
            RECONNECT_INTERVAL: options.reconnectInterval || options['reconnect-interval'] || 5000,
            initialize: function (options) {
                this.connected = false;
                this.disconnectingManually = false;
            },
            namespace: "denon-connection",
            initialState: "uninitialized",
            states: {
                uninitialized: {
                    "*": function () {
                        this.deferUntilTransition();
                        this.transition("connecting");
                    }
                },
                connecting: {
                    _onEnter: function () {
                        this.disconnectingManually = false;
                        this.connected = false;
                        this.emit('connecting');
                        this.debug && console.log('Connecting to: ' + this.host + ':' + this.port);
                        this.connectingTimeout = setTimeout(function () {
                            this.debug && console.log('Connecting timeouted!');
                            this.transition("scheduleReconnect");
                        }.bind(this), this.CONNECT_TIMEOUT);

                        var connection = this.connection = new denon(new denon.transports.telnet({
                            host: this.host,
                            port: this.port,
                            debug: this.debug
                        }));

                        var self = this;
                        connection.on('connect', function () {
                            self.debug && console.log('Successfully connected!');
                            self.transition("connected");
                        });

                        function errorHandler(error) {
                            self.debug && console.log('Error connecting, cause: ' + error);
                            self.debug && console.log('Schedule reconnecting...');
                            self.handle('scheduleReconnect')
                        }

                        connection.getConnection().on('error', errorHandler);

                        connection.on('timeout', errorHandler);

                        connection.on('error', function (cause) {
                            self.debug && console.log('Denon connection event[error], cause: ' + cause);
                            if (!self.disconnectingManually)
                                self.transition('scheduleReconnect');
                        });
                        connection.on('close', function (cause) {
                            self.debug && console.log('Denon connection event[close], cause: ' + cause);
                            if (!self.disconnectingManually)
                                self.handle('scheduleReconnect');
                        });
                        connection.on('end', function (cause) {
                            self.debug && console.log('Denon connection event[end], cause: ' + cause);
                            if (!self.disconnectingManually)
                                self.handle('scheduleReconnect');
                        });
                        connection.connect();

                    },
                    _onExit: function (connection) {
                        clearTimeout(this.connectingTimeout);
                    }
                },
                scheduleReconnect: {
                    _onEnter: function () {
                        {
                            this.connected = false;
                            this.emit('disconnected');
                            this.connection && this.connection.getConnection().destroy();
                            this.connection = null;
                        }
                        this.debug && console.log('Scheduling reconnect');
                        clearTimeout(this.connectingTimeout);
                        this.emit('reconnect');
                        this.reconnectTimer = setTimeout(function () {
                            this.debug && console.log('Reconnecting...');
                            this.transition("connecting");
                        }.bind(this), this.RECONNECT_INTERVAL);
                    },
                    _onExit: function (connection) {
                        clearTimeout(this.reconnectTimer);
                    }
                },
                connected: {
                    _onEnter: function () {
                        if (!this.connected) {
                            this.connected = true;
                            this.emit('connected');
                        }
                        this.debug && console.log('Starting ping interval');
                        this.pingTimer = setTimeout(function () {
                            this.transition("pinging");
                        }.bind(this), this.PING_INTERVAL);
                    },
                    _onExit: function () {
                        clearTimeout(this.pingTimer);
                    }
                },
                pinging: {
                    _onEnter: function () {
                        var self = this;
                        this.pingTimeout = setTimeout(function () {
                            self.debug && console.log('Ping timeout');
                            self.transition('connecting');
                        }.bind(this), this.PING_TIMEOUT);
                        this.connection.getPowerState(function (error, pong) {
                            if (error) {
                                self.debug && console.log('Ping failed, error[' + error + ']');
                                if (!self.disconnectingManually)
                                    self.handle('scheduleReconnect');
                            }
                            self.debug && console.log('Ping success, pong[' + pong + ']');
                            self.transition('connected');
                        });
                    },
                    _onExit: function () {
                        clearTimeout(this.pingTimeout);
                    }
                },
                disconnecting: {
                    _onEnter: function () {
                        this.debug && console.log('Disconnecting');
                        this.connected = false;
                        this.disconnectingManually = true;
                        this.emit('disconnected');
                        this.connection && this.connection.getConnection().destroy();
                        this.connection = null;
                        this.transition('uninitialized');
                    }
                }
            },
            connect: function () {
                this.handle("_reset");
            },
            disconnect: function () {
                this.transition("disconnecting");
            }
        });
        return connectionFSM;
    }
}();