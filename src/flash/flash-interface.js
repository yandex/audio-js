var Logger = require('./logger');
var logger = new Logger('FlashInterface');

var FlashInterface = function(flash) {
    this.flash = Ya.Music._flash = flash;
};

FlashInterface.prototype._callFlash = function(fn) {
    //logger.debug(this, fn, arguments);

    try {
        return this.flash.call.apply(this.flash, arguments);
    } catch(e) {
        logger.error(this, "_callFlashError", e);
        return null;
    }
};

FlashInterface.prototype._heartBeat = function() {
    this._callFlash("heartBeat", -1);
};

FlashInterface.prototype._addPlayer = function() {
    return this._callFlash("addPlayer", -1);
};

FlashInterface.prototype.setVolume = function(id, volume) {
    return this._callFlash("setVolume", -1, volume);
};

FlashInterface.prototype.getVolume = function() {
    return this._callFlash("getVolume", -1);
};

FlashInterface.prototype.play = function(id, src, duration) {
    return this._callFlash("play", id, src, duration);
};

FlashInterface.prototype.stop = function(id, offset) {
    return this._callFlash("stop", id, offset || 0);
};

FlashInterface.prototype.pause = function(id) {
    return this._callFlash("pause", id);
};

FlashInterface.prototype.resume = function(id) {
    return this._callFlash("resume", id);
};

FlashInterface.prototype.preload = function(id, src, duration, offset) {
    return this._callFlash("preload", id, src, duration, offset || 1);
};

FlashInterface.prototype.isPreloaded = function(id, src, offset) {
    return this._callFlash("isPreloaded", id, src, offset || 1);
};

FlashInterface.prototype.isPreloading = function(id, src, offset) {
    return this._callFlash("isPreloading", id, src, offset || 1);
};

FlashInterface.prototype.playPreloaded = function(id, src, offset) {
    return this._callFlash("playPreloaded", id, offset || 1);
};

FlashInterface.prototype.getPosition = function(id) {
    return this._callFlash("getPosition", id);
};

FlashInterface.prototype.setPosition = function(id, position) {
    return this._callFlash("setPosition", id, position);
};

FlashInterface.prototype.getDuration = function(id, offset) {
    return this._callFlash("getDuration", id, offset || 0);
};

FlashInterface.prototype.getLoaded = function(id, offset) {
    return this._callFlash("getLoaded", id, offset || 0);
};

FlashInterface.prototype.getSrc = function(id, offset) {
    return this._callFlash("getSrc", id, offset || 0);
};

module.exports = FlashInterface;
