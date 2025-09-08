import init, { get_parse } from "./pkg/mg_viewer.js";

const drag = simulation => {

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  return d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}



function build_nodes(node, counter = { value: 0 }) {
  let data = null;
  let id = counter.value;
  counter.value++;
  let children = [];
  if (Array.isArray(node)) {
    data = node.shift();
    children = node.map(x => build_nodes(x, counter));
  } else {
    data = node;
  }

  data = remap_node(data);

  data["id"] = id;
  data["children"] = children
  return data
}


function remap_node(node) {
  const obj = { trace: {} }

  if ("Node" in node) {
    obj["features"] = node["Node"]["features"]
    if (node["Node"]["trace"] !== null) {
      obj["trace"] = { "dest": node["Node"]["trace"] };
    }

  } else if ("Leaf" in node) {
    obj["features"] = node["Leaf"]["features"]

    if (node["Leaf"]["trace"] !== null) {
      obj["trace"] = { "dest": node["Leaf"]["trace"] };
    }

    let lemma = node.Leaf.lemma;
    if ("Single" in lemma) {
      obj["lemma"] = lemma["Single"]
      if (obj["lemma"] == null) {
        obj["lemma"] = "ε";
      }
    } else if ("Stolen" in lemma) {
      obj["lemma"] = "ε";
    } else if ("Multi" in lemma) {
      console.log(lemma);
      obj["lemma"] = lemma["Multi"].map(x => {
        return x == null || x.length == 0 ? "ε" : x
      }).join("-");
    } else {
      obj["lemma"] = JSON.stringify(lemma);
    }
  } else { //trace 
    if (node["Trace"]["new_trace"] !== null) {
      obj["trace"] = { "start": node["Trace"]["new_trace"], "dest": node["Trace"]["trace"] };
    } else {
      obj["trace"] = { "start": node["Trace"]["trace"] };
    }
  }
  return obj
}

let grammars = {
  "Stabler 2013": [
    "C",
    ["::V= C",
      "::V= +W C",
      "knows::C= =D V",
      "says::C= =D V",
      "prefers::D= =D V",
      "drinks::D= =D V",
      "king::N",
      "wine::N",
      "beer::N",
      "queen::N",
      "the::N= D",
      "which::N= D -W"].join("\n"),
  ],
  "Copy language": [
    "T",
    [
      "::=T +r +l T",
      "::T -r -l",
      "a::=A +l T -l",
      "a::=T +r A -r",
      "b::=B +l T -l",
      "b::=T +r B -r",
    ].join("\n"),
  ],
};


const grammar = document.getElementById("grammar");
document.getElementById("category").value = grammars["Stabler 2013"][0];
grammar.value = grammars["Stabler 2013"][1];
let selection = document.getElementById("grammar-selection");

for (const [name, data] of Object.entries(grammars)) {
  const initial_category = data[0];
  const grammar_string = data[1];

  let li = document.createElement("li");
  li.innerHTML = `<li><a class="dropdown-item">${name}</a></li>`;
  selection.appendChild(li);
  li.addEventListener("click", (_) => {
    document.getElementById("category").value = initial_category;
    document.getElementById("grammar").value = grammar_string;
  });
}




function set_parse_tree(s) {
  document.getElementById("parse-tree").innerHTML = "";

  const tree = build_nodes(JSON.parse(s));
  const root = d3.hierarchy(tree);

  const links = root.links();
  const nodes = root.descendants();



  const dx = 50;
  const dy = 35;
  d3.tree().nodeSize([dx, dy])(root);

  // Center the tree.
  let x0 = Infinity;
  let x1 = -x0;
  let y0 = Infinity;
  let y1 = -x0;
  root.each(d => {
    if (d.x > x1) x1 = d.x;
    if (d.x < x0) x0 = d.x;
    if (d.y > y1) y1 = d.y;
    if (d.y < y0) y0 = d.y;

    d.targetX = d.x;
    d.targetY = d.y;
  });




  const height = y1 - y0 + dx * 2;
  const width = x1 - x0 + dx * 2;


  const svg = d3.select("#parse-tree").append("svg").attr("viewBox",
    [x0 - dy, y0 - dx, width, height])
    .style("width", "100%")
    .style("height", "100%")
    .attr("preserveAspectRatio", "xMinYMid meet")
    .attr("font-family", "sans-serif")
    .attr("font-size", 10);


  const link = svg.append("g")
    .attr("stroke", "#000")
    .selectAll("line")
    .data(links)
    .join("line");

  // Append nodes.
  const node = svg.append("g")
    .selectAll("g")
    .data(nodes).enter().append("g")
    .attr("class", "node")
    .attr("id", d => `node-${d.data.id}`);


  const textElement = node.append("text")
    .attr("text-anchor", "middle").attr("dominant-baseline", "middle");

  textElement.append("tspan")
    .text(d => {
      if ("start" in d.data.trace) {
        return "t";
      } else {
        return d.data.features.join(" ");
      }
    })
    .attr("x", 0);

  // Second line (only if lemma exists)
  textElement.selectAll(".lemma-tspan")
    .data(d => d.data.lemma != undefined ? [d] : [])
    .enter()
    .append("tspan")
    .attr("class", "lemma-tspan")
    .text(d => d.data.lemma)
    .attr("x", 0)
    .attr("dy", "1em");



  node.insert("rect", "text").attr("fill", "white").attr("stroke", "#000").attr("stroke-width", 1).attr("x", function () {
    const bbox = this.nextSibling.getBBox(); // Get text dimensions
    return bbox.x - 5;
  })
    .attr("y", function () {
      const bbox = this.nextSibling.getBBox();
      return bbox.y - 2;
    })
    .attr("width", function () {
      const bbox = this.nextSibling.getBBox();
      return bbox.width + 10;
    })
    .attr("height", function () {
      const bbox = this.nextSibling.getBBox();
      return bbox.height + 4;
    });


  node.each(function (d) {
    const bbox = this.getBBox();
    d.width = bbox.width;
    d.height = bbox.height;
  });




  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(d => {
      return Math.sqrt((d.source.targetX - d.target.targetX) ** 2 + (d.source.targetY - d.target.targetY) ** 2);
    }).strength(1.5))
    .force("x", d3.forceX(d => d.targetX).strength(0.25))
    .force("y", d3.forceY(d => d.targetY).strength(0.25));
  node.call(drag(simulation));


  const movers = new Map();

  root.descendants().forEach(node => {
    const trace = node.data.trace;
    if ("start" in trace) {
      const t = trace["start"];
      let move = movers.get(t)
      if (move == null) {
        move = {};
      }
      move["start"] = node;
      movers.set(t, move);
    }
    if ("dest" in trace) {
      const t = trace["dest"];
      let move = movers.get(t)
      if (move == null) {
        move = {}
      }
      move["dest"] = node;
      movers.set(t, move);
    };
  });

  svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 8)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 -5 L 10 0 L 0 5 z")
    .attr("fill", "#999");



  const moveLines = svg.selectAll(".move-line")
    .data(movers.entries())
    .enter()
    .insert("line", "g")
    .attr("class", "move-line")
    .attr("stroke", "#999")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "2,2")
    .attr("marker-end", "url(#arrowhead)");


  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);
    moveLines
      .attr("x1", d => d[1].start.x)
      .attr("y1", d => d[1].start.y)
      .attr("x2", d => d[1].dest.x < d[1].start.x ? d[1].dest.x + d[1].dest.width / 2 : d[1].dest.x - d[1].dest.width / 2)
      .attr("y2", d => d[1].dest.y + d[1].dest.height / 2);

    node.attr("transform", function (d) {
      return "translate(" + d.x + "," + d.y + ")";
    });
  });


}

const alertPlaceholder = document.getElementById('errors')

const appendAlert = (message) => {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = [
    `<div class="alert alert-danger alert-dismissible" role="alert">`,
    `   <div>${message}</div>`,
    '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
    '</div>'
  ].join('')

  alertPlaceholder.append(wrapper)
}

init().then(() => {
  document.getElementById("parse").addEventListener("submit", function (e) {
    e.preventDefault();
    const data = new FormData(e.target);
    try {
      let s = get_parse(
        data.get("sentence"),
        data.get("grammar"),
        data.get("category"),
        data.get("min_log_prob"),
        data.get("max_beams"),
        data.get("max_steps")
      );

      if (s) {
        alertPlaceholder.replaceChildren();
        set_parse_tree(s)
      } else {
        appendAlert("No parse found!")
      }
    } catch (e) {
      if (e instanceof TypeError) {
        throw e;
      } else {
        appendAlert(e)
      }
    }


  });
});
