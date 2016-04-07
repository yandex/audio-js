

##<a name="volumeLib"></a> *ns* volumeLib

**Доступен извне как:** `ya.music.Audio.fx.volumeLib`
Методы конвертации значений громкости.

#### volumeLib.EPSILON : number

Минимальное значение громкости, при котором происходит отключение звука. Ограничение в 0.01 подобрано эмпирически.

#### <a name="volumeLib.toExponent"></a> volumeLib.toExponent (value: Number) : Number 

Вычисление значение относительной громкости по значению на логарифмической шкале.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| value | Number |  | Значение на шкале. |

#### <a name="volumeLib.fromExponent"></a> volumeLib.fromExponent (volume: Number) : Number 

Вычисление положения на логарифмической шкале по значению относительной громкости громкости

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| volume | Number |  | Громкость. |

#### <a name="volumeLib.toDBFS"></a> volumeLib.toDBFS (volume: Number) : Number 

Вычисление значения dBFS из относительного значения громкости.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| volume | Number |  | Относительная громкость. |

#### <a name="volumeLib.fromDBFS"></a> volumeLib.fromDBFS (dbfs: Number) : Number 

Вычисление значения относительной громкости из значения dBFS.

| Имя | Тип | * | Описание |
| --- | --- | --- | --- |
| dbfs | Number |  | Громкость в dBFS. |

