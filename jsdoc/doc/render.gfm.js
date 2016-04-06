var cleanupTags = /<\/?(ul|li|p)>/g;
var unescape = /\\(\{|\})/g;
var beautify = /(\n[\t ]*){3,}/g;

var link = /\{@link (.*?) *\}/g;
var ltgt = /&lt;(.*?)&gt;/;

module.exports = function(page, data) {
    page = page.replace(cleanupTags, "")
        .replace(unescape, "$1")
        .replace(/\r/g, "").replace(beautify, "\n\n");

    page = page.replace(link, function(_, link) {
        if (ltgt.test(link)) {
            return link.replace(ltgt, function(_, parts) {
                return "&lt; " + parts.split(",").map(function(types) {
                        return types.split("|")
                            .map(function(type) { return "{@link " + type + "}" })
                            .join(" \\| ");
                    }).join(", ") + " &gt;";
            });
        }

        return "{@link " + link + "}";
    });

    page = page.replace(link, function(_, linkData) {
        linkData = linkData.split(" ");
        var linkPath = linkData.shift();
        var linkName = linkData.shift() || linkPath;

        if (data.links[linkPath]) {
            return "[" + linkName + "](" + data.links[linkPath] + ")";
        } else {
            return linkName;
        }
    });

    return page;
};
