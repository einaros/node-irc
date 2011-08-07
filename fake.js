exports.fake = function(methods) {
    var object = {};
    methods.forEach(function(name, i) {
        object[name] = function() {
            object[name].history.push(arguments);
            if (object[name].nextHandler.length > 0) {
                handler = object[name].nextHandler.pop();
                return handler.apply(this, arguments);
            }
        }
        Object.defineProperty(object[name], "history", {
            enumerable: false,
            value: []
        });
        Object.defineProperty(object[name], "nextHandler", {
            enumerable: false,
            value: []
        });
        Object.defineProperty(object[name], "next", {
            enumerable: false,
            value: function(handler) {
                object[name].nextHandler.push(handler);
            }
        });
    });
    return object;
}
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