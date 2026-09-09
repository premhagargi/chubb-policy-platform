"""Entity resolution for Copilot questions.

A question like "why is PCL-100219 flagged?" or "what does Kathy King hold?"
names a specific record. The statistical context (aggregates plus the top few
policies by premium) almost never contains that record, so without this step the
model correctly but uselessly answers "the context does not contain it".

This module extracts the entities a question refers to and turns them into
targeted lookups, which the AI service then appends to the context. It is
deliberately a small set of textual heuristics rather than an LLM call: it runs
in microseconds, costs nothing, and a false positive is harmless - it only ever
adds a few extra rows to the prompt.
"""

from __future__ import annotations

import re

#: Policy numbers are formatted `PCL-100219`; the prefix is allowed to vary so a
#: renamed scheme keeps working.
_POLICY_NUMBER = re.compile(r"\b[A-Z]{2,5}-\d{3,10}\b", re.IGNORECASE)

#: Anything the user quoted is, by definition, a term they meant literally.
_QUOTED = re.compile(r"[\"'“‘]([^\"'”’]{2,60})[\"'”’]")

#: Two or three consecutive capitalised words - a person or company name.
_PROPER_NOUN = re.compile(r"\b([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,2})\b")

#: Capitalised words that start sentences or name domain concepts, and would
#: otherwise be mistaken for policyholder names.
_STOPWORDS = frozenset(
    {
        "what",
        "which",
        "who",
        "why",
        "how",
        "when",
        "where",
        "show",
        "list",
        "tell",
        "give",
        "find",
        "the",
        "this",
        "that",
        "these",
        "those",
        "policy",
        "policies",
        "premium",
        "premiums",
        "region",
        "regions",
        "status",
        "flagged",
        "active",
        "expired",
        "pending",
        "cancelled",
        "property",
        "casualty",
        "marine",
        "underwriter",
        "underwriters",
        "portfolio",
        "hong",
        "kong",
        "singapore",
        "australia",
        "japan",
        "thailand",
        "indonesia",
        "malaysia",
        "philippines",
        "line",
        "business",
        "total",
        "count",
        "summary",
        "risk",
        "review",
    }
)

#: Caps on how much lookup work one question can trigger.
MAX_TERMS = 4
MAX_POLICIES = 10


def extract_search_terms(question: str) -> list[str]:
    """Return the literal terms a question appears to reference, most specific first.

    Ordering matters because the caller truncates: a policy number is a far
    stronger signal than a capitalised word pair, so it must not be crowded out.
    """
    terms: list[str] = []

    def add(term: str) -> None:
        cleaned = term.strip()
        if not cleaned:
            return
        # Case-insensitive dedupe; the search itself is case-insensitive too.
        if any(cleaned.casefold() == existing.casefold() for existing in terms):
            return
        terms.append(cleaned)

    for match in _POLICY_NUMBER.findall(question):
        add(match)

    for match in _QUOTED.findall(question):
        add(match)

    for match in _PROPER_NOUN.findall(question):
        # Reject phrases built only from sentence-starters and domain vocabulary,
        # e.g. "Which Property" or "Show Active".
        words = match.split()
        if all(word.casefold() in _STOPWORDS for word in words):
            continue
        # A leading interrogative with one real word ("Which Kathy") still leaves
        # a usable term, so only the fully-stopword case is dropped.
        add(match)

    if not terms:
        # Fallback for all-lowercase conversational input (e.g. "pull up courtney spencer policy for me")
        filler = _STOPWORDS | {
            "can", "you", "please", "pull", "up", "for", "me", "my", "of", "in", "on", "to", "a", "an",
            "is", "are", "am", "be", "do", "does", "did", "have", "has", "had", "will", "would", "shall",
            "should", "could", "may", "might", "must", "about", "at", "by", "from", "with", "i", "need",
            "want", "look", "search", "check", "out", "it", "them", "us", "we", "he", "she", "they",
            "his", "her", "their", "theirs", "mine", "yours", "your", "our", "ours"
        }
        words = [w for w in re.findall(r"\b[a-z]{2,20}\b", question.lower()) if w not in filler]
        if len(words) >= 2:
            # Group remaining words into potential name chunks of up to 3 words
            chunk = " ".join(words[:3])
            if len(chunk) > 3:
                add(chunk)

    return terms[:MAX_TERMS]
