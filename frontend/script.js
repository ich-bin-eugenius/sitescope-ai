const API_URL = "http://localhost:8000/api/audit";

const CATEGORY_LABELS = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Accessibility",
  "best-practices": "Best Practices"
};

const ICONS = {
  pass: '<img src="svg/pass.svg" alt="pass" height="23" width="23" />',
  warn: '<img src="svg/warn.svg" alt="warn" height="23" width="23" />',
  fail: '<img src="svg/fail.svg" alt="fail" height="23" width="23" />'
};

const form = document.getElementById("audit-form");
const urlInput = document.getElementById("url-input");
const submitBtn = document.getElementById("submit-btn");
const errorEl = document.getElementById("error");
const scanningEl = document.getElementById("scanning");
const resultsEl = document.getElementById("results");
const resetBtn = document.getElementById("reset-btn");

let scanning = false;

const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  const parsed = new URL(url);

  if (parsed.hostname !== "localhost" && !DOMAIN_PATTERN.test(parsed.hostname)) {
    throw new Error("Invalid domain format.");
  }

  return parsed.toString();
}

async function runAudit(url) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "The server returned an error.");
  }
  return data;
}

function buildCategories(data) {
  const byCategory = {};

  for (const opp of data.opportunities) {
    const cat = opp.category || "best-practices";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(opp);
  }

  const result = [];
  for (const id of Object.keys(data.scores)) {
    const score = data.scores[id];
    const rawFindings = byCategory[id] || [];
    const findings = [];

    for (const item of rawFindings) {
      findings.push({
        severity: item.severity === "critical" ? "fail" : "warn",
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

    result.push({
      id,
      label: CATEGORY_LABELS[id] || id,
      score,
      findings
    });
  }

  return result;
}

function renderResults(data) {
  const categories = buildCategories(data);
  const scoreSum = categories.reduce((sum, cat) => sum + cat.score, 0);
  const overallScore = Math.round(scoreSum / categories.length);

  document.getElementById("report-url").textContent = data.url;
  document.getElementById("report-title").textContent = "";
  document.getElementById("report-meta").textContent = "";

  const cls = overallScore >= 80 ? "good" : overallScore >= 50 ? "ok" : "bad";
  const circumference = 2 * Math.PI * 78;
  const offset = circumference * (1 - overallScore / 100);
  const ring = document.getElementById("ring-fg");

  ring.setAttribute("stroke-dasharray", circumference);
  ring.className.baseVal = `ring-fg stroke-${cls}`;
  ring.style.strokeDashoffset = offset;

  const scoreEl = document.getElementById("overall-score");
  scoreEl.textContent = overallScore;
  scoreEl.className = `score-number score-${cls}`;

  const bars = document.getElementById("category-bars");
  bars.innerHTML = "";

  for (const catItem of categories) {
    const cc = catItem.score >= 80 ? "good" : catItem.score >= 50 ? "ok" : "bad";
    const div = document.createElement("div");
    div.className = "cat-bar";
    div.innerHTML = `
      <div class="cat-bar-head">
        <span class="cat-bar-name">${catItem.label}</span>
        <span class="cat-bar-score score-${cc}">${catItem.score}</span>
      </div>
      <div class="cat-bar-track">
        <div class="cat-bar-fill fill-${cc}" style="width: ${catItem.score}%"></div>
      </div>
    `;
    bars.appendChild(div);
  }

  const sections = document.getElementById("category-sections");
  sections.innerHTML = "";

  for (const secItem of categories) {
    const sCls = secItem.score >= 80 ? "good" : secItem.score >= 50 ? "ok" : "bad";
    const section = document.createElement("section");
    section.className = "cat-section";

    const h2 = document.createElement("h2");
    h2.textContent = secItem.label;
    const span = document.createElement("span");
    span.className = `cat-section-score score-${sCls}`;
    span.textContent = `${secItem.score}/100`;
    h2.appendChild(span);
    section.appendChild(h2);

    const ul = document.createElement("ul");
    ul.className = "findings";

    for (const finding of secItem.findings) {
      const li = document.createElement("li");
      li.className = "finding";
      li.innerHTML = ICONS[finding.severity];

      const contentDiv = document.createElement("div");

      const titleP = document.createElement("p");
      titleP.className = "finding-title";
      titleP.textContent = finding.title;
      contentDiv.appendChild(titleP);

      const detailP = document.createElement("p");
      detailP.className = "finding-detail";
      detailP.textContent = finding.explanation;
      contentDiv.appendChild(detailP);

      if (finding.whyItMatters) {
        const whyP = document.createElement("p");
        whyP.className = "finding-why";
        const strong = document.createElement("strong");
        strong.textContent = "Why it matters: ";
        whyP.appendChild(strong);
        whyP.append(finding.whyItMatters);
        contentDiv.appendChild(whyP);
      }

      if (finding.howToFix) {
        const fixP = document.createElement("p");
        fixP.className = "finding-fix";
        const strong = document.createElement("strong");
        strong.textContent = "How to fix: ";
        fixP.appendChild(strong);
        fixP.append(finding.howToFix);
        contentDiv.appendChild(fixP);
      }

      li.appendChild(contentDiv);
      ul.appendChild(li);
    }

    section.appendChild(ul);
    sections.appendChild(section);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (scanning) return;

  let url;
  try {
    url = normalizeUrl(urlInput.value);
  } catch (err) {
    errorEl.textContent = "Invalid URL format.";
    errorEl.classList.remove("hidden");
    return;
  }

  scanning = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Scanning...";
  urlInput.disabled = true;
  errorEl.classList.add("hidden");
  resultsEl.classList.add("hidden");
  scanningEl.classList.remove("hidden");
  scanningEl.textContent = "Running audit...";

  try {
    const data = await runAudit(url);
    renderResults(data);
    scanningEl.classList.add("hidden");
    resultsEl.classList.remove("hidden");
  } catch (err) {
    scanningEl.classList.add("hidden");
    errorEl.textContent = err.message || "Audit failed.";
    errorEl.classList.remove("hidden");
  } finally {
    scanning = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Start Audit";
    urlInput.disabled = false;
  }
});

resetBtn.addEventListener("click", () => {
  resultsEl.classList.add("hidden");
  urlInput.value = "";
  urlInput.focus();
});