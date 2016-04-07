##<a name="Promise"></a> *inner* *class* Promise

----

### Методы

#### <a name="Promise..then"></a> Promise#then (callback: function, errback: null \| function) : [Promise](Promise.md#Promise) 

Назначить обработчики разрешения и отклонения обещания.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| callback | function |  | Обработчик успеха. |
| *\[errback\]* | null \| function |  | Обработчик ошибки. |

> **Возвращает:** новое обещание из результатов обработчика.

#### <a name="Promise..catch"></a> Promise#catch (errback: function) : [Promise](Promise.md#Promise) 

Назначить обработчик отклонения обещания.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| errback | function |  | Обработчик ошибки. |

> **Возвращает:** новое обещание из результатов обработчика.

