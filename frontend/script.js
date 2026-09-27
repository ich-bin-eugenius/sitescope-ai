const API_URL = "https://sitescope-ai.hackclub.app/api/audit";

const SCAN_LINES = [
  "revolving host…",
  "requesting PageSpeed audit…",
  "running Lighthouse…",
  "scoring performance…",
  "scoring SEO…",
  "scoring accessibility…",
  "compiling report…"
];

const CATEGORY_LABELS = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Accessibility",
  "best-practices": "Best Practices"
};

const ICONS = {
  pass: '<img src="svg/pass.svg" alt="world" height="23" width="23" />',
  warn: '<img src="svg/warn.svg" alt="world" height="23" width="23" />',
  fail: '<img src="svg/fail.svg" alt="world" height="23" width="23" />'
};

var form = document.getElementById("audit-form");
var urlInput = document.getElementById("url-input");
var submitBtn = document.getElementById("submit-btn");
var errorEl = document.getElementById("error");
var scanningEl = document.getElementById("scanning");
var scanLinesEl = document.getElementById("scan-lines");
var resultsEl = document.getElementById("results");
var resetBtn = document.getElementById("reset-btn");

var scanning = false;

var HTTP_PREFIX = /^https?:\/\//i;
var DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function normalizeUrl(raw) {
  var url = raw.trim();
  if (!HTTP_PREFIX.test(url)) {
    url = "https://" + url;
  }

  var parsed = new URL(url);

  if (!DOMAIN_PATTERN.test(parsed.hostname)) {
    throw new Error("not a real domain");
  }

  return parsed.toString();
}

function scoreClass(score) {
  if (score >= 80) {
    return "good";
  }
  if (score >= 50) {
    return "ok";
  }
  return "bad";
}

function severityToIcon(severity) {
  if (severity === "critical") {
    return "fail";
  }
  return "warn";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(ch) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch];
  });
}

async function runAudit(url) {
  var response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url }),
  });

  var data = await response.json();

  if (!response.ok) {
    var msg = "The server returned an unknown error.";
    if (Array.isArray(data.detail)) {
      var messages = [];
      for (var i = 0; i < data.detail.length; i++) {
        messages.push(data.detail[i].msg);
      }
      msg = messages.join(", ");
    } else if (data.detail) {
      msg = data.detail;
    }
    throw new Error(msg);
  }

  return data;
}

function buildCategories(data) {
  var byCategory = {};

  for (var i = 0; i < data.opportunities.length; i++) {
    var opp = data.opportunities[i];
    var cat = opp.category;
    if (!cat) {
      cat = "best-practices";
    }
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat].push(opp);
  }

  var scoreKeys = Object.keys(data.scores);
  var result = [];

  for (var j = 0; j < scoreKeys.length; j++) {
    var id = scoreKeys[j];
    var score = data.scores[id];
    var rawFindings = byCategory[id] || [];
    var findings = [];

    for (var k = 0; k < rawFindings.length; k++) {
      var item = rawFindings[k];
      findings.push({
        severity: severityToIcon(item.severity),
        title: item.title,
        explanation: item.explanation || item.description,
        whyItMatters: item.why_it_matters,
        howToFix: item.how_to_fix,
      });
    }

    if (findings.length === 0) {
      findings.push({
        severity: "pass",
        title: "No issues found",
        explanation: "Lighthouse didn't flag anything in this category.",
        whyItMatters: null,
        howToFix: null,
      });
    }

    var label = CATEGORY_LABELS[id];
    if (!label) {
      label = id;
    }

    result.push({ id: id, label: label, score: score, findings: findings });
  }

  return result;
}

function showScanLines() {
  scanLinesEl.innerHTML = "";
  var i = 0;

  function render() {
    var html = "";
    for (var j = 0; j <= i; j++) {
      var isCurrent = (j === i);
      var cursorHtml = isCurrent ? '<span class="cursor"></span>' : "";
      html += '<p><span class="prompt">&gt;</span> ' + SCAN_LINES[j] + cursorHtml + '</p>';
    }
    scanLinesEl.innerHTML = html;
  }

  render();

  return setInterval(function() {
    if (i < SCAN_LINES.length - 1) {
      i++;
    }
    render();
  }, 450);
}

function renderResults(data) {
  var categories = buildCategories(data);
  var scoreSum = 0;
  for (var i = 0; i < categories.length; i++) {
    scoreSum += categories[i].score;
  }
  var overallScore = Math.round(scoreSum / categories.length);

  document.getElementById("report-url").textContent = data.url;
  document.getElementById("report-title").textContent = "";
  document.getElementById("report-meta").innerHTML = "";

  var cls = scoreClass(overallScore);
  var circumference = 2 * Math.PI * 78;
  var offset = circumference * (1 - overallScore / 100);
  var ring = document.getElementById("ring-fg");

  ring.setAttribute("stroke-dasharray", circumference);
  ring.className.baseVal = "ring-fg stroke-" + cls;

  var scoreEl = document.getElementById("overall-score");
  scoreEl.textContent = overallScore;
  scoreEl.className = "score-number score-" + cls;

  ring.style.strokeDashoffset = circumference;
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      ring.style.strokeDashoffset = offset;
    });
  });

  var bars = document.getElementById("category-bars");
  bars.innerHTML = "";

  for (var c = 0; c < categories.length; c++) {
    var catItem = categories[c];
    var cc = scoreClass(catItem.score);
    var div = document.createElement("div");
    div.className = "cat-bar";
    div.innerHTML =
      '<div class="cat-bar-head">' +
        '<span class="cat-bar-name">' + catItem.label + '</span>' +
        '<span class="cat-bar-score score-' + cc + '">' + catItem.score + '</span>' +
      '</div>' +
      '<div class="cat-bar-track"><div class="cat-bar-fill fill-' + cc + '" data-score="' + catItem.score + '"></div></div>';
    bars.appendChild(div);
  }

  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      var fills = bars.querySelectorAll(".cat-bar-fill");
      for (var f = 0; f < fills.length; f++) {
        fills[f].style.width = fills[f].getAttribute("data-score") + "%";
      }
    });
  });

  var sections = document.getElementById("category-sections");
  sections.innerHTML = "";

  for (var s = 0; s < categories.length; s++) {
    var secItem = categories[s];
    var sCls = scoreClass(secItem.score);
    var section = document.createElement("section");
    section.className = "cat-section";

    var findingsHtml = "";
    for (var fn = 0; fn < secItem.findings.length; fn++) {
      var finding = secItem.findings[fn];
      var whyHtml = finding.whyItMatters ? '<p class="finding-why"><strong>Why it matters:</strong> ' + escapeHtml(finding.whyItMatters) + '</p>' : "";
      var fixHtml = finding.howToFix ? '<p class="finding-fix"><strong>How to fix:</strong> ' + escapeHtml(finding.howToFix) + '</p>' : "";

      findingsHtml +=
        '<li class="finding">' +
          ICONS[finding.severity] +
          '<div>' +
            '<p class="finding-title">' + escapeHtml(finding.title) + '</p>' +
            '<p class="finding-detail">' + escapeHtml(finding.explanation) + '</p>' +
            whyHtml +
            fixHtml +
          '</div>' +
        '</li>';
    }

    section.innerHTML =
      '<h2>' + secItem.label + '<span class="cat-section-score score-' + sCls + '">' + secItem.score + '/100</span></h2>' +
      '<ul class="findings">' + findingsHtml + '</ul>';

    sections.appendChild(section);
  }
}

form.addEventListener("submit", async function(e) {
  e.preventDefault();
  if (scanning) {
    return;
  }

  var url;
  try {
    url = normalizeUrl(urlInput.value);
  } catch (err) {
    errorEl.textContent = "That doesn't look like a valid URL.";
    errorEl.classList.remove("hidden");
    return;
  }

  scanning = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Scanning…";
  urlInput.disabled = true;
  errorEl.classList.add("hidden");
  resultsEl.classList.add("hidden");
  scanningEl.classList.remove("hidden");

  var ticker = showScanLines();

  try {
    var data = await runAudit(url);
    renderResults(data);
    scanningEl.classList.add("hidden");
    resultsEl.classList.remove("hidden");
  } catch (err) {
    scanningEl.classList.add("hidden");
    errorEl.textContent = err.message || "Could not complete the audit. Check the URL and try again.";
    errorEl.classList.remove("hidden");
  } finally {
    clearInterval(ticker);
    scanning = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Start Audit";
    urlInput.disabled = false;
  }
});

resetBtn.addEventListener("click", function() {
  resultsEl.classList.add("hidden");
  urlInput.value = "";
  urlInput.focus();
});