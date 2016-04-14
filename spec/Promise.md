##<a name="Promise"></a> *class* Promise

**Доступен извне как:** `ya.music.lib.Promise`

Обещание по спецификации [ES 2015 promises](https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise). В устаревших браузерах и IE используется замена из библиотеки [vow](http://github.com/dfilatov/vow.git)

#### new Promise()

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

