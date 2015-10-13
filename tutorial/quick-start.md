Быстрый старт
=============
Данное руководство поможет разобраться с тем, как пользоваться данной библиотекой на примере создания простого плеера.

Для начала создадим html каркас будущего плеера. Нам понадобятся кнопки play, шкала с позицией воспроизведения 
и шкала громкости. Также для инициализации флеш-плеера, отображения ошибок и блокировки управления потребуется оверлей.

***index.html***
```html
<div class="player">
    <div class="controls">
        <button class="controls__play">Play</button>
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

Теперь инициализируем всю эту структуру и создадим экземпляр плеера

***index.js***
```javascript
var AudioPlayer = ya.music.Audio;

var dom = {
    player: document.querySelector(".player"),

    play: document.querySelector(".controls__play"),

    progress: {
        bar: document.querySelector(".progress"),
        loaded: document.querySelector(".progress__loaded"),
        current: document.querySelector(".progress__current")
    },

    volume: {
        bar: document.querySelector(".volume"),
        value: document.querySelector(".volume__bar"),        
    },
    
    overlay: document.querySelector(".overlay")
};

// Предоставим плееру самому решать какой тип реализации использовать
var audioPlayer = new AudioPlayer(null, dom.overlay);

audioPlayer.initPromise().then(function() {
    // Скрываем оверлей, кнопки управления становятся доступны
    dom.overlay.classList.add("overlay_hidden");
}, function(err) {
    // Показываем ошибку инициализации в оверлее
    dom.overlay.innerHTML = err.message;
    dom.overlay.classList.add("overlay_error");
});
```

Настроим отображение статуса плеера. Для простого плеера нам достаточно знать запущено воспроизведение или нет.

```javascript
audioPlayer.on(ya.music.Audio.EVENT_STATE, function(state) {
    if (state === ya.music.Audio.STATE_PLAYING) {
        dom.player.classList.add("player_playing");
    } else {
        dom.player.classList.remove("player_playing");
    }
});
```

Теперь настроим обновление прогресс-бара. В нём предусмотрены 2 шкалы - шкала загрузки и шкала текущей 
позиции воспроизведения.

```javascript
audioPlayer.on(ya.music.Audio.EVENT_PROGRESS, function(timings) {
    dom.progress.loaded.style.width = (timings.loaded / timings.duration * 100).toFixed(2) + "%"; 
    dom.progress.current.style.width = (timings.position / timings.duration * 100).toFixed(2) + "%"; 
});
```

Аналогично будет работать шкала громкости

```javascript
var updateVolume = function(volume) {
    dom.volume.value.style.height = (volume * 100).toFixed(2) + "%";
};
audioPlayer.on(ya.music.Audio.EVENT_VOLUME, updateVolume);

// Отображаем начальную громкость
audioPlayer.initPromise().then(function() {
    updateVolume(audioPlayer.getVolume());
});
```

Теперь нужно настроить взаимодействие с пользователем. Начнём с запуска воспроизведения.

```javascript
var trackUrls = [
    "http://some.domain.and.zone/Здесь-могла-быть-ваша-реклама-1.mp3",
    "http://some.domain.and.zone/Здесь-могла-быть-ваша-реклама-2.mp3",
    "http://some.domain.and.zone/Здесь-могла-быть-ваша-реклама-3.mp3"
];

var trackIndex = 0;

var startPlay = function() {
    audioPlayer.play(trackUrls[trackIndex]);
};

dom.play.addEventListener("click", function() {
    var state = audioPlayer.getState();

    switch (state) {
        case ya.music.Audio.STATE_PLAYING:
            audioPlayer.pause();
            break;

        case ya.music.Audio.STATE_PAUSED:
            audioPlayer.resume();
            break;

        default:
            startPlay();
            break;
    }
});

audioPlayer.on(ya.music.Audio.EVENT_ENDED, function() {
    trackIndex++;

    if (trackIndex < trackUrls.length) {
        startPlay();
    }
});
```

Добавим немножко удобства для пользователей: сделаем автозагрузку следующего трека после того, как текущий загрузился.
Для этого потребуется немного изменить функцию `startPlay` и отслеживать момент загрузки трека

```javascript
var startPlay = function() {
    var track = trackUrls[trackIndex];
    if (audioPlayer.isPreloaded(track)) {
        audioPlayer.playPreloaded(track);
    } else {
        audioPlayer.play(track);
    }
};

audioPlayer.on(ya.music.Audio.EVENT_LOADED, function() {
    if (trackIndex + 1 < trackUrls.length) {
        audioPlayer.preload(trackUrls[trackIndex + 1]);
    }
});
```

Осталось только настроить навигацию по треку и регулирование громкости:
```javascript
var offsetLeft = function(node) {
    var offset = node.offsetLeft;
    if (node.offsetParent) {
        offset += offsetLeft(node.offsetParent);
    }
    return offset;
};

var offsetTop = function(node) {
    var offset = node.offsetTop;
    if (node.offsetParent) {
        offset += offsetTop(node.offsetParent);
    }
    return offset;
};

dom.progress.bar.addEventListener("click", function(evt) {
    var fullWidth = dom.progress.bar.offsetWidth;
    var offset = offsetLeft(dom.progress.bar);

    var relativePosition = Math.max(0, Math.min(1, ((evt.pageX || evt.screenX) - offset) / fullWidth));
    var duration = audioPlayer.getDuration();

    audioPlayer.setPosition(duration * relativePosition);
});

dom.volume.bar.addEventListener("click", function(evt) {
    var fullHeight = dom.volume.bar.offsetHeight;
    var offset = offsetTop(dom.volume.bar);

    // тут мы делаем "1 -" т.к. громость принято отмерять снизу, а не сверху
    var volume = 1 - Math.max(0, Math.min(1, ((evt.pageY || evt.screenY) - offset) / fullHeight));
    audioPlayer.setVolume(volume);
});
```

Полный код можно [посмотреть тут](https://github.yandex-team.ru/music/audio/tree/master/examples/quick-start).
Рабочий пример кода можно [посмотреть тут](https://github.yandex-team.ru/pages/music/audio/examples/quick-start/).
