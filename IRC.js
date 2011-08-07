var net = require('net');
var util = require('util');
var events = require('events');
var delegate = require('./delegate').delegate;

var parseIdentity = function(identity) {
    var parsed = identity.match(/:?(.*?)(?:$|!)(?:(.*)@(.*))?/);
    return {
        nick: parsed[1],
        ident: parsed[2],
        host: parsed[3]
    }
}

var messageHandlers = {
    '376': function(from, data) {
        console.log('motd complete')
    },
    'PRIVMSG': function(from, data) {
        // :Angel!foo@bar PRIVMSG Wiz :Hello are you receiving this message ?
        var identity = parseIdentity(from);
        var data = data.match(/([^\s]*)\s:(.*)/);
        if (!data) throw 'invalid privmsg structure';
        to = data[1];
        message = data[2];
        this.emit('privmsg', identity.nick, to, message);
    },
    'PING': function(from) {
        // PING :irc.homelien.no
        this.emit('ping', from.substr(1));
        this.sock.write('PONG ' + from + '\r\n');
    }
}

var processServerMessage = function(line) {
    // :Angel!foo@bar PRIVMSG Wiz :Hello are you receiving this message ?
    var matches = line.match(/:([^\s]*)\s([^\s]*)\s(.*)/);
    if (matches) {
        var handler = messageHandlers[matches[2]];
        if (typeof(handler) !== 'undefined') {
            handler.call(this, matches[1], matches[3]);
        }
    }
    // PING :irc.homelien.no
    matches = line.match(/([^\s]*)\s(.*)/);
    if (matches) {
        var handler = messageHandlers[matches[1]];
        if (typeof(handler) !== 'undefined') {
            handler.call(this, matches[2]);
        }
    }
}

function IRC(server, port) {
    events.EventEmitter.call(this);
    if (typeof server === 'object') {
        this.sock = server;
    }
    else {
        this.sock = new net.Socket();        
    }
    this.sock.setEncoding('ascii');
    this.sock.on('close', delegate(this, function(had_error) {
        console.log('server socket closed');
    }));
    this.sock.on('end', delegate(this, function() {
        console.log('server socket end');
    }));
    this.sock.on('error', delegate(this, function(exception) {
        console.log('server socket error');
        console.log(exception);
    }));
    this.sock.on('data', delegate(this, function(data) {
        var lines = data.split('\r\n');
        for (var i = 0; i < lines.length; ++i) {
            var line = lines[i].trim();
            if (line.length > 0) processServerMessage.call(this, lines[i]);
        }
    }));
}
util.inherits(IRC, events.EventEmitter);
IRC.prototype.connect = function(username) {
    this.sock.connect(6667, 'irc.homelien.no', function() {
        this.sock.write('NICK ' + username + '\r\n');
        this.sock.write('USER ' + username + ' client homelien :Foo Bar\r\n');
    });
}
IRC.prototype.privmsg = function(to, message) {
    this.sock.write('PRIVMSG ' + to + ' :' + message + '\r\n');
}
IRC.prototype.quit = function(message) {
    this.sock.write('QUIT :' + message + '\r\n');
    this.sock.close()
}
exports.IRC = IRC;
