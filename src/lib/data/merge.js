/**
 * Объединение объектов
 * @param {Object} initial - начальный объект
 * @param {Object} ...args - список объектов которые надо объединить с начальным
 * @param {Boolean} [extend] - если последний аргумент true, то будет модифицирован начальный объект, в противном случае будет создана неглубокая копия.
 * @exported ya.music.lib.merge
 * @returns {Object}
 */
var merge = function(initial) {
    var args = [].slice.call(arguments, 1);
    var object;
    var key;

    if (args[args.length - 1] === true) {
        object = initial;
        args.pop();
    } else {
        object = {};
        for (key in initial) {
            if (initial.hasOwnProperty(key)) {
                object[key] = initial[key];
            }
        }
    }

    for (var k = 0, l = args.length; k < l; k++) {
        for (key in args[k]) {
            if (args[k].hasOwnProperty(key)) {
                object[key] = args[k][key];
            }
        }
    }

    return object;
};

module.exports = merge;
