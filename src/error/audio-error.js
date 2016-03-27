var ErrorClass = require('../lib/class/error-class');

/**
 * @name Audio.AudioError
 * @class Класс ошибки аудиопллеера.
 * @extends <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error">Error</xref>
 * @param {String} message Текст ошибки.
 *
 * @constructor
 */
var AudioError = function(message) {
    ErrorClass.call(this, message);
};
AudioError.prototype = ErrorClass.create("AudioError");

/**
 * Не найдена реализация плеера или возникла ошибка при инициализации всех доступных реализаций.
 * @type String
 * @const
 * @name Audio.AudioError.NO_IMPLEMENTATION
 */
AudioError.NO_IMPLEMENTATION = "cannot find suitable implementation";
/**
 * Аудиофайл не был предзагружен или во время загрузки произошла ошибка.
 * @type String
 * @const
 * @name Audio.AudioError.NOT_PRELOADED
 */
AudioError.NOT_PRELOADED = "track is not preloaded";
/**
 * Действие недоступно из текущего состояния.
 * @type String
 * @const
 * @name Audio.AudioError.BAD_STATE
 */
AudioError.BAD_STATE = "action is not permited from current state";

/**
 * Flash-плеер был заблокирован.
 * @type String
 * @const
 * @name Audio.AudioError.FLASH_BLOCKER
 */
AudioError.FLASH_BLOCKER = "flash is rejected by flash blocker plugin";
/**
 * Возникла ошибка при инициализации Flash-плеера по неизвестным причинам.
 * @type String
 * @const
 * @name Audio.AudioError.FLASH_UNKNOWN_CRASH
 */
AudioError.FLASH_UNKNOWN_CRASH = "flash is crashed without reason";
/**
 * Возникла ошибка при инициализации Flash-плеера из-за таймаута.
 * @type String
 * @const
 * @name Audio.AudioError.FLASH_INIT_TIMEOUT
 */
AudioError.FLASH_INIT_TIMEOUT = "flash init timed out";
/**
 * Внутренняя ошибка Flash-плеера.
 * @type String
 * @const
 * @name Audio.AudioError.FLASH_INTERNAL_ERROR
 */
AudioError.FLASH_INTERNAL_ERROR = "flash internal error";
/**
 * Попытка вызвать недоступный экземляр Flash-плеера.
 * @type String
 * @const @name Audio.AudioError.FLASH_EMMITER_NOT_FOUND
 */
AudioError.FLASH_EMMITER_NOT_FOUND = "flash event emmiter not found";
/**
 * Flash-плеер перестал отвечать на запросы.
 * @type String
 * @const
 * @name Audio.AudioError.FLASH_NOT_RESPONDING
 */
AudioError.FLASH_NOT_RESPONDING = "flash player doesn't response";

module.exports = AudioError;
