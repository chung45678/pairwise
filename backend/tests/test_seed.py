from pairwise import seed as seed_mod


def test_seed_can_run_twice(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'demo.db'}")
    first = seed_mod.seed(8, "http://x", with_feedback=False)
    second = seed_mod.seed(8, "http://x", with_feedback=False)
    assert first["admin"] != second["admin"]
