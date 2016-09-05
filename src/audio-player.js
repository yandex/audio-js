var Logger = require('./logger/logger');
var logger = new Logger('Audio');

var Events = require('./lib/async/events');
var Promise = require('./lib/async/promise');
var Deferred = require('./lib/async/deferred');
var detect = require('./lib/browser/detect');
var config = require('./config');
var merge = require('./lib/data/merge');
var reject = require('./lib/async/reject');

var AudioError = require('./error/audio-error');
var AudioStatic = require('./audio-static');

var playerId = 1;

// =================================================================

//  Настройка доступных типов реализаций и их приоритета

// =================================================================

//TODO: сделать интерфейс для возможности подключения новых типов
var audioTypes = {
    html5: require('./html5/audio-html5'),
    flash: require('./flash/audio-flash')
};

var detectString = "@" + detect.platform.version +
    " " + detect.platform.os +
    ":" + detect.browser.name +
    "/" + detect.browser.version;

audioTypes.flash.priority = 0;
audioTypes.html5.priority = config.html5.blacklist.some(function(item) { return detectString.match(item); }) ? -1 : 1;

//INFO: прям в момент инициализации всего модуля нельзя писать в лог - он проглатывает сообщения, т.к. еще нет возможности настроить логгер.
setTimeout(function() {
    logger.info({
        flash: {
            available: audioTypes.flash.available,
            priority: audioTypes.flash.priority
        },
        html5: {
            available: audioTypes.html5.available,
            priority: audioTypes.html5.priority,
            audioContext: !!audioTypes.html5.audioContext
        }
    }, "audioTypes");
}, 0);

// =================================================================

//  JSDOC: вспомогательные классы

// =================================================================

/**
 * Описание временных данных плеера.
 * @typedef {Object} Audio~AudioTimes
 *
 * @property {Number} duration Длительность аудиофайла.
 * @property {Number} loaded Длительность загруженной части.
 * @property {Number} position Позиция воспроизведения.
 * @property {Number} played Длительность воспроизведения.
 */

// =================================================================

//  JSDOC: Общие события плеера

// =================================================================

/**
 * Событие начала воспроизведения.
 * @event Audio.EVENT_PLAY
 */
/**
 * Событие завершения воспроизведения.
 * @event Audio.EVENT_ENDED
 */
/**
 * Событие изменения громкости.
 * @event Audio.EVENT_VOLUME
 * @param {Number} volume Новое значение громкости.
 */
/**
 * Событие возникновения ошибки при инициализации плеера.
 * @event Audio.EVENT_CRASHED
 */
/**
 * Событие смены статуса плеера.
 * @event Audio.EVENT_STATE
 * @param {String} state Новый статус плеера.
 */
/**
 * Событие переключения активного плеера и прелоадера.
 * @event Audio.EVENT_SWAP
 */

// =================================================================

//  JSDOC: события активного плеера

// =================================================================

/**
 * Событие остановки воспроизведения.
 * @event Audio.EVENT_STOP
 */

/**
 * Событие паузы воспроизведения.
 * @event Audio.EVENT_PAUSE
 */

/**
 * Событие обновления позиции воспроизведения или загруженной части.
 * @event Audio.EVENT_PROGRESS
 * @param {Audio~AudioTimes} times Информация о временных данных аудиофайла.
 */

/**
 * Событие начала загрузки аудиофайла.
 * @event Audio.EVENT_LOADING
 */

/**
 * Событие завершения загрузки аудиофайла.
 * @event Audio.EVENT_LOADED
 */

/**
 * Событие ошибки воспроизведения.
 * @event Audio.EVENT_ERROR
 */

// =================================================================

//  JSDOC: события предзагрузчика

// =================================================================

/**
 * Событие остановки воспроизведения.
 * @event Audio.PRELOADER_EVENT+EVENT_STOP
 */

/**
 * Событие обновления позиции загруженной части.
 * @event Audio.PRELOADER_EVENT+EVENT_PROGRESS
 * @param {Audio~AudioTimes} times Информация о временных данных аудиофайла.
 */

/**
 * Событие начала загрузки аудиофайла.
 * @event Audio.PRELOADER_EVENT+EVENT_LOADING
 */

/**
 * Событие завершения загрузки аудиофайла.
 * @event Audio.PRELOADER_EVENT+EVENT_LOADED
 */

/**
 * Событие ошибки воспроизведения.
 * @event Audio.PRELOADER_EVENT+EVENT_ERROR
 */

// =================================================================

//  Конструктор

// =================================================================

/**
 * @classdesc Аудиоплеер для браузера.
 * @exported ya.music.Audio
 *
 * @param {String} [preferredType="html5"] Предпочитаемый тип плеера. Может принимать значения: "html5", "flash" или
 * любое ложное значение (false, null, undefined, 0, ""). Если выбранный тип плеера окажется недоступен, будет запущен
 * оставшийся тип. Если указано ложное значение либо параметр не передан, то API автоматически выберет поддерживаемый тип плеера.
 * Если браузер поддерживает обе технологии, то по умолчанию YandexAudio создает аудиоплеер на основе HTML5.
 * @param {HTMLElement} [overlay] HTML-контейнер для отображения Flash-апплета.
 *
 * @extends Events
 *
 * @fires Audio.EVENT_PLAY
 * @fires Audio.EVENT_ENDED
 * @fires Audio.EVENT_VOLUME
 * @fires Audio.EVENT_CRASHED
 * @fires Audio.EVENT_STATE
 * @fires Audio.EVENT_SWAP
 *
 * @fires Audio.EVENT_STOP
 * @fires Audio.EVENT_PAUSE
 * @fires Audio.EVENT_PROGRESS
 * @fires Audio.EVENT_LOADING
 * @fires Audio.EVENT_LOADED
 * @fires Audio.EVENT_ERROR
 *
 * @fires Audio.PRELOADER_EVENT+EVENT_STOP
 * @fires Audio.PRELOADER_EVENT+EVENT_PROGRESS
 * @fires Audio.PRELOADER_EVENT+EVENT_LOADING
 * @fires Audio.PRELOADER_EVENT+EVENT_LOADED
 * @fires Audio.PRELOADER_EVENT+EVENT_ERROR
 *
 * @constructor
 */
var Audio = function(preferredType, overlay) {
    this.name = playerId++;
    DEV && logger.debug(this, "constructor");

    Events.call(this);

    this.preferredType = preferredType;
    this.overlay = overlay;
    this.state = Audio.STATE_INIT;
    this._played = 0;
    this._lastSkip = 0;
    this._playId = null;

    this._initInProgress = true;
    this._whenReady = new Deferred();
    this.whenReady = this._whenReady.promise().then(function() {
        this._initInProgress = false;
        logger.info(this, "implementation found", this.implementation.type);

        this.implementation.on("*", function(event, offset, data) {
            this._populateEvents(event, offset, data);

            if (!offset) {
                switch (event) {
                    case Audio.EVENT_PLAY:
                        this._setState(Audio.STATE_PLAYING);
                        break;

                    case Audio.EVENT_ENDED:
                    case Audio.EVENT_SWAP:
                    case Audio.EVENT_STOP:
                    case Audio.EVENT_ERROR:
                        logger.info(this, "onEnded", event, data);
                        this._setState(Audio.STATE_IDLE);
                        break;

                    case Audio.EVENT_PAUSE:
                        this._setState(Audio.STATE_PAUSED);
                        break;

                    case Audio.EVENT_CRASHED:
                        this._setState(Audio.STATE_CRASHED);
                        break;
                }
            }
        }.bind(this));

        this._setState(Audio.STATE_IDLE);
    }.bind(this), function(e) {
        this._initInProgress = false;
        logger.error(this, AudioError.NO_IMPLEMENTATION, e);

        this._setState(Audio.STATE_CRASHED);
        throw e;
    }.bind(this));

    this._init(0);
};
Events.mixin(Audio);
merge(Audio, AudioStatic, true);

// =================================================================

//  Статика

// =================================================================

/**
 * Список доступных плееров
 * @type {Object}
 * @static
 */
Audio.info = {
    html5: audioTypes.html5.available,
    flash: audioTypes.flash.available
};

/**
 * Контекст для Web Audio API.
 * @type {AudioContext}
 * @static
 */
Audio.audioContext = audioTypes.html5.audioContext;

// =================================================================

//  Инициализация

// =================================================================

/**
 * Установить статус плеера.
 * @param {String} state Новый статус.
 * @private
 */
Audio.prototype._setState = function(state) {
    DEV && logger.debug(this, "_setState", state);

    if (state === Audio.STATE_PAUSED && this.state !== Audio.STATE_PLAYING) {
        return;
    }

    var changed = this.state !== state;
    this.state = state;

    if (changed) {
        logger.info(this, "newState", state);
        this.trigger(Audio.EVENT_STATE, state);
    }
};

/**
 * Инициализация плеера.
 * @param {int} [retry=0] Количество попыток.
 * @private
 */
Audio.prototype._init = function(retry) {
    retry = retry || 0;
    logger.info(this, "_init", retry);

    if (!this._initInProgress) {
        return;
    }

    if (retry > config.audio.retry) {
        logger.error(this, AudioError.NO_IMPLEMENTATION);
        this._whenReady.reject(new AudioError(AudioError.NO_IMPLEMENTATION));
    }

    var initSeq = [
        audioTypes.html5,
        audioTypes.flash
    ].sort(function(a, b) {
        if (a.available !== b.available) {
            return a.available ? -1 : 1;
        }

        if (a.AudioImplementation.type === this.preferredType) {
            return -1;
        }

        if (b.AudioImplementation.type === this.preferredType) {
            return 1;
        }

        return b.priority - a.priority;
    }.bind(this));

    var self = this;

    function init() {
        var type = initSeq.shift();

        if (!type) {
            self._init(retry + 1);
            return;
        }

        self._initType(type).then(self._whenReady.resolve, init);
    }

    init();
};

/**
 * Запуск реализации плеера с указанным типом
 * @param {{type: string, AudioImplementation: function}} type - объект описания типа инициализации.
 * @returns {Promise}
 * @private
 */
Audio.prototype._initType = function(type) {
    logger.info(this, "_initType", type);

    var deferred = new Deferred();
    try {
        /**
         * Текущая реализация аудио-плеера
         * @type {IAudioImplementation|null}
         * @private
         */
        this.implementation = new type.AudioImplementation(this.overlay);
        if (this.implementation.whenReady) {
            this.implementation.whenReady.then(deferred.resolve, deferred.reject);
        } else {
            deferred.resolve();
        }
    } catch(e) {
        deferred.reject(e);
        logger.warn(this, "_initTypeError", type, e);
    }

    return deferred.promise();
};

// =================================================================

//  Обработка событий

// =================================================================

/**
 * Создание обещания, которое разрешается при одном из списка событий
 * @param {String} action - название действия
 * @param {Array.<String>} resolve - список ожидаемых событий для разрешения обещания
 * @param {Array.<String>} reject - список ожидаемый событий для отклонения обещания
 * @returns {Promise} -- также создает Deferred свойство с названием _when<Action>, которое живет до момента разрешения
 * @private
 */
Audio.prototype._waitEvents = function(action, resolve, reject) {
    var deferred = new Deferred();
    var self = this;

    this[action] = deferred;

    var cleanupEvents = function() {
        resolve.forEach(function(event) {
            self.off(event, deferred.resolve);
        });
        reject.forEach(function(event) {
            self.off(event, deferred.reject);
        });
        delete self[action];
    };

    resolve.forEach(function(event) {
        self.on(event, deferred.resolve);
    });

    reject.forEach(function(event) {
        self.on(event, function(data) {
            var error = data instanceof Error ? data : new AudioError(data || event);
            deferred.reject(error);
        });
    });

    deferred.promise().then(cleanupEvents, cleanupEvents);

    return deferred.promise();
};

/**
 * Расширение событий аудио-плеера дополнительными свойствами. Подписывается на все события аудио-плеера,
 * триггерит итоговые события, разделяя их по типу активный плеер или прелоадер, дополняет события данными.
 * @param {String} event - событие
 * @param {int} offset - источник события. 0 - активный плеер. 1 - прелоадер.
 * @param {*} data - дополнительные данные события.
 * @private
 */
Audio.prototype._populateEvents = function(event, offset, data) {
    if (event !== Audio.EVENT_PROGRESS) {
        DEV && logger.debug(this, "_populateEvents", event, offset, data);
    }

    var outerEvent = (offset ? Audio.PRELOADER_EVENT : "") + event;

    switch (event) {
        case Audio.EVENT_CRASHED:
        case Audio.EVENT_SWAP:
            this.trigger(event, data);
            break;
        case Audio.EVENT_ERROR:
            logger.error(this, "error", outerEvent, data);
            this.trigger(outerEvent, data);
            break;
        case Audio.EVENT_VOLUME:
            this.trigger(event, this.getVolume());
            break;
        case Audio.EVENT_PROGRESS:
            this.trigger(outerEvent, {
                duration: this.getDuration(offset),
                loaded: this.getLoaded(offset),
                position: offset ? 0 : this.getPosition(),
                played: offset ? 0 : this.getPlayed()
            });
            break;
        default:
            this.trigger(outerEvent);
            break;
    }
};

// =================================================================

//  Общие функции управления плеером

// =================================================================

/*
 INFO: данный метод было решено оставить, т.к. это удобнее чем использовать обещание - есть возможность в начале
 инициализации получить сразу ссылку на экземпляр плеера и обвешать его обработчиками событий. Плюс к тому при
 таком подходе реинициализацию делать проще - при ней не придется переназначать обработчики и обновлять везде ссылку
 на текущий экземпляр плеера.
 */

/**
 * Получить обещание, разрешающееся после завершения инициализации.
 * @returns {Promise}
 */
Audio.prototype.initPromise = function() {
    return this.whenReady;
};

/**
 * Получить статус плеера.
 * @returns {String}
 */
Audio.prototype.getState = function() {
    return this.state;
};

/**
 * Получить текущий тип реализации плеера.
 * @returns {String|null}
 */
Audio.prototype.getType = function() {
    return this.implementation && this.implementation.type;
};

/**
 * Получить ссылку на текущий трек.
 * @param {int} [offset=0] Брать аудио-файл из активного плеера или из прелоадера. 0 - активный плеер, 1 - прелоадер.
 * @returns {String|null}
 */
Audio.prototype.getSrc = function(offset) {
    return this.implementation && this.implementation.getSrc(offset);
};

// =================================================================

//  Управление воспроизведением

// =================================================================
/**
 * Запуск воспроизведения.
 * @param {String} src Ссылка на трек.
 * @param {Number} [duration] Длительность аудио-файла. Актуально для Flash-реализации, в ней пока аудио-файл грузится длительность определяется с погрешностью.
 * @returns {AbortablePromise}
 */
Audio.prototype.play = function(src, duration) {
    logger.info(this, "play", logger._showUrl(src), duration);

    this._played = 0;
    this._lastSkip = 0;
    this._generatePlayId();

    if (this._whenPlay) {
        this._whenPlay.reject("play");
    }
    if (this._whenPause) {
        this._whenPause.reject("play");
    }
    if (this._whenStop) {
        this._whenStop.reject("play");
    }

    var promise = this._waitEvents("_whenPlay", [Audio.EVENT_PLAY], [
        Audio.EVENT_STOP,
        Audio.EVENT_ERROR,
        Audio.EVENT_CRASHED
    ]);

    promise.abort = function() {
        if (this._whenPlay) {
            this._whenPlay.reject.apply(this._whenPlay, arguments);
            this.stop();
        }
    }.bind(this);

    this._setState(Audio.STATE_PAUSED);
    this.implementation.play(src, duration);

    return promise;
};

/**
 * Перезапуск воспроизведения.
 * @returns {AbortablePromise} обещание, которое разрешится, когда трек будет перезапущен.
 */
Audio.prototype.restart = function() {
    if (!this.getDuration()) {
        return reject(new AudioError(AudioError.BAD_STATE));
    }

    this._generatePlayId();
    this.setPosition(0);
    this._played = 0;
    this._lastSkip = 0;
    return this.resume();
};

/**
 * Остановка воспроизведения.
 * @param {int} [offset=0] Активный плеер или прелоадер. 0 - активный плеер. 1 - прелоадер.
 * @returns {AbortablePromise} обещание, которое разрешится, когда воспроизведение будет остановлено.
 */
Audio.prototype.stop = function(offset) {
    logger.info(this, "stop", offset);

    if (offset !== 0) {
        return this.implementation.stop(offset);
    }

    this._played = 0;
    this._lastSkip = 0;

    if (this._whenPlay) {
        this._whenPlay.reject("stop");
    }
    if (this._whenPause) {
        this._whenPause.reject("stop");
    }

    var promise;
    if (this._whenStop) {
        promise = this._whenStop.promise();
    } else {
        promise = this._waitEvents("_whenStop", [Audio.EVENT_STOP], [
            Audio.EVENT_PLAY,
            Audio.EVENT_ERROR,
            Audio.EVENT_CRASHED
        ]);
    }

    this.implementation.stop();

    return promise;
};

/**
 * Поставить плеер на паузу.
 * @returns {AbortablePromise} обещание, которое  разрешится, когда плеер будет поставлен на паузу.
 */
Audio.prototype.pause = function() {
    logger.info(this, "pause");

    if (this.state !== Audio.STATE_PLAYING) {
        return reject(new AudioError(AudioError.BAD_STATE));
    }

    var promise;

    if (this._whenPlay) {
        this._whenPlay.reject("pause");
    }

    if (this._whenPause) {
        promise = this._whenPause.promise();
    } else {
        promise = this._waitEvents("_whenPause", [Audio.EVENT_PAUSE], [
            Audio.EVENT_STOP,
            Audio.EVENT_PLAY,
            Audio.EVENT_ERROR,
            Audio.EVENT_CRASHED
        ]);
    }

    this.implementation.pause();

    return promise;
};

/**
 * Снятие плеера с паузы.
 * @returns {AbortablePromise} обещание, которое разрешится, когда начнется воспроизведение.
 */
Audio.prototype.resume = function() {
    logger.info(this, "resume");

    if (this.state === Audio.STATE_PLAYING && !this._whenPause) {
        return Promise.resolve();
    }

    if (!(this.state === Audio.STATE_IDLE || this.state === Audio.STATE_PAUSED
        || this.state === Audio.STATE_PLAYING)) {
        return reject(new AudioError(AudioError.BAD_STATE));
    }

    var promise;

    if (this._whenPause) {
        this._whenPause.reject("resume");
    }

    if (this._whenPlay) {
        promise = this._whenPlay.promise();
    } else {
        promise = this._waitEvents("_whenPlay", [Audio.EVENT_PLAY], [
            Audio.EVENT_STOP,
            Audio.EVENT_ERROR,
            Audio.EVENT_CRASHED
        ]);

        promise.abort = function() {
            if (this._whenPlay) {
                this._whenPlay.reject.apply(this._whenPlay, arguments);
                this.stop();
            }
        }.bind(this);
    }

    this.implementation.resume();

    return promise;
};

/**
 * Запуск воспроизведения предзагруженного аудиофайла.
 * @param {String} [src] Ссылка на аудиофайл (для проверки, что в прелоадере нужный трек).
 * @returns {AbortablePromise} обещание, которое разрешится, когда начнется воспроизведение предзагруженного аудиофайла.
 */
Audio.prototype.playPreloaded = function(src) {
    logger.info(this, "playPreloaded", logger._showUrl(src));

    if (!src) {
        src = this.getSrc(1);
    }

    if (!this.isPreloaded(src)) {
        logger.warn(this, "playPreloadedBadTrack", AudioError.NOT_PRELOADED);
        return reject(new AudioError(AudioError.NOT_PRELOADED));
    }

    this._played = 0;
    this._lastSkip = 0;
    this._generatePlayId();

    if (this._whenPlay) {
        this._whenPlay.reject("playPreloaded");
    }
    if (this._whenPause) {
        this._whenPause.reject("playPreloaded");
    }
    if (this._whenStop) {
        this._whenStop.reject("playPreloaded");
    }

    var promise = this._waitEvents("_whenPlay", [Audio.EVENT_PLAY], [
        Audio.EVENT_STOP,
        Audio.EVENT_ERROR,
        Audio.EVENT_CRASHED
    ]);
    promise.abort = function() {
        if (this._whenPlay) {
            this._whenPlay.reject.apply(this._whenPlay, arguments);
            this.stop();
        }
    }.bind(this);

    this._setState(Audio.STATE_PAUSED);
    var result = this.implementation.playPreloaded();

    if (!result) {
        logger.warn(this, "playPreloadedError", AudioError.NOT_PRELOADED);
        this._whenPlay.reject(new AudioError(AudioError.NOT_PRELOADED));
    }

    return promise;
};

// =================================================================

//  Предзагрузка

// =================================================================

/**
 * Предзагрузка аудиофайла.
 * @param {String} src Ссылка на трек.
 * @param {Number} [duration] Длительность аудиофайла. Актуально для Flash-реализации, в ней пока аудиофайл грузится
 * длительность определяется с погрешностью.
 * @returns {AbortablePromise} обещание, которое разрешится, когда начнется предзагрузка аудиофайла.
 */
Audio.prototype.preload = function(src, duration) {
    if (detect.tv || (detect.browser.name === "msie" && detect.browser.version[0] == "9")) {
        return reject(new AudioError(AudioError.NOT_PRELOADED));
    }

    logger.info(this, "preload", logger._showUrl(src), duration);

    if (this._whenPreload) {
        this._whenPreload.reject("preload");
    }

    var promise = this._waitEvents("_whenPreload", [
        Audio.PRELOADER_EVENT + Audio.EVENT_LOADING,
        Audio.EVENT_SWAP
    ], [
        Audio.PRELOADER_EVENT + Audio.EVENT_CRASHED,
        Audio.PRELOADER_EVENT + Audio.EVENT_ERROR,
        Audio.PRELOADER_EVENT + Audio.EVENT_STOP
    ]);

    promise.abort = function() {
        if (this._whenPreload) {
            this._whenPreload.reject.apply(this._whenPreload, arguments);
            this.stop(1);
        }
    }.bind(this);

    this.implementation.preload(src, duration);

    return promise;
};

/**
 * Проверка, что аудиофайл предзагружен.
 * @param {String} src Ссылка на трек.
 * @returns {Boolean} true, если аудиофайл предзагружен, false - иначе.
 */
Audio.prototype.isPreloaded = function(src) {
    return this.implementation.isPreloaded(src);
};

/**
 * Проверка, что аудиофайл предзагружается.
 * @param {String} src Ссылка на трек.
 * @returns {Boolean} true, если аудиофайл начал предзагружаться, false - иначе.
 */
Audio.prototype.isPreloading = function(src) {
    return this.implementation.isPreloading(src, 1);
};

// =================================================================

//  Тайминги

// =================================================================

/**
 * Получение позиции воспроизведения (в секундах).
 * @returns {Number}
 */
Audio.prototype.getPosition = function() {
    return this.implementation.getPosition() || 0;
};

/**
 * Установка позиции воспроизведения (в секундах).
 * @param {Number} position Новая позиция воспроизведения
 * @returns {Number} итоговая позиция воспроизведения.
 */
Audio.prototype.setPosition = function(position) {
    logger.info(this, "setPosition", position);

    position = Math.max(0, Math.min(this.implementation.getMaxSeekablePosition() - 1, position));

    this._played += this.getPosition() - this._lastSkip;
    this._lastSkip = position;

    this.implementation.setPosition(position);

    return position;
};

/**
 * Получить длительность текущего аудио-файла (в секундах).
 * @param {Boolean|int} preloader Активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик.
 * @returns {Number}
 */
Audio.prototype.getDuration = function(preloader) {
    return this.implementation.getDuration(preloader ? 1 : 0) || 0;
};

/**
 * Получить длительность загруженной части (в секундах).
 * @param {Boolean|int} preloader Активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик.
 * @returns {Number}
 */
//TODO разный интерфейс у флэша и хтмл (offset vs id, offset)
Audio.prototype.getLoaded = function(preloader) {
    return this.implementation.getLoaded(preloader ? 1 : 0) || 0;
};

/**
 * Получить длительность воспроизведения (в секундах).
 * @returns {Number}
 */
Audio.prototype.getPlayed = function() {
    var position = this.getPosition();
    this._played += position - this._lastSkip;
    this._lastSkip = position;

    return this._played;
};

// =================================================================

//  Громкость

// =================================================================

/**
 * Получить текущее значение громкости плеера.
 * @returns {Number}
 */
Audio.prototype.getVolume = function() {
    if (!this.implementation) {
        return 0;
    }

    return this.implementation.getVolume();
};

/**
 * Установка громкости плеера.
 * @param {Number} volume Новое значение громкости.
 * @returns {Number} итоговое значение громкости.
 */
Audio.prototype.setVolume = function(volume) {
    DEV && logger.debug(this, "setVolume", volume);

    if (!this.implementation) {
        return 0;
    }

    return this.implementation.setVolume(volume);
};

/**
 * Проверка, что громкость управляется устройством, а не программно.
 * @returns {Boolean} true, если громкость управляется устройством, false - иначе.
 */
Audio.prototype.isDeviceVolume = function() {
    if (!this.implementation) {
        return true;
    }

    return this.implementation.isDeviceVolume();
};

/**
 * Проверка возможности воспроизведения без пользовательского взаимодействия
 * @returns {Boolean}
 */
Audio.prototype.isAutoplayable = function() {
    return this.implementation && this.implementation.isAutoplayable();
};

// =================================================================

//  Web Audio API

// =================================================================
/**
 * Включить режим CORS для получения аудио-треков
 * @param {Boolean} state - Запрашиваемый статус.
 * @returns {boolean} статус успеха.
 */
Audio.prototype.toggleCrossDomain = function(state) {
    if (this.implementation.type !== "html5") {
        logger.warn(this, "toggleCrossDomainFailed", this.implementation.type);
        return false;
    }

    this.implementation.toggleCrossDomain(state);
    return true;
};

/**
 * Переключение режима использования Web Audio API. Доступен только при html5-реализации плеера.
 * Внимание!!! После включения режима Web Audio API он не отключается полностью, т.к. для этого требуется
 * реинициализация плеера, которой требуется клик пользователя. При отключении из графа обработки исключаются
 * все ноды кроме нод-источников и ноды вывода, управление громкостью переключается на элементы audio, без
 * использования GainNode.
 * @param {Boolean} state Запрашиваемый статус.
 * @returns {Boolean} итоговый статус
 */
Audio.prototype.toggleWebAudioAPI = function(state) {
    logger.info(this, "toggleWebAudioAPI", state);
    if (this.implementation.type !== "html5") {
        logger.warn(this, "toggleWebAudioAPIFailed", this.implementation.type);
        return false;
    }

    return this.implementation.toggleWebAudioAPI(state);
};

/**
 * Аудио-препроцессор.
 * @typedef {Object} Audio~AudioPreprocessor
 *
 * @property {AudioNode} input Нода, в которую перенаправляется вывод аудио.
 * @property {AudioNode} output Нода, из которой вывод подается на усилитель.
 */

/**
 * Подключение аудио препроцессора. Вход препроцессора подключается к аудиоэлементу, у которого выставлена
 * 100% громкость. Выход препроцессора подключается к GainNode, которая регулирует итоговую громкость.
 * @param {Audio~AudioPreprocessor} preprocessor Препроцессор.
 * @returns {boolean} статус успеха.
 */
Audio.prototype.setAudioPreprocessor = function(preprocessor) {
    logger.info(this, "setAudioPreprocessor");
    if (this.implementation.type !== "html5") {
        logger.warn(this, "setAudioPreprocessorFailed", this.implementation.type);
        return false;
    }

    return this.implementation.setAudioPreprocessor(preprocessor);
};

// =================================================================

//  Логгирование

// =================================================================

/**
 * Генерация playId
 * @private
 */
Audio.prototype._generatePlayId = function() {
    this._playId = Math.random().toString().slice(2);
};

/**
 * Получить уникальный идентификатор воспроизведения. Создаётся каждый раз при запуске нового трека или перезапуске текущего.
 * @returns {String}
 */
Audio.prototype.getPlayId = function() {
    return this._playId;
};

/**
 * Вспомогательная функция для отображения состояния плеера в логе.
 * @private
 */
Audio.prototype._logger = function() {
    return {
        index: this.implementation && this.implementation.name,
        src: this.implementation && this.implementation._logger(),
        type: this.implementation && this.implementation.type
    };
};

module.exports = Audio;
