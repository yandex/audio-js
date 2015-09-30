Быстрый старт
=============
Простейший плеер на базе данной библиотеки можно сделать примерно так:

***index.html***
```html
<div class="player">
    <div class="controls">
        <button class="controls__play">Play</button>
        <button class="controls__stop">Stop</button>
    </div>

    <div class="progress">
        <div class="progress__loaded"></div>
        <div class="progress__current"></div>
    </div>

    <div class="volume">
        <div class="volume__bar"></div>
    </div>
    
    <div class="overlay"></div>      
</div>

<script src="https://github.yandex-team.ru/pages/music/audio/dist/index.min.js"></script>
<script src="index.js"></script>
```

***index.js***
```javascript
var AudioPlayer = ya.Audio;

var dom = {
    play: document.querySelector(".controls__play"),
    stop: document.querySelector(".controls__stop"),

    progress: {
        loaded: document.querySelector(".progress__loaded"),
        current: document.querySelector(".progress__current")
    },

    volume: document.querySelector(".volume__bar"),
    overlay: document.querySelector(".overlay")
};

var audioPlayer = new AudioPlayer(null, dom.overlay);

audioPlayer.initPromise().then(function() {
    // Скрываем оверлей, кнопки управления становятся доступны
    dom.overlay.classList.add("overlay_hidden");
}, function(err) {
    // Показываем ошибку инициализации в оверлее
    dom.overlay.innerHTML = err.message;
    dom.overlay.classList.add("overlay_error");
});

dom.play.addEventListener("click", function() {
    
});

dom.stop.addEventListener("click", function() {
    audioPlayer.stop();
});

```
