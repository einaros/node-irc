var IRC = require('./IRC').IRC;
var irc = new IRC('irc.homelien.no', 6667);
irc.on('connected', function(server) {
    console.log('connected to ' + server);
    // irc.privmsg(from, 'hi yourself!');
});
irc.on('privmsg', function(from, to, message) {
    console.log('privmsg: ' + message + ', from ' + from);
    // irc.privmsg(from, 'hi yourself!');
    irc.privmsg(from, '\1PING ' + Date.now() + '\1');
});
irc.on('servertext', function(from, to, text) {
    console.log('(' + from + ') ' + text);
});
irc.on('ping', function(from) {
    console.log('ping from ' + from);
});
irc.on('ping-reply', function(from, ms) {
    console.log('ping reply from ' + from + ': ' + ms + ' ms');
});
irc.connect('undefined');
process.on('exit', function () {
    irc.quit('bye');
});
