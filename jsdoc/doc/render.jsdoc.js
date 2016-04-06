var cleanupTags = /<\/?(ul|li|p)>/g;
var beautify_lines = /(\n[\t ]*){3,}/g;
var beautify_asterix = /( \* *\n){3,}/g;

module.exports = function(page) {
    return page.replace(cleanupTags, "")
        .replace(/\r/g, "").replace(beautify_lines, "\n\n")
        .replace(beautify_asterix, " *\n");
};
