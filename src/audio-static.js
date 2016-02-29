/**
 * @namespace AudioStatic
 * @private
 */
var AudioStatic = {};

/**
 * Начало воспроизведения трека.
 * @type String
 * @const
 * @name Audio.EVENT_PLAY
 */
AudioStatic.EVENT_PLAY = "play";
/**
 * Остановка воспроизведения.
 * @type String
 * @const
 * @name Audio.EVENT_STOP
 */
AudioStatic.EVENT_STOP = "stop";
/**
 * Пауза воспроизведения.
 * @type String
 * @const
 * @name Audio.EVENT_PAUSE
 */
AudioStatic.EVENT_PAUSE = "pause";
/**
 * Обновление позиции воспроизведения.
 * @type String
 * @const
 * @name Audio.EVENT_PROGRESS
 */
AudioStatic.EVENT_PROGRESS = "progress";
/**
 * Началась загрузка трека.
 * @type String
 * @const
 * @name Audio.EVENT_LOADED
 */
AudioStatic.EVENT_LOADING = "loading";
/**
 * Загрузка трека завершена.
 * @type String
 * @const
 * @name Audio.
 */
AudioStatic.EVENT_LOADED = "loaded";
/**
 * Изменение громкости.
 * @type String
 * @const
 * @name Audio.EVENT_VOLUME
 */
AudioStatic.EVENT_VOLUME = "volumechange";

/**
 * Воспроизведение трека завершено.
 * @type String
 * @const
 * @name Audio.EVENT_ENDED
 */
AudioStatic.EVENT_ENDED = "ended";
/**
 * Возникла ошибка при инициализации плеера.
 * @type String
 * @const
 * @name Audio.EVENT_CRASHED
 */
AudioStatic.EVENT_CRASHED = "crashed";
/**
 * Возникла ошибка при воспроизведении.
 * @type String
 * @const
 * @name Audio.EVENT_ERROR
 */
AudioStatic.EVENT_ERROR = "error";
/**
 * Изменение статуса плеера.
 * @type String
 * @const
 * @name Audio.EVENT_STATE
 */
AudioStatic.EVENT_STATE = "state";
/**
 * Переключение между текущим и предзагруженным треком.
 * @type String
 * @const
 * @name Audio.EVENT_SWAP
 */
AudioStatic.EVENT_SWAP = "swap";
/**
 * Событие предзагрузчика. Используется в качестве префикса.
 * @type String
 * @const
 * @name Audio.PRELOADER_EVENT
 */
AudioStatic.PRELOADER_EVENT = "preloader:";
/**
 * Плеер находится в состоянии инициализации.
 * @type String
 * @const
 * @name Audio.STATE_INIT
 */
AudioStatic.STATE_INIT = "init";
/**
 * Не удалось инициализировать плеер.
 * @type String
 * @const
 * @name Audio.STATE_CRASHED
 */
AudioStatic.STATE_CRASHED = "crashed";
/**
 * Плеер готов и ожидает.
 * @type String
 * @const
 * @name Audio.STATE_IDLE
 */
AudioStatic.STATE_IDLE = "idle";
/**
 * Плеер проигрывает трек.
 * @type String
 * @const
 * @name Audio.STATE_PLAYING
 */
AudioStatic.STATE_PLAYING = "playing";
/**
 * Плеер поставлен на паузу.
 * @type String
 * @const
 * @name Audio.STATE_PAUSED
 */
AudioStatic.STATE_PAUSED = "paused";

module.exports = AudioStatic;
