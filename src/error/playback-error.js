var ErrorClass = require('../lib/class/error-class');

var PlaybackError = function(message, src) {
    ErrorClass.call(this, message);

    this.src = src;
};

PlaybackError.prototype = ErrorClass.create("PlaybackError");

PlaybackError.CONNECTION_ABORTED = "Connection aborted";
PlaybackError.NETWORK_ERROR = "Network error";
PlaybackError.DECODE_ERROR = "Decode error";
PlaybackError.BAD_DATA = "Bad data";

PlaybackError.html5 = {
    1: PlaybackError.CONNECTION_ABORTED,
    2: PlaybackError.NETWORK_ERROR,
    3: PlaybackError.DECODE_ERROR,
    4: PlaybackError.BAD_DATA
};

module.exports = PlaybackError;
