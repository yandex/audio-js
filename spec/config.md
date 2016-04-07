

##<a name="config"></a> *ns* config

**Доступен извне как:** `ya.music.Audio.config`

Настройки библиотеки.

----

### Пространства имён

##<a name="config.audio"></a> *ns* config.audio

Общие настройки.

#### config.audio.retry : Number

Количество попыток реинициализации

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

##<a name="config.html5"></a> *ns* config.html5

Описание настроек HTML5 плеера.

#### config.html5.blacklist : Array.&lt; String &gt;

Список идентификаторов для которых лучше не использовать html5 плеер. Используется при авто-определении типа плеера. Идентификаторы сравниваются со строкой построенной по шаблону <code>@&amp;lt;platform.version&amp;gt; &amp;lt;platform.os&amp;gt;:&amp;lt;browser.name&amp;gt;/&amp;lt;browser.version&amp;gt;</code>

