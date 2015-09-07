var AudioPlayer = ya.Audio;

var audioMP3 = [
    "test-1.mp3",
    "test-2.mp3",
    "test-3.mp3"
];

var playerFirst = {
    overlay: document.querySelector(".player-first__overlay"),
    btnPlay: document.querySelector(".player-first__play"),
    btnStop: document.querySelector(".player-first__stop"),
    progress: document.querySelector(".player-first__progress"),
    src: document.querySelector(".player-first__src")
};
playerFirst.audioPlayer = new AudioPlayer("html5", playerFirst.overlay);

playerFirst.audioPlayer.on(AudioPlayer.EVENT_PLAY, function() {
    playerFirst.src.innerHTML = playerFirst.audioPlayer.getSrc();
});

playerFirst.audioPlayer.on(AudioPlayer.EVENT_PROGRESS, function(times) {
    playerFirst.progress.innerHTML = times.position + " / " + times.duration;
});

playerFirst.btnPlay.addEventListener("click", playerFirst.audioPlayer.play.bind(playerFirst.audioPlayer, audioMP3[0]));
playerFirst.btnStop.addEventListener("click", playerFirst.audioPlayer.stop.bind(playerFirst.audioPlayer, 0));
