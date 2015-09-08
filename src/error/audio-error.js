var ErrorClass = require('../lib/class/error-class');

var AudioError = function(message) {
    ErrorClass.call(this, message);
};
AudioError.prototype = ErrorClass.create("AudioError");

AudioError.NO_IMPLEMENTATION = "cannot find suitable implementation";
AudioError.NOT_PRELOADED = "track is not preloaded";

AudioError.FLASH_BLOCKER = "flash is rejected by flash blocker plugin";
AudioError.FLASH_UNKNOWN_CRASH = "flash is crashed without reason";
AudioError.FLASH_INIT_TIMEOUT = "flash init timed out";
AudioError.FLASH_INTERNAL_ERROR = "flash internal error";
AudioError.FLASH_EMMITER_NOT_FOUND = "flash event emmiter not found";
AudioError.FLASH_NOT_RESPONDING = "flash player doesn't response";

module.exports = AudioError;
