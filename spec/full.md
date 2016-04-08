## Внешняя структура модуля

* ya.music
  * [Audio](#Audio)
    * [config](#config)
    * [AudioError](#AudioError)
    * [PlaybackError](#PlaybackError)
    * fx
      * [Equalizer](#Equalizer)
      * [volumeLib](#volumeLib)
    * [LoaderError](#LoaderError)
    * [Logger](#Logger)

----

##<a name="Audio"></a> *class* Audio

**Доступен извне как:** `ya.music.Audio`

Аудиоплеер для браузера.

**Расширяет:**

  - [Events](#Events)

**Триггерит:**

  - [Audio.EVENT_PLAY](#Audio.EVENT_PLAY)
  - [Audio.EVENT_ENDED](#Audio.EVENT_ENDED)
  - [Audio.EVENT_VOLUME](#Audio.EVENT_VOLUME)
  - [Audio.EVENT_CRASHED](#Audio.EVENT_CRASHED)
  - [Audio.EVENT_STATE](#Audio.EVENT_STATE)
  - [Audio.EVENT_SWAP](#Audio.EVENT_SWAP)
  - [Audio.EVENT_STOP](#Audio.EVENT_STOP)
  - [Audio.EVENT_PAUSE](#Audio.EVENT_PAUSE)
  - [Audio.EVENT_PROGRESS](#Audio.EVENT_PROGRESS)
  - [Audio.EVENT_LOADING](#Audio.EVENT_LOADING)
  - [Audio.EVENT_LOADED](#Audio.EVENT_LOADED)
  - [Audio.EVENT_ERROR](#Audio.EVENT_ERROR)
  - [Audio.PRELOADER_EVENT+EVENT_STOP](#Audio.PRELOADER_EVENT+EVENT_STOP)
  - [Audio.PRELOADER_EVENT+EVENT_PROGRESS](#Audio.PRELOADER_EVENT+EVENT_PROGRESS)
  - [Audio.PRELOADER_EVENT+EVENT_LOADING](#Audio.PRELOADER_EVENT+EVENT_LOADING)
  - [Audio.PRELOADER_EVENT+EVENT_LOADED](#Audio.PRELOADER_EVENT+EVENT_LOADED)
  - [Audio.PRELOADER_EVENT+EVENT_ERROR](#Audio.PRELOADER_EVENT+EVENT_ERROR)

#### new Audio(preferredType: String, overlay: HTMLElement)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[preferredType\]* | String | "html5" | Предпочитаемый тип плеера. Может принимать значения: &quot;html5&quot;, &quot;flash&quot; или любое ложное значение (false, null, undefined, 0, &quot;&quot;). Если выбранный тип плеера окажется недоступен, будет запущен оставшийся тип. Если указано ложное значение либо параметр не передан, то API автоматически выберет поддерживаемый тип плеера. Если браузер поддерживает обе технологии, то по умолчанию YandexAudio создает аудиоплеер на основе HTML5. |
| *\[overlay\]* | HTMLElement |  | HTML-контейнер для отображения Flash-апплета. |

#### Audio.info : Object

Список доступных плееров

#### Audio.audioContext : AudioContext

Контекст для Web Audio API.

#### Audio.PRELOADER_EVENT : String

Событие предзагрузчика. Используется в качестве префикса.

#### Audio.STATE_INIT : String

Плеер находится в состоянии инициализации.

#### Audio.STATE_CRASHED : String

Не удалось инициализировать плеер.

#### Audio.STATE_IDLE : String

Плеер готов и ожидает.

#### Audio.STATE_PLAYING : String

Плеер проигрывает трек.

#### Audio.STATE_PAUSED : String

Плеер поставлен на паузу.

#### <a name="Audio..getDuration"></a> Audio#getDuration (preloader: Boolean \| int) : Number 

Получить длительность текущего аудио-файла (в секундах).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| preloader | Boolean \| int |  | Активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик. |

#### <a name="Audio..initPromise"></a> Audio#initPromise () : [Promise](#Promise) 

Получить обещание, разрешающееся после завершения инициализации.

#### <a name="Audio..getType"></a> Audio#getType () : String \| null 

Получить текущий тип реализации плеера.

#### <a name="Audio..getSrc"></a> Audio#getSrc (offset: int) : String \| null 

Получить ссылку на текущий трек.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[offset\]* | int | 0 | Брать аудио-файл из активного плеера или из прелоадера. 0 - активный плеер, 1 - прелоадер. |

#### <a name="Audio..play"></a> Audio#play (src: String, duration: Number) : [AbortablePromise](#AbortablePromise) 

Запуск воспроизведения.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| src | String |  | Ссылка на трек. |
| *\[duration\]* | Number |  | Длительность аудио-файла. Актуально для Flash-реализации, в ней пока аудио-файл грузится длительность определяется с погрешностью. |

#### <a name="Audio..restart"></a> Audio#restart () : [AbortablePromise](#AbortablePromise) 

Перезапуск воспроизведения.

> **Возвращает:** обещание, которое разрешится, когда трек будет перезапущен.

#### <a name="Audio..stop"></a> Audio#stop (offset: int) : [AbortablePromise](#AbortablePromise) 

Остановка воспроизведения.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[offset\]* | int | 0 | Активный плеер или прелоадер. 0 - активный плеер. 1 - прелоадер. |

> **Возвращает:** обещание, которое разрешится, когда воспроизведение будет остановлено.

#### <a name="Audio..pause"></a> Audio#pause () : [AbortablePromise](#AbortablePromise) 

Поставить плеер на паузу.

> **Возвращает:** обещание, которое  разрешится, когда плеер будет поставлен на паузу.

#### <a name="Audio..resume"></a> Audio#resume () : [AbortablePromise](#AbortablePromise) 

Снятие плеера с паузы.

> **Возвращает:** обещание, которое разрешится, когда начнется воспроизведение.

#### <a name="Audio..playPreloaded"></a> Audio#playPreloaded (src: String) : [AbortablePromise](#AbortablePromise) 

Запуск воспроизведения предзагруженного аудиофайла.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[src\]* | String |  | Ссылка на аудиофайл (для проверки, что в прелоадере нужный трек). |

> **Возвращает:** обещание, которое разрешится, когда начнется воспроизведение предзагруженного аудиофайла.

#### <a name="Audio..preload"></a> Audio#preload (src: String, duration: Number) : [AbortablePromise](#AbortablePromise) 

Предзагрузка аудиофайла.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| src | String |  | Ссылка на трек. |
| *\[duration\]* | Number |  | Длительность аудиофайла. Актуально для Flash-реализации, в ней пока аудиофайл грузится длительность определяется с погрешностью. |

> **Возвращает:** обещание, которое разрешится, когда начнется предзагрузка аудиофайла.

#### <a name="Audio..isPreloaded"></a> Audio#isPreloaded (src: String) : Boolean 

Проверка, что аудиофайл предзагружен.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| src | String |  | Ссылка на трек. |

> **Возвращает:** true, если аудиофайл предзагружен, false - иначе.

#### <a name="Audio..isPreloading"></a> Audio#isPreloading (src: String) : Boolean 

Проверка, что аудиофайл предзагружается.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| src | String |  | Ссылка на трек. |

> **Возвращает:** true, если аудиофайл начал предзагружаться, false - иначе.

#### <a name="Audio..getPosition"></a> Audio#getPosition () : Number 

Получение позиции воспроизведения (в секундах).

#### <a name="Audio..setPosition"></a> Audio#setPosition (position: Number) : Number 

Установка позиции воспроизведения (в секундах).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| position | Number |  | Новая позиция воспроизведения |

> **Возвращает:** итоговая позиция воспроизведения.

#### <a name="Audio..getState"></a> Audio#getState () : String 

Получить статус плеера.

#### <a name="Audio..getLoaded"></a> Audio#getLoaded (preloader: Boolean \| int) : Number 

Получить длительность загруженной части (в секундах).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| preloader | Boolean \| int |  | Активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик. |

#### <a name="Audio..getPlayed"></a> Audio#getPlayed () : Number 

Получить длительность воспроизведения (в секундах).

#### <a name="Audio..getVolume"></a> Audio#getVolume () : Number 

Получить текущее значение громкости плеера.

#### <a name="Audio..setVolume"></a> Audio#setVolume (volume: Number) : Number 

Установка громкости плеера.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| volume | Number |  | Новое значение громкости. |

> **Возвращает:** итоговое значение громкости.

#### <a name="Audio..isDeviceVolume"></a> Audio#isDeviceVolume () : Boolean 

Проверка, что громкость управляется устройством, а не программно.

> **Возвращает:** true, если громкость управляется устройством, false - иначе.

#### <a name="Audio..toggleCrossDomain"></a> Audio#toggleCrossDomain (state: Boolean) : boolean 

Включить режим CORS для получения аудио-треков

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| state | Boolean |  | Запрашиваемый статус. |

> **Возвращает:** статус успеха.

#### <a name="Audio..toggleWebAudioAPI"></a> Audio#toggleWebAudioAPI (state: Boolean) : Boolean 

Переключение режима использования Web Audio API. Доступен только при html5-реализации плеера.
Внимание!!! После включения режима Web Audio API он не отключается полностью, т.к. для этого требуется
реинициализация плеера, которой требуется клик пользователя. При отключении из графа обработки исключаются
все ноды кроме нод-источников и ноды вывода, управление громкостью переключается на элементы audio, без
использования GainNode.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| state | Boolean |  | Запрашиваемый статус. |

> **Возвращает:** итоговый статус

#### <a name="Audio..setAudioPreprocessor"></a> Audio#setAudioPreprocessor (preprocessor: [AudioPreprocessor](#AudioPreprocessor)) : boolean 

Подключение аудио препроцессора. Вход препроцессора подключается к аудиоэлементу, у которого выставлена
100% громкость. Выход препроцессора подключается к GainNode, которая регулирует итоговую громкость.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| preprocessor | [AudioPreprocessor](#AudioPreprocessor) |  | Препроцессор. |

> **Возвращает:** статус успеха.

#### <a name="Audio..getPlayId"></a> Audio#getPlayId () : String 

Получить уникальный идентификатор воспроизведения. Создаётся каждый раз при запуске нового трека или перезапуске текущего.

#### <a name="Audio..on"></a> Audio#on (event: String, callback: function) : [Events](#Events) *(inherits [Events#on](#Events..on))*

Подписаться на событие (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Audio..off"></a> Audio#off (event: String, callback: function) : [Events](#Events) *(inherits [Events#off](#Events..off))*

Отписаться от события (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Audio..once"></a> Audio#once (event: String, callback: function) : [Events](#Events) *(inherits [Events#once](#Events..once))*

Подписаться на событие и отписаться сразу после его первого возникновения (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Audio..clearListeners"></a> Audio#clearListeners () : [Events](#Events) *(inherits [Events#clearListeners](#Events..clearListeners))*

Отписаться от всех слушателей событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Audio..muteEvents"></a> Audio#muteEvents () : [Events](#Events) *(inherits [Events#muteEvents](#Events..muteEvents))*

Остановить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Audio..unmuteEvents"></a> Audio#unmuteEvents () : [Events](#Events) *(inherits [Events#unmuteEvents](#Events..unmuteEvents))*

Возобновить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

####<a name="Audio.EVENT_PROGRESS"></a> *event* Audio.EVENT_PROGRESS

Событие обновления позиции воспроизведения или загруженной части.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| times | [AudioTimes](#AudioTimes) |  | Информация о временных данных аудиофайла. |

####<a name="Audio.EVENT_PLAY"></a> *event* Audio.EVENT_PLAY

Событие начала воспроизведения.

####<a name="Audio.EVENT_VOLUME"></a> *event* Audio.EVENT_VOLUME

Событие изменения громкости.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| volume | Number |  | Новое значение громкости. |

####<a name="Audio.EVENT_CRASHED"></a> *event* Audio.EVENT_CRASHED

Событие возникновения ошибки при инициализации плеера.

####<a name="Audio.EVENT_STATE"></a> *event* Audio.EVENT_STATE

Событие смены статуса плеера.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| state | String |  | Новый статус плеера. |

####<a name="Audio.EVENT_SWAP"></a> *event* Audio.EVENT_SWAP

Событие переключения активного плеера и прелоадера.

####<a name="Audio.EVENT_STOP"></a> *event* Audio.EVENT_STOP

Событие остановки воспроизведения.

####<a name="Audio.EVENT_PAUSE"></a> *event* Audio.EVENT_PAUSE

Событие паузы воспроизведения.

####<a name="Audio.EVENT_ENDED"></a> *event* Audio.EVENT_ENDED

Событие завершения воспроизведения.

####<a name="Audio.EVENT_LOADING"></a> *event* Audio.EVENT_LOADING

Событие начала загрузки аудиофайла.

####<a name="Audio.EVENT_LOADED"></a> *event* Audio.EVENT_LOADED

Событие завершения загрузки аудиофайла.

####<a name="Audio.EVENT_ERROR"></a> *event* Audio.EVENT_ERROR

Событие ошибки воспроизведения.

####<a name="Audio.PRELOADER_EVENT+EVENT_STOP"></a> *event* Audio.PRELOADER_EVENT+EVENT_STOP

Событие остановки воспроизведения.

####<a name="Audio.PRELOADER_EVENT+EVENT_PROGRESS"></a> *event* Audio.PRELOADER_EVENT+EVENT_PROGRESS

Событие обновления позиции загруженной части.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| times | [AudioTimes](#AudioTimes) |  | Информация о временных данных аудиофайла. |

####<a name="Audio.PRELOADER_EVENT+EVENT_LOADING"></a> *event* Audio.PRELOADER_EVENT+EVENT_LOADING

Событие начала загрузки аудиофайла.

####<a name="Audio.PRELOADER_EVENT+EVENT_LOADED"></a> *event* Audio.PRELOADER_EVENT+EVENT_LOADED

Событие завершения загрузки аудиофайла.

####<a name="Audio.PRELOADER_EVENT+EVENT_ERROR"></a> *event* Audio.PRELOADER_EVENT+EVENT_ERROR

Событие ошибки воспроизведения.

----

##<a name="AudioError"></a> *class* AudioError

**Доступен извне как:** `ya.music.Audio.AudioError`

Класс ошибки аудиопллеера.

**Расширяет:**

  - Error

#### new AudioError(message: String)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| message | String |  | Текст ошибки. |

#### AudioError.NO_IMPLEMENTATION : String

Не найдена реализация плеера или возникла ошибка при инициализации всех доступных реализаций.

#### AudioError.NOT_PRELOADED : String

Аудиофайл не был предзагружен или во время загрузки произошла ошибка.

#### AudioError.BAD_STATE : String

Действие недоступно из текущего состояния.

#### AudioError.FLASH_BLOCKER : String

Flash-плеер был заблокирован.

#### AudioError.FLASH_UNKNOWN_CRASH : String

Возникла ошибка при инициализации Flash-плеера по неизвестным причинам.

#### AudioError.FLASH_INIT_TIMEOUT : String

Возникла ошибка при инициализации Flash-плеера из-за таймаута.

#### AudioError.FLASH_INTERNAL_ERROR : String

Внутренняя ошибка Flash-плеера.

#### AudioError.FLASH_EMMITER_NOT_FOUND : String

Попытка вызвать недоступный экземляр Flash-плеера.

#### AudioError.FLASH_NOT_RESPONDING : String

Flash-плеер перестал отвечать на запросы.

----

##<a name="PlaybackError"></a> *class* PlaybackError

**Доступен извне как:** `ya.music.Audio.PlaybackError`

Класс ошибки воспроизведения.

**Расширяет:**

  - Error

#### new PlaybackError(String, String)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| String |  |  | message Текст ошибки. |
| String |  |  | src Ссылка на трек. |

#### PlaybackError.CONNECTION_ABORTED : String

Отмена соединенния.

#### PlaybackError.NETWORK_ERROR : String

Сетевая ошибка.

#### PlaybackError.DECODE_ERROR : String

Ошибка декодирования аудио.

#### PlaybackError.BAD_DATA : String

Недоступный источник.

#### PlaybackError.DONT_START : String

Не запускается воспроизведение.

#### PlaybackError.html5 : Object

Таблица соответствия кодов ошибок HTML5 плеера.

----

##<a name="Equalizer"></a> *class* Equalizer

**Доступен извне как:** `ya.music.Audio.fx.Equalizer`

Эквалайзер.

**Расширяет:**

  - [Events](#Events)

**Триггерит:**

  - [Equalizer.EVENT_CHANGE](#Equalizer.EVENT_CHANGE)

#### new Equalizer(audioContext: AudioContext, bands: Array.&lt; Number &gt;)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| audioContext | AudioContext |  | Контекст Web Audio API. |
| bands | Array.&lt; Number &gt; |  | Список частот для полос эквалайзера. |

#### Equalizer.DEFAULT_BANDS : Array.&lt; Number &gt;

Набор частот эквалайзера, применяющийся по умолчанию.

#### Equalizer.DEFAULT_PRESETS : Object.&lt; String, [EqualizerPreset](#EqualizerPreset) &gt;

Набор распространенных пресетов эквалайзера для набора частот по умолчанию.

#### Equalizer#EVENT_CHANGE : String

#### <a name="Equalizer..loadPreset"></a> Equalizer#loadPreset (preset: [EqualizerPreset](#EqualizerPreset))  

Загрузить настройки.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| preset | [EqualizerPreset](#EqualizerPreset) |  | Настройки. |

#### <a name="Equalizer..savePreset"></a> Equalizer#savePreset () : [EqualizerPreset](#EqualizerPreset) 

Сохранить текущие настройки.

#### <a name="Equalizer..guessPreamp"></a> Equalizer#guessPreamp () : number 

Вычисляет оптимальное значение предусиления. Функция является экспериментальной.

> **Возвращает:** значение предусиления.

#### <a name="Equalizer..on"></a> Equalizer#on (event: String, callback: function) : [Events](#Events) *(inherits [Events#on](#Events..on))*

Подписаться на событие (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Equalizer..off"></a> Equalizer#off (event: String, callback: function) : [Events](#Events) *(inherits [Events#off](#Events..off))*

Отписаться от события (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Equalizer..once"></a> Equalizer#once (event: String, callback: function) : [Events](#Events) *(inherits [Events#once](#Events..once))*

Подписаться на событие и отписаться сразу после его первого возникновения (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Equalizer..clearListeners"></a> Equalizer#clearListeners () : [Events](#Events) *(inherits [Events#clearListeners](#Events..clearListeners))*

Отписаться от всех слушателей событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Equalizer..muteEvents"></a> Equalizer#muteEvents () : [Events](#Events) *(inherits [Events#muteEvents](#Events..muteEvents))*

Остановить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Equalizer..unmuteEvents"></a> Equalizer#unmuteEvents () : [Events](#Events) *(inherits [Events#unmuteEvents](#Events..unmuteEvents))*

Возобновить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

####<a name="Equalizer.EVENT_CHANGE"></a> *event* Equalizer.EVENT_CHANGE

Событие изменения полосы пропускания

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| freq | Number |  | Частота полосы пропускания. |
| value | Number |  | Значение усиления. |

----

##<a name="LoaderError"></a> *class* LoaderError

**Доступен извне как:** `ya.music.Audio.LoaderError`

Класс ошибок загрузчика.
Расширяет Error.

#### new LoaderError(message: String)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| message | String |  | Текст ошибки. |

#### LoaderError.TIMEOUT : String

Таймаут загрузки.

#### LoaderError.FAILED : String

Ошибка запроса на загрузку.

----

##<a name="Logger"></a> *class* Logger

**Доступен извне как:** `ya.music.Audio.Logger`

Настраиваемый логгер для аудиоплеера.

#### new Logger(channel: String)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| channel | String |  | Имя канала, за который будет отвечать экземляр логгера. |

#### Logger.ignores : Array.&lt; String &gt;

Список игнорируемых каналов.

#### Logger.logLevels : Array.&lt; String &gt;

Список отображаемых в консоли уровней лога.

#### Logger#debug 

Запись в лог с уровнем <strong>debug</strong>.

#### Logger#log 

Запись в лог с уровнем <strong>log</strong>.

#### Logger#info 

Запись в лог с уровнем <strong>info</strong>.

#### Logger#warn 

Запись в лог с уровнем <strong>warn</strong>.

#### Logger#error 

Запись в лог с уровнем <strong>error</strong>.

#### Logger#trace 

Запись в лог с уровнем <strong>trace</strong>.

#### <a name="Logger.log"></a> Logger.log (level: String, channel: String, context: Object, args: *)  

Сделать запись в лог.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| level | String |  | Уровень лога. |
| channel | String |  | Канал. |
| context | Object |  | Контекст вызова. |
| *\[args\]* | * |  | Дополнительные аргументы. |

----

##<a name="Events"></a> *inner* *class* Events

Диспетчер событий.

#### <a name="Events.mixin"></a> Events.mixin (classConstructor: function) : function 

Расширить произвольный класс свойствами диспетчера событий.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| classConstructor | function |  | Конструктор класса. |

> **Возвращает:** тот же конструктор класса, расширенный свойствами диспетчера событий.

#### <a name="Events.eventize"></a> Events.eventize (object: Object) : Object 

Расширить произвольный объект свойствами диспетчера событий.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| object | Object |  | Объект. |

> **Возвращает:** тот же объект, расширенный свойствами диспетчера событий.

#### <a name="Events..on"></a> Events#on (event: String, callback: function) : [Events](#Events) 

Подписаться на событие (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Events..off"></a> Events#off (event: String, callback: function) : [Events](#Events) 

Отписаться от события (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Events..once"></a> Events#once (event: String, callback: function) : [Events](#Events) 

Подписаться на событие и отписаться сразу после его первого возникновения (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Events..clearListeners"></a> Events#clearListeners () : [Events](#Events) 

Отписаться от всех слушателей событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Events..muteEvents"></a> Events#muteEvents () : [Events](#Events) 

Остановить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Events..unmuteEvents"></a> Events#unmuteEvents () : [Events](#Events) 

Возобновить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

----

##<a name="AbortablePromise"></a> *inner* *class* AbortablePromise

Обещание с возможностью отмены связанного с ним действия.

**Расширяет:**

  - [Promise](#Promise)

#### <a name="AbortablePromise..abort"></a> AbortablePromise#abort (reason: String \| Error)  

Отмена действия, связанного с обещанием. Абстрактный метод.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| reason | String \| Error |  | Причина отмены действия. |

#### <a name="AbortablePromise..then"></a> AbortablePromise#then (callback: function, errback: null \| function) : [Promise](#Promise) *(inherits [Promise#then](#Promise..then))*

Назначить обработчики разрешения и отклонения обещания.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| callback | function |  | Обработчик успеха. |
| *\[errback\]* | null \| function |  | Обработчик ошибки. |

> **Возвращает:** новое обещание из результатов обработчика.

#### <a name="AbortablePromise..catch"></a> AbortablePromise#catch (errback: function) : [Promise](#Promise) *(inherits [Promise#catch](#Promise..catch))*

Назначить обработчик отклонения обещания.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| errback | function |  | Обработчик ошибки. |

> **Возвращает:** новое обещание из результатов обработчика.

----

##<a name="Promise"></a> *inner* *class* Promise

#### <a name="Promise..then"></a> Promise#then (callback: function, errback: null \| function) : [Promise](#Promise) 

Назначить обработчики разрешения и отклонения обещания.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| callback | function |  | Обработчик успеха. |
| *\[errback\]* | null \| function |  | Обработчик ошибки. |

> **Возвращает:** новое обещание из результатов обработчика.

#### <a name="Promise..catch"></a> Promise#catch (errback: function) : [Promise](#Promise) 

Назначить обработчик отклонения обещания.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| errback | function |  | Обработчик ошибки. |

> **Возвращает:** новое обещание из результатов обработчика.

----

## Типы

####<a name="AudioTimes"></a> *type* AudioTimes : Object

Описание временных данных плеера.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| duration | Number |  | Длительность аудиофайла. |
| loaded | Number |  | Длительность загруженной части. |
| position | Number |  | Позиция воспроизведения. |
| played | Number |  | Длительность воспроизведения. |

####<a name="AudioPreprocessor"></a> *type* AudioPreprocessor : Object

Аудио-препроцессор.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| input | AudioNode |  | Нода, в которую перенаправляется вывод аудио. |
| output | AudioNode |  | Нода, из которой вывод подается на усилитель. |

####<a name="EqualizerPreset"></a> *type* EqualizerPreset : Object

Описание настроек эквалайзера.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[id\]* | String |  | Идентификатор настроек. |
| preamp | Number |  | Предусилитель. |
| bands | Array.&lt; Number &gt; |  | Значения для полос эквалайзера. |

## Пространства имён

----

##<a name="config.audio"></a> *ns* config.audio

Общие настройки.

#### config.audio.retry : Number

Количество попыток реинициализации

----

##<a name="config.flash"></a> *ns* config.flash

Настройки подключения Flash-плеера.

#### config.flash.path : String

Путь к .swf файлу флеш-плеера

#### config.flash.name : String

Имя .swf файла флеш-плеера

#### config.flash.version : String

Минимальная версия флеш-плеера

#### config.flash.playerID : String

ID, который будет выставлен для элемента с Flash-плеером

#### config.flash.callback : String

Имя функции-обработчика событий Flash-плеера

#### config.flash.initTimeout : Number

Таймаут инициализации

#### config.flash.loadTimeout : Number

Таймаут загрузки

#### config.flash.clickTimeout : Number

Таймаут инициализации после клика

#### config.flash.heartBeatInterval : Number

Интервал проверки доступности Flash-плеера

----

##<a name="config.html5"></a> *ns* config.html5

Описание настроек HTML5 плеера.

#### config.html5.blacklist : Array.&lt; String &gt;

Список идентификаторов для которых лучше не использовать html5 плеер. Используется при авто-определении типа плеера. Идентификаторы сравниваются со строкой построенной по шаблону <code>@&amp;lt;platform.version&amp;gt; &amp;lt;platform.os&amp;gt;:&amp;lt;browser.name&amp;gt;/&amp;lt;browser.version&amp;gt;</code>

----

##<a name="config"></a> *ns* config

**Доступен извне как:** `ya.music.Audio.config`
Настройки библиотеки.

----

##<a name="volumeLib"></a> *ns* volumeLib

**Доступен извне как:** `ya.music.Audio.fx.volumeLib`
Методы конвертации значений громкости.

#### volumeLib.EPSILON : number

Минимальное значение громкости, при котором происходит отключение звука. Ограничение в 0.01 подобрано эмпирически.

#### <a name="volumeLib.toExponent"></a> volumeLib.toExponent (value: Number) : Number 

Вычисление значение относительной громкости по значению на логарифмической шкале.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| value | Number |  | Значение на шкале. |

#### <a name="volumeLib.fromExponent"></a> volumeLib.fromExponent (volume: Number) : Number 

Вычисление положения на логарифмической шкале по значению относительной громкости громкости

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| volume | Number |  | Громкость. |

#### <a name="volumeLib.toDBFS"></a> volumeLib.toDBFS (volume: Number) : Number 

Вычисление значения dBFS из относительного значения громкости.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| volume | Number |  | Относительная громкость. |

#### <a name="volumeLib.fromDBFS"></a> volumeLib.fromDBFS (dbfs: Number) : Number 

Вычисление значения относительной громкости из значения dBFS.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| dbfs | Number |  | Громкость в dBFS. |

