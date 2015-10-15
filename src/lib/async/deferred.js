var Promise = require('./promise');
var noop = require('../noop');

/**
 * @classdesc Отложенное действие
 * @constructor
 * @private
 */
var Deferred = function() {
    var self = this;

    var _promise = new Promise(function(resolve, reject) {
        /**
         * Разрешить обещание
         * @method Deferred#resolve
         * @param {*} data - передать данные в обещание
         */
        self.resolve = resolve;

        /**
         * Отклонить обещание
         * @method Deferred#reject
         * @param {Error} error - передать ошибку
         */
        self.reject = reject;
    });

    var promise = _promise.then(function(data) {
        self.resolved = true;
        self.pending = false;
        return data;
    }, function(err) {
        self.rejected = true;
        self.pending = false;
        throw err;
    });
    promise["catch"](noop); // Don't throw errors to console

    /**
     * Выполнилось ли обещание
     * @type {boolean}
     */
    this.pending = true;

    /**
     * Отклонилось ли обещание
     * @type {boolean}
     */
    this.rejected = false;

    /**
     * Получить обещание
     * @method Deferred#promise
     * @returns {Promise}
     */
    this.promise = function() { return promise; };
};

/**
 * Ожидание выполнения списка обещаний
 * @param {...*} args - обещания, которые требуется ожидать
 * @returns AbortablePromise
 */
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

module.exports = Deferred;
