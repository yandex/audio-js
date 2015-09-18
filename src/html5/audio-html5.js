var Logger = require('../logger/logger');
var logger = new Logger('AudioHTML5');

var detect = require('../lib/browser/detect');
var Events = require('../lib/async/events');
var AudioStatic = require('../audio-static');
var PlaybackError = require('../error/playback-error');

var playerId = 1;

exports.available = (function() {
    // ------------------------------------------------------------------------------ Базовая проверка поддержки браузером
    var html5_available = true;
    try {
        //some browsers doesn't understand new Audio()
        var audio = document.createElement('audio');
        var canPlay = audio.canPlayType("audio/mpeg");
        if (!canPlay || canPlay === 'no') {

            logger.warn(this, "HTML5 detection failed with reason", canPlay);
            html5_available = false;
        }
    } catch(e) {
        logger.warn(this, "HTML5 detection failed with error", e);
        html5_available = false;
    }

    logger.info(this, "detection", html5_available);
    return html5_available;
})();

try {
    var audioContext = new AudioContext();
    logger.info(this, "WenAudioAPI context created");
} catch(e) {
    audioContext = null;
    logger.info(this, "WenAudioAPI not detected");
}

/**
 * @class Класс html5 аудио-плеера
 * @extends IAudioImplementation
 *
 * @fires IAudioImplementation#play
 * @fires IAudioImplementation#ended
 * @fires IAudioImplementation#volumechange
 * @fires IAudioImplementation#crashed
 * @fires IAudioImplementation#swap
 *
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
var AudioHTML5 = function() {
    this.name = playerId++;
    logger.debug(this, "constructor");

    Events.call(this);
    this.on("*", function(event) {
        if (event !== AudioStatic.EVENT_PROGRESS) {
            logger.debug(this, "onEvent", event);
        }
    }.bind(this));

    this.webAudioApi = false;

    this.activeLoader = 0;

    this.loaders = [];
    this.listeners = [];

    this._addLoader();
    this._addLoader();

    this._setActive(0);
};
Events.mixin(AudioHTML5);
AudioHTML5.type = AudioHTML5.prototype.type = "html5";

/**
 * Нативное событие начала воспроизведения
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_PLAY = "play";
/**
 * Нативное событие паузы
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_PAUSE = "pause";
/**
 * Нативное событие обновление позиции воспроизведения
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_TIMEUPDATE = "timeupdate";
/**
 * Нативное событие завершения трека
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_ENDED = "ended";
/**
 * Нативное событие изменения длительности
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_DURATION = "durationchange";
/**
 * Нативное событие изменения длительности загруженной части
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_LOADING = "progress";
/**
 * Нативное событие доступности мета-данных трека
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_META = "loadedmetadata";
/**
 * Нативное событие возможности начать воспроизведение
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_CANPLAY = "canplay";
/**
 * Нативное событие ошибки
 * @type {string}
 * @const
 */
AudioHTML5.EVENT_NATIVE_ERROR = "error";

/**
 * Добавить загрузчик аудио-файлов
 * @private
 */
AudioHTML5.prototype._addLoader = function() {
    logger.debug(this, "_addLoader");

    var self = this;

    var loader = document.createElement('audio');
    var listener = new Events();

    loader.loop = false; // for IE
    loader.preload = loader.autobuffer = "auto"; // 100%

    loader.startPlay = function() { //INFO: эта конструкция нужна, чтобы не менять логику при resume
        loader.removeEventListener(AudioHTML5.EVENT_NATIVE_META, loader.startPlay);
        loader.removeEventListener(AudioHTML5.EVENT_NATIVE_CANPLAY, loader.startPlay);

        try {
            loader.play();
            logger.debug(self, "startPlay");
        } catch(e) {
            logger.error(self, "crashed", e);
            listener.trigger(AudioStatic.EVENT_CRASHED, e);
        }
    };

    var lastUpdate = 0;
    var updateProgress = function() {
        var currentTime = +new Date();
        if (currentTime - lastUpdate < 30) {
            return;
        }

        lastUpdate = currentTime;
        listener.trigger(AudioStatic.EVENT_PROGRESS);
    };

    loader.addEventListener(AudioHTML5.EVENT_NATIVE_PAUSE, listener.trigger.bind(listener, AudioStatic.EVENT_PAUSE));
    loader.addEventListener(AudioHTML5.EVENT_NATIVE_PLAY, listener.trigger.bind(listener, AudioStatic.EVENT_PLAY));

    loader.addEventListener(AudioHTML5.EVENT_NATIVE_ENDED, function() {
        listener.trigger(AudioStatic.EVENT_PROGRESS);
        listener.trigger(AudioStatic.EVENT_ENDED);
    });

    loader.addEventListener(AudioHTML5.EVENT_NATIVE_TIMEUPDATE, updateProgress);
    loader.addEventListener(AudioHTML5.EVENT_NATIVE_DURATION, updateProgress);
    loader.addEventListener(AudioHTML5.EVENT_NATIVE_LOADING, function() {
        updateProgress();

        if (loader.buffered.length) {
            var loaded = loader.buffered.end(0) - loader.buffered.start(0);

            if (loader.notLoading && loaded) {
                loader.notLoading = false;
                listener.trigger(AudioStatic.EVENT_LOADING);
            }

            if (loaded >= loaded.duration - 0.1) {
                listener.trigger(AudioStatic.EVENT_LOADED);
            }
        }
    });

    loader.addEventListener(AudioHTML5.EVENT_NATIVE_ERROR, function(e) {
        if (!loader.fake) {
            var error = new PlaybackError(loader.error
                    ? PlaybackError.html5[loader.error.code]
                    : e instanceof Error ? e.message : e,
                loader.src);

            listener.trigger(AudioStatic.EVENT_ERROR, error);
        }
    });

    listener.on("*", function(event, data) {
        var offset = (self.loaders.length + loader.index - self.activeLoader) % self.loaders.length;
        self.trigger(event, offset, data);
    });

    loader.index = this.loaders.push(loader) - 1;
    this.listeners.push(listener);

    if (this.webAudioApi) {
        this._addSource(loader);
    }
};

/**
 * Создать (если необходимо) и подключить источник звука для Web Audio API
 * @param {Audio} loader - загрузчик аудио
 * @param {AudioNode} source - экземпляр источника звука
 * @private
 */
AudioHTML5.prototype._addSource = function(loader, source) {
    logger.debug(this, "_addSource", loader);

    if (!source) {
        source = audioContext.createMediaElementSource(loader);
        this.sources.push(source);
    } else {
        source.disconnect();
    }

    if (this.preprocessor) {
        source.connect(this.preprocessor);
    } else {
        source.connect(this.audioOutput);
    }
};

/**
 * Установить активный загрузчик
 * @param {int} offset - 0: текущий загрузчик, 1: следующий загрузчик
 * @private
 */
AudioHTML5.prototype._setActive = function(offset) {
    logger.debug(this, "_setActive", offset);

    this.activeLoader = (this.activeLoader + offset) % this.loaders.length;
    this.trigger(AudioStatic.EVENT_SWAP, offset);

    if (offset !== 0) {
        //INFO: если релизовывать концепцию множества загрузчиков, то это нужно доработать.
        this.stop(offset);
    }
};

/**
 * Получить загрузчик и отписать его от событий старта воспроизведения
 * @param {Boolean} unsubscribe - отписаться от событий
 * @param {int} offset - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {Audio}
 * @private
 */
AudioHTML5.prototype._getLoader = function(unsubscribe, offset) {
    offset = offset || 0;
    var loader = this.loaders[(this.activeLoader + offset) % this.loaders.length];
    if (unsubscribe) {
        loader.removeEventListener(AudioHTML5.EVENT_NATIVE_META, loader.startPlay);
        loader.removeEventListener(AudioHTML5.EVENT_NATIVE_CANPLAY, loader.startPlay);
    }

    return loader;
};

//INFO: эта конструкция нужна, чтобы не менять логику при resume
/**
 * Запуск воспроизведения
 * @param {Audio} loader - загрузчик аудио
 * @private
 */
AudioHTML5.prototype._play = function(loader) {
    logger.debug(this, "_play");

    if (loader.readyState > loader.HAVE_METADATA) {
        loader.startPlay();
    } else {
        // firefox waits too long till 'canplay' or 'canplaythrough'
        // but it can play right after 'loadedmetadata'
        // so we use both events
        loader.addEventListener(AudioHTML5.EVENT_NATIVE_META, loader.startPlay);
        loader.addEventListener(AudioHTML5.EVENT_NATIVE_CANPLAY, loader.startPlay);
    }
};

/**
 * Переключение режима использования Web Audio API. Доступен только при html5-реализации плеера.
 *
 * **Внимание!** - после включения режима Web Audio API он не отключается полностью, т.к. для этого требуется
 * реинициализация плеера, которой требуется клик пользователя. При отключении из графа обработки исключаются
 * все ноды кроме нод-источников и ноды вывода, управление громкостью переключается на элементы audio, без
 * использования GainNode
 * @param {Boolean} state - запрашиваемый статус
 * @returns {Boolean} -- итоговый статус плеера
 */
AudioHTML5.prototype.toggleWebAudioAPI = function(state) {
    if (!audioContext) {
        logger.warn(this, "toggleWebAudioAPIError", state);
        return false;
    }

    logger.info(this, "toggleWebAudioAPI", state);

    if (this.webAudioApi == state) {
        return state;
    }

    if (state) {
        this.audioOutput = audioContext.createGain();
        this.audioOutput.gain = this.volume;
        this.audioOutput.connect(audioContext.destination);

        if (this.preprocessor) {
            this.preprocessor.output.connect(this.audioOutput);
        }

        this.sources = this.sources || [];
        this.loaders.forEach(function(loader, idx) {
            loader.volume = 1;
            var prepared = loader.crossOrigin;
            loader.crossOrigin = "anonymous";
            this._addSource(loader, this.sources[idx]);

            if (!prepared) { // INFO: после того как мы включили webAudioAPI его уже нельзя полностью выключить.
                var pos = loader.currentTime;
                var paused = loader.paused;
                loader.load();
                loader.currentTime = pos;
                if (!paused) {
                    loader.play();
                }
            }
        }.bind(this));

    } else if (this.audioOutput) {
        if (this.preprocessor) {
            this.preprocessor.output.disconnect();
        }

        this.audioOutput.disconnect();
        delete this.audioOutput;

        this.sources.forEach(function(source) {
            source.disconnect();
        });
        //delete this.sources;

        this.loaders.forEach(function(loader, idx) {
            loader.volume = this.volume;

            var source = this.sources[idx];
            if (source) { // INFO: после того как мы включили webAudioAPI его уже нельзя полностью выключить.
                source.connect(audioContext.destination);
            }
        }.bind(this));
    }

    this.webAudioApi = state;

    return state;
};

/**
 * Подключение аудио препроцессора. Вход препроцессора подключается к аудио-элементу у которого выставлена
 * 100% громкость. Выход препроцессора подключается к GainNode, которая регулирует итоговую громкость
 * @param {ya.Audio~AudioPreprocessor} preprocessor - препроцессор
 * @returns {boolean} -- статус успеха
 */
AudioHTML5.prototype.setAudioPreprocessor = function(preprocessor) {
    if (!this.webAudioApi) {
        logger.warn(this, "setAudioPreprocessorError", preprocessor);
        return;
    }

    logger.info(this, "setAudioPreprocessor");

    if (this.preprocessor === preprocessor) {
        return;
    }

    if (this.preprocessor) {
        this.preprocessor.output.disconnect();
    }

    this.preprocessor = preprocessor;

    if (!preprocessor) {
        this.sources.forEach(function(source) {
            source.disconnect();
            source.connect(this.audioOutput);
        }.bind(this));
        return;
    }

    this.sources.forEach(function(source) {
        source.disconnect();
        source.connect(preprocessor.input);
    });
    preprocessor.output.connect(this.audioOutput);
};

/**
 * Проиграть трек
 * @param {String} src - ссылка на трек
 * @param {Number} [duration] - Длительность трека (не используется)
 */
AudioHTML5.prototype.play = function(src, duration) {
    logger.info(this, "play", src);

    var loader = this._getLoader(true);

    loader.fake = false;
    loader.src = src;
    loader._src = src;
    loader.notLoading = true;
    loader.load();

    this._play(loader);
};

/** Поставить трек на паузу */
AudioHTML5.prototype.pause = function() {
    logger.info(this, "pause");
    var loader = this._getLoader(true);
    loader.pause();
};

/** Снять трек с паузы */
AudioHTML5.prototype.resume = function() {
    logger.info(this, "resume");
    var loader = this._getLoader(true);
    this._play(loader);
};

/**
 * Остановить воспроизведение и загрузку трека
 * @param {int} [offset=0] - 0: для текущего загрузчика, 1: для следующего загрузчика
 */
AudioHTML5.prototype.stop = function(offset) {
    logger.info(this, "stop");
    var loader = this._getLoader(true, offset || 0);

    loader.fake = true;
    loader.src = "";
    loader._src = false;
    loader.notLoading = true;
    loader.load();

    this.trigger(AudioStatic.EVENT_STOP, offset);
};

/**
 * Предзагрузить трек
 * @param {String} src - Ссылка на трек
 * @param {Number} [duration] - Длительность трека (не используется)
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 */
AudioHTML5.prototype.preload = function(src, duration, offset) {
    logger.info(this, "preload", src, offset);
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(true, offset);

    loader.src = src;
    loader._src = src;
    loader.notLoading = true;
    loader.load();
};

/**
 * Проверить что трек предзагружается
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean}
 */
AudioHTML5.prototype.isPreloaded = function(src, offset) {
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(false, offset);
    return loader._src === src && !loader.notLoading;
};

/**
 * Проверить что трек начал предзагружаться
 * @param {String} src - ссылка на трек
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean}
 */
AudioHTML5.prototype.isPreloading = function(src, offset) {
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(false, offset);
    return loader._src === src;
};

/**
 * Запустить воспроизведение предзагруженного трека
 * @param {int} [offset=1] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {boolean} -- доступность данного действия
 */
AudioHTML5.prototype.playPreloaded = function(offset) {
    logger.info(this, "playPreloaded", offset);
    offset = offset == null ? 1 : offset;
    var loader = this._getLoader(false, offset);

    if (!loader._src) {
        return false;
    }

    this._setActive(offset);
    this._play(this._getLoader(true, 0));

    return true;
};

/**
 * Получить позицию воспроизведения
 * @returns {number}
 */
AudioHTML5.prototype.getPosition = function() {
    return this._getLoader().currentTime;
};

/**
 * Установить текущую позицию воспроизведения
 * @param {number} position
 */
AudioHTML5.prototype.setPosition = function(position) {
    logger.info(this, "setPosition", position);
    this._getLoader().currentTime = position - 0.001;
};

/**
 * Получить длительность трека
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {number}
 */
AudioHTML5.prototype.getDuration = function(offset) {
    return this._getLoader(false, offset).duration;
};

/**
 * Получить длительность загруженной части трека
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {number}
 */
AudioHTML5.prototype.getLoaded = function(offset) {
    var loader = this._getLoader(false, offset);

    if (loader.buffered.length) {
        return loader.buffered.end(0) - loader.buffered.start(0);
    }
    return 0;
};

/**
 * Получить текущее значение громкости
 * @returns {number}
 */
AudioHTML5.prototype.getVolume = function() {
    return this.volume;
};

/**
 * Установить значение громкости
 * @param {number} volume
 */
AudioHTML5.prototype.setVolume = function(volume) {
    logger.info(this, "setVolume", volume);
    this.volume = volume;

    if (this.webAudioApi) {
        this.audioOutput.gain.value = volume;
    } else {
        this.loaders.forEach(function(loader) {
            loader.volume = volume;
        });
    }

    this.trigger(AudioStatic.EVENT_VOLUME);
};

/**
 * Получить ссылку на трек
 * @param {int} [offset=0] - 0: текущий загрузчик, 1: следующий загрузчик
 * @returns {String|Boolean} -- Ссылка на трек или false, если нет загружаемого трека
 */
AudioHTML5.prototype.getSrc = function(offset) {
    return this._getLoader(false, offset)._src;
};

/**
 * Проверить доступен ли программный контроль громкости
 * @returns {boolean}
 */
AudioHTML5.prototype.isDeviceVolume = function() {
    return detect.onlyDeviceVolume;
};

/**
 * Вспомогательная функция для отображения состояния плеера в логе.
 * @private
 */
AudioHTML5.prototype._logger = function() {
    try {
        return {
            main: this.getSrc(0),
            preloader: this.getSrc(1)
        };
    } catch(e) {
        return "";
    }
};

exports.audioContext = audioContext;
exports.AudioImplementation = AudioHTML5;
