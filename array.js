if (typeof Array.prototype.last === 'undefined') {
    Object.defineProperty(Array.prototype, "last", {
        enumerable: false,
        value: function(filter) {
            if (this.length == 0) return undefined;
            if (typeof filter === 'function') {
                for (var i = this.length - 1; i >= 0; --i) {
                    var val = this[i];
                    if (filter(val)) return val;
                }
                return undefined;
            }
            return this[this.length - 1];
        }
    });
}