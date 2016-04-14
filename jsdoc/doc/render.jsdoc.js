var cleanupTags = /<\/?(ul|li|p)>/g;
var bbcodes = /\[(.*?)\]/g;
var unescape = /\\(\{|\})/g;
var beautify_lines = /(\n[\t ]*){3,}/g;
var beautify_asterix = /([\t ]*\*[\t ]*\n){2,}/g;
var linkhref = /\{@linkhref (.*?) ([^\}]*) *\}/g;

var doclet = /\/\*\*[\s\S]*?\*\//g;

module.exports = function(page, data, style) {
    page = page.replace(cleanupTags, "")
        .replace(unescape, "$1")
        .replace(bbcodes, "<$1>");

    if (style === 'tech') {
        page = page.replace(linkhref, "<xref href='$1' scope='external'>$2</xref>");
    } else {
        page = page.replace(linkhref, "{@link $1 $2}");
    }

    var aliases = [];

    page = page.replace(doclet, function(doclet) {
        var alias = /@alias (.*)/g;
        var name = /@name (.*)/g;

        var rawName;
        if (rawName = name.exec(doclet)) {
            rawName = rawName[1];

            doclet = doclet.replace(alias, function(_, aliasName) {
                aliases.push({
                    reg: new RegExp("([^\\w.#~\/])" + rawName + "([^\\w])", "g"),
                    rep: "$1" + aliasName + "$2"
                    // rep: aliasName
                });

                return "";
            });
        }

        return doclet;
    });

    // console.log("-----------------------------");
    // console.log(aliases);

    aliases.forEach(function(alias) {
        page = page.replace(alias.reg, alias.rep);
    });

    if (style === "tech") {
        page = page
            .replace(/\.<(.*)>/g, ".&lt;$1&gt;")
            .replace(/<(\/?)code>/g, "<$1codeph>")
            .replace(/<(\/?)strong>/g, "<$1b>")
            .replace(/ya\.music\./g, "")
            .replace(/Array\.&lt;(.*)&gt;/g, "$1[]")
            .replace(/ Error( |$)/g,
                " <xref scope=\"external\" href=\"https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error\">Error</xref> ");
    }

    return page.replace(/\r/g, "").replace(beautify_lines, "\n\n")
        .replace(beautify_asterix, " *\n");
};
