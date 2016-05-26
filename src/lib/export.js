require('../export');

if (!ya.music.lib) {
    ya.music.lib = {};
}

var Events = require('./async/events');
var ErrorClass = require('./class/error-class');
var pureInstance = require('./class/pure-instance');

var EventsProxy = function() { Events.call(this); };
EventsProxy.prototype = pureInstance(Events);
EventsProxy.mixin = Events.mixin;
EventsProxy.eventize = Events.eventize;

var ErrorClassProxy = function() { ErrorClass.apply(this, arguments); };
ErrorClassProxy.prototype = pureInstance(ErrorClass);
ErrorClassProxy.create = ErrorClass.create;

ya.music.lib.Events = EventsProxy;
ya.music.lib.Error = ErrorClassProxy;

ya.music.lib.Promise = require('./async/promise');
ya.music.lib.Deferred = require('./async/deferred');

ya.music.lib.pureInstance = pureInstance;
ya.music.lib.merge = require('./data/merge');

ya.music.info = require('./browser/detect');
