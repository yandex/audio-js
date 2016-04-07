##<a name="Audio"></a> *class* Audio

**Доступен извне как:** `ya.music.Audio`

Аудиоплеер для браузера.

**Расширяет:**

  - [Events](Events.md#Events)

**Триггерит:**

  - [Audio.EVENT_PLAY](Audio.md#Audio.EVENT_PLAY)
  - [Audio.EVENT_ENDED](Audio.md#Audio.EVENT_ENDED)
  - [Audio.EVENT_VOLUME](Audio.md#Audio.EVENT_VOLUME)
  - [Audio.EVENT_CRASHED](Audio.md#Audio.EVENT_CRASHED)
  - [Audio.EVENT_STATE](Audio.md#Audio.EVENT_STATE)
  - [Audio.EVENT_SWAP](Audio.md#Audio.EVENT_SWAP)
  - [Audio.EVENT_STOP](Audio.md#Audio.EVENT_STOP)
  - [Audio.EVENT_PAUSE](Audio.md#Audio.EVENT_PAUSE)
  - [Audio.EVENT_PROGRESS](Audio.md#Audio.EVENT_PROGRESS)
  - [Audio.EVENT_LOADING](Audio.md#Audio.EVENT_LOADING)
  - [Audio.EVENT_LOADED](Audio.md#Audio.EVENT_LOADED)
  - [Audio.EVENT_ERROR](Audio.md#Audio.EVENT_ERROR)
  - [Audio.PRELOADER_EVENT+EVENT_STOP](Audio.md#Audio.PRELOADER_EVENT+EVENT_STOP)
  - [Audio.PRELOADER_EVENT+EVENT_PROGRESS](Audio.md#Audio.PRELOADER_EVENT+EVENT_PROGRESS)
  - [Audio.PRELOADER_EVENT+EVENT_LOADING](Audio.md#Audio.PRELOADER_EVENT+EVENT_LOADING)
  - [Audio.PRELOADER_EVENT+EVENT_LOADED](Audio.md#Audio.PRELOADER_EVENT+EVENT_LOADED)
  - [Audio.PRELOADER_EVENT+EVENT_ERROR](Audio.md#Audio.PRELOADER_EVENT+EVENT_ERROR)

#### new Audio(preferredType: String, overlay: HTMLElement)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[preferredType\]* | String | "html5" | Предпочитаемый тип плеера. Может принимать значения: &quot;html5&quot;, &quot;flash&quot; или любое ложное значение (false, null, undefined, 0, &quot;&quot;). Если выбранный тип плеера окажется недоступен, будет запущен оставшийся тип. Если указано ложное значение либо параметр не передан, то API автоматически выберет поддерживаемый тип плеера. Если браузер поддерживает обе технологии, то по умолчанию YandexAudio создает аудиоплеер на основе HTML5. |
| *\[overlay\]* | HTMLElement |  | HTML-контейнер для отображения Flash-апплета. |

#### Audio.info : Object

Список доступных плееров

#### Audio.audioContext : AudioContext

Контекст для Web Audio API.

----

### События

####<a name="Audio.EVENT_PROGRESS"></a> *event* Audio.EVENT_PROGRESS

Событие обновления позиции воспроизведения или загруженной части.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| times | [AudioTimes](Audio.md#AudioTimes) |  | Информация о временных данных аудиофайла. |

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
| times | [AudioTimes](Audio.md#AudioTimes) |  | Информация о временных данных аудиофайла. |

####<a name="Audio.PRELOADER_EVENT+EVENT_LOADING"></a> *event* Audio.PRELOADER_EVENT+EVENT_LOADING

Событие начала загрузки аудиофайла.

####<a name="Audio.PRELOADER_EVENT+EVENT_LOADED"></a> *event* Audio.PRELOADER_EVENT+EVENT_LOADED

Событие завершения загрузки аудиофайла.

####<a name="Audio.PRELOADER_EVENT+EVENT_ERROR"></a> *event* Audio.PRELOADER_EVENT+EVENT_ERROR

Событие ошибки воспроизведения.

----

### Методы

#### <a name="Audio..getDuration"></a> Audio#getDuration (preloader: Boolean \| int) : Number 

Получить длительность текущего аудио-файла (в секундах).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| preloader | Boolean \| int |  | Активный плеер или предзагрузчик. 0 - активный плеер, 1 - предзагрузчик. |

#### <a name="Audio..initPromise"></a> Audio#initPromise () : [Promise](Promise.md#Promise) 

Получить обещание, разрешающееся после завершения инициализации.

#### <a name="Audio..getType"></a> Audio#getType () : String \| null 

Получить текущий тип реализации плеера.

#### <a name="Audio..getSrc"></a> Audio#getSrc (offset: int) : String \| null 

Получить ссылку на текущий трек.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[offset\]* | int | 0 | Брать аудио-файл из активного плеера или из прелоадера. 0 - активный плеер, 1 - прелоадер. |

#### <a name="Audio..play"></a> Audio#play (src: String, duration: Number) : [AbortablePromise](AbortablePromise.md#AbortablePromise) 

Запуск воспроизведения.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| src | String |  | Ссылка на трек. |
| *\[duration\]* | Number |  | Длительность аудио-файла. Актуально для Flash-реализации, в ней пока аудио-файл грузится длительность определяется с погрешностью. |

#### <a name="Audio..restart"></a> Audio#restart () : [AbortablePromise](AbortablePromise.md#AbortablePromise) 

Перезапуск воспроизведения.

> **Возвращает:** обещание, которое разрешится, когда трек будет перезапущен.

#### <a name="Audio..stop"></a> Audio#stop (offset: int) : [AbortablePromise](AbortablePromise.md#AbortablePromise) 

Остановка воспроизведения.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[offset\]* | int | 0 | Активный плеер или прелоадер. 0 - активный плеер. 1 - прелоадер. |

> **Возвращает:** обещание, которое разрешится, когда воспроизведение будет остановлено.

#### <a name="Audio..pause"></a> Audio#pause () : [AbortablePromise](AbortablePromise.md#AbortablePromise) 

Поставить плеер на паузу.

> **Возвращает:** обещание, которое  разрешится, когда плеер будет поставлен на паузу.

#### <a name="Audio..resume"></a> Audio#resume () : [AbortablePromise](AbortablePromise.md#AbortablePromise) 

Снятие плеера с паузы.

> **Возвращает:** обещание, которое разрешится, когда начнется воспроизведение.

#### <a name="Audio..playPreloaded"></a> Audio#playPreloaded (src: String) : [AbortablePromise](AbortablePromise.md#AbortablePromise) 

Запуск воспроизведения предзагруженного аудиофайла.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[src\]* | String |  | Ссылка на аудиофайл (для проверки, что в прелоадере нужный трек). |

> **Возвращает:** обещание, которое разрешится, когда начнется воспроизведение предзагруженного аудиофайла.

#### <a name="Audio..preload"></a> Audio#preload (src: String, duration: Number) : [AbortablePromise](AbortablePromise.md#AbortablePromise) 

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

#### <a name="Audio..setAudioPreprocessor"></a> Audio#setAudioPreprocessor (preprocessor: [AudioPreprocessor](Audio.md#AudioPreprocessor)) : boolean 

Подключение аудио препроцессора. Вход препроцессора подключается к аудиоэлементу, у которого выставлена
100% громкость. Выход препроцессора подключается к GainNode, которая регулирует итоговую громкость.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| preprocessor | [AudioPreprocessor](Audio.md#AudioPreprocessor) |  | Препроцессор. |

> **Возвращает:** статус успеха.

#### <a name="Audio..getPlayId"></a> Audio#getPlayId () : String 

Получить уникальный идентификатор воспроизведения. Создаётся каждый раз при запуске нового трека или перезапуске текущего.

#### <a name="Audio..on"></a> Audio#on (event: String, callback: function) : [Events](Events.md#Events) *(inherits [Events#on](Events.md#Events..on))*

Подписаться на событие (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Audio..off"></a> Audio#off (event: String, callback: function) : [Events](Events.md#Events) *(inherits [Events#off](Events.md#Events..off))*

Отписаться от события (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Audio..once"></a> Audio#once (event: String, callback: function) : [Events](Events.md#Events) *(inherits [Events#once](Events.md#Events..once))*

Подписаться на событие и отписаться сразу после его первого возникновения (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Audio..clearListeners"></a> Audio#clearListeners () : [Events](Events.md#Events) *(inherits [Events#clearListeners](Events.md#Events..clearListeners))*

Отписаться от всех слушателей событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Audio..muteEvents"></a> Audio#muteEvents () : [Events](Events.md#Events) *(inherits [Events#muteEvents](Events.md#Events..muteEvents))*

Остановить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Audio..unmuteEvents"></a> Audio#unmuteEvents () : [Events](Events.md#Events) *(inherits [Events#unmuteEvents](Events.md#Events..unmuteEvents))*

Возобновить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

----

### Типы

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

