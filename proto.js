exports.private = function(target, source) {
    Object.keys(source).forEach(function(name) {
        Object.defineProperty(target, name, {
            enumerable: false,
            value: source[name]
        });
    });
}
exports.public = function(target, source) {
    Object.keys(source).forEach(function(name) {
        Object.defineProperty(target, name, {
            enumerable: true,
            value: source[name]
        });
    });
}
