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
 * @function
 * @name Promise.resolve
 * @param {*} data Данные, которыми разрешить обещание.
 * @static
 * @returns {Promise} Promise-объект.
 * @private
 */

/**
 * Создать обещание, отклоненное переданными данными.
 * @function
 * @name Promise.reject
 * @param {*} data Данные, которыми отклонить обещание.
 * @static
 * @returns {Promise} Promise-объект.
 * @private
 */

/**
 * Создать обещание, которое выполнится тогда, когда будут выполнены все переданные обещания.
 * @function
 * @name Promise.all
 * @param {Promise[]} promises Список обещаний.
 * @static
 * @returns {Promise} Promise-объект.
 * @private
 */

/**
 * Создать обещание, которое выполнится тогда, когда будет выполнено хотя бы одно из переданных обещаний.
 * @name Promise.race
 * @function
 * @param {Promise[]} promises Список обещаний.
 * @static
 * @returns {Promise} Promise-объект.
 * @private
 */

/**
 * Назначить обработчики разрешения и отклонения обещания.
 * @param {function} callback Обработчик успеха.
 * @param {null|function} [errback] Обработчик ошибки.
 * @returns {Promise} новое обещание из результатов обработчика.
 */

/**
 * Назначить обработчик отклонения обещания.
 * @param {function} errback Обработчик ошибки.
 * @returns {Promise} новое обещание из результатов обработчика.
 */

// =================================================================

// AbortablePromise

// =================================================================

/**
 * @classdecs Обещание с возможностью отмены связанного с ним действия.
 * Расширяет Promise.
 * @class AbortablePromise
 */

/**
 * Отмена действия, связанного с обещанием. Абстрактный метод.
 * @abstract
 * @param {String|Error} reason Причина отмены действия.
 */




