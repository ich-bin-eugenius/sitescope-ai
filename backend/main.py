import os
import json
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from google import genai
import asyncio
from concurrent.futures import ThreadPoolExecutor

_executor = ThreadPoolExecutor(max_workers=4)
AI_TIMEOUT_SECONDS = 20.0

load_dotenv()

app = FastAPI(root_path="")

# noinspection PyTypeChecker
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PAGESPEED_API_KEY = os.getenv("PAGESPEED_API_KEY")
PAGESPEED_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

CATEGORIES = ["performance", "seo", "accessibility", "best-practices"]

# Initialize the Gemini client (expects GEMINI_API_KEY in environment)
gemini_client = genai.Client()


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
    """It extracts only the category scores and audits with a score < 1 from the full PageSpeed API response."""
    lighthouse = data.get("lighthouseResult", {})

    categories_raw = lighthouse.get("categories", {})
    scores = {
        name: round(cat["score"] * 100)
        for name, cat in categories_raw.items()
        if cat.get("score") is not None
    }

    audit_to_category = {}
    for cat_name, cat in categories_raw.items():
        for ref in cat.get("auditRefs", []):
            audit_id = ref.get("id")
            group = ref.get("group")
            if audit_id and group not in ("hidden", "diagnostics"):
                audit_to_category.setdefault(audit_id, cat_name)

    audits = lighthouse.get("audits", {})
    opportunities = []
    for audit in audits.values():
        score = audit.get("score")
        if score is not None and score < 1:
            audit_id = audit.get("id")
            opportunities.append({
                "id": audit_id,
                "category": audit_to_category.get(audit_id, "best-practices"),
                "title": audit.get("title"),
                "description": audit.get("description"),
                "severity": score_to_severity(score),
                "displayValue": audit.get("displayValue"),
            })

    severity_order = {"critical": 0, "warning": 1, "minor": 2}
    opportunities.sort(key=lambda o: severity_order[o["severity"]])

    return {"scores": scores, "opportunities": opportunities}


def generate_ai_explanations(opportunities: list) -> list:
    """Sends simplified audit opportunities to Gemini and returns plain-language explanations."""
    if not opportunities:
        return []

    prompt_path = os.path.join(os.path.dirname(__file__), "prompt.txt")
    if not os.path.exists(prompt_path):
        prompt_path = "prompt.txt"

    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt_template = f.read()

    prompt = prompt_template.format(json_data=json.dumps(opportunities, indent=2))

    response = gemini_client.models.generate_content(
        model='gemini-3.6-flash',
        contents=prompt,
    )

    response_text = response.text.strip()
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.startswith("```"):
        response_text = response_text[3:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]
    response_text = response_text.strip()

    return json.loads(response_text)


async def generate_ai_explanations_async(opportunities: list) -> list:
    """Runs the blocking Gemini call in a thread, so it can't freeze the
    whole FastAPI event loop, and gives up after AI_TIMEOUT_SECONDS so a
    slow/rate-limited AI call can't hang the whole audit."""
    loop = asyncio.get_event_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(_executor, generate_ai_explanations, opportunities),
            timeout=AI_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        print(f"Warning: AI explanation generation timed out after {AI_TIMEOUT_SECONDS}s")
        return []
    except Exception as e:
        print(f"Warning: AI explanation generation failed: {e}")
        return []


@app.get("/")
def read_root():
    return {"status": "SiteScope AI backend is running..."}


@app.post("/api/audit")
async def audit_website(request: AuditRequest):
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
            detail=f"The analysis of the website {url_str} took too long and timed out. Please try again.",
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=502,
            detail="Failed to connect to the PageSpeed API. Check your internet connection.",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error communicating with the PageSpeed API: {str(e)}",
        )

    if response.status_code == 400:
        raise HTTPException(
            status_code=400,
            detail=f"The website {url_str} could not be analyzed, check that the URL is valid"
                   f" and the website is publicly accessible.",
        )
    elif response.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="The PageSpeed API daily limit has been reached. Please try again tomorrow.",
        )
    elif response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"The PageSpeed API returned an unexpected error (code {response.status_code}).",
        )

    try:
        data = response.json()
    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="The PageSpeed API returned invalid data.",
        )

    result = simplify_pagespeed_response(data)
    opportunities = result["opportunities"]

    ai_explanations = await generate_ai_explanations_async(opportunities)

    ai_map = {item["id"]: item for item in ai_explanations if "id" in item}

    merged_opportunities = []
    for opp in opportunities:
        opp_id = opp["id"]
        ai_data = ai_map.get(opp_id, {})

        merged_opportunities.append({
            **opp,
            "explanation": ai_data.get("explanation", opp.get("description")),
            "why_it_matters": ai_data.get("why_it_matters", "Improves overall user experience and performance."),
            "how_to_fix": ai_data.get("how_to_fix", "Review technical documentation for this specific audit.")
        })

    result["opportunities"] = merged_opportunities

    return {"url": url_str, **result}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
