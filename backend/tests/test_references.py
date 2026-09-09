"""Tests for the entity extraction that lets the Copilot answer questions about
a specific policy."""

from __future__ import annotations

from app.application.references import MAX_TERMS, extract_search_terms


def test_policy_number_is_extracted():
    assert extract_search_terms("Why is PCL-100219 flagged?") == ["PCL-100219"]


def test_policy_number_is_case_insensitive():
    assert extract_search_terms("tell me about pcl-100219") == ["pcl-100219"]


def test_policyholder_name_is_extracted():
    assert "Kathy King" in extract_search_terms("What does Kathy King hold?")


def test_quoted_term_is_extracted():
    assert 'Acme Holdings' in extract_search_terms('Show me "Acme Holdings" policies')


def test_policy_number_outranks_a_name():
    """Ordering matters because the caller truncates the list."""
    terms = extract_search_terms("Does PCL-100219 belong to Kathy King?")

    assert terms[0] == "PCL-100219"


def test_generic_questions_produce_no_lookups():
    """A statistical question must not trigger pointless searches."""
    assert extract_search_terms("How many policies are flagged?") == []
    assert extract_search_terms("what is the premium split by region") == []


def test_domain_vocabulary_is_not_mistaken_for_a_name():
    assert extract_search_terms("Which Property policies are Active?") == []


def test_duplicate_terms_are_collapsed():
    terms = extract_search_terms("PCL-100219 and pcl-100219 again")

    assert len(terms) == 1


def test_term_count_is_capped():
    question = " ".join(f"PCL-10000{i}" for i in range(10))

    assert len(extract_search_terms(question)) == MAX_TERMS
