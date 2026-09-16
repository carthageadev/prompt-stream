"""
OpenRouter helpers with deterministic local fallbacks.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_ANALYSIS_MODEL = os.getenv(
    "OPENROUTER_ANALYSIS_MODEL", "openai/gpt-4o-mini"
)
OPENROUTER_SEMANTIC_MODEL = os.getenv(
    "OPENROUTER_SEMANTIC_MODEL", OPENROUTER_ANALYSIS_MODEL
)

STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "your",
    "you",
    "are",
    "have",
    "has",
    "will",
    "not",
    "use",
    "using",
    "into",
    "then",
    "than",
    "what",
    "when",
    "where",
    "which",
    "their",
    "there",
    "should",
    "must",
    "about",
    "prompt",
    "prompts",
}


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _extract_json_blob(raw: str) -> dict[str, Any] | list[Any] | None:
    raw = raw.strip()
    if not raw:
        return None

    for start_char, end_char in (("{", "}"), ("[", "]")):
        start = raw.find(start_char)
        end = raw.rfind(end_char)
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                continue
    return None


def _call_openrouter(
    model: str, system_prompt: str, user_prompt: str
) -> dict[str, Any] | list[Any] | None:
    if not OPENROUTER_API_KEY:
        return None

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    request = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://prompts.achraf.tn",
            "X-Title": "prompts.achraf.tn",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None

    content = (
        body.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    if isinstance(content, list):
        text_parts = [part.get("text", "") for part in content if isinstance(part, dict)]
        content = "\n".join(filter(None, text_parts))

    return _extract_json_blob(content) if isinstance(content, str) else None


def extract_keywords(content: str, limit: int = 10) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9\+#\.]{3,}", content.lower())
    buckets: dict[str, int] = {}
    for word in words:
        if word in STOPWORDS or word.isdigit():
            continue
        buckets[word] = buckets.get(word, 0) + 1
    return [word for word, _ in sorted(buckets.items(), key=lambda item: (-item[1], item[0]))[:limit]]


def heuristic_tag_suggestions(content: str, existing_tags: list[str]) -> dict[str, Any]:
    text = content.lower()
    suggestions = set()

    if any(token in text for token in ("react", "useeffect", "usestate", "jsx")):
        suggestions.add("React")
    if any(token in text for token in ("next.js", "next/", "getserversideprops", "app router")):
        suggestions.add("Next.js")
    if any(token in text for token in ("python", "pandas", "numpy", "flask", "django")):
        suggestions.add("Python")
    if any(token in text for token in ("typescript", "interface ", "type ")) or re.search(
        r":\s*(string|number|boolean|unknown|never)", content
    ):
        suggestions.add("TypeScript")
    if any(token in text for token in ("json", "markdown", "yaml", "xml", "output")):
        suggestions.add("Output")
    if any(token in text for token in ("must", "do not", "avoid", "never", "constraints")):
        suggestions.add("Rules")
    if any(token in text for token in ("role", "you are", "act as", "persona")):
        suggestions.add("Role")
    if any(token in text for token in ("context", "background", "project", "environment")):
        suggestions.add("Context")
    if "sql" in text or any(token in text for token in ("select ", "insert ", "update ", "create table")):
        suggestions.add("SQL")

    suggestions.update(tag for tag in existing_tags if tag.lower() in text)

    merge_suggestions = []
    lower_existing = {tag.lower(): tag for tag in existing_tags}
    if "ux" in lower_existing and "ui/ux" in lower_existing:
        merge_suggestions.append(
            {"source": lower_existing["ux"], "target": lower_existing["ui/ux"], "reason": "Overlapping design taxonomy."}
        )

    return {
        "suggested_tags": sorted(suggestions),
        "merge_suggestions": merge_suggestions,
    }


def heuristic_scorecard(content: str) -> dict[str, Any]:
    length = len(content.strip())
    has_constraints = bool(re.search(r"\b(do not|avoid|must|never|limit|constraint)\b", content, re.I))
    has_output = bool(re.search(r"\b(json|markdown|yaml|xml|format|table|bullet)\b", content, re.I))
    has_context = bool(re.search(r"\b(context|background|project|stack|environment)\b", content, re.I))
    has_persona = bool(re.search(r"\b(you are|act as|persona|role)\b", content, re.I))

    clarity = min(10, 4 + (1 if length > 120 else 0) + (2 if has_persona else 0) + (2 if has_context else 0))
    specificity = min(10, 3 + (2 if length > 220 else 0) + (2 if has_output else 0) + (2 if has_constraints else 0))
    constraints = 8 if has_constraints else 3
    output_definition = 8 if has_output else 4
    reuse_potential = min(10, 4 + (2 if has_persona else 0) + (2 if has_output else 0) + (1 if has_context else 0))
    ambiguity_risk = max(1, 8 - (clarity // 2) - (2 if has_output else 0) - (2 if has_constraints else 0))

    recommendations = []
    if not has_persona:
        recommendations.append("Add a clearer role or perspective for the model.")
    if not has_context:
        recommendations.append("Provide more task or project context.")
    if not has_constraints:
        recommendations.append("Define explicit constraints or non-goals.")
    if not has_output:
        recommendations.append("Specify the desired output shape or format.")
    if length < 100:
        recommendations.append("Expand the prompt to reduce ambiguity.")

    return {
        "clarity": clarity,
        "specificity": specificity,
        "constraints": constraints,
        "output_definition": output_definition,
        "reuse_potential": reuse_potential,
        "ambiguity_risk": ambiguity_risk,
        "summary": "Structured and reusable." if ambiguity_risk <= 3 else "Useful foundation but still underspecified.",
        "recommendations": recommendations[:4],
    }


def heuristic_semantic_profile(title: str, content: str, tags: list[str]) -> dict[str, Any]:
    keywords = extract_keywords(f"{title}\n{content}")
    constraints = [
        phrase
        for phrase in re.findall(r"(?:^|\n)[\-\*\d\.\)]\s*([^\n]{5,120})", content)
        if re.search(r"\b(do not|avoid|must|keep|limit|preserve)\b", phrase, re.I)
    ][:5]
    personas = re.findall(r"(?:you are|act as)\s+([^.:\n]{4,80})", content, re.I)[:3]
    output_style = "structured"
    if re.search(r"\b(json|yaml|xml)\b", content, re.I):
        output_style = "machine-readable"
    elif re.search(r"\b(markdown|bullet|table)\b", content, re.I):
        output_style = "formatted"
    elif re.search(r"\b(code|typescript|python|react|sql)\b", content, re.I):
        output_style = "technical"

    intent = title.strip() or "Prompt workflow"
    if len(intent) < 12:
        intent = " ".join(keywords[:4]).title() or "Prompt workflow"

    return {
        "intent": intent,
        "output_style": output_style,
        "keywords": sorted(set(keywords + tags))[:12],
        "constraints": constraints,
        "personas": personas,
    }


def suggest_tags(
    title: str, content: str, existing_tags: list[str], current_tags: list[str]
) -> dict[str, Any]:
    system_prompt = (
        "You analyze prompts. Return JSON with keys suggested_tags and merge_suggestions. "
        "suggested_tags is an array of concise tags. merge_suggestions is an array of "
        "objects with source, target, and reason. Do not include any prose."
    )
    user_prompt = json.dumps(
        {
            "title": title,
            "content": content,
            "existing_tags": existing_tags,
            "current_tags": current_tags,
        }
    )
    response = _call_openrouter(OPENROUTER_ANALYSIS_MODEL, system_prompt, user_prompt)
    if isinstance(response, dict):
        tags = response.get("suggested_tags") or []
        merges = response.get("merge_suggestions") or []
        return {
            "suggested_tags": [str(tag).strip() for tag in tags if str(tag).strip()],
            "merge_suggestions": [
                {
                    "source": str(item.get("source", "")).strip(),
                    "target": str(item.get("target", "")).strip(),
                    "reason": str(item.get("reason", "")).strip() or "Suggested consolidation.",
                }
                for item in merges
                if isinstance(item, dict)
                and str(item.get("source", "")).strip()
                and str(item.get("target", "")).strip()
            ],
        }
    return heuristic_tag_suggestions(f"{title}\n{content}", existing_tags)


def analyze_quality(title: str, content: str) -> dict[str, Any]:
    system_prompt = (
        "You score prompts. Return JSON with clarity, specificity, constraints, "
        "output_definition, reuse_potential, ambiguity_risk, summary, recommendations. "
        "Scores must be integers from 1 to 10."
    )
    user_prompt = json.dumps({"title": title, "content": content})
    response = _call_openrouter(OPENROUTER_ANALYSIS_MODEL, system_prompt, user_prompt)
    if isinstance(response, dict):
        return response
    return heuristic_scorecard(content)


def build_semantic_profile(title: str, content: str, tags: list[str]) -> dict[str, Any]:
    system_prompt = (
        "You create compact semantic search profiles. Return JSON with intent, output_style, "
        "keywords, constraints, personas. Keep keywords short."
    )
    user_prompt = json.dumps({"title": title, "content": content, "tags": tags})
    response = _call_openrouter(OPENROUTER_SEMANTIC_MODEL, system_prompt, user_prompt)
    if isinstance(response, dict):
        return response
    return heuristic_semantic_profile(title, content, tags)
