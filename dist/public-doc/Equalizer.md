##<a name="Equalizer"></a> *class* Equalizer

**Доступен извне как:** `ya.music.Audio.fx.Equalizer`

Эквалайзер.

**Расширяет:**

  - [Events](Events.md#Events)

**Триггерит:**

  - [Equalizer.EVENT_CHANGE](Equalizer.md#Equalizer.EVENT_CHANGE)

#### new Equalizer(audioContext: AudioContext, bands: Array.&lt; Number &gt;)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| audioContext | AudioContext |  | Контекст Web Audio API. |
| bands | Array.&lt; Number &gt; |  | Список частот для полос эквалайзера. |

#### Equalizer.DEFAULT_BANDS : Array.&lt; Number &gt;

Набор частот эквалайзера, применяющийся по умолчанию.

#### Equalizer.DEFAULT_PRESETS : Object.&lt; String, [EqualizerPreset](Equalizer.md#EqualizerPreset) &gt;

Набор распространенных пресетов эквалайзера для набора частот по умолчанию.

#### Equalizer#EVENT_CHANGE : String

----

### События

####<a name="Equalizer.EVENT_CHANGE"></a> *event* Equalizer.EVENT_CHANGE

Событие изменения полосы пропускания

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| freq | Number |  | Частота полосы пропускания. |
| value | Number |  | Значение усиления. |

----

### Методы

#### <a name="Equalizer..loadPreset"></a> Equalizer#loadPreset (preset: [EqualizerPreset](Equalizer.md#EqualizerPreset))  

Загрузить настройки.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| preset | [EqualizerPreset](Equalizer.md#EqualizerPreset) |  | Настройки. |

#### <a name="Equalizer..savePreset"></a> Equalizer#savePreset () : [EqualizerPreset](Equalizer.md#EqualizerPreset) 

Сохранить текущие настройки.

#### <a name="Equalizer..guessPreamp"></a> Equalizer#guessPreamp () : number 

Вычисляет оптимальное значение предусиления. Функция является экспериментальной.

> **Возвращает:** значение предусиления.

#### <a name="Equalizer..on"></a> Equalizer#on (event: String, callback: function) : [Events](Events.md#Events) *(inherits [Events#on](Events.md#Events..on))*

Подписаться на событие (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Equalizer..off"></a> Equalizer#off (event: String, callback: function) : [Events](Events.md#Events) *(inherits [Events#off](Events.md#Events..off))*

Отписаться от события (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Equalizer..once"></a> Equalizer#once (event: String, callback: function) : [Events](Events.md#Events) *(inherits [Events#once](Events.md#Events..once))*

Подписаться на событие и отписаться сразу после его первого возникновения (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Equalizer..clearListeners"></a> Equalizer#clearListeners () : [Events](Events.md#Events) *(inherits [Events#clearListeners](Events.md#Events..clearListeners))*

Отписаться от всех слушателей событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Equalizer..muteEvents"></a> Equalizer#muteEvents () : [Events](Events.md#Events) *(inherits [Events#muteEvents](Events.md#Events..muteEvents))*

Остановить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Equalizer..unmuteEvents"></a> Equalizer#unmuteEvents () : [Events](Events.md#Events) *(inherits [Events#unmuteEvents](Events.md#Events..unmuteEvents))*

Возобновить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

----

### Типы

####<a name="EqualizerPreset"></a> *type* EqualizerPreset : Object

Описание настроек эквалайзера.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[id\]* | String |  | Идентификатор настроек. |
| preamp | Number |  | Предусилитель. |
| bands | Array.&lt; Number &gt; |  | Значения для полос эквалайзера. |

