##<a name="Logger"></a> *class* Logger

**Доступен извне как:** `ya.music.Logger`

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

----

### Методы

#### <a name="Logger.log"></a> Logger.log (level: String, channel: String, context: Object, args: *)  

Сделать запись в лог.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| level | String |  | Уровень лога. |
| channel | String |  | Канал. |
| context | Object |  | Контекст вызова. |
| *\[args\]* | * |  | Дополнительные аргументы. |

