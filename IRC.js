require('./lib/array');
var net = require('net');
var util = require('util');
var events = require('events');
var private = require('./lib/proto').private;
var public = require('./lib/proto').public;

function IRC(server, port, password) {
    events.EventEmitter.call(this);
    if (typeof server == 'object') {
        private(this, {_socket: server}, true);
    }
    else {
        private(this, {_socket: new net.Socket()}, true);
    }
    private(this, {
       _server: server,
       _port: port,
       _username: '',
       _cache: {},
       _callQueue: {},
       _eventPreInterceptorMap: {},
       _debugLevel: 2,
       _connected: false,
       _keepAliveTimer: -1
    }, true);
    var realEmit = this.emit;
    this.emit = function(event) {
        if (event !== 'newListener') {
            var interceptorQueue = this._eventPreInterceptorMap[event];
            if (interceptorQueue && interceptorQueue.length > 0) {
                for (var i = 0; i < interceptorQueue.length; ++i) {
                    if (interceptorQueue[i][event].apply(this, Array.prototype.slice.call(arguments, 1)) === true) {
                        interceptorQueue[i].__remove();
                        break;
                    }
                }
            }
        }
        var retVal = realEmit.apply(this, arguments);
        return retVal;
    }
    this._socket.setTimeout(false);
    this._socket.setEncoding('ascii');
    this._socket.on('connect', function() {
        if (typeof password != 'undefined') this._socket.write('PASS ' + password + '\r\n');
        this._socket.write('NICK ' + this._username + '\r\n');
        this._socket.write('USER ' + this._ident + ' host server :' + this._realname + '\r\n');
    }.bind(this));
    this._socket.on('close', function(had_error) {
        this._debug(3, 'Server socket closed');
        this._stopKeepAlive();
        this._eventPreInterceptorMap = {};
        this._connected = false;
        this.emit('disconnected');
    }.bind(this));
    this._socket.on('end', function() {
        this._debug(3, 'Server socket end');
        this._socket.end();
    }.bind(this));
    this._socket.on('error', function(exception) {
        this._debug(1, 'Server socket error', exception);
    }.bind(this));
    this._socket.on('timeout', function(exception) {
        this._debug(1, 'Server socket timeout', exception);
        this._socket.end();
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
    whoami: function() {
        return this._username;
    },
    connect: function(username, realname, ident) {
        this._username = username;
        this._realname = realname || 'user';
        this._ident = ident || 'user';
        this._socket.connect(this._port, this._server);
    },
    join: function(channel, callback) {
        this._socket.write('JOIN ' + channel + '\r\n');
        this._queueEventPreInterceptor({
            'join': function(who, where) {
                if (who == this._username && where == channel) {
                    if (typeof callback == 'function') callback();
                    return true;
                }
            }.bind(this),
            'redirected': function(who, where, redirect) {
                if (who == this._username && where == channel) {
                    if (typeof callback == 'function') callback(null, redirect);
                    return true;
                }
            }.bind(this),
            'errorcode': function(code, to, reason) {
                if (['ERR_BANNEDFROMCHAN', 'ERR_INVITEONLYCHAN', 'ERR_BADCHANNELKEY',
                     'ERR_CHANNELISFULL', 'ERR_BADCHANMASK', 'ERR_NOSUCHCHANNEL',
                     'ERR_TOOMANYCHANNELS'].has(code)) {
                    if (typeof callback == 'function') callback(reason);
                    return true;
                }
                else if (code == 'ERR_NEEDMOREPARAMS' &&
                         regarding == 'JOIN') {
                    if (typeof callback == 'function') callback(reason);
                    return true;
                }
            }
        });
    },
    kick: function(where, target, why, callback) {
        this._socket.write('KICK ' + where + ' ' + target + ' :' + why + '\r\n');
        this._queueEventPreInterceptor({
            'kick': function(who_, where_, target_, why_) {
                if (who_ == this._username && where_ == where && target_ == target) {
                    if (typeof callback == 'function') callback();
                    return true;
                }
            }.bind(this),
            'errorcode': function(code, who_, where_, reason) {
                if (['ERR_NOSUCHCHANNEL', 'ERR_BADCHANMASK', 'ERR_CHANOPRIVSNEEDED',
                     'ERR_NOTONCHANNEL'].has(code) &&
                     where_ == where && who_ == this._username) {
                    if (typeof callback == 'function') callback(reason);
                    return true;
                }
                else if (code == 'ERR_NEEDMOREPARAMS' &&
                         where_ == 'KICK') {
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
        this._queueEventPreInterceptor({
            'mode': function(who_, target_, modes_, mask_) {
                if (who_ == this._username &&
                    target_ == target &&
                    modes_ == modes &&
                    mask_ == maskString) {
                    if (typeof cb == 'function') cb(undefined);
                    return true;
                }
            }.bind(this),
            'errorcode': function(code, to, regarding, reason) {
                if (['ERR_CHANOPRIVSNEEDED', 'ERR_NOSUCHNICK', 'ERR_NOTONCHANNEL',
                     'ERR_KEYSET', 'ERR_UNKNOWNMODE', 'ERR_NOSUCHCHANNEL',
                     'ERR_USERSDONTMATCH', 'ERR_UMODEUNKNOWNFLAG'].has(code)) {
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
    names: function(channel, callback) {
        var handler = function() {
            this._socket.write('NAMES ' + channel + '\r\n');
            this._queueEventPreInterceptor({
                'names': function(where, names) {
                    this._callQueue.names.inProgress -= 1;;
                    var handled = false;
                    if (where == channel) {
                        if (typeof callback == 'function') callback(undefined, names);
                        handled = true;
                    }
                    if (this._callQueue.names.pending.length > 0) {
                        this._callQueue.names.pending.shift()();
                    }
                    return handled;
                }.bind(this)
            });
        }.bind(this);
        var queue = this._callQueue.names = this._callQueue.names|| { inProgress: 0, pending: [] };
        queue.inProgress += 1;
        if (queue.inProgress > 1) {
            queue.pending.push(handler);
        }
        else handler();
    },

    whois: function(nick, callback) {
        var handler = function() {
            this._socket.write('WHOIS ' + nick + '\r\n');
            this._queueEventPreInterceptor({
                'whois': function(who, whois) {
                    this._callQueue.whois.inProgress -= 1;;
                    var handled = false;
                    if (nick == who) {
                        if (typeof callback == 'function') callback(undefined, whois);
                        handled = true;
                    }
                    if (this._callQueue.whois.pending.length > 0) {
                        this._callQueue.whois.pending.shift()();
                    }
                    return handled;
                }.bind(this),
                'errorcode': function(code, to, regarding, reason) {
                    if (['ERR_NOSUCHSERVER', 'ERR_NONICKNAMEGIVEN',
                         'RPL_WHOISUSER', 'RPL_WHOISCHANNELS',
                         'RPL_WHOISCHANNELS', 'RPL_WHOISSERVER',
                         'RPL_AWAY', 'RPL_WHOISOPERATOR',
                         'RPL_WHOISIDLE', 'ERR_NOSUCHNICK',
                         'RPL_ENDOFWHOIS'].has(code)) {
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
        }.bind(this);
        var queue = this._callQueue.whois = this._callQueue.whois || { inProgress: 0, pending: [] };
        queue.inProgress += 1;
        if (queue.inProgress > 1) {
            queue.pending.push(handler);
        }
        else handler();
    },

    nick: function(newnick, callback) {
        this._socket.write('NICK ' + newnick + '\r\n');
        this._queueEventPreInterceptor({
            'connected': function() {
                return true;
            },
            'nick': function(oldn, newn) {
                if (oldn == this._username) {
                    this._username = newnick;
                    if (typeof callback == 'function') callback(undefined, oldn, newn);
                    return true;
                }
            }.bind(this),
            'errorcode': function(code, who, regarding, reason) {
                if (['ERR_NONICKNAMEGIVEN'].has(code)) {
                    if (typeof callback == 'function') callback(regarding);
                    return true;
                }
                else if(['ERR_NICKNAMEINUSE', 'ERR_NICKCOLLISION', 'ERR_ERRONEUSNICKNAME'].has(code)) {
                    if (typeof callback == 'function') callback(reason);
                    return true;
                }
            }.bind(this)
        });
    },
    part: function(channel, callback) {
        this._socket.write('PART ' + channel + '\r\n');
        this._queueEventPreInterceptor({
            'part': function(who_, where_) {
                if (who_ == this._username && where_ == channel) {
                    if (typeof callback == 'function') callback(undefined);
                    return true;
                }
            }.bind(this),
            'errorcode': function(code, who, regarding, reason) {
                if (['ERR_NOSUCHCHANNEL', 'ERR_NOTONCHANNEL'].has(code)) {
                    if (typeof cb == 'function') cb(reason);
                    return true;
                }
                else if (code == 'ERR_NEEDMOREPARAMS' &&
                         regarding == 'JOIN') {
                    if (typeof cb == 'function') cb(reason);
                    return true;
                }
            }.bind(this)
        });
    },
    ping: function(to) {
        this._socket.write('PRIVMSG ' + to + ' :\1PING ' + Date.now() + '\1\r\n');
    },
    privmsg: function(to, message) {
        this._socket.write('PRIVMSG ' + to + ' :' + message + '\r\n');
    },
    notice: function(to, message) {
        this._socket.write('NOTICE ' + to + ' :' + message + '\r\n');
    },
    raw: function(message) {
        this._socket.write(message + '\r\n');
    },
    quit: function(message) {
        this._socket.write('QUIT :' + message + '\r\n');
        this._socket.end();
    },
    // todo: move to setter
    setDebugLevel: function(level) {
        this._debugLevel = level;
    }
});
private(IRC.prototype, {
    _startKeepAlive: function(server) {
        if (this._keepAliveTimer != -1) this._stopKeepAlive();
        var self = this;
        this._keepAliveTimer = setInterval(function() {
            self._socket.write('PING ' + server + '\r\n');
        }, 60000);
    },
    _stopKeepAlive: function() {
        if (this._keepAliveTimer == -1) return;
        clearInterval(this._keepAliveTimer);
        this._keepAliveTimer = -1;
    },
    _debug: function(level, text, data) {
        if (level <= this._debugLevel) {
            console.log(text);
        }
    },
    _queueEventPreInterceptor: function(interceptor) {
        var interceptorQueues = [];
        private(interceptor, {
            __remove: function() {
                for (var i = 0; i < interceptorQueues.length; ++i) {
                    var interceptorQueue = interceptorQueues[i];
                    var index = interceptorQueue.indexOf(interceptor);
                    if (index != -1) interceptorQueue.splice(index, 1);
                }
            }
        });
        for (var event in interceptor) {
            var interceptorQueue = this._eventPreInterceptorMap[event];
            if (typeof interceptorQueue == 'undefined') {
                interceptorQueue = this._eventPreInterceptorMap[event] = [];
            }
            interceptorQueue.push(interceptor);
            interceptorQueues.push(interceptorQueue);
        }
    },
    _errorHandler: function(code, raw, server, to, regarding, reason) {
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
        /* RPL_WELCOME */ '001': function(raw, from, to, text) {
            this._username = to;
            if (this._connected) return;
            this._connected = true;
            this.emit('connected', text);
            this._startKeepAlive(from);
        },
        /* RPL_MOTDSTART */ '375': function(raw) {
            return this._messageHandlers['372'].apply(this, arguments);
        },
        /* RPL_MOTD */ '372': function(raw, from, to, text) {
            this.emit('servertext', from, to, text, raw);
        },
        /* RPL_ENDOFMOTD */ '376': function(raw, from, text) {
            return this._messageHandlers['372'].apply(this, arguments);
        },
        /* RPL_NAMRPLY */ '353': function(raw, from, to, type, where, names) {
            this._cache['names'] = this._cache['names'] || {};
            this._cache['names'][where] = (this._cache['names'][where] || []).concat(names.split(' '));
        },
        /* RPL_ENDOFNAMES */ '366': function(raw, from, to, where) {
            var namesCache = this._cache['names']||[];
            var names = namesCache[where]||[];
            this.emit('names', where, names);
            if (this._cache['names'] && this._cache['names'][where]) delete this._cache['names'][where];
        },
        /* RPL_WHOISUSER */ '311': function(raw, from, to, nick, ident, host, noop, realname) {
            this._cache['whois'] = this._cache['whois'] || {};
            var whois = this._cache['whois'][nick] = (this._cache['whois'][nick] || {});
            whois.nick = nick;
            whois.ident = ident;
            whois.host = host;
            whois.realname = realname;
        },
        /* RPL_WHOISCHANNELS */ '319': function(raw, from, to, nick, channels) {
            this._cache['whois'] = this._cache['whois'] || {};
            var whois = this._cache['whois'][nick] = (this._cache['whois'][nick] || {});
            whois.channels = (whois.channels || []).concat(channels.replace(/[\+@]([#&])/g, '$1').split(' '));
        },
        /* RPL_ENDOFWHOIS */ '318': function(raw, from, to, nick) {
            this._cache['whois'] = this._cache['whois'] || {};
            var whois = this._cache['whois'][nick] = (this._cache['whois'][nick] || {});
            this.emit('whois', nick, whois);
            if (this._cache['whois'] && this._cache['whois'][nick]) delete this._cache['whois'][nick];
        },
        /* RPL_NOTOPIC */ '331': function(raw, from, to, where, topic) {
            this.emit('topic', where, null, null, raw);
        },
        /* RPL_TOPIC */ '332': function(raw, from, to, where, topic) {
            this.emit('topic', where, topic, null, raw);
        },
        /* RPL_LINKCHANNEL */ '470': function(raw, from, to, original, redirect) {
            this.emit('redirected', to, original, redirect);
        },
        /* RPL_TOPICWHOTIME */ '333': function(raw, from, to, where, who, timestamp) {
            var identity = parseIdentity(who);
            this.emit('topicinfo', where, identity.nick, timestamp);
        },
        'PING': function(raw, from) {
            this._socket.write('PONG :' + from + '\r\n');
        },
        'PONG': function(raw, from) {
        },
        // Client messages
        'MODE': function(raw, who, target, modes, mask) {
            var identity = parseIdentity(who);
            this.emit('mode', identity.nick, target, modes, mask, raw);
        },
        'TOPIC': function(raw, who, channel, topic) {
            var identity = parseIdentity(who);
            this.emit('topic', channel, topic, identity.nick, raw);
        },
        'PRIVMSG': function(raw, from, to, message) {
            var identity = parseIdentity(from);
            this.emit('privmsg', identity.nick, to, message, raw);
        },
        'NOTICE': function(raw, from, to, message) {
            var identity = parseIdentity(from);
            this.emit('notice', identity.nick, to, message, raw);
        },
        'JOIN': function(raw, who, channel) {
            var identity = parseIdentity(who);
            this.emit('join', identity.nick, channel, raw);
        },
        'KICK': function(raw, who, where, target, why) {
            var identity = parseIdentity(who);
            this.emit('kick', identity.nick, where, target, why, raw);
        },
        'NICK': function(raw, from, data) {
            // :Angel!foo@bar NICK newnick
            var identity = parseIdentity(from);
            var data = data.match(/:?(.*)/);
            if (!data) throw 'invalid NICK structure';
            if (from == this._username) this._username = newnick;
            this.emit('nick', identity.nick, data[1], raw);
        },
        'PART': function(raw, who, where) {
            var identity = parseIdentity(who);
            this.emit('part', identity.nick, where, raw);
        },
        'QUIT': function(raw, who, message) {
            var identity = parseIdentity(who);
            this.emit('quit', identity.nick, message, raw);
        },
        'CTCP_PRIVMSG_PING': function(raw, from, to, data) {
            var identity = parseIdentity(from);
            this.emit('ping', identity.nick);
            this._socket.write('NOTICE ' + identity.nick + ' :\1PING ' + data + '\1\r\n');
        },
        'CTCP_NOTICE_PING': function(raw, from, to, data) {
            var identity = parseIdentity(from);
            this.emit('ping-reply', identity.nick, Date.now() - Number(data));
        },
        'CTCP_PRIVMSG_ACTION': function(raw, from, to, data) {
            var identity = parseIdentity(from);
            this.emit('action', identity.nick, to, data, raw);
        },
    },
    _processServerMessage: function(line) {
        this._debug(4, 'Incoming: ' + line);
        this.emit('raw', line);

        // ctcp handling should be rewritten
        var matches = line.match(/^:([^\s]*)\s([^\s]*)\s([^\s]*)\s:\u0001([^\s]*)\s(.*)\u0001/);
        if (matches) {
            var handler = this._messageHandlers['CTCP_' + matches[2] + '_' + matches[4]];
            if (typeof handler !== 'undefined') {
                handler.call(this, line, matches[1], matches[3], matches[5]);
            }
            else {
                this._debug(2, 'Unhandled ctcp: ' + line);
            }
            return;
        }

        // anything other than ctcp
        var parts = line.trim().split(/ :/)
          , args = parts[0].split(' ');
        if (parts.length > 1) args.push(parts.slice(1).join(' :'));
        if (line.match(/^:/)) {
            args[1] = args.splice(0, 1, args[1]);
            args[1] = (args[1] + '').replace(/^:/, '');
        }
        var command = args[0].toUpperCase();
        args = args.slice(1);
        args.unshift(line);

        var handler = this._messageHandlers[command];
        if (typeof handler == 'function') handler.apply(this, args);
        else if (typeof handler == 'string') {
            args.unshift(handler);
            this._errorHandler.apply(this, args);
        }
        else this._debug(2, 'Unhandled msg: ' + line);
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
