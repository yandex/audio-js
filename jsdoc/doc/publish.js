var util = require("util");
var render = require('./render');
var fs = require("fs");

var makeKinds = function() {
    return {
        "class": [],
        "typedef": [],
        "namespace": [],

        "event": [],

        "function": [],
        "member": [],

        // "file": [],
        "package": []
    };
};

var checkDoc = function(data, includePrivate) {
    return (includePrivate || !data.access || data.access == "public")
        && (!data.undocumented)
        && (!data.ignore);
};

var optimize = function(tree, indent) {
    indent = indent || 0;
    var orig = Object.keys(tree.sub);
    var key, keys;

    for (var k = 0; k < orig.length; k++) {
        key = orig[k];
        keys = Object.keys(tree.sub[key].sub);

        if (keys.length == 1 && !tree.sub[key].sub[keys[0]].link) {
            tree.sub[key + "." + keys[0]] = tree.sub[key].sub[keys[0]];
            delete tree.sub[key];
            orig.push(key + "." + keys[0]);
        } else {
            optimize(tree.sub[key], indent + 1);
        }
    }
    tree.indent = new Array(indent + 1).join("  ");
};
var makePath = function(path, name) {
    path = path.split(".");
    // var symbol = path.pop();
    var ns = docs.exportTree;
    var full = "";

    path.forEach(function(chunk) {
        full += (full ? "." : "") + chunk;
        if (!ns.sub[chunk]) {
            ns.sub[chunk] = {
                sub: {},
                indent: 0,
                full: full,
                link: null
            };
        }
        ns = ns.sub[chunk];
    });

    ns.link = name;
};

var weight = function(data) {
    return (data.kind != "class" && data.static ? 10 : 0)
        + (data.inner ? -1 : 0)
        + (data.exported ? 5 : 0);
};
var sort = function(kinds) {
    for (var kind in kinds) {
        if (Array.isArray(kinds[kind])) {
            kinds[kind] = kinds[kind].sort(function(a, b) {
                return weight(b) - weight(a);
            });
        }
    }
};

var fixParams = function(params) {
    params.forEach(function(param) {
        param.description = param.description && param.description.replace(/\n/g, " ");

        param.type && param.type.names && (param.type.names = param.type.names.map(function(type) {
            type = type
                .replace(/[\w.#~]*~/, "")
                .replace(/\(|\)/g, "");

            return type;
        }));
    });
    return params;
};
var fixes = function(data) {
    data.type && fixParams([data]);
    data.params && fixParams(data.params);
    data.properties && fixParams(data.properties);
    data.returns && fixParams(data.returns) && (data.returns = data.returns[0]);

    if (data.kind === 'constant') {
        data.kind = 'member';
        data.const = true;
    }

    if (data.kind === 'class') {
        data["class"] = true;
    }

    if (data.scope === 'static') {
        data.static = true;
    } else if (data.scope === 'inner') {
        data.inner = true;
    }

    data.fires && (data.fires = data.fires.map(function(event) { return event.replace("event:", ""); }));
    if (data.kind === 'event') { data.longname = data.longname.replace("event:", ""); }

    data.tags && data.tags.forEach(function(tag) {
        if (tag.title === "exported") {
            data.exported = tag.value;
            makePath(tag.value, data.name);
        }
        if (tag.title === "unignore") {
            data.unignore = true;
        }
    });
};

var subtree = function(taffy, data) {
    data.children = makeKinds();

    taffy({memberof: data.longname}).each(function(member) {
        if (!checkDoc(member)) {
            return;
        }

        if (data.children[member.kind]) {
            data.children[member.kind].push(member);
        } else {
            console.warn("Unexpected type", member.kind);
            return;
        }

        member.parent = data;
        subtree(taffy, member);
    });

    delete data.children.package;
    sort(data.children);
};

var docs = {
    exportTree: {
        sub: {},
        symbols: []
    },
    links: {},
    tree: makeKinds(),
    linear: makeKinds()
};

var pendingExported = {};
var unignore = {};

var prepare = function(taffy, style) {
    taffy().each(function(data) {
        fixes(data);

        if (unignore[data.longname]) {
            data.ignore = false;
        }

        if (!checkDoc(data)) {
            if (data.exported) {
                pendingExported[data.longname] = data.exported;
            }
            if (data.unignore) {
                unignore[data.longname] = true;
            }

            return;
        }

        if (pendingExported[data.longname]) {
            data.exported = pendingExported[data.longname];
        }

        if (data.kind === 'function' && !data.description) {
            // console.log(util.inspect(data, {color: true, depth: 0}));
        }

        if (!docs.linear[data.kind]) {
            console.warn("Unexpected kind", data.kind);
            return;
        }

        var link = (data.memberof && !data.inner ? data.memberof + (
                    data.static ? "." : "#")
                    : ""
            ) + data.name;

        docs.links[link] = data;

        if (data.scope === 'global'
            || data.kind === 'class'
            || data.kind === 'typedef'
            || data.kind === 'namespace') {
            docs.linear[data.kind].push(data);
        }
    });

    taffy({scope: "global"}).each(function(data) {
        if (!checkDoc(data)) {
            return;
        }

        if (docs.tree[data.kind]) {
            docs.tree[data.kind].push(data);
            subtree(taffy, data);
        }
    });

    delete docs.tree.package;
    delete docs.linear.package;

    sort(docs.tree);
    sort(docs.linear);

    if (!/jsdoc/.test(style)) {
        optimize(docs.exportTree);
    }
};

var styles = {
    "jsdoc": "jsdoc",
    "jsdoc-tech": "jsdoc",
    "gfm-single": "md",
    "gfm-files": "md"
};

exports.publish = function(taffyData, opts, tutorials) {
    var style = opts.query && opts.query.style || "gfm-single";
    var out = opts.query && opts.query.out || "readme";

    prepare(taffyData, style);

    render.prepare(opts.template, style);
    var files = render.render(docs, out);

    var ext = "." + styles[style];

    try {
        fs.mkdirSync(opts.destination);
    } catch(e) {}

    for (var name in files) {
        fs.writeFileSync(opts.destination + name.replace(/~/g, "-") + ext, files[name]);
    }

    // console.log(util.inspect(docs.linear["class"], {color: true, depth: 2}));
};
