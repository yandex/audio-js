var Logger = require('../logger/logger');
var logger = new Logger('AudioHTML5Loader');

var Events = require('../lib/async/events');
var Deferred = require('../lib/async/deferred');
var AudioStatic = require('../audio-static');
var PlaybackError = require('../error/playback-error');
var noop = require('../lib/noop');

var loaderId = 1;

// =================================================================

//  Конструктор

// =================================================================

/**
 * @class Обёртка для нативного класса Audio
 * @extends Events
 *
 * @fires IAudioImplementation#play
 * @fires IAudioImplementation#ended
 * @fires IAudioImplementation#stop
 * @fires IAudioImplementation#pause
 * @fires IAudioImplementation#progress
 * @fires IAudioImplementation#loading
 * @fires IAudioImplementation#loaded
 * @fires IAudioImplementation#error
 *
 * @constructor
 * @private
 */
var AudioHTML5Loader = function() {
    this.name = loaderId++;
    logger.debug(this, "constructor");

    Events.call(this);
    this.on("*", function(event) {
        if (event !== AudioStatic.EVENT_PROGRESS) {
            logger.debug(this, "onEvent", event);
        }
    }.bind(this));

    /**
     * Контейнер для различных ожиданий событий
     * @type {Object.<String, Deferred>}
     * @private
     */
    this.promises = {};

    /**
     * Ссылка на трек
     * @type {string}
     * @private
     */
    this.src = "";
    /**
     * Назначенная позиция воспроизведения
     * @type {number}
     * @private
     */
    this.position = 0;

    /**
     * Время последнего обновления данных
     * @type {number}
     * @private
     */
    this.lastUpdate = 0;

    /**
     * Флаг начала загрузки
     * @type {boolean}
     * @private
     */
    this.notLoading = true;

    /**
     * Выход для Web Audio API
     * @type {AudioNode}
     * @private
     */
    this.output = null;

    //--- Сахар для защиты от утечек памяти
    this.__startPlay = this._startPlay.bind(this);
    this.__restart = this._restart.bind(this);
    this.__startupAudio = this._startupAudio.bind(this);

    this.__updateProgress = this._updateProgress.bind(this);
    this.__onNativeLoading = this._onNativeLoading.bind(this);
    this.__onNativeEnded = this._onNativeEnded.bind(this);
    this.__onNativeError = this._onNativeError.bind(this);

    this.__onNativePause = this.trigger.bind(this, AudioStatic.EVENT_PAUSE);
    this.__onNativePlay = this.trigger.bind(this, AudioStatic.EVENT_PLAY);

    this._initAudio();
};
Events.mixin(AudioHTML5Loader);

/**
 * Интервал обновления таймингов трека
 * @type {number}
 * @private
 * @const
 */
AudioHTML5Loader._updateInterval = 250;

// =================================================================

//  Нативные события Audio

// =================================================================

/**
 * Нативное событие начала воспроизведения
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_PLAY = "play";

/**
 * Нативное событие паузы
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_PAUSE = "pause";

/**
 * Нативное событие обновление позиции воспроизведения
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE = "timeupdate";

/**
 * Нативное событие завершения трека
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_ENDED = "ended";

/**
 * Нативное событие изменения длительности
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_DURATION = "durationchange";

/**
 * Нативное событие изменения длительности загруженной части
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_LOADING = "progress";

/**
 * Нативное событие доступности мета-данных трека
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_META = "loadedmetadata";

/**
 * Нативное событие возможности начать воспроизведение
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_CANPLAY = "canplay";

/**
 * Нативное событие ошибки
 * @type {string}
 * @const
 */
AudioHTML5Loader.EVENT_NATIVE_ERROR = "error";

// =================================================================

//  Обработчики событий

// =================================================================

/**
 * Обработчик обновления таймингов трека
 * @private
 */
AudioHTML5Loader.prototype._updateProgress = function() {
    var currentTime = +new Date();
    if (currentTime - this.lastUpdate < AudioHTML5Loader._updateInterval) {
        return;
    }

    this.lastUpdate = currentTime;
    this.trigger(AudioStatic.EVENT_PROGRESS);
};

/**
 * Обработчик событий загрузки трека
 * @private
 */
AudioHTML5Loader.prototype._onNativeLoading = function() {
    this._updateProgress();

    if (this.audio.buffered.length) {
        var loaded = this.audio.buffered.end(0) - this.audio.buffered.start(0);

        if (this.notLoading && loaded) {
            this.notLoading = false;
            this.trigger(AudioStatic.EVENT_LOADING);
        }

        if (loaded >= this.audio.duration - 0.1) {
            this.trigger(AudioStatic.EVENT_LOADED);
        }
    }
};

/**
 * Обработчик события окончания трека
 * @private
 */
AudioHTML5Loader.prototype._onNativeEnded = function() {
    this.trigger(AudioStatic.EVENT_PROGRESS);
    this.trigger(AudioStatic.EVENT_ENDED);
    this.ended = true;
    this.pause();
};

/**
 * Обработчик ошибок воспроизведения
 * @param {Event} e - Событие ошибки
 * @private
 */
AudioHTML5Loader.prototype._onNativeError = function(e) {
    if (!this.src) {
        return;
    }

    var error = new PlaybackError(this.audio.error
            ? PlaybackError.html5[this.audio.error.code]
            : e instanceof Error ? e.message : e,
        this.src);

    this.trigger(AudioStatic.EVENT_ERROR, error);
};

// =================================================================

//  Инициализация и деинициализация Audio

// =================================================================

/**
 * Создание объекта Audio и назначение обработчиков событий
 * @private
 */
AudioHTML5Loader.prototype._initAudio = function() {
    logger.debug(this, "_initAudio");

    this.muteEvents();

    this.audio = document.createElement("audio");
    this.audio.loop = false; // for IE
    this.audio.preload = this.audio.autobuffer = "auto"; // 100%

    document.body.addEventListener("mousedown", this.__startupAudio);
    document.body.addEventListener("keydown", this.__startupAudio);
    document.body.addEventListener("touchstart", this.__startupAudio);

    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_PAUSE, this.__onNativePause);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_PLAY, this.__onNativePlay);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_ENDED, this.__onNativeEnded);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE, this.__updateProgress);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_DURATION, this.__updateProgress);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_LOADING, this.__onNativeLoading);
    this.audio.addEventListener(AudioHTML5Loader.EVENT_NATIVE_ERROR, this.__onNativeError);
};

/**
 * Отключение обработчиков событий и удаление объекта Audio
 * @private
 */
AudioHTML5Loader.prototype._deinitAudio = function() {
    logger.debug(this, "_deinitAudio");

    this.muteEvents();

    document.body.removeEventListener("mousedown", this.__startupAudio);
    document.body.removeEventListener("keydown", this.__startupAudio);
    document.body.removeEventListener("touchstart", this.__startupAudio);

    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_PAUSE, this.__onNativePause);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_PLAY, this.__onNativePlay);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_ENDED, this.__onNativeEnded);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE, this.__updateProgress);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_DURATION, this.__updateProgress);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_LOADING, this.__onNativeLoading);
    this.audio.removeEventListener(AudioHTML5Loader.EVENT_NATIVE_ERROR, this.__onNativeError);

    this.audio = null;
};

/**
 * Инициализация объекта Audio. Для начала воспроизведение требуется любое пользовательское действие.
 * @private
 */
AudioHTML5Loader.prototype._startupAudio = function() {
    logger.debug(this, "_startupAudio");

    document.body.removeEventListener("mousedown", this.__startupAudio);
    document.body.removeEventListener("keydown", this.__startupAudio);
    document.body.removeEventListener("touchstart", this.__startupAudio);

    //INFO: перед использованием объект Audio требуется инициализировать, в обработчике пользовательского события
    this.audio.play();

    //INFO: некоторые браузеры слишком упортно пытаются запустить воспроизведение - нужно ограничивать
    this.audio.pause();

    //INFO: IE (как всегда) не умеет правильно работать - приходится повторять по 2 раза...
    setTimeout(function() {
        this.audio.pause();

        //TODO: проверить, что не слишком рано разрешаем триггерить события
        this.unmuteEvents();
        logger.debug(this, "_startupAudio:ready");
    }.bind(this), 0);
};

// =================================================================

//  Методы ожидания различных событий и генерации обещаний

// =================================================================

/**
 * Дождаться определённого состояния плеера
 * @param {String} name - имя состояния
 * @param {Function} check - метод проверки, что мы находимся в нужном состоянии
 * @param {Array.<String>} listen - список событий, при которых может смениться состояние
 * @returns {Promise}
 * @private
 */
AudioHTML5Loader.prototype._waitFor = function(name, check, listen) {
    if (!this.promises[name]) {
        var deferred = new Deferred();
        this.promises[name] = deferred;

        if (check.call(this)) {
            deferred.resolve();
        } else {
            var listener = function() {
                if (check.call(this)) {
                    deferred.resolve();
                }
            }.bind(this);

            var clearListeners = function() {
                for (var i = 0, l = listen.length; i < l; i++) {
                    this.audio.removeEventListener(listen[i], listener);
                }
            }.bind(this);

            for (var i = 0, l = listen.length; i < l; i++) {
                this.audio.addEventListener(listen[i], listener);
            }

            deferred.promise().then(clearListeners, clearListeners);
        }
    }

    return this.promises[name].promise();
};

/**
 * Отмена ожидания состояния
 * @param {String} name - имя состояния
 * @param {String} reason - причина отмены ожидания
 * @todo reason сделать наследником класса Error
 * @private
 */
AudioHTML5Loader.prototype._cancelWait = function(name, reason) {
    var promise;
    if (promise = this.promises[name]) {
        delete this.promises[name];
        promise.reject(reason);
    }
};

/**
 * Отмена всех ожиданий
 * @param {String} reason - причина отмены ожидания
 * @todo reason сделать наследником класса Error
 * @private
 */
AudioHTML5Loader.prototype._abortPromises = function(reason) {
    for (var key in this.promises) {
        if (this.promises.hasOwnProperty(key)) {
            this._cancelWait(key, reason);
        }
    }
};

// =================================================================

//  Ожидание получения метаданных трека

// =================================================================

/**
 * Список событий плеера при которых можно ожидать готовности метаданных
 * @type {Array.<String>}
 * @private
 */
AudioHTML5Loader._promiseMetadataEvents = [AudioHTML5Loader.EVENT_NATIVE_META, AudioHTML5Loader.EVENT_NATIVE_CANPLAY];

/**
 * Проверка получения метаданных
 * @returns {boolean}
 * @private
 */
AudioHTML5Loader.prototype._promiseMetadataCheck = function() {
    return this.audio.readyState > this.audio.HAVE_METADATA;
};

/**
 * Ожидание получения метаданных
 * @returns {Promise}
 * @private
 */
AudioHTML5Loader.prototype._promiseMetadata = function() {
    return this._waitFor("metadata", this._promiseMetadataCheck, AudioHTML5Loader._promiseMetadataEvents);
};

// =================================================================

//  Ожидание загрузки нужной части трека

// =================================================================

/**
 * Список событий плеера при которых можно ожидать загрузки
 * @type {Array.<String>}
 * @private
 */
AudioHTML5Loader._promiseLoadedEvents = [AudioHTML5Loader.EVENT_NATIVE_LOADING];

/**
 * Проверка, что загружена нужная часть трека
 * @returns {boolean}
 * @private
 */
AudioHTML5Loader.prototype._promiseLoadedCheck = function() {
    var loaded = Math.min(this.position + 1, this.audio.duration);
    return this.audio.buffered.length
        && this.audio.buffered.end(0) - this.audio.buffered.start(0) >= loaded;
};

/**
 * Ожидание загрузки нужной части трека
 * @returns {Promise}
 * @private
 */
AudioHTML5Loader.prototype._promiseLoaded = function() {
    return this._waitFor("loaded", this._promiseLoadedCheck, AudioHTML5Loader._promiseLoadedEvents);
};

// =================================================================

//  Ожидание проигрывания нужной части трека

// =================================================================

/**
 * Список событий плеера при которых можно ожидать проигрывания нужно части
 * @type {Array.<String>}
 * @private
 */
AudioHTML5Loader._promisePlayingEvents = [AudioHTML5Loader.EVENT_NATIVE_TIMEUPDATE];

/**
 * Проверка, что проигрывается нужная часть трека
 * @returns {boolean}
 * @private
 */
AudioHTML5Loader.prototype._promisePlayingCheck = function() {
    var time = Math.min(this.position + 0.2, this.audio.duration);
    return this.audio.currentTime >= time;
};

/**
 * Ожидание проигрывания нужной части трека
 * @returns {Promise}
 * @private
 */
AudioHTML5Loader.prototype._promisePlaying = function() {
    return this._waitFor("playing", this._promisePlayingCheck, AudioHTML5Loader._promisePlayingEvents);
};

// =================================================================

//  Ожидание начала воспроизведения

// =================================================================

/**
 * Ожидание начала воспроиведения, перезапуск трека, если воспроизведение не началось
 * @returns {Promise}
 * @private
 */
AudioHTML5Loader.prototype._promiseStartPlaying = function() {
    if (!this.promises["startPlaying"]) {
        var deferred = new Deferred();
        this.promises["startPlaying"] = deferred;

        //INFO: если отменено ожидание загрузки или воспроизведения, то нужно отменить и это обещание
        var reject = this._cancelWait.bind(this, "startPlaying");

        this._promiseLoaded().then(function() {
            this._promisePlaying().then(function() {
                deferred.resolve();
                logger.debug(this, "startPlaying:success");
            }.bind(this), reject);

            setTimeout(function() {
                deferred.reject("timeout");
                this._cancelWait("playing", "timeout");
                logger.warn(this, "startPlaying:failed");
            }.bind(this), 1000);
        }.bind(this), reject);
    }

    return this.promises["startPlaying"].promise();
};

// =================================================================

//  Управление элементом Audio

// =================================================================

/**
 * Начать загрузку трека
 * @param {String} src
 */
AudioHTML5Loader.prototype.load = function(src) {
    logger.debug(this, "load", src);

    this._abortPromises("load");

    this.playing = false;
    this.notLoading = true;
    this.position = 0;

    this.src = src;
    this.audio.src = src;
    this.audio.load();
};

/** Остановить воспроизведение и загрузку трека */
AudioHTML5Loader.prototype.stop = function() {
    logger.debug(this, "stop");

    this._abortPromises("stop");
    this.load("");
};

/**
 * Начать воспроизведение трека
 * @private
 */
AudioHTML5Loader.prototype._startPlay = function() {
    logger.debug(this, "_startPlay");

    this.audio.currentTime = this.position;

    if (!this.playing) {
        return;
    }

    this.audio.play();

    //TODO: подумать нужно ли триггерить событие в случае успеха
    this._promiseStartPlaying().then(noop, this.__restart);
};

/**
 * Перезапустить воспроизведение трека
 * @param {String} [reason] - если причина вызова указана и не равна "timeout" ничего не происходит
 * @private
 */
AudioHTML5Loader.prototype._restart = function(reason) {
    //TODO: подумать нужен ли тут какой-то счётик количества попыток
    if (reason && reason !== "timeout") {
        return;
    }

    logger.debug(this, "_restart", reason);

    //INFO: Запоминаем текущее состояние, т.к. оно сбросится после перезагрузки
    var position = this.position;
    var playing = this.playing;

    this.load(this.src);

    if (playing) {
        this.play(position);
    } else {
        this.setPosition(position);
    }
};

/**
 * Воспроизведение трека/отмена паузы
 * @param {Number} [position] - позиция воспроизведения
 */
AudioHTML5Loader.prototype.play = function(position) {
    logger.debug(this, "play", position);

    this.playing = true;
    this.position = position == null ? this.position || 0 : position;
    this._promiseMetadata().then(this.__startPlay, noop);
};

/** Пауза */
AudioHTML5Loader.prototype.pause = function() {
    logger.debug(this, "pause");

    this.playing = false;
    this._cancelWait("startPlaying", "pause");
    this.audio.pause();
    this.position = this.audio.currentTime;
};

/**
 * Установить позицию воспроизведения
 * @param {Number} position - позиция воспроизведения
 */
AudioHTML5Loader.prototype.setPosition = function(position) {
    logger.debug(this, "setPosition", position);

    this.position = position;

    this._promiseMetadata().then(function() {
        this.audio.currentTime = this.position;
    }.bind(this), noop);
};

// =================================================================

//  Подключение/отключение источника для Web Audio API

// =================================================================

/**
 * Создать источник для Web Audio API
 * !!!Внимание!!! - при использовании Web Audio API в браузере стоит учитывать, что все треки должны либо загружаться
 * с того же домена, либо для них должны быть правильно выставлены заголовки CORS.
 * При вызове данного метода трек будет перезапущен
 * @param {AudioContext} audioContext - контекст Web Audio API
 */
AudioHTML5Loader.prototype.createSource = function(audioContext) {
    if (this.output) {
        return;
    }

    logger.debug(this, "createSource");

    this.audio.crossOrigin = "anonymous";
    this.output = audioContext.createMediaElementSource(this.audio);
    this.output.connect(audioContext.destination);

    this._restart();
};

/**
 * Удалить источник для Web Audio API. Удаляет источник, пересоздаёт объект Audio.
 * !!!Внимание!!! - Данный метод можно вызывать только в обработчике пользовательского события, т.к. свежесозданный
 * элемент Audio нужно инициализировать - иначе будет недоступно воспроизведение. Инициализация элемента
 * Audio возможна только в обработчике пользовательского события (клик, тач-событие или клавиатурное событие)
 */
AudioHTML5Loader.prototype.destroySource = function() {
    //INFO: единственный способ оторвать MediaElementSource от Audio - создать новый объект Audio

    if (!this.output) {
        return;
    }

    logger.warn(this, "destroySource");

    this.output.disconnect();
    this.output = null;

    this._abortPromises();

    this._deinitAudio();
    this._initAudio();
    this._startupAudio();

    this._restart();
};

// =================================================================

//  Удаление всех обработчиков и объекта Audio

// =================================================================

/** Удаление всех обработчиков и объекта Audio. После вызова данного метода этот объект будет нельзя использовать */
AudioHTML5Loader.prototype.destroy = function() {
    logger.debug(this, "destroy");

    if (this.output) {
        this.output.disconnect();
        this.output = null;
    }

    this._abortPromises();
    this._deinitAudio();

    this.__restart = null;
    this.__startPlay = null;
    this.promises = null;
};

module.exports = AudioHTML5Loader;
