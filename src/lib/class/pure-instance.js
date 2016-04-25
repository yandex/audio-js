/**
 * Создаёт экземпляр класса, но не запускает его конструктор
 * @param {function} OriginalClass - класс
 * @exported ya.music.lib.pureInstance
 * @returns {OriginalClass}
 */
var pureInstance = function(OriginalClass) {
    var PureClass = function() {};
    PureClass.prototype = OriginalClass.prototype;
    return new PureClass();
};

module.exports = pureInstance;
