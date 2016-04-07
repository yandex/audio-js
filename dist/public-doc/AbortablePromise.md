##<a name="AbortablePromise"></a> *inner* *class* AbortablePromise

Обещание с возможностью отмены связанного с ним действия.

**Расширяет:**

  - [Promise](Promise.md#Promise)

----

### Методы

#### <a name="AbortablePromise..abort"></a> AbortablePromise#abort (reason: String \| Error)  

Отмена действия, связанного с обещанием. Абстрактный метод.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| reason | String \| Error |  | Причина отмены действия. |

#### <a name="AbortablePromise..then"></a> AbortablePromise#then (callback: function, errback: null \| function) : [Promise](Promise.md#Promise) *(inherits [Promise#then](Promise.md#Promise..then))*

Назначить обработчики разрешения и отклонения обещания.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| callback | function |  | Обработчик успеха. |
| *\[errback\]* | null \| function |  | Обработчик ошибки. |

> **Возвращает:** новое обещание из результатов обработчика.

#### <a name="AbortablePromise..catch"></a> AbortablePromise#catch (errback: function) : [Promise](Promise.md#Promise) *(inherits [Promise#catch](Promise.md#Promise..catch))*

Назначить обработчик отклонения обещания.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| errback | function |  | Обработчик ошибки. |

> **Возвращает:** новое обещание из результатов обработчика.

