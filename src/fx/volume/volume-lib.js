/**
 * @class Методы конвертации значений громкости.
 * @static
 * @name Audio.fx.volumeLib
 */
var volumeLib = {};

/**
 * Минимальное значение громкости, при котором происходит отключение звука.
 * Ограничение в 0.01 подобрано эмпирически.
 * @type number
 * @field
 * @name Audio.fx.volumeLib.EPSILON
 */
volumeLib.EPSILON = 0.01;

/**
 * Коэффициент для преобразований громкости из относительной шкалы в децибелы.
 * @type Number
 * @private
 */
volumeLib._DBFS_COEF = 20 / Math.log(10);

/**
 * Вычисление значение громкости по значению на логарифмической шкале.
 * @function
 * @name Audio.fx.volumeLib#toExponent
 * @param {Number} value Значение на шкале.
 * @returns {Number} значение громкости.
 */
volumeLib.toExponent = function(value) {
    var volume = Math.pow(volumeLib.EPSILON, 1 - value);
    return volume > volumeLib.EPSILON ? volume : 0;
};

/**
 * @function
 * @name Audio.fx.volumeLib#fromExponent
 * @param {Number} volume Громкость.
 * @returns {Number} значения положения на логарифмической шкале по значению громкости.
 */
volumeLib.fromExponent = function(volume) {
    return 1 - Math.log(Math.max(volume, volumeLib.EPSILON)) / Math.log(volumeLib.EPSILON);
};

/**
 * @function
 * @name Audio.fx.volumeLib#toDBFS
 * @param {Number} volume Относительная громкость.
 * @returns {Number} значения dBFS из относительного значения громкости.
 */
volumeLib.toDBFS = function(volume) {
    return Math.log(volume) * volumeLib._DBFS_COEF;
};

/**
 * @function
 * @name Audio.fx.volumeLib#fromDBFS
 * @param {Number} dbfs Громкость в dBFS.
 * @returns {Number} значения относительной громкости из значения dBFS.
 */
volumeLib.fromDBFS = function(dbfs) {
    return Math.exp(dbfs / volumeLib._DBFS_COEF);
};

module.exports = volumeLib;
