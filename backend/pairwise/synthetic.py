"""Synthetic attendees with known ground truth, for the benchmark, tests and demo seed.

Each fake attendee has hidden `wants` and `offers` topics. Their visible text is
generated from those topics using *different* phrasings for wanting and offering
("advice on breaking into PM" vs "product management, PRDs"), so the matcher has
to bridge vocabulary the way it would with real people. Because we know the
hidden topics, we can score any matching against the truth.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from pairwise.matching.profile import Profile

TOPICS: dict[str, dict[str, list[str]]] = {
    "pm": {
        "want": [
            "advice on breaking into product management",
            "how to write a good PRD",
            "learning product management and roadmapping",
        ],
        "offer": [
            "product management, writing PRDs",
            "roadmapping and prioritization",
            "product management interviews",
        ],
        "tags": ["product management", "product strategy"],
    },
    "design": {
        "want": [
            "design feedback on my portfolio",
            "someone to critique my UX design",
            "learning Figma and UX design",
        ],
        "offer": [
            "UX design, Figma, portfolio reviews",
            "design feedback and UX critique",
            "Figma prototyping",
        ],
        "tags": ["ux design", "figma"],
    },
    "frontend": {
        "want": [
            "help learning React and frontend development",
            "frontend mentor for my side project",
        ],
        "offer": ["React, TypeScript and frontend development", "frontend code reviews"],
        "tags": ["web dev", "react"],
    },
    "backend": {
        "want": ["someone who knows backend APIs and databases", "help designing a database"],
        "offer": ["backend APIs, Python, databases", "system design and backend architecture"],
        "tags": ["backend", "python"],
    },
    "ml": {
        "want": [
            "getting started with machine learning",
            "feedback on my machine learning project",
        ],
        "offer": ["machine learning, PyTorch, model training", "applied machine learning projects"],
        "tags": ["machine learning", "ai"],
    },
    "data": {
        "want": ["learning SQL and data analysis", "help building dashboards"],
        "offer": ["SQL, data analysis, dashboards", "analytics and data visualization"],
        "tags": ["data science", "analytics"],
    },
    "startups": {
        "want": [
            "advice on fundraising for my startup",
            "practice pitching to investors",
            "a cofounder for a startup idea",
        ],
        "offer": ["fundraising and pitching to investors", "startup founding experience"],
        "tags": ["startups", "entrepreneurship"],
    },
    "coop": {
        "want": ["resume feedback before co-op apps", "co-op interview prep"],
        "offer": ["resume reviews and co-op interview prep", "co-op recruiting tips"],
        "tags": ["co-op", "careers"],
    },
    "growth": {
        "want": ["growing an audience on TikTok", "learning growth marketing"],
        "offer": [
            "growth marketing and TikTok content",
            "content strategy and social media growth",
        ],
        "tags": ["marketing", "content creation"],
    },
    "finance": {
        "want": ["breaking into investment banking", "learning financial modeling"],
        "offer": [
            "investment banking recruiting, financial modeling",
            "valuation and finance case prep",
        ],
        "tags": ["finance", "fintech"],
    },
    "research": {
        "want": ["finding an undergrad research supervisor", "how to get into research"],
        "offer": ["undergrad research experience, reading papers", "research lab applications"],
        "tags": ["research", "academia"],
    },
}

ROLES: dict[str, list[str]] = {
    "Product Manager": ["pm", "coop", "growth"],
    "Designer": ["design", "frontend"],
    "Software Engineer": ["frontend", "backend", "coop"],
    "ML Engineer": ["ml", "backend", "research"],
    "Data Scientist": ["data", "ml"],
    "Founder": ["startups", "growth", "pm"],
    "Finance Student": ["finance", "data"],
    "Researcher": ["research", "ml"],
}

HOBBIES = [
    "basketball",
    "piano",
    "photography",
    "climbing",
    "chess",
    "cooking",
    "hiking",
    "anime",
    "running",
    "film",
]
CLUBS = ["Blueprint", "UW PM", "UW Data Science", "Velocity", "WATonomous", "Hack the North"]
FIRST = [
    "Maya",
    "Jordan",
    "Sam",
    "Ava",
    "Leo",
    "Priya",
    "Ethan",
    "Chloe",
    "Noah",
    "Zara",
    "Kai",
    "Ivy",
    "Owen",
    "Nina",
    "Ryan",
    "Lena",
    "Arjun",
    "Mia",
    "Lucas",
    "Hana",
    "Ben",
    "Sofia",
    "Daniel",
    "Aisha",
    "Theo",
    "Grace",
    "Marcus",
    "Elena",
    "Jun",
    "Ruby",
]
LAST = [
    "Chen",
    "Lee",
    "Patel",
    "Kim",
    "Nguyen",
    "Singh",
    "Wong",
    "Garcia",
    "Brown",
    "Ali",
    "Zhang",
    "Martin",
    "Shah",
    "Park",
    "Liu",
    "Tran",
    "Wilson",
    "Khan",
    "Lopez",
    "Ito",
]


@dataclass(frozen=True)
class SyntheticPerson:
    profile: Profile
    email: str
    wants: frozenset[str]
    offers: frozenset[str]
    hobbies: frozenset[str]


def generate(n: int, seed: int = 0, empty_rate: float = 0.05) -> list[SyntheticPerson]:
    rng = random.Random(seed)
    people = []
    for i in range(n):
        role = rng.choice(list(ROLES))
        offers = set(rng.sample(ROLES[role], k=rng.choice([1, 2])))
        want_pool = [t for t in TOPICS if t not in offers]
        wants = set(rng.sample(want_pool, k=rng.choice([1, 2])))
        hobbies = set(rng.sample(HOBBIES, k=rng.choice([0, 1, 2])))

        tags = [rng.choice(TOPICS[t]["tags"]) for t in sorted(offers | wants)] + sorted(hobbies)
        rng.shuffle(tags)
        looking = "; ".join(rng.choice(TOPICS[t]["want"]) for t in sorted(wants))
        helping = "; ".join(rng.choice(TOPICS[t]["offer"]) for t in sorted(offers))
        if rng.random() < empty_rate:  # some people skip the free-text fields
            looking = ""

        first, last = rng.choice(FIRST), rng.choice(LAST)
        profile = Profile(
            id=i + 1,
            name=f"{first} {last}",
            role=role,
            affiliation=rng.choice(CLUBS) if rng.random() < 0.6 else "",
            interests=tuple(dict.fromkeys(tags)),
            looking_for=looking,
            can_help_with=helping,
        )
        people.append(
            SyntheticPerson(
                profile=profile,
                email=f"{first}.{last}.{i}@example.com".lower(),
                wants=frozenset(wants),
                offers=frozenset(offers),
                hobbies=frozenset(hobbies),
            )
        )
    return people


def true_value(a: SyntheticPerson, b: SyntheticPerson) -> float:
    """Ground-truth value of a pair: real complementarity first, shared hobbies second."""
    complement = len(a.wants & b.offers) + len(b.wants & a.offers)
    shared = len((a.wants | a.offers) & (b.wants | b.offers)) + len(a.hobbies & b.hobbies)
    return complement + 0.25 * shared
