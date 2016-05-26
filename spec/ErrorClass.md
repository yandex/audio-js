##<a name="ErrorClass"></a> *class* ErrorClass

**Доступен извне как:** `ya.music.lib.Error`

Класс ошибки. Оригинальный Error ведёт себя как фабрика, а не как класс. Этот объект ведёт себя как класс и его можно наследовать.

**Расширяет:**

  - Error

#### new ErrorClass(message: String, id: Number)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| *\[message\]* | String |  | сообщение |
| *\[id\]* | Number |  | идентификатор ошибки |

----

### Методы

#### <a name="ErrorClass.create"></a> ErrorClass.create (name: String) : [ErrorClass](ErrorClass.md#ErrorClass) 

Сахар для быстрого создания нового класса ошибок.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| name | String |  | имя создаваемого класса |

