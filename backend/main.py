import os
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

PAGESPEED_API_KEY = os.getenv("PAGESPEED_API_KEY")
PAGESPEED_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

CATEGORIES = ["performance", "seo", "accessibility", "best-practices"]


class AuditRequest(BaseModel):
    url: str


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
                "score": score,
                "displayValue": audit.get("displayValue"),
            })

    return {"scores": scores, "opportunities": opportunities}


@app.get("/")
def read_root():
    return {"status": "SiteScope AI backend is running..."}


@app.post("/api/audit")
async def audit_website(request: AuditRequest):
    params = [("url", request.url), ("key", PAGESPEED_API_KEY)]
    for cat in CATEGORIES:
        params.append(("category", cat))

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(PAGESPEED_URL, params=params)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"PageSpeed API returned error: {response.text}",
        )

    result = simplify_pagespeed_response(response.json())
    return {"url": request.url, **result}