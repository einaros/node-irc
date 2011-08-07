var IRC = require('./IRC').IRC;
var irc = new IRC('irc.homelien.no', 6667);
irc.on('privmsg', function(from, to, message) {
    console.log('privmsg: ' + message + ', from ' + from);
    // irc.privmsg(from, 'hi yourself!');
});
irc.on('ping', function(from) {
    console.log('ping from ' + from);
});
irc.connect('undefined');
process.on('exit', function () {
    irc.quit('bye');
});
