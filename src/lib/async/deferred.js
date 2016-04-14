var Promise = require('./promise');
var noop = require('../noop');

/**
 * @classdesc Класс для управления обещанием
 * @exported ya.music.lib.Deferred
 * @constructor
 */
var Deferred = function() {
    var self = this;

    var promise = new Promise(function(resolve, reject) {
        /**
         * Разрешить обещание
         * @method Deferred#resolve
         * @param data - передать данные в обещание
         */
        self.resolve = resolve;

        /**
         * Отклонить обещание
         * @method Deferred#reject
         * @param error - передать ошибку
         */
        self.reject = reject;
    });

    promise["catch"](noop); // Don't throw errors to console

    /**
     * Получить обещание
     * @method Deferred#promise
     * @returns {Promise}
     */
    this.promise = function() { return promise; };
};

module.exports = Deferred;
