var ErrorClass = require('../lib/class/error-class');

/**
 * @name Audio.PlaybackError
 * @class Класс ошибки воспроизведения.
 * <p>Расширяет <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error">Error</xref>.</p>
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
 * @type String
 * @const
 * @name Audio.PlaybackError.CONNECTION_ABORTED
 */
PlaybackError.CONNECTION_ABORTED = "Connection aborted";
/**
 * Сетевая ошибка.
 * @type String
 * @const
 * @name Audio.PlaybackError.NETWORK_ERROR
 */
PlaybackError.NETWORK_ERROR = "Network error";
/**
 * Ошибка декодирования аудио.
 * @type String
 * @const
 * @name Audio.PlaybackError.DECODE_ERROR
 */
PlaybackError.DECODE_ERROR = "Decode error";
/**
 * Недоступный источник.
 * @type String
 * @const
 * @name Audio.PlaybackError.BAD_DATA
 */
PlaybackError.BAD_DATA = "Bad data";

/**
 * Не запускается воспроизведение.
 * @type String
 * @const
 * @name Audio.PlaybackError.DONT_START
 */
PlaybackError.DONT_START = "Playback start error";

/**
 * Таблица соответствия кодов ошибок HTML5 плеера. Содержит поля:
 * <p>1: PlaybackError.CONNECTION_ABORTED,<br/>
 * 2: PlaybackError.NETWORK_ERROR,<br/>
 * 3: PlaybackError.DECODE_ERROR,<br/>
 * 4: PlaybackError.BAD_DATA</p>
 * @const
 * @type Object
 * @name Audio.PlaybackError.html5
 */
PlaybackError.html5 = {
    1: PlaybackError.CONNECTION_ABORTED,
    2: PlaybackError.NETWORK_ERROR,
    3: PlaybackError.DECODE_ERROR,
    4: PlaybackError.BAD_DATA
};

//TODO: сделать классификатор ошибок flash-плеера

module.exports = PlaybackError;
