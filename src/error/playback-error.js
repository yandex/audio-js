var ErrorClass = require('../lib/class/error-class');

/**
 * @class PlaybackError
 * @alias ya.music.Audio.PlaybackError
 * @classdesc Класс ошибки воспроизведения.
 * @extends Error
 * @param String message Текст ошибки.
 * @param String src Ссылка на трек.
 *
 * @constructor
 */
var PlaybackError = function(message, src) {
    ErrorClass.call(this, message);

    this.src = src;
};

PlaybackError.prototype = ErrorClass.create("PlaybackError");

/**
 * Отмена соединенния.
 * @type {String}
 * @const
 */
PlaybackError.CONNECTION_ABORTED = "Connection aborted";
/**
 * Сетевая ошибка.
 * @type {String}
 * @const
 */
PlaybackError.NETWORK_ERROR = "Network error";
/**
 * Ошибка декодирования аудио.
 * @type {String}
 * @const
 */
PlaybackError.DECODE_ERROR = "Decode error";
/**
 * Недоступный источник.
 * @type {String}
 * @const
 */
PlaybackError.BAD_DATA = "Bad data";

/**
 * Не запускается воспроизведение.
 * @type {String}
 * @const
 */
PlaybackError.DONT_START = "Playback start error";

/**
 * Таблица соответствия кодов ошибок HTML5 плеера.
 *
 * @const
 * @type {Object}
 */
PlaybackError.html5 = {
    1: PlaybackError.CONNECTION_ABORTED,
    2: PlaybackError.NETWORK_ERROR,
    3: PlaybackError.DECODE_ERROR,
    4: PlaybackError.BAD_DATA
};

//TODO: сделать классификатор ошибок flash-плеера

module.exports = PlaybackError;
