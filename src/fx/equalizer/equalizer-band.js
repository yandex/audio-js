var Events = require('../../lib/async/events');
var EqualizerStatic = require('./equalizer-static');

// =================================================================

//  Конструктор

// =================================================================

/**
 * Событие изменения значения усиления.
 * @event Audio.fx.Equalizer.EqualizerBand#EVENT_CHANGE
 * @param {Number} value Новое значение.
 */

/**
 * @name Audio.fx.Equalizer.EqualizerBand
 * @class Полоса пропускания эквалайзера.
 * @extends Events
 *
 * @param {<xref scope="external" href="https://developer.mozilla.org/en-US/docs/Web/API/AudioContext">AudioContext</xref>} audioContext Контекст Web Audio API.
 * @param {String} type Тип фильтра.
 * @param {Number} frequency Частота фильтра.
 *
 * @fires Audio.fx.Equalizer.EqualizerBand#EVENT_CHANGE
 *
 * @constructor
 */
var EqualizerBand = function(audioContext, type, frequency) {
    Events.call(this);

    this.type = type;

    this.filter = audioContext.createBiquadFilter();
    this.filter.type = type;
    this.filter.frequency.value = frequency;
    this.filter.Q.value = 1;
    this.filter.gain.value = 0;
};
Events.mixin(EqualizerBand);

// =================================================================

//  Управление настройками

// =================================================================

/**
 * @name Audio.fx.Equalizer.EqualizerBand#getFreq
 * @function
 * @returns {Number} частоту полосы пропускания.
 */
EqualizerBand.prototype.getFreq = function() {
    return this.filter.frequency.value;
};

/**
 * @name Audio.fx.Equalizer.EqualizerBand#getValue
 * @function
 * @returns {Number} Значение усиления.
 */
EqualizerBand.prototype.getValue = function() {
    return this.filter.gain.value;
};

/**
 * Установить значение усиления.
 * @name Audio.fx.Equalizer.EqualizerBand#setValue
 * @function
 * @param {Number} value Значение.
 */
EqualizerBand.prototype.setValue = function(value) {
    this.filter.gain.value = value;
    this.trigger(EqualizerStatic.EVENT_CHANGE, value);
};

module.exports = EqualizerBand;
