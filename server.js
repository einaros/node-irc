var IRC = require('./IRC').IRC;
var irc = new IRC('irc.homelien.no', 6667);
irc.on('connected', function(server) {
    console.log('connected to ' + server);
    // irc.privmsg(from, 'hi yourself!');
});
irc.on('privmsg', function(from, to, message) {
    console.log('privmsg: ' + message + ', from ' + from);
    // irc.privmsg(from, 'hi yourself!');
});
irc.on('servertext', function(from, text) {
    console.log('(' + from + ') ' + text);
    // irc.privmsg(from, 'hi yourself!');
});
irc.on('ping', function(from) {
    console.log('ping from ' + from);
});
irc.connect('undefined');
process.on('exit', function () {
    irc.quit('bye');
});
