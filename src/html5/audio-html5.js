var Logger = require('../logger/logger');
var logger = new Logger('AudioHTML5');

var detect = require('../lib/browser/detect');
var Events = require('../lib/async/events');
var AudioStatic = require('../audio-static');

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

exports.audioContext = audioContext;

var AudioHTML5 = function() {
    this.name = playerId++;
    logger.debug(this, "constructor");

    Events.call(this);
    this.on("*", function(event) {
        logger.debug(this, "onEvent", event);
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

AudioHTML5.EVENT_NATIVE_PLAY = "play";
AudioHTML5.EVENT_NATIVE_PAUSE = "pause";
AudioHTML5.EVENT_NATIVE_TIMEUPDATE = "timeupdate";
AudioHTML5.EVENT_NATIVE_ENDED = "ended";
AudioHTML5.EVENT_NATIVE_DURATION = "durationchange";
AudioHTML5.EVENT_NATIVE_LOADING = "progress";
AudioHTML5.EVENT_NATIVE_META = "loadedmetadata";
AudioHTML5.EVENT_NATIVE_CANPLAY = "canplay";
AudioHTML5.EVENT_NATIVE_ERROR = "error";

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
            listener.trigger(AudioStatic.EVENT_ERROR, loader.error || e);
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

AudioHTML5.prototype._setActive = function(offset) {
    logger.debug(this, "_setActive", offset);

    if (offset !== 0) {
        this.stop();
    }

    this.activeLoader = (this.activeLoader + offset) % this.loaders.length;
    this.trigger(AudioStatic.EVENT_SWAP, offset);
};

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
            loader.crossOrigin = "anonymous";
            this._addSource(loader, this.sources[idx]);
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
            loader.crossOrigin = "";

            var source = this.sources[idx];
            if (source) {
                source.connect(audioContext.destination);
            }
        }.bind(this));
    }

    this.webAudioApi = state;

    return state;
};

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

AudioHTML5.prototype.play = function(src) {
    logger.info(this, "play", src);

    var loader = this._getLoader(true);

    loader.preloaded = false;
    loader.fake = false;
    loader.src = src;
    loader.notLoading = true;
    loader.load();

    this._play(loader);
};

AudioHTML5.prototype.pause = function() {
    logger.info(this, "pause");
    var loader = this._getLoader(true);
    loader.pause();
};

AudioHTML5.prototype.resume = function() {
    logger.info(this, "resume");
    var loader = this._getLoader(true);
    this._play(loader);
};

AudioHTML5.prototype.stop = function(offset) {
    logger.info(this, "stop");
    var loader = this._getLoader(true, offset || 0);

    loader.fake = true;
    loader.src = "";
    loader.notLoading = true;
    loader.load();

    this.trigger(AudioStatic.EVENT_STOP);
};

AudioHTML5.prototype.preload = function(src, _, offset) {
    logger.info(this, "preload", src, offset);
    offset = offset || 1;
    if (this.loaders.length < offset + 1) {
        return false;
    }

    var loader = this._getLoader(true, offset);

    loader.preloaded = src;
    loader.src = src;
    loader.notLoading = true;
    loader.load();

    return true;
};

AudioHTML5.prototype.isPreloaded = function(src, offset) {
    var loader = this._getLoader(false, offset);
    return loader.preloaded === src && !loader.notLoading;
};

AudioHTML5.prototype.isPreloading = function(src, offset) {
    var loader = this._getLoader(false, offset);
    return loader.preloaded === src;
};

AudioHTML5.prototype.playPreloaded = function(offset) {
    logger.info(this, "playPreloaded", offset);
    offset = offset || 1;
    if (this.loaders.length < 1 + offset) {
        return false;
    }
    if (!this._getLoader(false, offset).preloaded) {
        return false;
    }

    this._setActive(offset);
    this._play(this._getLoader(true));

    return true;
};

AudioHTML5.prototype.getPosition = function() {
    return this._getLoader().currentTime;
};

AudioHTML5.prototype.setPosition = function(position) {
    logger.info(this, "setPosition", position);
    this._getLoader().currentTime = position - 0.001;
};

AudioHTML5.prototype.getDuration = function(offset) {
    return this._getLoader(false, offset).duration;
};

AudioHTML5.prototype.getLoaded = function(offset) {
    var loader = this._getLoader(false, offset);

    if (loader.buffered.length) {
        return loader.buffered.end(0) - loader.buffered.start(0);
    }
    return 0;
};

AudioHTML5.prototype.getVolume = function() {
    return this.volume;
};

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

AudioHTML5.prototype.getSrc = function(offset) {
    return this._getLoader(false, offset).src;
};

AudioHTML5.prototype.isDeviceVolume = function() {
    return detect.onlyDeviceVolume;
};

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

exports.AudioImplementation = AudioHTML5;
