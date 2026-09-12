Devlog #10 - AI timeout fix, a Nest outage that wasn't my fault, and first ship readiness

12.9.2026

AI call timeout fix

Fixed the blocking-call bug from earlier testing: generate_ai_explanations() was running synchronously inside the async /api/audit endpoint with no timeout, so a slow or rate-limited Gemini call could freeze the entire event loop — not just one request, but every concurrent request on the server. I wrapped it in run_in_executor + asyncio.wait_for with a 20-second cap.

Confirmed it working in production logs: three separate Warning: AI explanation generation timed out after 20.0s entries showed up, and the server kept responding normally instead of hanging. The audit still returns successfully in that case — it just falls back to the plain Lighthouse description instead of an AI-generated one.

Nest went down - this time, not my bug

The container went into a stopped / unknown state after some load testing, and SSH kept disconnecting. It turned out to be a platform-wide issue: Nest's pvestatd (the Proxmox stats daemon) was crashing under load across all containers on the host, not just mine — confirmed by an admin in the Nest Slack.

I proved it wasn't my code by testing curl localhost:8000/api/slow-test directly inside the container, which returned correctly after 45s, versus the same request through the public domain, which failed after ~30s or hung with no response at all. The same pattern showed up earlier when auditing heavier sites like nike.com — they fail around 30s with "Failed to fetch", while lightweight sites like example.com complete fine.

Net effect: there's currently an informal ~30-second ceiling on how long an audit can take before the public domain drops the connection, independent of anything in my own code. Only lighter sites (simple HTML/CSS, fewer images) reliably complete right now.

Heavier sites will need a proper fix later - likely restructuring the audit into a job + polling flow instead of one long-held request, so no single request has to stay open that long. I've filed this as a known limitation for now, so it isn't blocking the first ship.

Small polish

Made some minor fixes to the nav and footer.

README finished

Wrote a complete README.md covering everything the Stardance shipping guide asks for: a one-line description, live demo link, screenshot, local run instructions, and a "Known limitations" section that's upfront about the current Nest instability and audit-length ceiling, so testers don't mistake a platform issue for a broken app.

Status: The project is ready for a first informal ship - a soft launch to a small group for feedback, not the official Stardance submission yet.