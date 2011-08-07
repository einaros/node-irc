exports.delegate = function(obj, func) {
    return function(){ func.apply(obj, arguments); }
}
exports.bind = function(func /*, arguments */) {
    var outerArgs = arguments;
    return function() { 
        var args = [];
        for (var i = 1; i < outerArgs.length; ++i) args.push(outerArgs[i]);
        for (var i = 0; i < arguments.length; ++i) args.push(arguments[i]);
        func.apply(this, args); 
    } 
}   
