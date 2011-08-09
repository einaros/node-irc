var net = require('net');
var util = require('util');
var events = require('events');
var private = require('./proto').private;
var public = require('./proto').public;
function IRC(server, port) {
    events.EventEmitter.call(this);
    if (typeof server == 'object') {
        this._socket = server;
    }
    else {
        this._socket = new net.Socket();
    }
    this._server = server;
    this._port = port;
    this._cache = {};
    var realEmit = this.emit;
    this._interceptorMap = {};
    this.emit = function(event) {
        if (event !== 'newListener') {
            var interceptorArray = this._interceptorMap[event];
            if (interceptorArray && interceptorArray.length > 0) {
                for (var i = 0; i < interceptorArray.length; ++i) {
                    if (interceptorArray[i][event].apply(this,
                        Array.prototype.slice.call(arguments, 1)) === true) {
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
        this._intercept({
            'join': function(who, where) {
                if (who == this._username && where == channel) {
                    if (typeof callback == 'function') callback();
                    return true;
                }
            }.bind(this),
            'errorcode': function(code, who, where, error) {
                if (['ERR_BANNEDFROMCHAN',
                     'ERR_INVITEONLYCHAN',
                     'ERR_BADCHANNELKEY',
                     'ERR_CHANNELISFULL',
                     'ERR_BADCHANMASK',
                     'ERR_NOSUCHCHANNEL',
                     'ERR_TOOMANYCHANNELS'].indexOf(code) != -1) {
                    if (typeof callback == 'function') callback(error);
                    return true;
                }
                else if (code == 'ERR_NEEDMOREPARAMS' &&
                         regarding == 'JOIN') {
                    if (typeof callback == 'function') callback(error);
                    return true;
                }
            }
        });
    },
    kick: function(where, target, why, callback) {
        this._socket.write('KICK ' + where + ' ' + target + ' :' + why + '\r\n');
        this._intercept({
            'kick': function(who_, where_, target_, why_) {
                if (who_ == this._username && where_ == where && target_ == target) {
                    if (typeof callback == 'function') callback();
                    return true;
                }
            }.bind(this),
            'errorcode': function(code, regarding, error) {
                if (['ERR_NOSUCHCHANNEL',
                     'ERR_BADCHANMASK',
                     'ERR_CHANOPRIVSNEEDED',
                     'ERR_NOTONCHANNEL'].indexOf(code) != -1 &&
                    regarding == where) {
                    if (typeof callback == 'function') callback(error);
                    return true;
                }
                else if (code == 'ERR_NEEDMOREPARAMS' &&
                         regarding == 'KICK') {
                    if (typeof callback == 'function') callback(error);
                    return true;
                }
            }.bind(this)
        });
    },
    names: function(channel, callback) {
        this._socket.write('NAMES ' + channel + '\r\n');
        this._intercept({
            'names': function(where, names) {
                if (where == channel) {
                    if (typeof callback == 'function') callback(undefined, names);
                    return true;
                }
            }.bind(this),
        });
    },
    nick: function(newnick, callback) {
        this._socket.write('NICK ' + newnick + '\r\n');
        this._intercept({
            'nick-change': function(oldn, newn) {
                if (oldn == this._username && newn == newnick) {
                    this._username = newnick;
                    if (typeof callback == 'function') callback(undefined, oldn, newn);
                    return true;
                }
            }.bind(this),
            'errorcode': function(code, to, regarding, reason) {
                if (['ERR_NONICKNAMEGIVEN',
                     'ERR_ERRONEUSNICKNAME',
                     'ERR_NICKNAMEINUSE',
                     'ERR_NICKCOLLISION'].indexOf(code) != -1) {
                    if (typeof callback == 'function') callback(reason);
                    return true;
                }
            }.bind(this)
        });
    },
    mode: function(target, modes, mask, callback) {
        var maskString = typeof mask == 'string' ? mask : undefined;
        var cb = typeof mask == 'function' ? mask : callback;
        this._socket.write('MODE ' + target + ' ' + modes + (maskString ? ' ' + maskString : '') + '\r\n');
        this._intercept({
            'mode': function(who_, target_, modes_, mask_) {
                if (who_ == this._username && 
                    target_ == target &&
                    modes_ == modes &&
                    mask_ == maskString) {
                    if (typeof cb == 'function') cb(undefined);
                    return true;
                }
            }.bind(this),
            'errorcode': function(code, to, reason) {
                if (['ERR_CHANOPRIVSNEEDED',
                     'ERR_NOSUCHNICK',
                     'ERR_NOTONCHANNEL',
                     'ERR_KEYSET',
                     'ERR_UNKNOWNMODE',
                     'ERR_NOSUCHCHANNEL',
                     'ERR_USERSDONTMATCH',
                     'ERR_UMODEUNKNOWNFLAG'].indexOf(code) != -1) {
                    if (typeof cb == 'function') cb(reason);
                    return true;
                }
                else if (code == 'ERR_NEEDMOREPARAMS' &&
                         regarding == 'JOIN') {
                    if (typeof cb == 'function') cb(reason);
                    return true;
                }
            }
        });
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
            if (typeof interceptorStack == 'undefined') {
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
        '401': 'ERR_NOSUCHNICK',
        '402': 'ERR_NOSUCHSERVER',
        '403': 'ERR_NOSUCHCHANNEL',
        '404': 'ERR_CANNOTSENDTOCHAN',
        '405': 'ERR_TOOMANYCHANNELS',
        '406': 'ERR_WASNOSUCHNICK',
        '407': 'ERR_TOOMANYTARGETS',
        '409': 'ERR_NOORIGIN',
        '411': 'ERR_NORECIPIENT',
        '412': 'ERR_NOTEXTTOSEND',
        '413': 'ERR_NOTOPLEVEL',
        '414': 'ERR_WILDTOPLEVEL',
        '421': 'ERR_UNKNOWNCOMMAND',
        '422': 'ERR_NOMOTD',
        '423': 'ERR_NOADMININFO',
        '424': 'ERR_FILEERROR',
        '431': 'ERR_NONICKNAMEGIVEN',
        '432': 'ERR_ERRONEUSNICKNAME',
        '433': 'ERR_NICKNAMEINUSE',
        '436': 'ERR_NICKCOLLISION',
        '441': 'ERR_USERNOTINCHANNEL',
        '442': 'ERR_NOTONCHANNEL',
        '443': 'ERR_USERONCHANNEL',
        '444': 'ERR_NOLOGIN',
        '445': 'ERR_SUMMONDISABLED',
        '446': 'ERR_USERSDISABLED',
        '451': 'ERR_NOTREGISTERED',
        '461': 'ERR_NEEDMOREPARAMS',
        '462': 'ERR_ALREADYREGISTRED',
        '463': 'ERR_NOPERMFORHOST',
        '464': 'ERR_PASSWDMISMATCH',
        '465': 'ERR_YOUREBANNEDCREEP',
        '467': 'ERR_KEYSET',
        '471': 'ERR_CHANNELISFULL',
        '472': 'ERR_UNKNOWNMODE',
        '473': 'ERR_INVITEONLYCHAN',
        '474': 'ERR_BANNEDFROMCHAN',
        '475': 'ERR_BADCHANNELKEY',
        '481': 'ERR_NOPRIVILEGES',
        '482': 'ERR_CHANOPRIVSNEEDED',
        '483': 'ERR_CANTKILLSERVER',
        '491': 'ERR_NOOPERHOST',
        '501': 'ERR_UMODEUNKNOWNFLAG',
        '502': 'ERR_USERSDONTMATCH',
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
        /* RPL_NAMRPLY */ '353': function(from, to, where, names) {
            this._cache['names'] = this._cache['names'] || {};
            this._cache['names'][where] = (this._cache['names'][where] || []).concat(names.split(' '));
        },
        /* RPL_ENDOFNAMES */ '366': function(from, to, where) {
            this.emit('names', where, this._cache['names'][where]);
            delete this._cache['names'][where];
        },
        'PING': function(from) {
            this.emit('ping', from);
            this._socket.write('PONG :' + from + '\r\n');
        },
        // Client messages
        'MODE': function(who, target, modes, mask) {
            var identity = parseIdentity(who);
            this.emit('mode', identity.nick, target, modes, mask);
        },
        'PRIVMSG': function(from, to, message) {
            var identity = parseIdentity(from);
            this.emit('privmsg', identity.nick, to, message);
        },
        'JOIN': function(who, channel) {
            var identity = parseIdentity(who);
            this.emit('join', identity.nick, channel);
        },
        'KICK': function(who, where, target, why) {
            var identity = parseIdentity(who);
            this.emit('kick', identity.nick, where, target, why);
        },
        'NICK': function(from, data) {
            // :Angel!foo@bar NICK newnick
            var identity = parseIdentity(from);
            var data = data.match(/:?(.*)/);
            if (!data) throw 'invalid NICK structure';
            this.emit('nick-change', identity.nick, data[1]);
        },
        'PART': function(who, where) {
            var identity = parseIdentity(who);
            this.emit('part', identity.nick, where);
        },
        'QUIT': function(who, message) {
            var identity = parseIdentity(who);
            this.emit('quit', identity.nick, message);
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
        matches = line.match(/(?::([^\s]*)\s)?([^:]{1}[^\s]*)(?:\s([^:]{1}[^\s]*))?(?:\s(?:=\s)?([^:]{1}[^\s]*))?(?:\s:?(.*))?/);
        if (matches) {
            var handler = this._messageHandlers[matches[2]];
            var args = [];
            for (var i = 1; i < matches.length; ++i) {
                if (i != 2 && typeof matches[i] !== 'undefined') args.push(matches[i]);
            }
            if (typeof handler == 'function') handler.apply(this, args);
            else if (typeof handler == 'string') {
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