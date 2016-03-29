/**
 * @namespace AudioStatic
 * @private
 */
var AudioStatic = {};

/**
 * Начало воспроизведения трека.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_PLAY = "play";
/**
 * Остановка воспроизведения.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_STOP = "stop";
/**
 * Пауза воспроизведения.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_PAUSE = "pause";
/**
 * Обновление позиции воспроизведения.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_PROGRESS = "progress";
/**
 * Началась загрузка трека.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_LOADING = "loading";
/**
 * Загрузка трека завершена.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_LOADED = "loaded";
/**
 * Изменение громкости.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_VOLUME = "volumechange";

/**
 * Воспроизведение трека завершено.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_ENDED = "ended";
/**
 * Возникла ошибка при инициализации плеера.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_CRASHED = "crashed";
/**
 * Возникла ошибка при воспроизведении.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_ERROR = "error";
/**
 * Изменение статуса плеера.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_STATE = "state";
/**
 * Переключение между текущим и предзагруженным треком.
 * @type {String}
 * @const
 */
AudioStatic.EVENT_SWAP = "swap";
/**
 * Событие предзагрузчика. Используется в качестве префикса.
 * @type {String}
 * @const
 */
AudioStatic.PRELOADER_EVENT = "preloader:";
/**
 * Плеер находится в состоянии инициализации.
 * @type {String}
 * @const
 */
AudioStatic.STATE_INIT = "init";
/**
 * Не удалось инициализировать плеер.
 * @type {String}
 * @const
 */
AudioStatic.STATE_CRASHED = "crashed";
/**
 * Плеер готов и ожидает.
 * @type {String}
 * @const
 */
AudioStatic.STATE_IDLE = "idle";
/**
 * Плеер проигрывает трек.
 * @type {String}
 * @const
 */
AudioStatic.STATE_PLAYING = "playing";
/**
 * Плеер поставлен на паузу.
 * @type {String}
 * @const
 */
AudioStatic.STATE_PAUSED = "paused";

module.exports = AudioStatic;
