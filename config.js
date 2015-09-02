var config = {
    audio: {
        retry: 3
    },
    flash: {
        url: "ya/audio/flash/build/player.swf", //FIXME: сделать адекватный путь после настройки сборки
        version: "9.0.28",
        playerID: "YaMusicFlashPlayer",
        callback: "__flash__YaMusicFlashCallback",
        initTimeout: 3000, // 3 sec
        loadTimeout: 5000,
        clickTimeout: 1000
    },
    html5: {
        blacklist: ["linux:mozilla", "unix:mozilla", "macos:mozilla", ":opera", "@NT 5", "@NT 4"]
    }
};

module.exports = config;
