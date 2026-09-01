# DEVLOG #4 — Frontend ↔ Backend Connection - 29.8.2026

Today I continued building the basic frontend structure and connected it to the backend.

## What I implemented

### Frontend

Added `script.js` with:

* Form submission handling
* URL input validation
* Loading state
* `fetch()` request to the `/api/audit` endpoint
* JSON result rendering
* Basic error handling

The frontend now sends the submitted URL to the backend as JSON:

```json
{
  "url": "https://example.com"
}
```

and receives the simplified audit response from the backend.

### Deployment

I also deployed the frontend to **Netlify** so I can start testing the project outside of localhost.

However, the deployed version currently returns:

```text
Error: Failed to fetch
```

The current frontend is still trying to communicate with the local backend at:

```text
http://localhost:8000/api/audit
```

so the public deployment cannot reach my local development server.

This is something I need to solve next by deploying the backend and connecting the frontend to its public API endpoint.

## Current architecture

```text
User
 ↓
Netlify Frontend
 ↓
JavaScript fetch()
 ↓
FastAPI Backend
 ↓
PageSpeed Insights API
 ↓
Simplified audit results
 ↓
Frontend
```

The basic pieces are now connected locally. The next goal is to make the entire pipeline work publicly.

**Day 4 complete. 🚀**