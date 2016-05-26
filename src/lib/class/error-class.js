var pureInstance = require('./pure-instance');

/**
 * @classdesc Класс ошибки. Оригинальный Error ведёт себя как фабрика, а не как класс. Этот объект ведёт себя как класс и его можно наследовать.
 * @param {String} [message] - сообщение
 * @param {Number} [id] - идентификатор ошибки
 * @extends Error
 * @exported ya.music.lib.Error
 * @constructor
 */
var ErrorClass = function(message, id) {
    var err = new Error(message, id);
    err.name = this.name;

    this.message = err.message;
    this.stack = err.stack;
};

/**
 * Сахар для быстрого создания нового класса ошибок.
 * @param {String} name - имя создаваемого класса
 * @returns {ErrorClass}
 */
ErrorClass.create = function(name) {
    var errClass = pureInstance(this);
    errClass.name = name;
    return errClass;
};

ErrorClass.prototype = pureInstance(Error);
ErrorClass.prototype.name = "ErrorClass";

module.exports = ErrorClass;
