var ErrorClass = require('../../class/error-class');

var LoaderError = function(message) {
    ErrorClass.call(this, message);
};
LoaderError.prototype = ErrorClass.create("LoaderError");

LoaderError.TIMEOUT = "request timeout";
LoaderError.FAILED = "request failed";

module.exports = LoaderError;
