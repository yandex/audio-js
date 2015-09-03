var Promise = require('./promise');
var noop = require('../noop');

var Deferred = module.exports = function() {
    var self = this;

    var _promise = new Promise(function(resolve, reject) {
        self.resolve = resolve;
        self.reject = reject;
    });

    var promise = _promise.then(function(data) { // FIXME: убрать этот мусор
        self.resolved = true;
        self.pending = false;
        return data;
    }, function(err) {
        self.rejected = true;
        self.pending = false;
        throw err;
    });
    promise["catch"](noop); // Don't throw errors to console

    self.pending = true;

    self.promise = function() { return promise; };
};

Deferred.when = function() {
    var deferred = new Deferred();

    var list = [].slice.call(arguments);
    var pending = list.length;

    var resolve = function() {
        pending--;

        if (pending <= 0) {
            deferred.resolve();
        }
    };

    list.forEach(function(promise) {
        promise.then(resolve, deferred.reject);
    });
    list = null;

    deferred.promise.abort = deferred.reject;

    return deferred.promise();
};
