YandexAudio
===========
YandexAudio - это библиотека аудио-плеера для браузера. Текущее состояние дел с html5 audio и поддержкой flash в разных браузерах не позволяют легко и просто реализовать функционал воспроизведения музыки в браузере. Данная библиотека нацелена на то, чтобы устранить этот досадный недостаток. Вот краткий список возможностей данной библиотеки:

  - автоматическое определение поддерживаемых браузером технологий
  - подключение flash-плеера на страницу с возможностью отображения видимого (прозрачного) flash-апплета
  - автоматическая реинициализация при крахе плеера (например из-за заблокированного flash-содержимого)
  - предзагрузка следующего трека, параллельно с воспроизведением текущего
  - детектирование и использование технологий web audio api
  - эквалайзер (с пресетами от WINAMP) с возможностью настройки количества и частоты полос пропускания


Подключение
----------
Существует 3 способа подключения данной библиотеки:

  - **npm** если ваш проект использует сборку скриптов с помощью browserify или аналога, то можно просто подключать библиотку как npm-пакет `var YandexAudio = require('YandexAudio')`
  - **скрипт** - достаточно подключить основной файл скрипта (dist/index.js или dist/index.min.js - минифицированную версию) в тело страницы и далее использовать глобально доступный объект `ya.Audio`
  - **modules** - .... нужно описать как с этим работать... я сам если честно не до конца понимаю зачем и как...


Использование
------------
### Создание экземпляра плеера:

```javascript
    var audioPlayer = new ya.Audio(preferredPlayerType, flashOverlayElement);
    audioPlayer.initPromise().then(function() {
      console.log("Аудио-плеер готов к работе");
    }, function(){
      console.error("Не удалось инициализировать аудио-плеер");
    });
```

  - **preferredPlayerType** - строка `"html5"`, `"flash"` или любое ложное значение (false, null, undefined, 0, ""), указывает на предпочитаемый тип плеера (если он окажется недоступен, будет запущен оставшийся тип)
  - **flashOverlayElement** - HTMLElement в который требуется встроить flash-апплет или ложное значение. Требуется для того, чтобы была возможность отобразить видимый flash-апплет для отключения различных блокировщиков flash'а.

### Запуск воспроизведения

```javascript
    audioPlayer.play(src).then(function(){
      console.log("Воспроизведение успешно началось");
    }, function(err){
      console.error("Не удалось начать воспроизведенние", err);
    });
```

### Управление воспроизведением

```javascript
    audioPlayer.pause(); // пауза
    audioPlayer.resume(); // продолжение воспроизведения
    audioPlayer.stop(); // остановка воспроизведения и загрузки трека
    
    console.log("Длительность трека", audioPlayer.getDuration());
    console.log("Текущая позиция воспроизведения", audioPlayer.getPosition());
    console.log("Длительность загруженной части", audioPlayer.getLoaded());
    console.log("Время воспроизведения трека", audioPlayer.getPlayed());
    
    console.log("Новая позиция воспроизведения", audioPlayer.setPosition(position));
```

### Прослушивание событий

```javascript
    audioPlayer.on(ya.Audio.EVENT_STATE, function(state){
      switch(state) {
        case ya.Audio.STATE_INIT: console.log("Инициализация плеера"); break;
        case ya.Audio.STATE_IDLE: console.log("Плеер готов и ожидает"); break;
        case ya.Audio.STATE_PLAYING: console.log("Плеер проигрывает музыку"); break;
        case ya.Audio.STATE_PAUSED: console.log("Плеер поставлен на паузу"); break;
        case ya.Audio.STATE_CRASHED: console.log("Не удалось инициализировать плеер"); break;
      }
    });
    
    var logEvent = function(text){ return function(data){ console.log(text, data); }; };
    audioPlayer.on(ya.Audio.EVENT_PLAY, logEvent("Плеер начал воспроизведение трека"));
    audioPlayer.on(ya.Audio.EVENT_STOP, logEvent("Остановка воспроизведения"));
    audioPlayer.on(ya.Audio.EVENT_PAUSE, logEvent("Пауза воспроизведения"));
    
    audioPlayer.on(ya.Audio.EVENT_PROGRESS, logEvent("Обновление позиции воспроизведения"));
    audioPlayer.on(ya.Audio.EVENT_LOADING, logEvent("Обновление длительности загруженной части"));
    
    audioPlayer.on(ya.Audio.EVENT_LOADED, logEvent("Трек загружен полностью"));
    audioPlayer.on(ya.Audio.EVENT_ENDED, logEvent("Воспроизведение трека завершено"));
    
    audioPlayer.on(ya.Audio.EVENT_VOLUME, logEvent("Изменение громкости"));
    
    audioPlayer.on(ya.Audio.EVENT_ERROR, logEvent("Возникла ошибка при воспроизведении"));
    audioPlayer.on(ya.Audio.EVENT_CRASHED, logEvent("Крах инициализации"));
    
    audioPlayer.on(ya.Audio.EVENT_SWAP, logEvent("Переключение между текущим и предзагруженным треком"));
```    

Сборка javascipt
----------------
Сборка библиотеки производится с помощью npm-пакетов [browserify](https://www.npmjs.com/package/browserify) и [uglify-js](https://www.npmjs.com/package/uglify-js).
Для того чтобы подготовить окружение для сборки библиотеки требуется установить [node-js](https://nodejs.org/en/) и выполнить `npm install` в корне репозитория.
Сам процесс сборки доступен в двух вариантах: с помощью утилиты make (основой метод) и с помощью библиотеки [grunt](http://gruntjs.com/).

### Makefile
Является основным методом сборки. Доступные команды:

  - **make all** - делает полную сборку библиотеки
  - **make clean** - удаляет каталог сборки
  - **make build** - собирает библиотеку
  - **make minify** - собирает минифицированную версию библиотеки (не пересобирает библиотеку если она была уже собрана через make build)
  
Без аргументов **make** выполняет сценарий **make all**.
Перед тем как делать pull request следует сделать полную сборку библиотеки с помощью make.

### Grunt
Запасной вариант сборки для тех у кого по каким-то причинам нет возможности воспользоваться утилитой make.
Чтобы использовать сборку через grunt требуется установить глобально пакет [grunt-cli](https://www.npmjs.com/package/grunt-cli) (`npm install -g grunt-cli`).
Доступные команды:

  - **grunt all** - делает полную сборку библиотеки
  - **grunt clean** - удаляет каталог сборки
  - **grunt build** - собирает библиотеку
  
Без аргументов **grunt** выполняет сценарий **grunt all**.


Сборка flash
------------
Сборка flash-плеера в автоматическом режиме не доступна. Для ручной сборки требуется настроить какой-либо сборщик (наиболее удобные: IntelliJ IDEA, FlashDevelop). Параметры, используемые для сборки: FlexSDK 3.6.0, целевая версия плеера 9, основной класс - AudioManager, имя собранного файла player-2_0.swf

