exports.fake = function(source) {
    var object = {};
    var methods = [];
    if (Object.prototype.toString.call(source) === '[object Object]') {
        var names = Object.getOwnPropertyNames(source);
        for (var i in names) {
            var member = source[names[i]];
            if (typeof member === 'function') methods.push(names[i]);
        }
    }
    else if (Object.prototype.toString.call(source) === '[object Array]') {
        methods = source;
    }
    methods.forEach(function(name, i) {
        Object.defineProperty(object, name, {
            enumerable: false,
            value: function() {
                object[name].history.push(arguments);
                if (object[name].nextHandler.length > 0) {
                    handler = object[name].nextHandler.pop();
                    return handler.apply(this, arguments);
                }
                return object[name].defaultReturnValue;
            }
        });
        Object.defineProperties(object[name], {
            history: {
                enumerable: false,
                value: []
            },
            nextHandler: {
                enumerable: false,
                value: []
            },
            next: {
                enumerable: false,
                value: function(handler) {
                    object[name].nextHandler.push(handler);
                }
            },
            returns: {
                enumerable: false,
                value: function(value) {
                    object[name].defaultReturnValue = value;
                }
            }
        });
    });
    return object;
}
// var fakeSocket = exports.fake(require('net').Socket.prototype);
// console.log(fakeSocket);
// fakeSocket.connect.returns('hi');
// console.log(fakeSocket.connect());
/*
var obj = fake(['on', 'setEncoding', 'connect', 'write']);
console.log(obj.connect.history);
obj.connect(1, 2, 3);
//obj.connect.next(function() {console.log('connect called');});
obj.connect.require(1);
//obj.connect(3, 2, 1);
obj.verify();
console.log(obj.connect.history);
*/