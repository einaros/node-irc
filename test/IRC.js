require('../array');
var assert = require('assert'); 
var fake = require('../fake').fake;
var IRC = require('../IRC').IRC;

module.exports = {
    'connect attempts to set proper encoding and establish socket connection': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc.connect('undefined');
        assert.equal(1, obj.connect.history.length);
        assert.equal(1, obj.setEncoding.history.length);
        assert.equal('ascii', obj.setEncoding.history[0][0]);
    },
    'handles chunked data': function() {
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
        data(':foo PRIVMSG bar ');
        data(':hi there!\r\n');
        assert.ok(eventEmitted);
    },
    'incoming privmsg causes privmsg event': function() {
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
    'incoming join causes join event': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('join', function(who, where) {
            eventEmitted = true;
            assert.equal('foo', who);
            assert.equal('#channel', where);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':foo!bar@somewhere.com JOIN :#channel\r\n');
        assert.ok(eventEmitted);
    },
    'incoming nick causes nick-change event': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('nick-change', function(oldnick, newnick) {
            eventEmitted = true;
            assert.equal('foo', oldnick);
            assert.equal('bar', newnick);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':foo!bar@somewhere.com NICK bar\r\n');
        assert.ok(eventEmitted);
    },
    'incoming quit causes quit event': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('quit', function(who, message) {
            eventEmitted = true;
            assert.equal('baz', who);
            assert.equal('Quit: http://chat.efnet.org  (Ping timeout)', message);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':baz!bar@somewhere.com QUIT :Quit: http://chat.efnet.org  (Ping timeout)\r\n');
        assert.ok(eventEmitted);
    },
    'incoming part causes part event': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('part', function(who, where) {
            eventEmitted = true;
            assert.equal('baz', who);
            assert.equal('#test', where);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':baz!bar@somewhere.com PART #test\r\n');
        assert.ok(eventEmitted);
    },
    'incoming names list causes names event': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.on('names', function(where, names) {
            eventEmitted = true;
            assert.equal('#foobartest', where);
            assert.equal(JSON.stringify(['muppetty', '@foo', '@bar', '+baz', 'bam']), JSON.stringify(names));
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':irc.homelien.no 353 muppetty = #foobartest :muppetty @foo\r\n');
        data(':irc.homelien.no 353 muppetty = #foobartest :@bar +baz bam\r\n');
        data(':irc.homelien.no 366 muppetty #foobartest :End of /NAMES list.\r\n');
        assert.ok(eventEmitted);
    },
    'incoming server ping causes pong and ping event': function() {
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
    'incoming ctcp ping causes ping event': function() {
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
    'incoming ctcp ping reply causes ping-reply event': function() {
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
    'incoming server text (375) message causes servertext event': function() {
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
    'incoming server text (372) message causes servertext event': function() {
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
    'incoming end of motd message causes connected event': function() {
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
    'incoming ERR_NICKNAMEINUSE causes error event': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc._username = 'foo';
        var eventEmitted = false;
        irc.on('errorcode', function(code, to, regarding, reason) {
            eventEmitted = true;
            assert.equal('ERR_NICKNAMEINUSE', code);
            assert.equal('foo', to);
            assert.equal('bar', regarding);
            assert.equal('Nickname is already in use.', reason);            
        });
        irc.nick('bar');
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':irc.foo.bar 433 foo bar :Nickname is already in use.\r\n');
        assert.ok(eventEmitted);
    },
    'incoming ERR_NONICKNAMEGIVEN causes error event': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc._username = 'foo';
        var eventEmitted = false;
        irc.on('errorcode', function(code, to, reason) {
            eventEmitted = true;
            assert.equal('ERR_NONICKNAMEGIVEN', code);
            assert.equal('foo', to);
            assert.equal('Blah blah blah.', reason);            
        });
        irc.nick('bar');
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':irc.foo.bar 431 foo :Blah blah blah.\r\n');
        assert.ok(eventEmitted);
    },
    'ping sends ctcp ping command to server': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.ping('foo');
        assert.ok(obj.write.history.last()[0].match(/^PRIVMSG foo :\u0001PING [0-9\s]*\u0001\r\n/));
    },
    'privmsg sends privmsg command to server': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.privmsg('foo', 'hi there!');
        assert.ok(obj.write.history.last()[0].match(/^PRIVMSG foo :hi there!\r\n/));
    },
    'join sends join command to server': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.join('#testorama');
        assert.ok(obj.write.history.last()[0].match(/^JOIN #testorama\r\n/));
    },
    'join calls callback when joins is done': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc._username = 'foo';
        var eventEmitted = false;
        irc.join('#testorama', function() {
            eventEmitted = true;
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':foo!bar@somewhere.com JOIN :#testorama\r\n');
        assert.ok(eventEmitted);
        assert.equal(0, irc.listeners('join').length);
    },
    'nick sends nick command to server': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc.nick('bar');
        assert.ok(obj.write.history.last()[0].match(/^NICK bar\r\n/));
        assert.equal(0, irc.listeners('nick-inuse').length);
        assert.equal(0, irc.listeners('nick-change').length);
    },
    'nick calls callback when nick change is done': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc._username = 'foo';
        var eventEmitted = false;
        irc.nick('bar', function(oldnick, newnick) {
            eventEmitted = true;
            assert.equal('foo', oldnick);
            assert.equal('bar', newnick);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':foo!bar@somewhere.com NICK :bar\r\n');
        assert.ok(eventEmitted);
        assert.equal(0, irc.listeners('nick-inuse').length);
        assert.equal(0, irc.listeners('nick-change').length);
    },
    'names sends names command to server': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc.names('#test');
        assert.ok(obj.write.history.last()[0].match(/^NAMES #test\r\n/));
    },
    'names calls callback when name listing is done': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        var eventEmitted = false;
        irc.names('#foobartest', function(names) {
            eventEmitted = true;
            assert.equal(JSON.stringify(['muppetty', '@foo', '@bar', '+baz', 'bam']), JSON.stringify(names));
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':irc.homelien.no 353 muppetty = #foobartest :muppetty @foo\r\n');
        data(':irc.homelien.no 353 muppetty = #foobartest :@bar +baz bam\r\n');
        data(':irc.homelien.no 366 muppetty #foobartest :End of /NAMES list.\r\n');
        assert.ok(eventEmitted);
    },
    'nick calls callback with null newnick when nick change yields nick_in_use': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc._username = 'foo';
        var eventEmitted = false;
        irc.nick('bar', function(oldnick, newnick) {
            eventEmitted = true;
            assert.equal('foo', oldnick);
            assert.equal(null, newnick);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':irc.foo.bar 433 foo bar :Nickname is already in use.\r\n');
        assert.ok(eventEmitted);
        assert.equal(0, irc.listeners('nick-inuse').length);
        assert.equal(0, irc.listeners('nick-change').length);
    },
    'nick callbacks will stack, not execute in parallell': function() {
        var obj = fake(['on', 'setEncoding', 'connect', 'write']);
        var irc = new IRC(obj);
        irc._username = 'foo';
        var eventEmitted = 0;
        irc.nick('bar', function(oldnick, newnick) {
            eventEmitted++;
            assert.equal('foo', oldnick);
            assert.equal('bar', newnick);
        });
        irc.nick('baz', function(oldnick, newnick) {
            eventEmitted++;
            assert.equal('bar', oldnick);
            assert.equal('baz', newnick);
        });
        data = obj.on.history.filter(function(args) { return args[0] == 'data'; }).map(function(args) { return args[1]; })[0];
        data(':foo!bar@somewhere.com NICK bar\r\n');
        data(':bar!bar@somewhere.com NICK baz\r\n');
        assert.equal(2, eventEmitted);
    },
};
