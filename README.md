node-red-contrib-denon
========================

A <a href="http://nodered.org" target="_new">Node-RED</a> node to communicate [Denon AVR receivers](http://www.denon.com).

# Install
-------

Run command on Node-RED installation directory

	npm install node-red-contrib-denon

# Pre-reqs
--------

TODO: fill it

# Usage
-----

![node-red-denon-flow] (example.png)

If you want to use this node simply inject payload as string:
MV20 // Master Volume set to 20 - command from Denon AVR protocol: [DENON_PROTOCOL_V7.6.0.pdf](doc/AVR3312CI_AVR3312_PROTOCOL_V7.6.0.pdf)
MVUP // Master Volume UP by 0.5 - command from Denon AVR protocol: [DENON_PROTOCOL_V7.6.0.pdf](doc/AVR3312CI_AVR3312_PROTOCOL_V7.6.0.pdf)
MVDOWN // Master Volume DOWN by 0.5 - command from Denon AVR protocol: [DENON_PROTOCOL_V7.6.0.pdf](doc/AVR3312CI_AVR3312_PROTOCOL_V7.6.0.pdf)

there is one exeption if you set
msg.topic="setvolumedb"
msg.payload="-65" as a string
it will set the master volume to -65dB
There is a switch in denon.js at line 186 which cause this behavior but other command are processed as I described

inject command + value as a string to denon node
CommnadValue
MVUP // example to increase volume
MVDOWN // example to decrease volume

# Additinal documentation

Take a look at Denon AVR protocol: [DENON_PROTOCOL_V7.6.0.pdf](doc/AVR3312CI_AVR3312_PROTOCOL_V7.6.0.pdf)