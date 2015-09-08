var Logger = require('../logger/logger');
var logger = new Logger('FlashBridge');

var config = require('../config');

var AudioStatic = require('../audio-static');
var flashLoader = require('./loader');
var FlashInterface = require('./flash-interface');

var Deferred = require('../lib/async/deferred');

var AudioError = require('../error/audio-error');
var LoaderError = require('../lib/net/error/loader-error');

var flashManager;

var FlashManager = function(overlay) { // singleton!
    if (flashManager) {
        return flashManager;
    }
    flashManager = this;

    logger.debug(this, "constructor", overlay);

    this.state = "init";
    this.overlay = overlay;
    this.emmiters = [];

    var deferred = this.deferred = new Deferred();
    this.whenReady = this.deferred.promise();

    window[config.flash.callback] = this.onEvent.bind(this);
    this.__loadTimeout = setTimeout(this.onLoadTimeout, config.flash.loadTimeout);
    flashLoader(config.flash.path + "/"
        + config.flash.name, config.flash.version, config.flash.playerID, this.onLoad.bind(this), {}, overlay);

    if (overlay) {
        var timeout;
        overlay.addEventListener("mousedown", function() { //KNOWLEDGE: only mousedown event and only wmode: transparent
            timeout = timeout || setTimeout(function() {
                    deferred.reject(new AudioError(AudioError.FLASH_NOT_RESPONDING));
                }, config.flash.clickTimeout);
        }, true);
    }

    this.whenReady.then(function(result) {
        timeout = timeout && clearTimeout(timeout);
        logger.info(this, "ready", result);
    }.bind(this), function(e) {
        flashManager = null; // если обломались удаляем экземпляр менеджера, чтобы можно было было пытаться снова
        logger.error(this, "failed", e);
    }.bind(this));
};

FlashManager.EVENT_INIT = "init";
FlashManager.EVENT_FAIL = "failed";

FlashManager.prototype.onLoad = function(data) {
    logger.debug(this, "onLoad", data);

    clearTimeout(this.__loadTimeout);
    delete this.__loadTimeout;

    if (data.success) {
        this.flash = new FlashInterface(data.ref);

        if (this.state === "ready") {
            this.deferred.resolve(data.ref);
        } else if (!this.overlay) {
            this.__initTimeout = setTimeout(this.onInitTimeout.bind(this), config.flash.initTimeout);
        }
    } else {
        this.state = "failed";
        this.deferred.reject(new AudioError(data.__fbn ? AudioError.FLASH_BLOCKER : AudioError.FLASH_UNKNOWN_CRASH));
    }
};

FlashManager.prototype.onLoadTimeout = function() {
    this.state = "failed";
    this.deferred.reject(new LoaderError(LoaderError.TIMEOUT));
};

FlashManager.prototype.onInitTimeout = function() {
    this.state = "failed";
    this.deferred.reject(new AudioError(AudioError.FLASH_INIT_TIMEOUT));
};

FlashManager.prototype.onInit = function() {
    logger.debug(this, "onInit");

    this.state = "ready";

    if (this.__initTimeout) {
        clearTimeout(this.__initTimeout);
        delete this.__initTimeout;
    }

    if (this.flash) {
        this.deferred.resolve(this.flash);
    }
};

FlashManager.prototype.onEvent = function(event, id, offset, data) {
    if (event === "debug") {
        console.debug("flashDEBUG", id, offset, data);
    }

    if (this.state === "failed") {
        logger.warn(this, "onEventFailed", event, id, offset, data);
        return;
    }

    logger.debug(this, "onEvent", event, id, offset);

    if (event === FlashManager.EVENT_INIT) {
        return this.onInit();
    }

    if (event === FlashManager.EVENT_FAIL) {
        logger.warn(this, "failed", AudioError.FLASH_INTERNAL_ERROR);
        this.deferred.reject(new AudioError(AudioError.FLASH_INTERNAL_ERROR));
        return;
    }

    if (id == -1) {
        this.emmiters.forEach(function(emmiter) {
            emmiter.trigger(event, offset, data);
        });
    } else if (this.emmiters[id]) {
        this.emmiters[id].trigger(event, offset, data);
    } else {
        logger.error(this, AudioError.FLASH_EMMITER_NOT_FOUND, id);
    }
};

FlashManager.prototype.onHeartBeat = function() {
    try {
        this.flash._heartBeat();
    } catch(e) {
        logger.error(this, "crashed", e);
        this.onEvent(AudioStatic.EVENT_CRASHED, -1, e);
    }
};

FlashManager.prototype.createPlayer = function(player) {
    logger.debug(this, "createPlayer");

    var promise = this.whenReady.then(function() {
        player.id = this.flash._addPlayer();
        this.emmiters[player.id] = player;
        return player.id;
    }.bind(this));

    promise.then(function(player) {
        logger.debug(this, "createPlayerSuccess", player);
    }.bind(this), function(err) {
        logger.error(this, "createPlayerError", err);
    }.bind(this));

    return promise;
};

module.exports = FlashManager;
