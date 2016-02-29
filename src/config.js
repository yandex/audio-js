/**
 * @name Audio.config
 * @namespace Настройки библиотеки.
 */
var config = {

    // =================================================================

    //  Общие настройки

    // =================================================================

    /**
     * Общие настройки. Содержит поле:
     * <ul>
     *  <li> retry {Number} — количество попыток реинициализации (по умолчанию 3).</li>
     * </ul>
     * @field
     * @name Audio.config.audio
     * @static
     */
    audio: {
        /**
         * Количество попыток реинициализации
         * @type {Number}
         */
        retry: 3
    },

    // =================================================================

    //  Flash-плеер

    // =================================================================

    /**
     * Настройки подключения Flash-плеера. Содержит следующие поля:
     * <ul>
     *  <li> path {String} — путь к .swf файлу Flash-плеера (по умолчанию 'dist').</li>
     *  <li> name {String} — имя .swf файла Flash-пеера (по умолчанию 'player-2_1.swf').</li>
     *  <li> vesrion {Number} — минимальная версия Flash-плеера (по умолчанию 9.0.28).</li>
     *  <li> playerID {Number} — ID, который будет выставлен для элемента с Flash-плеером (по умолчанию 'YandexAudioFlashPlayer').</li>
     *  <li> callback {String} — имя функции-обработчика событий flash-плеера.</li>
     *  <li> initTimeout {Number} — таймаут инициализации (по умолчанию 3000).</li>
     *  <li> loadTimeout {Number} — таймаут загрузки (по умолчанию 5000).</li>
     *  <li> clickTimeout {Number} — таймаут инициализации после клика (по умолчанию 1000).</li>
     *  <li> heartBeatInterval {Number} — интервал проверки доступности Flash-плеера (по умолчанию 1000).</li>
     * </ul>
     * @field
     * @type Object
     * @static
     * @name Audio.config.flash
     */
    flash: {
        /**
         * Путь к .swf файлу флеш-плеера
         * @type {String}
         */
        path: "dist",
        /**
         * Имя .swf файла флеш-плеера
         * @type {String}
         */
        name: "player-2_1.swf",
        /**
         * Минимальная версия флеш-плеера
         * @type {String}
         */
        version: "9.0.28",
        /**
         * ID, который будет выставлен для элемента с flash-плеером
         * @type {String}
         */
        playerID: "YandexAudioFlashPlayer",
        /**
         * Имя функции-обработчика событий flash-плеера
         * @type {String}
         * @const
         */
        callback: "ya.music.Audio._flashCallback",
        /**
         * Таймаут инициализации
         * @type {Number}
         */
        initTimeout: 3000, // 3 sec
        /**
         * Таймаут загрузки
         * @type {Number}
         */
        loadTimeout: 5000,
        /**
         * Таймаут инициализации после клика
         * @type {Number}
         */
        clickTimeout: 1000,
        /**
         * Интервал проверки доступности flash-плеера
         * @type {Number}
         */
        heartBeatInterval: 1000
    },

    // =================================================================

    //  HTML5-плеер

    // =================================================================

    /**
     * Описание настроек HTML5 плеера. Содержит поле:
     * <ul>
     *  <li> <p>blacklist {String[]} — список браузеров, для которых лучше не использовать HTML5 плеер. Используется при
     * автоопределении типа плеера. Идентификаторы сравниваются со строкой, построенной по шаблону
     * `@&lt;platform.version&gt; &lt;platform.os&gt;:&lt;browser.name&gt;/&lt;browser.version&gt;`</p>
     * <p>По умолчанию содержит следующие значения: ["linux:mozilla", "unix:mozilla", "macos:mozilla", ":opera", "@NT 5", "@NT 4", ":msie/9"].</p>
     * </li>
     * </ul>
     * @field
     * @type Object
     * @name Audio.config.html5
     * @static
     */
    html5: {
        /**
         * Список идентификаторов для которых лучше не использовать html5 плеер. Используется при
         * авто-определении типа плеера. Идентификаторы сравниваются со строкой построенной по шаблону
         * `@&lt;platform.version&gt; &lt;platform.os&gt;:&lt;browser.name&gt;/&lt;browser.version&gt;`
         * @type {Array.&lt;String&gt;}
         */
        blacklist: ["linux:mozilla", "unix:mozilla", "macos:mozilla", ":opera", "@NT 5", "@NT 4", ":msie/9"]
    }
};

module.exports = config;
