var net = require('net');
var util = require('util');
var events = require('events');
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
    var realEmit = this.emit;
    this._interceptorMap = {};
    this.emit = function(event) {
        if (event !== 'newListener') {
            var interceptorArray = this._interceptorMap[event];
            if (interceptorArray && interceptorArray.length > 0) {
                for (var i = 0; i < interceptorArray.length; ++i) {
                    if (interceptorArray[i][event].apply(this, arguments) === true) {
                        interceptorArray[i].__remove();
                        break;
                    }
                }
            }
        }
        return realEmit.apply(this, arguments);
    }
    this._socket.setEncoding('ascii');
    this._socket.on('connect', function() {
        this._socket.write('NICK ' + this._username + '\r\n');
        this._socket.write('USER ' + this._username + ' client homelien :Foo Bar\r\n');        
    }.bind(this));
    this._socket.on('close', function(had_error) {
        console.log('server socket closed');
    }.bind(this));
    this._socket.on('end', function() {
        console.log('server socket end');
    }.bind(this));
    this._socket.on('error', function(exception) {
        console.log('server socket error');
        console.log(exception);
    }.bind(this));
    var overflow = '';
    this._socket.on('data', function(data) {
        data = overflow + data;
        var lastCrlf = data.lastIndexOf('\r\n');
        if (lastCrlf == -1) {
            overflow = data;
            return;
        }
        overflow = data.substr(lastCrlf + 2);
        data = data.substr(0, lastCrlf);
        var lines = data.split('\r\n');
        for (var i = 0; i < lines.length; ++i) {
            var line = lines[i].trim();
            if (line.length > 0) this._processServerMessage.call(this, lines[i]);
        }
    }.bind(this));
}
util.inherits(IRC, events.EventEmitter);
public(IRC.prototype, {
    connect: function(username) {
        this._username = username;
        this._socket.connect(this._port, this._server);
    },
    join: function(channel, callback) {
        this._socket.write('JOIN ' + channel + '\r\n');
        if (typeof callback === 'function') {
            var handler = function(who, where) {
                if (who == this._username && where == channel) {
                    this.removeListener('join', handler);
                    callback();
                }
            }.bind(this);
            this.on('join', handler);
        }
    },
    nick: function(newnick, callback) {
        this._socket.write('NICK ' + newnick + '\r\n');
        this._intercept({
            'nick-change': function(event, oldn, newn) {
                if (oldn == this._username && newn == newnick) {
                    this._username = newnick;
                    if (typeof callback === 'function') callback(oldn, newn);
                    return true;
                }
            }.bind(this),
            'errorcode': function(event, code, oldn, newn, reason) {
                if (oldn == this._username && newn == newnick) {
                    if (typeof callback === 'function') callback(oldn, null);
                    return true;
                }
            }.bind(this)
        });
        // this.on('nick-change', changeHandler);
        // this.on('nick-inuse', inuseHandler);
    },
    privmsg: function(to, message) {
        this._socket.write('PRIVMSG ' + to + ' :' + message + '\r\n');
    },
    ping: function(to) {
        this._socket.write('PRIVMSG ' + to + ' :\1PING ' + Date.now() + '\1\r\n');
    },
    quit: function(message) {
        this._socket.write('QUIT :' + message + '\r\n');
        this._socket.close();
    }    
});
private(IRC.prototype, {
    // stacks an interceptor for the given set of events
    _intercept: function(interceptor) {
        var interceptorStackArray = [];
        private(interceptor, {
            __remove: function() {
                for (var i = 0; i < interceptorStackArray.length; ++i) {
                    var interceptorStack = interceptorStackArray[i];
                    var index = interceptorStack.indexOf(interceptor);
                    if (index != -1) interceptorStack.splice(index, 1);
                }
            }
        });
        for (var event in interceptor) {
            var interceptorStack = this._interceptorMap[event];
            if (typeof interceptorStack === 'undefined') {
                interceptorStack = this._interceptorMap[event] = [];
            }
            interceptorStack.push(interceptor);
            interceptorStackArray.push(interceptorStack);
        }
    },
    _errorHandler: function(code, server, to, regarding, reason) {
        this.emit('errorcode', code, to, regarding, reason);
    },
    _messageHandlers: {
        // Errors
        '433': 'ERR_NICKNAMEINUSE',
        // Server messages
        /* RPL_MOTDSTART */ '375': function() {
            return this._messageHandlers['372'].apply(this, arguments);
        },
        /* RPL_MOTD */ '372': function(from, to, text) {
            this.emit('servertext', from, to, text);
        },
        /* RPL_ENDOFMOTD */ '376': function(from, data) {
            this.emit('connected', from);
        },
        'PING': function(from) {
            this.emit('ping', from);
            this._socket.write('PONG :' + from + '\r\n');
        },
        // Client messages
        'PRIVMSG': function(from, to, message) {
            var identity = parseIdentity(from);
            this.emit('privmsg', identity.nick, to, message);
        },
        'JOIN': function(who, channel) {
            var identity = parseIdentity(who);
            this.emit('join', identity.nick, channel);
        },
        'NICK': function(from, data) {
            // :Angel!foo@bar NICK newnick
            var identity = parseIdentity(from);
            var data = data.match(/:?(.*)/);
            if (!data) throw 'invalid NICK structure';
            this.emit('nick-change', identity.nick, data[1]);
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
        var matches = line.match(/^:([^\s]*)\s([^\s]*)\s([^\s]*)\s:\u0001([^\s]*)\s(.*)\u0001/);
        if (matches) {
            var handler = this._messageHandlers['CTCP_' + matches[2] + '_' + matches[4]];
            if (typeof handler !== 'undefined') {
                handler.call(this, matches[1], matches[3], matches[5]);
            }
            else console.log('unhandled ctcp: ' + line);
            return;
        }
        matches = line.match(/(?::([^\s]*)\s)?([^:]{1}[^\s]*)(?:\s([^:]{1}[^\s]*))?(?:\s([^:]{1}[^\s]*))?(?:\s:(.*))?/);
        if (matches) {
            var handler = this._messageHandlers[matches[2]];
            var args = [];
            for (var i = 1; i < matches.length; ++i) {
                if (i != 2 && typeof matches[i] !== 'undefined') args.push(matches[i]);
            }
            if (typeof handler === 'function') handler.apply(this, args);
            else if (typeof handler === 'string') {
                args.unshift(handler);
                this._errorHandler.apply(this, args);
            }
            else console.log('unhandled msg: ' + line);
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
