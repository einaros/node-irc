exports.private = function(target, source, writable) {
    Object.keys(source).forEach(function(name) {
        Object.defineProperty(target, name, {
            enumerable: false,
            value: source[name],
            writable: writable === true,
        });
    });
}
exports.public = function(target, source, writable) {
    Object.keys(source).forEach(function(name) {
        Object.defineProperty(target, name, {
            enumerable: true,
            value: source[name],
            writable: writable === true,
        });
    });
}
