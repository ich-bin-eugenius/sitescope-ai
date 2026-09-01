# DEVLOG #2 — First Working Audit Endpoint - 27.8.2026

Today I moved SiteScope AI from the initial project setup to its first working website audit pipeline.

The main goal for today was to connect the backend to the **Google PageSpeed Insights API**, process its response, and expose the results through my own API endpoint.

## What I did today

### ⚙️ FastAPI backend

* Initialized the FastAPI application
* Created the root `GET /` endpoint
* Started the local development server with Uvicorn
* Created a new `POST /api/audit` endpoint
* Added request handling for website URLs

### 🔌 PageSpeed Insights API

I connected SiteScope AI to the Google PageSpeed Insights API using `httpx`.

The backend now:

1. Receives a website URL
2. Sends it to PageSpeed Insights
3. Receives the Lighthouse/PageSpeed JSON response
4. Extracts the important information
5. Returns a simplified JSON response

The current response contains:

* Performance score
* Accessibility score
* Best Practices score
* SEO score
* Main opportunities / issues that should be fixed

### 🧪 Testing the parser

I also created a mock parser test using sample PageSpeed JSON data.

Example result:

```json
{
  "performance": 85,
  "seo": 92
}
```

The parser also successfully extracted opportunities such as:

```json
{
  "id": "render-blocking-resources",
  "title": "Eliminate render-blocking resources",
  "description": "JavaScript and CSS are blocking rendering",
  "score": 0.5,
  "displayValue": "150 ms"
}
```

This means I can now work with the PageSpeed response without having to pass the entire huge API response to the frontend.

## 🚀 First API test

I tested the new endpoint locally with `curl`:

```bash
curl.exe -X POST http://127.0.0.1:8000/api/audit ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://example.com\"}"
```

The endpoint successfully returned:

```json
{
  "url": "https://example.com",
  "scores": {
    "performance": 100,
    "accessibility": 96,
    "best-practices": 96,
    "seo": 80
  },
  "opportunities": [
    {
      "id": "meta-description",
      "title": "Document does not have a meta description",
      "score": 0,
      "displayValue": null
    }
  ]
}
```

I also tested the API response against `example.com` and confirmed that SiteScope AI is able to detect actual website issues such as:

* Missing meta description
* Non-descriptive link text
* Missing `<main>` landmark
* Missing or late charset declaration

## 🐛 Bugs & improvements

While building the endpoint, I ran into a few issues with the PageSpeed API response and query parameter serialization.

I fixed the API category parameter handling and refactored the PageSpeed response parser into a more modular structure.

I also added `notes-developer.txt` to `.gitignore` so development notes don't accidentally end up in the repository.

## 📦 Commits

Today's main commits:

* `feat: initialize FastAPI app with root endpoint`
* `feat: implement /api/audit endpoint calling PageSpeed Insights API`
* `fixed bug`
* `refactor: modularize pagespeed response parsing and fix query parameter serialization for categories`
* `test: add mock test parser for simplify_pagespeed_response and sample json data`
* `Add notes-developer.txt to .gitignore`

## 📈 Current state

SiteScope AI can now perform the first real step of its intended workflow:

**Website URL → PageSpeed Insights → Backend parser → Simplified audit data**

It's still far from the final product, but the backend is now actually processing real website data.

## 🔜 Next steps

Next I want to continue building the audit pipeline and start preparing the data for the AI layer.

The long-term goal is:

**Website → Technical analysis → AI analysis → Clear recommendations → User-friendly report**

Day 2 complete. 🔥