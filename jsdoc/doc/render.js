var fs = require("fs");
var Handlebars = require("handlebars");
var renderStyle;
var files;

var layout;
var index;
var parser;

var trim = /^\s*|\s*$|\n(\{\{\/if}})|(\{\{#if [.\w ]*}})\n|\n(\{\{else[.\w ]*}})\n/g;

var prepare = function(path, style) {
    renderStyle = style.split("-")[0];
    files = style.split("-")[1] === "files";

    var partials = fs.readdirSync(path + "/" + style);

    partials.forEach(function(partial) {
        Handlebars.registerPartial(partial.replace(".hbs", ""),
            fs.readFileSync(path + "/" + style + "/" + partial, {encoding: "utf8"}).replace(trim, "$1$2$3")
        );
    });

    layout = Handlebars.compile(
        fs.readFileSync(path + "/" + style + "/layout.hbs", {encoding: "utf8"}).replace(trim, "$1$2$3")
    );

    try {
        index = Handlebars.compile(
            fs.readFileSync(path + "/" + style + "/index.hbs", {encoding: "utf8"}).replace(trim, "$1$2$3")
        );
    } catch(e) {}

    parser = require("./render." + renderStyle + ".js");
};

var render = function(data) {
    var renderPage = function(item) {
        var page = {};
        page[item.kind] = item;
        return parser(layout(page), data, item);
    };

    var list = {};

    if (files) {
        for (var link in data.links) {
            var item = data.links[link];
            var kind = item.kind;
            var parent = item.parent;
            var parentKind = parent && parent.kind;
            var path;

            if (parent && (parentKind === "class" || parentKind === "typedef" || parentKind === "namespace")) {
                path = parent.name;
            } else if (kind === "class" || kind === "typedef" || kind === "namespace") {
                path = item.name;
            } else {
                path = "global";
            }

            data.links[link] = path + ".md#" + link.replace(/#/g, "..").replace(/~/g, "--");
        }

        var makeFile = function(item) { list[item.name] = renderPage(item); };

        // кладём все классы в отдельные файлы даже если они внутренние
        data.linear["class"].forEach(makeFile);
        // кладём только глобальные тайпдефы в отдельные файлы
        data.tree["typedef"].forEach(makeFile);
        // кладём только глобальные неймспейсы в отдельные файлы
        data.tree["namespace"].forEach(makeFile);

        list.global = "";

        for (var key in data.linear) {
            if (key === "class" || key === "typedef" || key === "namespace") {
                continue;
            }

            list.global += data.linear[key].map(renderPage).join("\n\n");
        }

        list.readme = parser(index(data), data);
    } else {
        for (var link in data.links) {
            data.links[link] = "#" + link.replace(/#/g, "..").replace(/~/g, "--");
        }

        list.readme = parser(layout(data), data);
    }

    return list;
};

module.exports = {
    prepare: prepare,
    render: render
};
