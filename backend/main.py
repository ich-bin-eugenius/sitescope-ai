import os
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

PAGESPEED_API_KEY = os.getenv("PAGESPEED_API_KEY")
PAGESPEED_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

CATEGORIES = ["performance", "seo", "accessibility", "best-practices"]


class AuditRequest(BaseModel):
    url: HttpUrl


def score_to_severity(score: float) -> str:
    """Converts numerical Lighthouse score to human-readable severity level."""
    if score < 0.5:
        return "critical"
    elif score < 0.9:
        return "warning"
    else:
        return "minor"


def simplify_pagespeed_response(data: dict) -> dict:
    lighthouse = data.get("lighthouseResult", {})

    categories_raw = lighthouse.get("categories", {})
    scores = {
        name: round(cat["score"] * 100)
        for name, cat in categories_raw.items()
        if cat.get("score") is not None
    }

    audits = lighthouse.get("audits", {})
    opportunities = []
    for audit in audits.values():
        score = audit.get("score")
        if score is not None and score < 1:
            opportunities.append({
                "id": audit.get("id"),
                "title": audit.get("title"),
                "description": audit.get("description"),
                "severity": score_to_severity(score),
                "displayValue": audit.get("displayValue"),
            })

    severity_order = {"critical": 0, "warning": 1, "minor": 2}
    opportunities.sort(key=lambda o: severity_order[o["severity"]])

    return {"scores": scores, "opportunities": opportunities}


@app.get("/")
def read_root():
    return {"status": "SiteScope AI backend is running..."}


@app.post("/api/audit")
async def audit_website(request: AuditRequest):
    # https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
    url_str = str(request.url)
    params = [("url", url_str), ("key", PAGESPEED_API_KEY)]
    for cat in CATEGORIES:
        params.append(("category", cat))

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(PAGESPEED_URL, params=params)

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail=f"The analyze of the website {url_str} took to long and timed out. Please try again.",
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to connect to the PageSpeed API. Check your internet connection.",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error communicating with the PageSpeed API: {str(e)}",
        )
    except response.status_code == 400:
        raise HTTPException(
            status_code=400,
            detail=f"The website {url_str} could not be analyzed — check that the URL is valid and the website is "
                   f"publicly accessible.",
        )
    except response.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail=f"The PageSpeed API daily limit has been reached. Please try again tomorrow.",
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"The PageSpeed API returned an unexpected error. (code {response.status_code}).",
        )

    try:
        data = response.json()
    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="The PageSpeed API returned invalid data.",
        )

    result = simplify_pagespeed_response(data)
    return {"url": url_str, **result}
