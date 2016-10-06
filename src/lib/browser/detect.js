var ua = navigator.userAgent.toLowerCase();

// =================================================================

//  Получение данных о браузере

// =================================================================

// Useragent RegExp
var ruc = /(ucbrowser)\/([\w.]+)/;
var rwebkit = /(webkit)[ \/]([\w.]+)/;
var ryabro = /(yabrowser)[ \/]([\w.]+)/;
var ropera = /(opr|opera)(?:.*version)?[ \/]([\w.]+)/;
var rmsie = /(msie) ([\w.]+)/;
var redge = /(edge)\/([\w.]+)/;
var rmmsie = /(iemobile)\/([\d\.]+)/;
var rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/;
var rsafari = /^((?!chrome).)*version\/([\d\w\.]+).*(safari)/;

// Порядок очень важен:
// у Ya, Opera и Edge есть и chrome и safari, но не факт, что одновременно,
// поэтому чекаем их первыми, что бы избежать false positive
// у хрома есть сафари, но у сафари нет хрома, поэтому сафари идет первым
// хром считаем неким абстрактным вебкит-браузером, точнее никак, много притворяющихся
var match = ruc.exec(ua)
    || ryabro.exec(ua)
    || ropera.exec(ua)
    || redge.exec(ua)
    || rsafari.exec(ua)
    || rmmsie.exec(ua)
    || rwebkit.exec(ua)
    || rmsie.exec(ua)
    || ua.indexOf("compatible") < 0 && rmozilla.exec(ua)
    || [];

var browser = {name: match[1] || "", version: match[2] || "0"};

if (match[3] === "safari") {
    browser.name = match[3];
    // Сафари четче различать по версии вебкита, а не по маркетинговой
    browser.version = rwebkit.exec(ua)[2]
}

if (browser.name === 'msie') {
    if (document.documentMode) { // IE8 or later
        browser.documentMode = document.documentMode;
    } else { // IE 5-7
        browser.documentMode = 5; // Assume quirks mode unless proven otherwise
        if (document.compatMode) {
            if (document.compatMode === "CSS1Compat") {
                browser.documentMode = 7; // standards mode
            }
        }
    }
}

if (browser.name === "opr") {
    browser.name = "opera";
}

//INFO: IE (как всегда) не корректно выставляет user-agent
if (browser.name === "mozilla" && browser.version.split(".")[0] === "11") {
    browser.name = "msie";
}

// =================================================================

//  Получение данных о платформе

// =================================================================

// Useragent RegExp
var rplatform = /(windows phone|ipad|iphone|ipod|android|blackberry|playbook|windows ce)/;
var rtablet = /(ipad|playbook)/;
var randroid = /(android)/;
var rmobile = /(mobile)/;
var rtv = /(netcast|web[0o]s|nettv|netrange|sharp|smart-tv)/;

platform = rplatform.exec(ua) || [];
var tablet = rtablet.exec(ua) || !rmobile.exec(ua) && randroid.exec(ua) || [];
var tv = rtv.exec(ua) || (!!window.tizen ? [null, 'tizen'] : false) || (typeof window.sony == 'object' && window.sony.tv ? [null, 'sony'] : false) || [];

if (platform[1]) {
    platform[1] = platform[1].replace(/\s/g, "_"); // Change whitespace to underscore. Enables dot notation.
}

if (tv[1] == 'web0s') {
    tv[1] = 'webos';
}

var platform = {
    type: platform[1] || "",
    tablet: !!tablet[1],
    tv: !!tv[1],
    mobile: platform[1] && !tablet[1] || false
};
if (!!tv[1]) {
    platform.type = tv[1];
}
if (!platform.type) {
    platform.type = 'pc';
}

platform.os = platform.type;
if (platform.type === 'ipad' || platform.type === 'iphone' || platform.type === 'ipod') {
    platform.os = 'ios';
} else if (platform.type === 'android') {
    platform.os = 'android';
} else if (platform.type === "windows phone" || navigator.appVersion.indexOf("Win") !== -1) {
    platform.os = "windows";
    platform.version = navigator.userAgent.match(/win[^ ]* ([^;]*)/i);
    platform.version = platform.version && platform.version[1];
} else if (navigator.appVersion.indexOf("Mac") !== -1) {
    platform.os = "macos";
} else if (navigator.appVersion.indexOf("X11") !== -1) {
    platform.os = "unix";
} else if (navigator.appVersion.indexOf("Linux") !== -1) {
    platform.os = "linux";
}

// =================================================================

//  Получение данных о возможности менять громкость

// =================================================================
var noVolume = true;
try {
    var audio = document.createElement('audio');
    audio.volume = 0.63;
    noVolume = Math.abs(audio.volume - 0.63) > 0.01;
} catch(e) {
    noVolume = true;
}

/**
 * Информация об окружении.
 * @namespace
 * @exported ya.music.info
 */
var info = {
    /**
     * Информация о браузере.
     * @namespace
     * @property {string} name Название браузера.
     * @property {string} version Версия.
     * @property {number} [documentMode] Версия документа (для IE).
     */
    browser: browser,

    /**
     * Информация о платформе.
     * @namespace
     * @property {string} os Тип операционной системы.
     * @property {string} type Тип платформы.
     * @property {Boolean} tablet Планшет.
     * @property {Boolean} mobile Мобильный.
     * @property {boolean} tv Телевизор
     */
    platform: platform,

    /**
     * Настройка громкости.
     * @type {Boolean}
     */
    onlyDeviceVolume: noVolume
};

module.exports = info;
