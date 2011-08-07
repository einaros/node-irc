var assert = require('assert'); 
var fake = require('../fake').fake;
require('../array');
var IRC = require('../IRC').IRC;

module.exports = {
    'test connect': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc.connect('undefined');
        assert.equal(1, obj.connect.history.length);
        assert.equal(1, obj.setEncoding.history.length);
        assert.equal('ascii', obj.setEncoding.history[0][0]);
    },
    'test privmsg': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('privmsg', function() {
            eventEmitted = true;
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':foo PRIVMSG bar :hi there!\r\n');
        assert.ok(eventEmitted);
    },
    'test ping => pong': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('ping', function(from) {
            if (from == 'irc.foo.bar') eventEmitted = true;
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data('PING :irc.foo.bar\r\n');
        assert.ok(eventEmitted);
        assert.equal('PONG :irc.foo.bar\r\n', obj.write.history.last()[0]);
    },
    'test motd': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('servertext', function(from, to, text) {
            if (from == 'irc.foo.bar' &&
                to == 'user' &&
                text == 'hi there') eventEmitted = true;
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':irc.foo.bar 375 user :hi there\r\n');
        assert.ok(eventEmitted);
    },
    'test servertext': function(){
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('servertext', function(from, to, text) {
            if (from == 'irc.foo.bar' &&
                to == 'user' &&
                text == 'hi there') eventEmitted = true;
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':irc.foo.bar 372 user :hi there\r\n');
        assert.ok(eventEmitted);
    },
    'test end of motd': function(){
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
};
