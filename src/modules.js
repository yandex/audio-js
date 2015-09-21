var Modules = require('ym');
var YandexAudio = require("./index.js");

if (!window.ya) {
    window.ya = {};
}

var modules;
if (window.ya.modules) {
    modules = window.ya.modules;
} else {
    modules = window.ya.modules = Modules.create();
}

modules.define('YandexAudio', function(provide) {
    provide(YandexAudio);
});
