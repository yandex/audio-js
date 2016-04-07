##<a name="AudioError"></a> *class* AudioError

**Доступен извне как:** `ya.music.Audio.AudioError`
Класс ошибки аудиопллеера.

**Расширяет:**

  - Error

#### new AudioError(message: String)

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| message | String |  | Текст ошибки. |

#### AudioError.NO_IMPLEMENTATION : String

Не найдена реализация плеера или возникла ошибка при инициализации всех доступных реализаций.

#### AudioError.NOT_PRELOADED : String

Аудиофайл не был предзагружен или во время загрузки произошла ошибка.

#### AudioError.BAD_STATE : String

Действие недоступно из текущего состояния.

#### AudioError.FLASH_BLOCKER : String

Flash-плеер был заблокирован.

#### AudioError.FLASH_UNKNOWN_CRASH : String

Возникла ошибка при инициализации Flash-плеера по неизвестным причинам.

#### AudioError.FLASH_INIT_TIMEOUT : String

Возникла ошибка при инициализации Flash-плеера из-за таймаута.

#### AudioError.FLASH_INTERNAL_ERROR : String

Внутренняя ошибка Flash-плеера.

#### AudioError.FLASH_EMMITER_NOT_FOUND : String

Попытка вызвать недоступный экземляр Flash-плеера.

#### AudioError.FLASH_NOT_RESPONDING : String

Flash-плеер перестал отвечать на запросы.

