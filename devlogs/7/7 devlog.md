# Devlog 7 — Phase 1 edge-case testing 1.9.2026

Tested the audit flow against a range of inputs to close out Phase 1's error-handling checklist item.

**Valid sites**
- `example.com` — score 93, UI renders correctly (score ring, category bars, findings).
- `info.cern.ch` — score 89, parser and rendering hold up fine on a minimal/legacy page.

**Error handling**
- `thiswebsitedoesnt-exist.com` — backend correctly catches the connection failure; frontend shows a clear error message instead of crashing.
- `httpbin.org/delay/3` — confirms the timeout/error path works for slow-responding sites.
- `not_a_url_at_all` / `test_site` — found a real bug here: these passed client-side validation (JS's `URL()` accepts almost any string as a hostname), so the app was sending them straight to the backend and burning PageSpeed quota on requests that could never succeed, with the user waiting 5+ seconds for an error that could've been instant.

**Fix**
Added a hostname pattern check in `normalizeUrl()` (frontend) that requires at least one dot and only valid domain characters before a request is ever sent. Invalid-looking input now fails instantly with "That doesn't look like a valid URL," no backend call, no wasted quota.
Phase 1 checklist is now fully closed. Moving on to Phase 2 — drafting the AI prompt.