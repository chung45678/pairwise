import pytest

from pairwise.importers.luma import map_headers, parse_luma_csv, split_tags


def test_maps_real_luma_headers(luma_csv):
    report = parse_luma_csv(luma_csv)
    m = report.mapping
    assert m["email"] == "email"
    assert m["role"] == "What program are you in?"
    assert m["affiliation"] == "Which club or team are you part of?"
    assert m["interests"] == "What are your interests? (comma separated)"
    assert m["looking_for"] == "What are you looking for at this event?"
    assert m["can_help_with"] == "What could you help others with?"
    assert "ticket_name" in report.unmapped_headers


def test_skips_declined_missing_and_duplicate(luma_csv):
    report = parse_luma_csv(luma_csv)
    reasons = sorted(s["reason"] for s in report.skipped)
    assert reasons == ["duplicate email", "missing or invalid email", "status is declined"]
    assert [g.email for g in report.guests] == [
        "maya@uwaterloo.ca",
        "jordan@uwaterloo.ca",
        "sam@uwaterloo.ca",
        "quiet@uwaterloo.ca",
    ]


def test_builds_name_and_tags(luma_csv):
    guests = {g.email: g for g in parse_luma_csv(luma_csv).guests}
    assert guests["sam@uwaterloo.ca"].name == "Sam Patel"  # from first + last
    assert guests["jordan@uwaterloo.ca"].interests == ["figma", "user research"]
    assert guests["maya@uwaterloo.ca"].has_intake
    assert not guests["quiet@uwaterloo.ca"].has_intake


def test_school_is_not_affiliation():
    assert "affiliation" not in map_headers(["email", "What school do you go to?"])


def test_requires_email_column():
    with pytest.raises(ValueError, match="email"):
        parse_luma_csv("name,phone\nA,1\n")


def test_split_tags_dedupes_and_caps():
    assert split_tags("AI, ai; Design / design.|Web") == ["AI", "Design", "Web"]
    assert len(split_tags(",".join(str(i) for i in range(20)))) == 10
