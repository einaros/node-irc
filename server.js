var IRC = require('./IRC').IRC;
var irc = new IRC('irc.homelien.no', 6667);
irc.on('privmsg', function(from, to, message) {
    console.log('privmsg: ' + message + ', from ' + from);
    irc.privmsg(from, 'hi yourself!');
});
irc.connect('undefined');
process.on('exit', function () {
    irc.quit('bye');
});
