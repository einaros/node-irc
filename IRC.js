var net = require('net');
var util = require('util');
var events = require('events');
var delegate = require('./delegate').delegate;
var private = require('./proto').private;
var public = require('./proto').public;

function IRC(server, port) {
    events.EventEmitter.call(this);
    if (typeof server === 'object') {
        this._socket = server;
    }
    else {
        this._socket = new net.Socket();        
    }
    this._server = server;
    this._port = port;
    this._socket.setEncoding('ascii');
    this._socket.on('connect', delegate(this, function() {
        this._socket.write('NICK ' + this._username + '\r\n');
        this._socket.write('USER ' + this._username + ' client homelien :Foo Bar\r\n');        
    }));
    this._socket.on('close', delegate(this, function(had_error) {
        console.log('server socket closed');
    }));
    this._socket.on('end', delegate(this, function() {
        console.log('server socket end');
    }));
    this._socket.on('error', delegate(this, function(exception) {
        console.log('server socket error');
        console.log(exception);
    }));
    this._socket.on('data', delegate(this, function(data) {
        var lines = data.split('\r\n');
        for (var i = 0; i < lines.length; ++i) {
            var line = lines[i].trim();
            if (line.length > 0) this._processServerMessage.call(this, lines[i]);
        }
    }));
}
util.inherits(IRC, events.EventEmitter);
public(IRC.prototype, {
    connect: function(username) {
        this._username = username;
        this._socket.connect(this._port, this._server);
    },
    privmsg: function(to, message) {
        this._socket.write('PRIVMSG ' + to + ' :' + message + '\r\n');
    },
    quit: function(message) {
        this._socket.write('QUIT :' + message + '\r\n');
        this._socket.close()
    }    
});
private(IRC.prototype, {
    _messageHandlers: {
        // Server messages
        '372': function() {
            return this._messageHandlers['375'].apply(this, arguments);
        },
        '375': function(from, data) {
            var parsed = data.match(/([^\s]*)\s:(.*)/);
            var to = parsed[1];
            var text = parsed[2];
            this.emit('servertext', from, to, text);
        },
        '376': function(from, data) {
            this.emit('connected', from);
        },
        'PING': function(from) {
            // PING :irc.homelien.no
            this.emit('ping', from.substr(1));
            this._socket.write('PONG ' + from + '\r\n');
        },
        // Client messages
        'PRIVMSG': function(from, data) {
            // :Angel!foo@bar PRIVMSG Wiz :Hello are you receiving this message ?
            var identity = parseIdentity(from);
            var data = data.match(/([^\s]*)\s:(.*)/);
            if (!data) throw 'invalid privmsg structure';
            to = data[1];
            message = data[2];
            this.emit('privmsg', identity.nick, to, message);
        },
        'CTCP_PRIVMSG_PING': function(from, to, data) {
            var identity = parseIdentity(from);
            this.emit('ping', identity.nick);
            this._socket.write('NOTICE ' + identity.nick + ' :\1PING ' + data + '\1\r\n');
        },
        'CTCP_NOTICE_PING': function(from, to, data) {
            var identity = parseIdentity(from);
            this.emit('ping-reply', identity.nick, Date.now() - Number(data));
        },
        // 'CTCP_PRIVMSG_ACTION': function(from, to, data) {
        //     //:einar_!~einar@cypher.itu.dk PRIVMSG undefined :ACTION laks
        //     var identity = parseIdentity(from);
        //     this.emit('action', identity.nick);            
        // }
    },
    _processServerMessage: function(line) {
        // :Angel!foo@bar PRIVMSG Wiz :\1PING 123 123
        var matches = line.match(/^:([^\s]*)\s([^\s]*)\s([^\s]*)\s:\u0001([^\s]*)\s(.*)\u0001/);
        if (matches) {
            var handler = this._messageHandlers['CTCP_' + matches[2] + '_' + matches[4]];
            if (typeof(handler) !== 'undefined') {
                handler.call(this, matches[1], matches[3], matches[5]);
            }
            else console.log('unhandled ctcp: ' + line);
            return;
        }
        // :Angel!foo@bar PRIVMSG Wiz :Hello are you receiving this message ?
        var matches = line.match(/^:([^\s]*)\s([^\s]*)\s(.*)/);
        if (matches) {
            var handler = this._messageHandlers[matches[2]];
            if (typeof(handler) !== 'undefined') {
                handler.call(this, matches[1], matches[3]);
            }
            else console.log('unhandled msg: ' + line);
            return;
        }
        // PING :irc.homelien.no
        matches = line.match(/([^\s]*)\s(.*)/);
        if (matches) {
            var handler = this._messageHandlers[matches[1]];
            if (typeof(handler) !== 'undefined') {
                handler.call(this, matches[2]);
            }
            else console.log('unhandled server command: ' + line);
            return;
        }
        // Unknown
        console.log('unmatched server data: ' + line);
    }
});
exports.IRC = IRC;

function parseIdentity(identity) {
    var parsed = identity.match(/:?(.*?)(?:$|!)(?:(.*)@(.*))?/);
    return {
        nick: parsed[1],
        ident: parsed[2],
        host: parsed[3]
    }
}
