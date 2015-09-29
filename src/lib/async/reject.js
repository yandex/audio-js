var noop = require('../noop');
var Promise = require('./promise');

/**
 * Содание отклонённого обещания, которое не плюётся в консоль ошибкой
 * @param {Error} data - причина отклонения обещания
 * @returns {Promise}
 * @private
 */
var reject = function(data) {
    var promise = Promise.reject(data);
    promise["catch"](noop);
    return promise;
};

module.exports = reject;
