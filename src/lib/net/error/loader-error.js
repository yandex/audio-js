var clearInstance = require('../../class/clear-instance');

var LoaderError = function(message) {
    Error.call(this, message);
};
LoaderError.prototype = clearInstance(Error);

LoaderError.TIMEOUT = "request timeout";
LoaderError.FAILED = "request failed";

module.exports = LoaderError;
