var w = 1600, h = 1200;

var wx = w / 2;
var wy = h / 2;

var labelAnchors = [];
var labelAnchorLinks = [];

var nodes = [];
var links = [];

//------------------------------------------------------------------------------------------

Object.keys(deps).forEach(function(depName) {
    deps[depName].deps.forEach(function(dep) {
        deps[dep].outcome = (deps[dep].outcome || 0) + 1;
    });
});

Object.keys(deps).forEach(function(entry, idx) {
    deps[entry].idx = idx;

    var nodeEnt = deps[entry];

    var node = {
        label: entry,
        subtree: {},
        outcome: nodeEnt.outcome,
        income: nodeEnt.deps.length,
        start: nodeEnt.start,
        final: nodeEnt.final,
        success: nodeEnt.success,
        fail: nodeEnt.fail,
        dummy: nodeEnt.dummy,
        queue: nodeEnt.queue
    };
    node.subtree[node.label] = true;
    nodes.push(node);
});

Object.keys(deps).forEach(function(entryName) {
    var entry = deps[entryName];

    entry.deps.forEach(function(linkName) {
        var link = deps[linkName];

        links.push({
            source: entry.idx,
            target: link.idx,
            ring: false,
            subtree: {},
            weight: 1
        });

    });
});

//------------------------------------------------------------------------------------------

links.forEach(function(link) {
    link.linked = links.filter(function(tolink) {
        return tolink.source === link.target;
    });
});

var path = [];
var walk = function(link) {
    var i;
    if ((i = path.indexOf(link)) !== -1) {
        for (var k = i; k < path.length; k++) {
            path[k].ring = true;
        }

        return;
    }

    path.push(link);

    path.forEach(function(oldNode) {
        oldNode.subtree[link.idx] = true;
        nodes[oldNode.source].subtree[nodes[link.target].label] = true;
    });
    link.linked.forEach(walk);

    path.pop();
};

links.forEach(walk);

nodes.forEach(function(node) {
    node.tree = Object.keys(node.subtree).length;
    delete node.subtree;
});
links.forEach(function(link) {
    delete link.subtree;
    delete link.linked;
});

//------------------------------------------------------------------------------------------

nodes.forEach(function(node, i) {
    var x = Math.random() * w - wx;
    var y = Math.random() * h - wy;

    node.px = x;
    node.py = y;
    node.x = x;
    node.y = y;

    labelAnchors.push({node: node, px: x, py: y, x: x, y: y});
    labelAnchors.push({node: node, px: x, py: y, x: x, y: y});

    labelAnchorLinks.push({
        source: i * 2,
        target: i * 2 + 1,
        weight: 1
    });
});

//------------------------------------------------------------------------------------------

console.log("nodes", nodes, "labelAnchors", labelAnchors, "labelAnchorLinks", labelAnchorLinks, "links", links);

//------------------------------------------------------------------------------------------

var vis = d3.select("body")
    .append("svg:svg")
    .attr("width", w).attr("height", h);

//------------------------------------------------------------------------------------------

var force = d3.layout.force().size([w, h])
    .nodes(nodes).links(links)
    .gravity(0.3).linkDistance(function(x) {
        return Math.sqrt(x.source.tree * x.target.tree);
    }).charge(function(x) {
        return x.tree * -400;
    }).linkStrength(1);

force.start();

//------------------------------------------------------------------------------------------

var force2 = d3.layout.force().size([w, h])
    .nodes(labelAnchors).links(labelAnchorLinks)
    .gravity(0).linkDistance(0).charge(-100).linkStrength(8);

force2.start();

//------------------------------------------------------------------------------------------

var link = vis.selectAll("line.link")
    .data(links).enter()
    .append("svg:line")
    .attr("class", function(x) {
        return "link" + (x.ring ? " ring" : "");
    })
    .style("stroke", "#999");

var node = vis.selectAll("g.node")
    .data(force.nodes()).enter()
    .append("svg:g")
    .attr("class", "node");

node.append("svg:circle")
    .attr("class", function(x) {
        return "node " + x.label.split(/\/|\./g).filter(function(a) { return a && a !== "." && a !== ".."; }).join(" ");
    })
    .attr("r", function(x) {
        return 5 + Math.pow(x.tree, 0.6) * 5;
    })
    .style("stroke", function(x) {
        if (!x.outcome) {
            return "#0F0";
        }
        if (!x.income) {
            return "#00F";
        }
        return "#FFF";
    }).style("stroke-width", 3);

node.call(force.drag);

//------------------------------------------------------------------------------------------

var anchorLink = vis.selectAll("line.anchorLink")
    .data(labelAnchorLinks);

var anchorNode = vis.selectAll("g.anchorNode")
    .data(force2.nodes()).enter()
    .append("svg:g")
    .attr("class", "anchorNode");

anchorNode.append("svg:circle")
    .attr("r", 0)
    .style("fill", "#FFF");

anchorNode.append("svg:text")
    .text(function(d, i) { return i % 2 == 0 ? "" : d.node.label })
    .style("fill", "#000").style("font-family", "Arial").style("font-size", 12);

//------------------------------------------------------------------------------------------

var updateLink = function() {
    this.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

};

var updateNode = function() {
    try {
        this.attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
    } catch(e) {
    }
};

//------------------------------------------------------------------------------------------

force.on("tick", function() {
    force2.start();

    anchorNode.each(function(d, i) {
        if (i % 2 == 0) {
            d.x = d.node.x;
            d.y = d.node.y;
        } else {
            var b = this.childNodes[1].getBBox();

            var diffX = d.x - d.node.x;
            var diffY = d.y - d.node.y;

            var dist = Math.sqrt(diffX * diffX + diffY * diffY);

            var shiftX = b.width * (diffX - dist) / (dist * 2);
            shiftX = Math.max(-b.width, Math.min(0, shiftX));
            var shiftY = 5;

            try {
                this.childNodes[1].setAttribute("transform", "translate(" + shiftX + "," + shiftY + ")");
            } catch(e) {
            }
        }
    });

    node.call(updateNode);
    anchorNode.call(updateNode);

    link.call(updateLink);
    anchorLink.call(updateLink);
});
