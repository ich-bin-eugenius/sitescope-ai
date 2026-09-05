/* SiteScope AI — frontend for the SiteScope AI FastAPI backend
 * Sends the target URL to /api/audit and renders the returned
 * PageSpeed/Lighthouse scores and findings.
 */

const API_URL = "https://sitescope-ai.hackclub.app/api/audit";

const SCAN_LINES = [
  "resolving host…",
  "requesting PageSpeed audit…",
  "running Lighthouse…",
  "scoring performance…",
  "scoring SEO…",
  "scoring accessibility…",
  "compiling report…",
];

const CATEGORY_LABELS = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Accessibility",
  "best-practices": "Best Practices",
};

const ICONS = {
  pass: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>',
  warn: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  fail: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--destructive)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
};

const form = document.getElementById("audit-form");
const urlInput = document.getElementById("url-input");
const submitBtn = document.getElementById("submit-btn");
const errorEl = document.getElementById("error");
const scanningEl = document.getElementById("scanning");
const scanLinesEl = document.getElementById("scan-lines");
const resultsEl = document.getElementById("results");
const resetBtn = document.getElementById("reset-btn");

let scanning = false;

const HTTP_PREFIX = /^https?:\/\//i;
const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!HTTP_PREFIX.test(url)) url = "https://" + url;

  const parsed = new URL(url); // throws on malformed input

  if (!DOMAIN_PATTERN.test(parsed.hostname)) {
    throw new Error("not a real domain");
  }

  return parsed.toString();
}

function scoreClass(score) {
  if (score >= 80) return "good";
  if (score >= 50) return "ok";
  return "bad";
}

function severityToIcon(severity) {
  if (severity === "critical") return "fail";
  return "warn"; // "warning" and "minor" both get a caution icon — they're still real findings
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]
  );
}

/* ---------- Audit logic ---------- */

async function runAudit(url) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();

  if (!response.ok) {
    // FastAPI's HTTPException puts the message in "detail" (a string, or
    // an array of validation errors for 422 responses).
    const message = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(", ")
      : data.detail || "The server returned an unknown error.";
    throw new Error(message);
  }

  return data;
}

function buildCategories(data) {
  // Group the flat opportunities list by category so each score section
  // gets its own findings underneath it.
  const byCategory = {};
  for (const opp of data.opportunities) {
    const cat = opp.category || "best-practices";
    (byCategory[cat] ||= []).push(opp);
  }

  return Object.entries(data.scores).map(([id, score]) => {
    const findings = (byCategory[id] || []).map((opp) => ({
      severity: severityToIcon(opp.severity),
      title: opp.title,
      detail: opp.displayValue || opp.description,
    }));

    if (findings.length === 0) {
      findings.push({
        severity: "pass",
        title: "No issues found",
        detail: "Lighthouse didn't flag anything in this category.",
      });
    }

    return { id, label: CATEGORY_LABELS[id] || id, score, findings };
  });
}

/* ---------- Rendering ---------- */

function showScanLines() {
  scanLinesEl.innerHTML = "";
  let i = 0;
  const render = () => {
    scanLinesEl.innerHTML = SCAN_LINES.slice(0, i + 1)
      .map(
        (line, idx) =>
          `<p><span class="prompt">&gt;</span> ${line}${idx === i ? '<span class="cursor"></span>' : ""}</p>`
      )
      .join("");
  };
  render();
  return setInterval(() => {
    i = Math.min(i + 1, SCAN_LINES.length - 1);
    render();
  }, 450);
}

function renderResults(data) {
  const categories = buildCategories(data);
  const overallScore = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );

  document.getElementById("report-url").textContent = data.url;
  document.getElementById("report-title").textContent = "";
  document.getElementById("report-meta").innerHTML = "";

  // Score ring
  const cls = scoreClass(overallScore);
  const circumference = 2 * Math.PI * 78;
  const offset = circumference * (1 - overallScore / 100);
  const ring = document.getElementById("ring-fg");
  ring.setAttribute("stroke-dasharray", circumference);
  ring.className.baseVal = "ring-fg stroke-" + cls;
  const scoreEl = document.getElementById("overall-score");
  scoreEl.textContent = overallScore;
  scoreEl.className = "score-number score-" + cls;
  ring.style.strokeDashoffset = circumference;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => (ring.style.strokeDashoffset = offset))
  );

  // Category bars
  const bars = document.getElementById("category-bars");
  bars.innerHTML = "";
  for (const c of categories) {
    const cc = scoreClass(c.score);
    const div = document.createElement("div");
    div.className = "cat-bar";
    div.innerHTML = `
      <div class="cat-bar-head">
        <span class="cat-bar-name">${c.label}</span>
        <span class="cat-bar-score score-${cc}">${c.score}</span>
      </div>
      <div class="cat-bar-track"><div class="cat-bar-fill fill-${cc}" data-score="${c.score}"></div></div>`;
    bars.appendChild(div);
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      bars.querySelectorAll(".cat-bar-fill").forEach((el) => {
        el.style.width = el.dataset.score + "%";
      })
    )
  );

  // Findings sections
  const sections = document.getElementById("category-sections");
  sections.innerHTML = "";
  for (const c of categories) {
    const cc = scoreClass(c.score);
    const section = document.createElement("section");
    section.className = "cat-section";
    section.innerHTML = `
      <h2>${c.label}<span class="cat-section-score score-${cc}">${c.score}/100</span></h2>
      <ul class="findings">
        ${c.findings
          .map(
            (f) => `
          <li class="finding">
            ${ICONS[f.severity]}
            <div>
              <p class="finding-title">${escapeHtml(f.title)}</p>
              <p class="finding-detail">${escapeHtml(f.detail)}</p>
            </div>
          </li>`
          )
          .join("")}
      </ul>`;
    sections.appendChild(section);
  }
}

/* ---------- Flow ---------- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (scanning) return;

  let url;
  try {
    url = normalizeUrl(urlInput.value);
  } catch {
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
  const ticker = showScanLines();

  try {
    const data = await runAudit(url);
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

resetBtn.addEventListener("click", () => {
  resultsEl.classList.add("hidden");
  urlInput.value = "";
  urlInput.focus();
});