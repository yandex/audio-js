var fs = require('fs');
var jsdocReg = /\/\*\*([\s\S]*?)\*\//g;
var newDoc = /@name/;
var privateDoc = /@private/;

var xref = /<xref.*>(.*)<\/xref>/g;
var p = /<p>(.*)<\/p>/g;

var contains = /Содержит.*:/g;
var ul = /<ul>[\s\S]*?<\/ul>/g;

var audio = /([^\w.])Audio([^\w])/g;
var webaudioapifix = /Web ya\.music\.Audio API/gi;

var name = /(\s*\*\s*)@name (.*)/;

var arrTypeFix = /\.&lt;(.*?)&gt;/g;
var typeArray = /(\w*)\[\]/g;
var typeFix = /@type ([^\{].*)$/m;

var event = /\s*\*\s*@event/;
var field = /\s*\*\s*@field/;
var func = /\s*\*\s*@function/;
var cnst = /\s*\*\s*@const/;
var cls = /(\s*\*\s*)@class (.*)/;
var classname = /(\s*\*\s*)@class ((\w*[.~#])+)(\w*)/;

var inherited = /@inherited/;

var inner = /\.(AudioPlayerTimes|AudioPreprocessor|\w*Error|EqualizerBand|EqualizerPreset)/g;

var extract = function(path) {
    fs.readFile(path, {encoding: "utf8"}, function(err, data) {
        if (err) {
            throw err;
        }
        var docs = data.match(jsdocReg);

        if (!docs) {
            return;
        }

        docs = docs.filter(function(doclet) {
            return newDoc.test(doclet) && !privateDoc.test(doclet);
        });

        if (!docs.length) {
            return;
        }

        var reps = docs.map(function(doclet) {
            if (inherited.test(doclet)) {
                doclet = "";
            }

            doclet = doclet
                .replace(contains, "")
                .replace(ul, "")
                .replace(p, "$1")

                .replace(xref, "$1")

                .replace(audio, "$1ya.music.Audio$2")
                .replace(webaudioapifix, "Web Audio API");

            doclet = doclet
                .replace(inner, "~$1");

            doclet = doclet
                .replace(arrTypeFix, ".<$1>")
                .replace(typeArray, "Array.<$1>")
                .replace(typeFix, "@type {$1}");

            if (cls.test(doclet)) {
                doclet = doclet
                    .replace(cls, "$1@classdecs $2")
                    .replace(name, "$1@class $2")
                    .replace(classname, "$1@class $4" + "$1@alias $2$4");
            }

            if (event.test(doclet)) {
                doclet = doclet
                    .replace(event, "")
                    .replace(name, "$1@event $2");
            }

            if (func.test(doclet)) {
                doclet = doclet
                    .replace(func, "")
                    .replace(name, "");
            }

            if (field.test(doclet)) {
                doclet = doclet
                    .replace(field, "")
                    .replace(name, "");
            }

            if (cnst.test(doclet)) {
                doclet = doclet
                    .replace(name, "");
            }

            return doclet;
        });

        docs.forEach(function(doclet, i) {
            data = data.replace(doclet, reps[i]);
        });

        fs.writeFile(path, data);
    });
};

var path = process.argv[2];

extract(path);
