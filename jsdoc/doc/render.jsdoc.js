var cleanupTags = /<\/?(ul|li|p)>/g;
var unescape = /\\(\{|\})/g;
var beautify_lines = /(\n[\t ]*){3,}/g;
var beautify_asterix = /( \* *\n){2,}/g;
var linkhref = /\{@linkhref (.*?) ([^\}]*) *\}/g;

var doclet = /\/\*\*[\s\S]*?\*\//g;
var alias = /@alias (.*)/g;
var name = /@name (.*)/g;

module.exports = function(page, data, style) {
    var page = page.replace(cleanupTags, "")
        .replace(unescape, "$1")
        .replace(linkhref, "{@link $1 $2}");

    var aliases = [];

    page = page.replace(doclet, function(doclet) {
        var rawName;
        if (rawName = name.exec(doclet)) {
            rawName = rawName[1];

            doclet = doclet.replace(alias, function(_, aliasName) {
                aliases.push({
                    reg: new RegExp("([^\\w.#~])" + rawName + "([^\\w])", "g"),
                    rep: "$1" + aliasName + "$2"
                    // rep: aliasName
                });

                return "";
            });
        }

        return doclet;
    });

    aliases.forEach(function(alias) {
        page = page.replace(alias.reg, alias.rep);
    });

    if (style === "tech") {
        page = page
            .replace(/\.<(.*)>/g, ".&lt;$1&gt;")
            .replace(/<(\/?)code>/g, "<$1codeph>");
    }

    return page.replace(/\r/g, "").replace(beautify_lines, "\n\n")
        .replace(beautify_asterix, " *\n");
};
