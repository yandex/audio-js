##<a name="Events"></a> *inner* *class* Events

Диспетчер событий.

----

### Методы

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

#### <a name="Events..on"></a> Events#on (event: String, callback: function) : [Events](Events.md#Events) 

Подписаться на событие (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Events..off"></a> Events#off (event: String, callback: function) : [Events](Events.md#Events) 

Отписаться от события (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Events..once"></a> Events#once (event: String, callback: function) : [Events](Events.md#Events) 

Подписаться на событие и отписаться сразу после его первого возникновения (цепочный метод).

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| event | String |  | Имя события. |
| callback | function |  | Обработчик события. |

> **Возвращает:** ссылку на контекст.

#### <a name="Events..clearListeners"></a> Events#clearListeners () : [Events](Events.md#Events) 

Отписаться от всех слушателей событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Events..muteEvents"></a> Events#muteEvents () : [Events](Events.md#Events) 

Остановить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

#### <a name="Events..unmuteEvents"></a> Events#unmuteEvents () : [Events](Events.md#Events) 

Возобновить запуск событий (цепочный метод).

> **Возвращает:** ссылку на контекст.

