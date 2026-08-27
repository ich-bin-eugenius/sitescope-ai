import json
import os
from main import simplify_pagespeed_response

os.makedirs("tests", exist_ok=True)
sample_path = "tests/sample_response.json"

if not os.path.exists(sample_path):
    with open(sample_path, "w", encoding="utf-8") as f:
        json.dump({
            "lighthouseResult": {
                "categories": {
                    "performance": {"score": 0.85},
                    "seo": {"score": 0.92}
                },
                "audits": {
                    "render-blocking-resources": {
                        "id": "render-blocking-resources",
                        "title": "Eliminate render-blocking resources",
                        "description": "Javasript and CSS are blocking rendering",
                        "score": 0.5,
                        "displayValue": "150 ms"
                    }
                }
            }
        }, f, indent=2)

with open(sample_path, encoding="utf-8") as f:
    sample_data = json.load(f)

result = simplify_pagespeed_response(sample_data)

print("Scores:")
print(json.dumps(result["scores"], indent=2))

print(f"\nCount opportunities: {len(result['opportunities'])}")
print("First 5 opportunities:")
print(json.dumps(result["opportunities"][:5], indent=2, ensure_ascii=False))