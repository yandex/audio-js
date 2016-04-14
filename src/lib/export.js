require('../export');

if (!ya.music.lib) {
    ya.music.lib = {};
}

var Events = require('./async/events');
var clearInstance = require('./class/clear-instance');

var EventsProxy = function() { Events.call(this); };
EventsProxy.prototype = clearInstance(Events);
EventsProxy.mixin = Events.mixin;
EventsProxy.eventize = Events.eventize;

ya.music.lib.Events = EventsProxy;

ya.music.lib.Promise = require('./async/promise');
ya.music.lib.Deferred = require('./async/deferred');

ya.music.info = require('./browser/detect');
