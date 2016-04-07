##<a name="PlaybackError"></a> *class* PlaybackError

**Доступен извне как:** `ya.music.Audio.PlaybackError`

Класс ошибки воспроизведения.

**Расширяет:**

  - Error

#### new PlaybackError(String, String)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| String |  |  | message Текст ошибки. |
| String |  |  | src Ссылка на трек. |

#### PlaybackError.CONNECTION_ABORTED : String

Отмена соединенния.

#### PlaybackError.NETWORK_ERROR : String

Сетевая ошибка.

#### PlaybackError.DECODE_ERROR : String

Ошибка декодирования аудио.

#### PlaybackError.BAD_DATA : String

Недоступный источник.

#### PlaybackError.DONT_START : String

Не запускается воспроизведение.

#### PlaybackError.html5 : Object

Таблица соответствия кодов ошибок HTML5 плеера.

