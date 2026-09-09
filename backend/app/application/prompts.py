"""Prompt construction.

All model-facing text lives here rather than being inlined at call sites, so
prompts are reviewable in one place and the mock provider has a stable format to
parse. Each system prompt opens with a `TASK: <NAME>` marker: the real model
ignores it, and the mock uses it to pick a response shape, which keeps the two
providers interchangeable without a second dispatch mechanism.

The grounding rule is the same in every prompt: answer from the supplied
context, and say so when the context does not contain the answer. That is what
keeps these features useful on a real book rather than confidently wrong.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.application.dto import PolicyDto, PolicySummaryDto
from app.application.filters import PolicyFilter

_GROUNDING = (
    "Answer only from the PORTFOLIO CONTEXT supplied below. If the context does not "
    "contain enough information, say so plainly instead of guessing. Never invent "
    "policy numbers, names or figures. Be concise and specific; prefer numbers from "
    "the context over adjectives."
)

COPILOT_SYSTEM = (
    "TASK: COPILOT\n"
    "You are an insurance operations analyst embedded in Chubb's APAC policy "
    "management dashboard. You help underwriting and operations staff with three "
    "kinds of question:\n"
    "1. Details of a specific policy, referenced by policy number or policyholder "
    "name. Records matching terms in the question are supplied under POLICIES "
    "MATCHING TERMS IN THE QUESTION - answer from those.\n"
    "2. Summaries of the set currently in view.\n"
    "3. Statistics - counts, totals and distributions - taken from the aggregates.\n"
    f"{_GROUNDING}\n"
    "If a policy the user named is not present in the context, say it was not found "
    "rather than describing a different one.\n"
    "FORMATTING: reply in concise Markdown. Use `-` bullets for lists, `**bold**` for "
    "the figures and policy numbers that matter, and short paragraphs otherwise. Keep "
    "answers under about 150 words unless more detail is asked for. No headings, no "
    "tables, no code fences."
)

RISK_SYSTEM = (
    "TASK: RISK_ASSESSMENT\n"
    "You are an underwriting risk assessor. Given a single policy's attributes, "
    "assess how much manual review it warrants.\n"
    f"{_GROUNDING}\n"
    "Respond with a single JSON object and nothing else - no prose, no code fence. "
    "Schema:\n"
    '{"riskScore": <integer 0-100>, "riskBand": "Low"|"Medium"|"High", '
    '"factors": [<string>, ...], "recommendation": <string>, '
    '"suggestFlag": <boolean>, "summary": <string>}\n'
    "Base the score on premium size, policy status, proximity to expiry, and whether "
    "an operator has already flagged it. Keep `factors` to at most four entries, each "
    "one sentence."
)

BRIEF_SYSTEM = (
    "TASK: PORTFOLIO_BRIEF\n"
    "You are writing a short executive brief for an insurance operations lead about "
    "the policy portfolio currently in view.\n"
    f"{_GROUNDING}\n"
    "Respond with exactly three Markdown bullets (`-`), each one sentence: (1) the "
    "shape of the book, (2) the most pressing operational risk, (3) a concrete next "
    "action. Use `**bold**` for the figures that matter. No preamble, no heading."
)


# --------------------------------------------------------------------------- #
# Context blocks
# --------------------------------------------------------------------------- #


def describe_scope(request: PolicyFilter) -> str:
    """One-line, human-readable description of the active filter, echoed back to
    the client so the user can see what the answer actually covered."""
    parts: list[str] = []

    if request.status:
        parts.append(f"status={request.status}")
    if request.line_of_business:
        parts.append(f"line of business={request.line_of_business}")
    if request.region:
        parts.append(f"region={request.region}")
    if request.effective_date_from:
        parts.append(f"effective from {request.effective_date_from}")
    if request.effective_date_to:
        parts.append(f"effective to {request.effective_date_to}")
    if request.search:
        parts.append(f'search="{request.search}"')
    if request.flagged is True:
        parts.append("flagged only")
    elif request.flagged is False:
        parts.append("unflagged only")

    return "entire portfolio" if not parts else ", ".join(parts)


def build_portfolio_context(
    summary: PolicySummaryDto,
    sample: list[PolicyDto],
    request: PolicyFilter,
    referenced: list[PolicyDto] | None = None,
) -> str:
    """Compact, token-cheap rendering of the filtered set.

    Aggregates plus a small sample rather than every matching row: the summary
    carries the statistical shape, the sample gives the model concrete records
    to cite, and the payload stays bounded no matter how large the book grows.
    """
    lines = [
        f"Filter in effect: {describe_scope(request)}",
        f"Total policies in scope: {summary.total_count}",
        f"Flagged for review: {summary.flagged_count}",
        f"Expiring within 30 days: {summary.expiring_soon_count}",
    ]

    if summary.counts_by_status:
        lines.append("Count by status: " + _pairs(summary.counts_by_status))
    if summary.counts_by_region:
        lines.append("Count by region: " + _pairs(summary.counts_by_region))
    if summary.premium_by_line_of_business:
        lines.append(
            "Total premium by line of business: "
            + _pairs({k: _money(v) for k, v in summary.premium_by_line_of_business.items()})
        )
    if summary.premium_by_region:
        lines.append(
            "Total premium by region: "
            + _pairs({k: _money(v) for k, v in summary.premium_by_region.items()})
        )

    if sample:
        lines.append("")
        lines.append(f"Sample of {len(sample)} policies from this set (highest premium first):")
        lines.extend(_policy_line(policy) for policy in sample)

    if referenced:
        # Full field detail, not the one-line form: these are the records the
        # question actually asked about, so the model has every attribute it
        # might be asked to quote.
        lines.append("")
        lines.append(
            "POLICIES MATCHING TERMS IN THE QUESTION "
            "(searched across the whole register, so some may fall outside the filter above):"
        )
        for policy in referenced:
            lines.append("")
            lines.append(f"- Policy number: {policy.policy_number}")
            lines.append(f"  Policyholder: {policy.policyholder_name}")
            lines.append(f"  Line of business: {policy.line_of_business}")
            lines.append(f"  Status: {policy.status}")
            lines.append(f"  Premium: {_money(policy.premium_amount)} {policy.currency}")
            lines.append(f"  Region: {policy.region}")
            lines.append(f"  Underwriter: {policy.underwriter}")
            lines.append(f"  Effective date: {policy.effective_date}")
            lines.append(f"  Expiry date: {policy.expiry_date}")
            lines.append(f"  Flagged for review: {policy.flagged_for_review}")

    return "\n".join(lines)


def _policy_line(policy: PolicyDto) -> str:
    return (
        f"- {policy.policy_number} | {policy.policyholder_name} | "
        f"{policy.line_of_business} | {policy.status} | "
        f"{_money(policy.premium_amount)} {policy.currency} | {policy.region} | "
        f"underwriter {policy.underwriter} | expires {policy.expiry_date}"
        + (" | FLAGGED" if policy.flagged_for_review else "")
    )


def build_copilot_user_prompt(question: str, context: str) -> str:
    return f"PORTFOLIO CONTEXT:\n{context}\n\nQUESTION:\n{question.strip()}"


def build_risk_user_prompt(policy: PolicyDto, *, expiring_soon: bool, today: date) -> str:
    lines = [
        f"TODAY: {today.isoformat()}",
        "",
        "POLICY:",
        f"Policy number: {policy.policy_number}",
        f"Policyholder: {policy.policyholder_name}",
        f"Line of business: {policy.line_of_business}",
        f"Status: {policy.status}",
        f"Premium: {_money(policy.premium_amount)} {policy.currency}",
        f"Region: {policy.region}",
        f"Underwriter: {policy.underwriter}",
        f"Effective date: {policy.effective_date}",
        f"Expiry date: {policy.expiry_date}",
        f"Flagged for review: {policy.flagged_for_review}",
    ]

    if expiring_soon:
        lines.append("This policy is expiring within 30 days.")

    return "\n".join(lines)


def build_brief_user_prompt(context: str) -> str:
    return f"PORTFOLIO CONTEXT:\n{context}"


# --------------------------------------------------------------------------- #


def _pairs(values: dict[str, object]) -> str:
    return ", ".join(f"{key} {value}" for key, value in sorted(values.items()))


def _money(value: Decimal | float) -> str:
    return f"{float(value):,.2f}"
