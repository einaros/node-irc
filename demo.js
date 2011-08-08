var IRC = require('./IRC').IRC;
var irc = new IRC('irc.homelien.no', 6667);
irc.on('connected', function(server) {
    console.log('connected to ' + server);
    irc.join('#foobartest', function() {
        // irc.privmsg('#foobartest', 'well hello yall');
        // irc.nick('muppetty2', function(old, newn) {
        //     irc.privmsg('#foobartest', 'I\'m new!');
        // });
    });
});
irc.on('quit', function(who, message) {
    console.log(who + ' quit: ' + message);
});
irc.on('part', function(who, channel) {
    console.log(who + ' left ' + channel);
});
irc.on('privmsg', function(from, to, message) {
    console.log('<' + from + '> to ' + to + ': ' + message);
    // if (to[0] == '#') irc.privmsg(to, 'public greetings, ' + from);
    // else irc.privmsg(from, 'hi!');
});
irc.on('servertext', function(from, to, text) {
    console.log('(' + from + ') ' + text);
});
irc.on('ping', function(from) {
    console.log('ping from ' + from);
    irc.ping(from);
});
irc.on('ping-reply', function(from, ms) {
    console.log('ping reply from ' + from + ': ' + ms + ' ms');
});
irc.connect('muppetty');
process.on('exit', function () {
    irc.quit('bye');
});
