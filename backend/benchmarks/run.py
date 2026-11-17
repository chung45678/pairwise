"""Benchmark the matcher against baselines on synthetic events with known ground truth.

    python -m benchmarks.run          # writes docs/BENCHMARK.md and docs/img/benchmark.png

Every synthetic attendee has hidden "wants" and "offers" topics (see
pairwise/synthetic.py). The matcher only sees their text. We then score each
matching against the hidden truth.
"""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from pairwise.matching.scoring import ScoringWeights, build_features, score_matrix
from pairwise.matching.solver import Pair, solve_greedy, solve_random, solve_rounds
from pairwise.synthetic import SyntheticPerson, generate, true_value

ROOT = Path(__file__).resolve().parents[2]
SIZES = [20, 40, 80, 150]
SEEDS = range(10)
K = 2

SOLVERS = {
    "Pairwise (k-round blossom)": lambda s: solve_rounds(s, K),
    "Greedy": lambda s: solve_greedy(s, K),
    "Random": lambda s: solve_random(s, K, seed=0),
}

ABLATIONS = {
    "Default (0.55 / 0.35 / 0.10)": ScoringWeights(),
    "Complement only": ScoringWeights(complement=1, shared=0, diversity=0),
    "Shared interests only": ScoringWeights(complement=0, shared=1, diversity=0),
    "No affiliation penalty": ScoringWeights(same_affiliation_penalty=0),
}


@dataclass
class Result:
    mean_value: float
    hit_rate: float  # share of matches with real complementarity
    worst_best: float  # the worst-off attendee's best match value
    bottom10: float  # mean best-match value of the bottom 10% of attendees
    coverage: float
    ms: float


def evaluate(people: list[SyntheticPerson], pairs: list[Pair], ms: float) -> Result:
    n = len(people)
    values = [true_value(people[p.i], people[p.j]) for p in pairs]
    hits = [
        bool(people[p.i].wants & people[p.j].offers or people[p.j].wants & people[p.i].offers)
        for p in pairs
    ]
    best = np.full(n, -1.0)
    for p, v in zip(pairs, values, strict=True):
        best[p.i] = max(best[p.i], v)
        best[p.j] = max(best[p.j], v)
    covered = best >= 0
    return Result(
        mean_value=float(np.mean(values)) if values else 0.0,
        hit_rate=float(np.mean(hits)) if hits else 0.0,
        worst_best=float(best[covered].min()) if covered.any() else 0.0,
        bottom10=float(np.sort(best)[: max(1, n // 10)].clip(min=0).mean()),
        coverage=float(covered.mean()),
        ms=ms,
    )


def average(results: list[Result]) -> Result:
    return Result(
        *(float(np.mean([getattr(r, f) for r in results])) for f in Result.__dataclass_fields__)
    )


def run_solvers():
    table: dict[tuple[str, int], Result] = {}
    for n in SIZES:
        per = defaultdict(list)
        for seed in SEEDS:
            people = generate(n, seed=seed)
            scores = score_matrix(build_features([p.profile for p in people]))
            for name, solve in SOLVERS.items():
                t0 = time.perf_counter()
                pairs = solve(scores)
                per[name].append(evaluate(people, pairs, (time.perf_counter() - t0) * 1000))
        for name, rs in per.items():
            table[(name, n)] = average(rs)
    return table


def run_ablations(n: int = 80):
    out = {}
    for name, w in ABLATIONS.items():
        rs = []
        for seed in SEEDS:
            people = generate(n, seed=seed)
            scores = score_matrix(build_features([p.profile for p in people]), w)
            rs.append(evaluate(people, solve_rounds(scores, K), 0))
        out[name] = average(rs)
    return out


def ceiling(n: int = 80) -> float:
    """Upper bound: the same solver run on the *true* values instead of predicted scores."""
    vals = []
    for seed in SEEDS:
        people = generate(n, seed=seed)
        truth = np.array(
            [[true_value(a, b) if a is not b else -np.inf for b in people] for a in people]
        )
        vals.append(evaluate(people, solve_rounds(truth, K), 0).mean_value)
    return float(np.mean(vals))


def plot(table, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    colors = {name: c for name, c in zip(SOLVERS, ["#2a78d6", "#eb6834", "#1baf7a"], strict=True)}
    ink, muted, surface = "#0b0b0b", "#52514e", "#fcfcfb"
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2), facecolor=surface)
    panels = [
        ("mean_value", "Average match value (ground truth)"),
        ("bottom10", "Bottom 10% of attendees: value of their best match"),
    ]
    width = 0.26
    x = np.arange(len(SIZES))
    for ax, (field, title) in zip(axes, panels, strict=True):
        ax.set_facecolor(surface)
        for idx, name in enumerate(SOLVERS):
            ys = [getattr(table[(name, n)], field) for n in SIZES]
            ax.bar(
                x + (idx - 1) * width, ys, width - 0.03, color=colors[name], label=name, linewidth=0
            )
        ax.set_xticks(x, [f"{n} people" for n in SIZES], color=muted, fontsize=9)
        ax.tick_params(axis="y", colors=muted, labelsize=9, length=0)
        ax.tick_params(axis="x", length=0)
        ax.set_title(title, color=ink, fontsize=11, loc="left", pad=10)
        ax.grid(axis="y", color="#e4e3df", linewidth=0.8)
        ax.set_axisbelow(True)
        for side in ("top", "right", "left"):
            ax.spines[side].set_visible(False)
        ax.spines["bottom"].set_color("#c9c8c2")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(
        handles,
        labels,
        loc="upper center",
        ncol=3,
        frameon=False,
        fontsize=9,
        labelcolor=ink,
        bbox_to_anchor=(0.5, 1.02),
    )
    fig.tight_layout(rect=(0, 0, 1, 0.92))
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=160, facecolor=surface)


def write_report(table, ablations, top: float, path: Path) -> None:
    lines = [
        "# Benchmark",
        "",
        "> Generated by `python -m benchmarks.run`. Do not edit by hand.",
        "",
        "Synthetic events where every attendee has hidden *wants* and *offers* topics. The "
        "matcher only sees the text they'd type, written with different wording for wanting "
        "and offering, so it has to bridge vocabulary. Each matching is then scored against "
        f"the hidden truth. {len(SEEDS)} random events per size, k = {K} matches per person.",
        "",
        "![benchmark](img/benchmark.png)",
        "",
        "## Solvers",
        "",
        "| Event size | Solver | Avg match value | Real complement hit rate | "
        "Bottom 10% best match | Worst-off best match | Coverage | Time |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for n in SIZES:
        for name in SOLVERS:
            r = table[(name, n)]
            lines.append(
                f"| {n} | {name} | {r.mean_value:.2f} | {r.hit_rate:.0%} | "
                f"{r.bottom10:.2f} | {r.worst_best:.2f} | {r.coverage:.0%} | {r.ms:.0f} ms |"
            )
    ours = table[(next(iter(SOLVERS)), 80)]
    greedy = table[("Greedy", 80)]
    rand = table[("Random", 80)]
    lines += [
        "",
        "**What this shows (80 people):**",
        "",
        f"- **vs random:** {ours.mean_value / rand.mean_value:.1f}x the match value, and "
        f"{ours.hit_rate:.0%} of matches have real complementarity vs {rand.hit_rate:.0%}.",
        f"- **vs greedy:** about the same on average ({ours.mean_value:.2f} vs "
        f"{greedy.mean_value:.2f}), but the bottom 10% of attendees get better matches "
        f"({ours.bottom10:.2f} vs {greedy.bottom10:.2f}, "
        f"{ours.bottom10 / max(greedy.bottom10, 1e-9):.1f}x). Greedy hands the best edges to "
        "whoever is most matchable and leaves the leftovers with each other. Round-based "
        "matching spreads good matches across everyone. For an event, that's the whole point: "
        "the person who already knows the room doesn't need the tool.",
        "- **Trade-off:** the round-based solver is O(k·n³). It's well under a second at 80 "
        "people and about 2 s at 150. Fine for club events, but past roughly 300 people "
        "it's time to switch to greedy plus local search.",
        "",
        f"**Ceiling:** running the same solver on the *true* values scores "
        f"{top:.2f} at 80 people. Pairwise reaches {ours.mean_value / top:.0%} of that "
        "from text alone.",
        "",
        "## Scoring ablation (80 people)",
        "",
        "| Weights | Avg match value | Real complement hit rate | Bottom 10% best match |",
        "|---|---|---|---|",
    ]
    for name, r in ablations.items():
        lines.append(f"| {name} | {r.mean_value:.2f} | {r.hit_rate:.0%} | {r.bottom10:.2f} |")
    comp = ablations["Complement only"]
    default = ablations[next(iter(ABLATIONS))]
    lines += [
        "",
        f"Scoring on complementarity alone gives the highest hit rate ({comp.hit_rate:.0%}) "
        f"but the bottom 10% fall to {comp.bottom10:.2f} (default weights: "
        f"{default.bottom10:.2f}). People whose needs nobody covers get nothing to talk about. "
        "Shared interests are the safety net, which is why the default blends both.",
        "",
        "## Caveats",
        "",
        "- Synthetic data rewards what the generator encodes. The live event test "
        "([LIVE_TEST.md](LIVE_TEST.md)) is the real check.",
        "- The ground-truth weighting (complement = 1, shared topic or hobby = 0.25) is a "
        "modeling choice, the same bet the scoring weights make.",
        "- Turning off the same-affiliation penalty scores slightly *higher* here, because the "
        "generator doesn't model teammates who already know each other. The penalty exists "
        "for real events, and the live test should confirm it earns its place.",
        "",
    ]
    path.write_text("\n".join(lines))


def main() -> None:
    table = run_solvers()
    ablations = run_ablations()
    top = ceiling()
    plot(table, ROOT / "docs" / "img" / "benchmark.png")
    write_report(table, ablations, top, ROOT / "docs" / "BENCHMARK.md")
    print((ROOT / "docs" / "BENCHMARK.md").read_text())


if __name__ == "__main__":
    main()
