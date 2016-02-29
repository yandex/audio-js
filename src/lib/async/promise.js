var vow = require('vow');
var detect = require('../browser/detect');

// =================================================================

// Promise

// =================================================================

/**
 * @see {@link https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise|ES 2015 Promise}
 * @class
 * @name Promise
 * @private
 * @constructor
 */
var Promise;
if (typeof window.Promise !== "function"
    || detect.browser.name === "msie" || detect.browser.name === "edge" // мелкие мягкие как всегда ничего не умеют делать правильно
) {
    Promise = vow.Promise;
} else {
    Promise = window.Promise;
}

module.exports = Promise;

/**
 * Создать обещание, разрешенное переданными данными.
 * @method Promise.resolve
 * @param {*} data Данные, которыми разрешить обещание.
 * @static
 * @returns {Promise} Promise-объект.
 */

/**
 * Создать обещание, отклоненное переданными данными.
 * @method Promise.reject
 * @param {*} data Данные, которыми отклонить обещание.
 * @static
 * @returns {Promise} Promise-объект.
 */

/**
 * Создать обещание, которое выполнится тогда, когда будут выполнены все переданные обещания.
 * @method Promise.all
 * @param {Array.<Promise>} promises Список обещаний.
 * @static
 * @returns {Promise} Promise-объект.
 */

/**
 * Создать обещание, которое выполнится тогда, когда будет выполнено хотя бы одно из переданных обещаний.
 * @method Promise.race
 * @param {Array.<Promise>} promises Список обещаний.
 * @static
 * @returns {Promise} Promise-объект.
 */

/**
 * Назначить обработчики разрешения и отклонения обещания.
 * @method Promise#then
 * @param {function} callback - обработчик успеха
 * @param {null|function} [errback] - обработчик ошибки
 * @returns {Promise} -- новое обещание из результатов обработчика
 */

/**
 * Назначить обработчик отклонения обещания.
 * @method Promise#catch
 * @param {function} errback Обработчик ошибки.
 * @returns {Promise} новое обещание из результатов обработчика.
 */

// =================================================================

// AbortablePromise

// =================================================================

/**
 * Обещание с возможностью отмены связанного с ним действия.
 * @class
 * @name AbortablePromise
 * @extends Promise
 */

/**
 * Отмена действия связанного с обещанием
 * @abstract
 * @method AbortablePromise#abort
 * @param {String|Error} reason - причина отмены действия
 */
