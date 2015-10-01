(function() {
    /* Теперь инициализируем всю эту структуру и создадим экземпляр плеера */

    var AudioPlayer = ya.Audio;

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
            value: document.querySelector(".volume__bar")
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

    /* Настроим отображение статуса плеера. Для простого плеера нам достаточно знать запущено воспроизведение или нет. */

    audioPlayer.on(ya.Audio.EVENT_STATE, function(state) {
        if (state === ya.Audio.STATE_PLAYING) {
            dom.player.classList.add("player_playing");
        } else {
            dom.player.classList.remove("player_playing");
        }
    });

    /* Теперь настроим обновление прогресс-бара. В нём предусмотрены 2 шкалы - шкала загрузки и шкала текущей
    позиции воспроизведения. */

    audioPlayer.on(ya.Audio.EVENT_PROGRESS, function(timings) {
        dom.progress.loaded.style.width = (timings.loaded / timings.duration * 100).toFixed(2) + "%";
        dom.progress.current.style.width = (timings.position / timings.duration * 100).toFixed(2) + "%";
    });

    /* Аналогично будет работать шкала громкости */

    var updateVolume = function(volume) {
        dom.volume.value.style.height = (volume * 100).toFixed(2) + "%";
    };
    audioPlayer.on(ya.Audio.EVENT_VOLUME, updateVolume);

    // Отображаем начальную громкость
    audioPlayer.initPromise().then(function() {
        updateVolume(audioPlayer.getVolume());
    });

    /* Теперь нужно настроить взаимодействие с пользователем. Начнём с запуска воспроизведения. */

    var trackUrls = [
        "http://storage.mp3.cc/download/4598134/MnpDemgvLzlGcklLbXh0WHppZWEwdzVkL01BUHczbHNFcUFjMmI0b0NNMFFqYkNzT0FHeWdQSTFQQ1pzYmlQbEJyS2VkSkN3QVhyaEROZkpEOHVIL3ZocVlnWlB5TWZDSnlxQnFmSWcxcGgwdUUzLzlnQU9xZEpLY1F5YVByVmk/The_Doors_-_Riders_On_The_Storm-The_Doors_-_Riders_On_The_Storm_(mp3.cc).mp3",
        "http://storage.mp3.cc/download/1392098/MnpDemgvLzlGcklLbXh0WHppZWEwdzVkL01BUHczbHNFcUFjMmI0b0NNMVd4OHhGUnBiSVY0WnRtdVc0VTVoK1F6YU1vcDBqbXhkNlJWMjJpdkNZT0p6dEZMVDZSek9iUDJ2OVFISDRPTGZ3NGtINXk4dnBFQTlRMnd1Q0twdHg/Marty_Robbins-The_Master_s_Call_(mp3.cc).mp3",
        "http://storage.mp3.cc/download/16317365/MnpDemgvLzlGcklLbXh0WHppZWEwdzVkL01BUHczbHNFcUFjMmI0b0NNMXdQbzhRUkNpV0FWZ0xXUkx5TzlqdlJ5VnV3VzFrMlRhSzlrNWpFWmhwTEM1Z1ptMXJ2UHZpb1NPc0NUUGtZbUJpQk56U3IrT2FhSjFtQW9xa3pZN04/Dzho_Koker-My_father_son_(mp3.cc).mp3"
    ];

    var trackIndex = 0;

    var startPlay = function() {
        var track = trackUrls[trackIndex];
        if (audioPlayer.isPreloaded(track)) {
            audioPlayer.playPreloaded(track);
        } else {
            audioPlayer.play(track);
        }
    };

    dom.play.addEventListener("click", function() {
        var state = audioPlayer.getState();

        switch (state) {
            case ya.Audio.STATE_PLAYING:
                audioPlayer.pause();
                break;

            case ya.Audio.STATE_PAUSED:
                audioPlayer.resume();
                break;

            default:
                startPlay();
                break;
        }
    });

    /* Добавим немножко удобства для пользователей: сделаем автозагрузку следующего трека после того, как текущий загрузился.
    Для этого потребуется немного изменить функцию `startPlay` и отслеживать момент загрузки трека */

    audioPlayer.on(ya.Audio.EVENT_ENDED, function() {
        trackIndex++;

        if (trackIndex < trackUrls.length) {
            startPlay();
        }
    });

    audioPlayer.on(ya.Audio.EVENT_LOADED, function() {
        if (trackIndex + 1 < trackUrls.length) {
            audioPlayer.preload(trackUrls[trackIndex + 1]);
        }
    });

    /* Осталось только настроить навигацию по треку и регулирование громкости: */

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
})();
