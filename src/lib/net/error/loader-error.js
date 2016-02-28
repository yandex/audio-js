var ErrorClass = require('../../class/error-class');

/**
 * Класс ошибок загрузчика.
 * @name Audio.LoaderError
 * @class
 * @namespace ya.music
 * @param {String} message Текст ошибки.
 *
 * @extends Error
 *
 * @constructor
 */
var LoaderError = function(message) {
    ErrorClass.call(this, message);
};
LoaderError.prototype = ErrorClass.create("LoaderError");

/**
 * Таймаут загрузки.
 * @type {string}
 * @const
 */
LoaderError.TIMEOUT = "request timeout";
/**
 * Ошибка запроса на загрузку.
 * @type {string}
 * @const
 */
LoaderError.FAILED = "request failed";

module.exports = LoaderError;
