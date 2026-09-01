import json
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from main import simplify_pagespeed_response

load_dotenv()

# Initialize the Gemini client (expects GEMINI_API_KEY environment variable)
client = genai.Client()


def generate_ai_explanations(raw_audit_data):
    """Sends simplified audit data to Gemini and returns parsed JSON explanations."""
    simplified_result = simplify_pagespeed_response(raw_audit_data)
    simplified_data = simplified_result.get("opportunities", [])

    with open("prompt.txt", "r", encoding="utf-8") as f:
        prompt_template = f.read()

    # Format the prompt with the JSON payload
    prompt = prompt_template.format(json_data=json.dumps(simplified_data, indent=2))

    # Call Gemini model
    response = client.models.generate_content(
        model='gemini-3.6-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
        )
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


if __name__ == "__main__":
    print("Loading raw audit data from raw.json...")
    with open("raw.json", "r", encoding="utf-8") as f:
        sample_audit = json.load(f)

    # Test main parses first
    result = simplify_pagespeed_response(sample_audit)

    print(json.dumps(result["scores"], indent=2))

    print(f"\nCount opportunities: {len(result['opportunities'])}")
    print("Opportunities preview:")
    print(json.dumps(result["opportunities"][:5], indent=2, ensure_ascii=False))

    print("\nTesting prompt integration with Gemini...")
    try:
        ai_result = generate_ai_explanations(sample_audit)
        print("Success! AI Output:")
        print(json.dumps(ai_result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error during execution: {e}")
