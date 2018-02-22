node-red-contrib-denon
========================

A <a href="http://nodered.org" target="_new">Node-RED</a> node to communicate [Denon AVR receivers](http://www.denon.com) over telnet (port 23) TCP/IP connection.

# Install
-------

Run command on Node-RED installation directory

	npm install node-red-contrib-denon

# Usage
-----

![node-red-denon-flow] (example.png)

If you want to use this node simply inject message's payload as string:

## `Denon-Out` node sends commands to Denon devices

### Commands with no arguments

#### Master Volume

`MV20`

Master Volume set to 20 - command from Denon AVR protocol: [DENON_PROTOCOL_V7.6.0.pdf](doc/AVR3312CI_AVR3312_PROTOCOL_V7.6.0.pdf)

#### Master Volume Up

`MVUP`

Master Volume UP by 0.5 - command from Denon AVR protocol: [DENON_PROTOCOL_V7.6.0.pdf](doc/AVR3312CI_AVR3312_PROTOCOL_V7.6.0.pdf)

#### Master Volume Down

`MVDOWN`

Master Volume DOWN by 0.5 - command from Denon AVR protocol: [DENON_PROTOCOL_V7.6.0.pdf](doc/AVR3312CI_AVR3312_PROTOCOL_V7.6.0.pdf)

### Commands with arguments

Currently, there is only one such command implemented: `SetVolumeDB`.
One may use `setvolumedb` too, cause it's case insensitive.
So, `msg` object shoud looks like:
```javascript
{
    topic; "setvolumedb",
    payload: -65.5
}
```
It will set the master volume to -65.5dB.

## `Denon-In`

Node sends to single output messages from Denon quipment with structure:
```javascript
{
    topic: 'denon',
    payload: 'PWON'
}
```

where `notification` could be `PWON` and `data` contain additional info, arguments for current notification.

# Collect debug log for issues

Current package use debug package: https://www.npmjs.com/package/debug.
Run you `node-red` with command to enable debug output:

`set DEBUG=node-red-contrib-denon node-red`

for globally installed Node-RED, or

`set DEBUG=node-red-contrib-denon node node-red/red.js` 

for local Node-RED.

# Additinal documentation

Take a look at Denon AVR protocol: [DENON_PROTOCOL_V7.6.0.pdf](doc/AVR3312CI_AVR3312_PROTOCOL_V7.6.0.pdf)