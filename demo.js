var IRC = require('./IRC').IRC;
var irc = new IRC('irc.homelien.no', 6667);
irc.on('connected', function(server) {
    console.log('connected to ' + server);
    irc.join('#foobartest', function(error) {
        if (error) {
            console.log('error joining channel: ' + error);
            return;
        }
        irc.privmsg('#foobartest', 'well hello yall');
        irc.nick('muppetty2', function(old, newn) {
            irc.privmsg('#foobartest', 'I\'m new!');
        });
    });
});
irc.on('join', function(who, where) {
   console.log(who + ' joined ' + where);
   if (where == '#foobartest' && who != irc.whoami()) {
       irc.kick(where, who, 'woot', function(error) {
           if (error) {
               console.log('error kicking user: ' + error);
               return;
           }
           irc.mode(where, '+b', who + '!*@*', function(error) {
               if (error) {
                   console.log('error banning user: ' + error);
                   return;
               }               
           });
       });
   } 
});
irc.on('quit', function(who, message) {
    console.log(who + ' quit: ' + message);
});
irc.on('part', function(who, channel) {
    console.log(who + ' left ' + channel);
});
irc.on('kick', function(who, channel, target, message) {
    console.log(target + ' was kicked from ' + channel + ' by ' + who + ': ' + message);
});
irc.on('names', function(channel, names) {
    console.log(channel + ' users: ' + names);
});
irc.on('privmsg', function(from, to, message) {
    console.log('<' + from + '> to ' + to + ': ' + message);
    if (to[0] == '#') irc.privmsg(to, 'public greetings, ' + from);
    else irc.privmsg(from, 'hi!');
});
irc.on('mode', function(who, target, modes, mask) {
    console.log(who + ' set mode ' + modes + (mask ? ' ' + mask : '') + ' on ' + target);
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
