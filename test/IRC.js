require('../array');
var assert = require('assert'); 
var fake = require('../fake').fake;
var IRC = require('../IRC').IRC;

module.exports = {
    'connect attempts to set proper encoding and establish socket connection': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc.connect('undefined');
        assert.equal(1, obj.connect.history.length);
        assert.equal(1, obj.setEncoding.history.length);
        assert.equal('ascii', obj.setEncoding.history[0][0]);
    },
    'privmsg causes privmsg event': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('privmsg', function(from, to, message) {
            eventEmitted = true;
            assert.equal('foo', from);
            assert.equal('bar', to);
            assert.equal('hi there!', message);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':foo PRIVMSG bar :hi there!\r\n');
        assert.ok(eventEmitted);
    },
    'server ping causes pong and ping event': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('ping', function(from) {
            eventEmitted = true;
            assert.equal('irc.foo.bar', from);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data('PING :irc.foo.bar\r\n');
        assert.ok(eventEmitted);
        assert.equal('PONG :irc.foo.bar\r\n', obj.write.history.last()[0]);
    },
    'ctcp ping causes ping event': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('ping', function(from) {
            eventEmitted = true;
            assert.equal('foo', from);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':foo PRIVMSG bar :\1PING 1234 4321\1\r\n');
        assert.ok(eventEmitted);
        assert.ok(obj.write.history.last()[0].match(/NOTICE foo :\u0001PING 1234 4321\u0001\r\n/));
    },
    'ctcp ping reply causes ping-reply event': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        var when = Date.now();
        irc.on('ping-reply', function(from, data) {
            eventEmitted = true;
            assert.equal('foo', from);
            assert.ok(data < 10);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':foo NOTICE bar :\u0001PING ' + when + '\u0001\r\n');
        assert.ok(eventEmitted);
    },
    'server text (375) message causes servertext event': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('servertext', function(from, to, text) {
            eventEmitted = true;
            assert.equal('irc.foo.bar', from);
            assert.equal('user', to);
            assert.equal('hi there', text);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':irc.foo.bar 375 user :hi there\r\n');
        assert.ok(eventEmitted);
    },
    'server text (372) message causes servertext event': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('servertext', function(from, to, text) {
            eventEmitted = true;
            assert.equal('irc.foo.bar', from);
            assert.equal('user', to);
            assert.equal('hi there', text);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':irc.foo.bar 372 user :hi there\r\n');
        assert.ok(eventEmitted);
    },
    'end of motd message causes connected event': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('connected', function(from, to, text) {
            eventEmitted = true;
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':irc.foo.bar 376 user :end of motd\r\n');
        assert.ok(eventEmitted);
    },
    'ping sends ctcp ping': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.ping('foo');
        assert.ok(obj.write.history.last()[0].match(/^PRIVMSG foo :\u0001PING [0-9\s]*\u0001\r\n/));
    },
};
