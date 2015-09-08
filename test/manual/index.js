var AudioPlayer = ya.Audio;
ya.Audio.config.flash.path = "/api/audio/src/flash/build";

//AudioPlayer.Logger.logLevels.push("debug");
//AudioPlayer.Logger.logLevels.push("info");
AudioPlayer.Logger.logLevels.push("warn");

var audioMP3 = [
    "test-1.mp3?r=" + Math.random(),
    "test-2.mp3?r=" + Math.random(),
    "test-3.mp3?r=" + Math.random()
];

var playerFirst = {
    overlay: document.querySelector(".player-first__overlay"),

    btnPlay: document.querySelector(".player-first__play"),
    btnStop: document.querySelector(".player-first__stop"),

    progress: document.querySelector(".player-first__progress"),
    src: document.querySelector(".player-first__src"),

    progressPreloder: document.querySelector(".player-first__progress_preloader"),
    srcPreloader: document.querySelector(".player-first__src_preloader")
};
playerFirst.audioPlayer = new AudioPlayer("flash", playerFirst.overlay);

//---------------------------------------------------
playerFirst.audioPlayer.on(AudioPlayer.EVENT_LOADING, function() {
    playerFirst.src.innerHTML = playerFirst.audioPlayer.getSrc();
});

playerFirst.audioPlayer.on(AudioPlayer.EVENT_PROGRESS, function(times) {
    playerFirst.progress.innerHTML = times.position + " / " + times.duration;
});

//---------------------------------------------------
playerFirst.audioPlayer.on(AudioPlayer.PRELOADER_EVENT + AudioPlayer.EVENT_LOADING, function() {
    playerFirst.srcPreloader.innerHTML = playerFirst.audioPlayer.getSrc(1);
});

playerFirst.audioPlayer.on(AudioPlayer.PRELOADER_EVENT + AudioPlayer.EVENT_PROGRESS, function(times) {
    playerFirst.progressPreloder.innerHTML = times.loaded + " / " + times.duration;
});

//---------------------------------------------------

var logResult = function(title, promise) {
    promise.then(function(data) {
        console.info(title, "success", data);
    }, function(err) {
        console.warn(title, "fail", err.stack);
    });
};

//---------------------------------------------------
playerFirst.btnPlay.addEventListener("click", function() {
    logResult("play", playerFirst.audioPlayer.play(audioMP3[0]));

    setTimeout(function() {
        console.log("timer 1");
        logResult("preload", playerFirst.audioPlayer.preload(audioMP3[1]));

        setTimeout(function() {
            console.log("timer 2");
            logResult("playPreloaded", playerFirst.audioPlayer.playPreloaded(audioMP3[1]));
        }, 2000);
    }, 2000);
});

playerFirst.btnStop.addEventListener("click", function() {
    playerFirst.audioPlayer.stop(0);
    playerFirst.audioPlayer.stop(1);
});

playerFirst.audioPlayer.on("*", function(event, data) {
    console.log(+new Date(), event, data);
});
