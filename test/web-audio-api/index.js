var template = document.querySelector(".template").innerHTML;
document.body.removeChild(document.querySelector(".template"));

var WIDTH = 300;
var HEIGHT = 200;
var GUTTER = 20;

var INNER_HEIGHT = HEIGHT - GUTTER * 2;
var INNER_WIDTH = WIDTH - GUTTER * 2;

var MIN_FREQ = 20;
var MAX_FREQ = 20000;
var FREQ_STEPS = 101;

var A = Math.exp((Math.log(MAX_FREQ) - Math.log(MIN_FREQ)) / (FREQ_STEPS - 1));
var B = Math.log(MIN_FREQ) / Math.log(A);

var FILTER_LINE = 0.5;

var norm = function(points) {
    var min = Math.min.apply(Math, points) || 0;
    var max = Math.max.apply(Math, points) || 0;
    var k = INNER_HEIGHT / (max - min) || 1;
    var dy = min * k;
    var step = INNER_WIDTH / (points.length - 1);

    return points
        .map(function(v) { return INNER_HEIGHT - ((v || 0) * k - dy); })
        .map(function(v, idx) { return (GUTTER + idx * step) + " " + (GUTTER + (v || 0)); });
};

var drawTest = function(name, data) {
    var testBlock = document.createElement("DIV");
    testBlock.classList.add("test");

    var id = name.replace(/[ =.]/g, "_");

    testBlock.innerHTML = template
        .replace("{{title}}", name)
        .replace("{{name}}", id);
    document.body.appendChild(testBlock);

    var canvas = Raphael(id, WIDTH, HEIGHT);

    var l = (GUTTER + FILTER_LINE * INNER_WIDTH) + " 0";
    canvas.path().attr({
        path: "M" + l + "L" + l + " l0 " + HEIGHT,
        stroke: "#ff0000",
        "stroke-width": 2,
        "stroke-linejoin": "round"
    });

    var draw = function(path, color, width) {
        path.forEach(function(p) {
            var point = p.split(" ");
            canvas.circle(point[0], point[1], width).attr({fill: color});
        });

        canvas.path().attr({
            path: "M" + path[0] + " L" + path.join(" "),
            stroke: color,
            "stroke-width": 1 + width,
            "stroke-linejoin": "round"
        });
    };

    draw(norm(data[1]), "#5B9A1C", 1);
    draw(norm(data[0]), "#134b9a", 2);
};

var audioCtx = new AudioContext();
var freqs = new Float32Array(FREQ_STEPS);

for (var k = 0; k < FREQ_STEPS; k++) {
    freqs[k] = Math.pow(A, B + k);
}

var FILTER_FREQ = freqs[Math.floor(FREQ_STEPS * FILTER_LINE)];
console.log(FILTER_FREQ);

var testFilter = function(options, phase) {
    return function() {
        var filter = audioCtx.createBiquadFilter();
        for (var key in options) {
            if (options.hasOwnProperty(key)) {
                if (key !== "type") {
                    filter[key].value = options[key];
                } else {
                    filter[key] = options[key];
                }
            }
        }

        var resFreq = new Float32Array(FREQ_STEPS);
        var resPhase = new Float32Array(FREQ_STEPS);

        filter.frequency.value = FILTER_FREQ;

        filter.getFrequencyResponse(freqs, resFreq, resPhase);

        resFreq.map = resPhase.map = Array.prototype.map;
        return [resFreq, resPhase];
    }
};

var tests = {
    "lowpass Q=0.2": testFilter({ type: "lowpass", Q: 0.2 }),
    "lowpass Q=1": testFilter({ type: "lowpass", Q: 1 }),
    "lowpass Q=5": testFilter({ type: "lowpass", Q: 5 }),

    "highpass Q=0.2": testFilter({ type: "highpass", Q: 0.2 }),
    "highpass Q=1": testFilter({ type: "highpass", Q: 1 }),
    "highpass Q=5": testFilter({ type: "highpass", Q: 5 }),

    "bandpass Q=0.2": testFilter({ type: "bandpass", Q: 0.2 }),
    "bandpass Q=1": testFilter({ type: "bandpass", Q: 1 }),
    "bandpass Q=5": testFilter({ type: "bandpass", Q: 5 }),

    "notch Q=0.2": testFilter({ type: "notch", Q: 0.2 }),
    "notch Q=1": testFilter({ type: "notch", Q: 1 }),
    "notch Q=5": testFilter({ type: "notch", Q: 5 }),

    "peaking Q=0.2": testFilter({ type: "peaking", Q: 0.2, gain: 6 }),
    "peaking Q=1": testFilter({ type: "peaking", Q: 1, gain: 6 }),
    "peaking Q=5": testFilter({ type: "peaking", Q: 5, gain: 6 }),

    "allpass Q=0.2": testFilter({ type: "allpass", Q: 0.2 }),
    "allpass Q=1": testFilter({ type: "allpass", Q: 1 }),
    "allpass Q=5": testFilter({ type: "allpass", Q: 5 }),

    "lowshelf": testFilter({ type: "lowshelf", gain: 6 }),
    "highshelf": testFilter({ type: "highshelf", gain: 6 })
};

Object.keys(tests).forEach(function(testname) {
    drawTest(testname, tests[testname]());
});
