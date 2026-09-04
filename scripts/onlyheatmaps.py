#!/usr/bin/env python3
"""Fetch SofaScore season heatmaps for all mapped Série A players.

Example (VS Code terminal):
  python3 -u scripts/onlyheatmaps.py \\
    --url "https://www.sofascore.com/football/tournament/brazil/brasileirao-serie-a/325#id:87678" \\
    --output-dir "./HeatmapsBR26" \\
    --resume \\
    --rate-limit 5.0 \\
    --png

After a successful run, sync into the site:
  python3 scripts/build_site_data.py
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from engine.load_data import load_players_dataframe
from engine.measures import attach_base_measures
from engine.sofascore_heatmap import (
    DEFAULT_TOURNAMENT_ID,
    build_sofascore_player_map,
    fetch_api_json,
    fetch_player_season_heatmap,
    pick_season_entry,
    write_heatmap_index,
)

STATE_FILE = ".onlyheatmaps_state.json"
DEFAULT_URL = "https://www.sofascore.com/football/tournament/brazil/brasileirao-serie-a/325#id:87678"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch SofaScore season heatmaps (onlyheatmaps).")
    parser.add_argument("--url", default=DEFAULT_URL, help="SofaScore tournament URL with #id:<seasonId>")
    parser.add_argument("--output-dir", type=Path, default=Path("./HeatmapsBR26"), help="Directory for JSON/PNG output")
    parser.add_argument("--tournament-id", type=int, default=None, help="Override tournament id parsed from --url")
    parser.add_argument("--season-id", type=int, default=None, help="Override season id parsed from --url")
    parser.add_argument("--season-hint", default="2026", help="Season name hint when --season-id omitted")
    parser.add_argument("--scope", default="overall", choices=["overall", "home", "away"])
    parser.add_argument("--csv", type=Path, default=ROOT / "BR26_defensive.csv", help="SofaScore export used for player id mapping")
    parser.add_argument("--rate-limit", type=float, default=5.0, help="Seconds to wait between API calls")
    parser.add_argument("--resume", action="store_true", help="Skip players already saved in output dir")
    parser.add_argument("--png", action="store_true", help="Also save PNG preview per player")
    parser.add_argument("--limit", type=int, default=None, help="Max players to fetch")
    parser.add_argument(
        "--sync-site",
        action="store_true",
        help="Also copy JSON files into data/heatmaps/ for build_site_data.py",
    )
    parser.add_argument(
        "--consolidated-only",
        action="store_true",
        help="Only write per-player JSON + index/manifest (no extra debug artifacts)",
    )
    return parser.parse_args()


def parse_tournament_url(url: str) -> tuple[int, int | None]:
    """Extract tournament id from path and season id from #id: fragment."""
    hash_part = ""
    if "#" in url:
        path_part, hash_part = url.split("#", 1)
    else:
        path_part = url

    tournament_match = re.search(r"/(\d+)/?$", path_part.rstrip("/"))
    if not tournament_match:
        raise ValueError(f"Could not parse tournament id from URL: {url}")
    tournament_id = int(tournament_match.group(1))

    season_id = None
    season_match = re.search(r"id:(\d+)", hash_part)
    if season_match:
        season_id = int(season_match.group(1))
    return tournament_id, season_id


def load_state(out_dir: Path) -> dict[str, Any]:
    path = out_dir / STATE_FILE
    if not path.exists():
        return {"completed": [], "failed": {}, "started_at": None}
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(out_dir: Path, state: dict[str, Any]) -> None:
    path = out_dir / STATE_FILE
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def is_valid_heatmap(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    points = data.get("points") or []
    return isinstance(points, list) and len(points) > 0


def save_player_files(
    out_dir: Path,
    site_id: str,
    payload: dict[str, Any],
    *,
    save_png: bool,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / f"{site_id}.json"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if save_png:
        maybe_save_png(payload, json_path)


def maybe_save_png(payload: dict[str, Any], json_path: Path) -> None:
    try:
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        print("  [warn] matplotlib not installed; skipping PNG")
        return

    pts = payload.get("points") or []
    if not pts:
        return

    xs = [p["x"] for p in pts]
    ys = [p["y"] for p in pts]
    fig, ax = plt.subplots(figsize=(6.8, 4.4), facecolor="#0f172a")
    ax.set_facecolor("#14532d")
    ax.scatter(xs, ys, s=8, c="#f97316", alpha=0.25, linewidths=0)
    try:
        from scipy.stats import gaussian_kde

        if len(pts) >= 20:
            kde = gaussian_kde([xs, ys])
            gx, gy = np.mgrid[0:100:120j, 0:100:78j]
            positions = np.vstack([gx.ravel(), gy.ravel()])
            z = np.reshape(kde(positions), gx.shape)
            ax.imshow(np.rot90(z), cmap="hot", alpha=0.55, extent=[0, 100, 0, 100], aspect="auto")
    except Exception:
        pass
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)
    fig.savefig(json_path.with_suffix(".png"), dpi=120, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def write_manifest(out_dir: Path, *, tournament_id: int, season_id: int, scope: str, stats: dict[str, int]) -> None:
    manifest = {
        "tool": "onlyheatmaps",
        "tournament_id": tournament_id,
        "season_id": season_id,
        "scope": scope,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": stats,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def write_index(out_dir: Path) -> None:
    entries = []
    for path in sorted(out_dir.glob("*.json")):
        if path.name in {STATE_FILE, "index.json", "manifest.json"}:
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        entries.append(
            {
                "player_id": path.stem,
                "sofascore_player_id": data.get("sofascore_player_id"),
                "sofascore_name": data.get("sofascore_name"),
                "point_count": data.get("point_count", len(data.get("points", []))),
                "competition": data.get("competition"),
            }
        )
    (out_dir / "index.json").write_text(
        json.dumps({"heatmaps": entries, "total": len(entries)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def sync_to_site(out_dir: Path) -> int:
    site_dir = ROOT / "data" / "heatmaps"
    site_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for path in sorted(out_dir.glob("*.json")):
        if path.name in {STATE_FILE, "index.json", "manifest.json"}:
            continue
        target = site_dir / path.name
        target.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        png = path.with_suffix(".png")
        if png.exists():
            (site_dir / png.name).write_bytes(png.read_bytes())
        copied += 1
    write_heatmap_index(site_dir)
    return copied


def resolve_season(
    *,
    tournament_id: int,
    season_id: int | None,
    season_hint: str,
    sample_sofascore_id: int,
) -> tuple[int, str | None]:
    if season_id:
        return season_id, "Brasileirão Série A"
    seasons_payload = fetch_api_json(f"player/{sample_sofascore_id}/statistics/seasons")
    picked = pick_season_entry(seasons_payload, tournament_id, season_hint=season_hint)
    if not picked:
        raise RuntimeError(f"Season not found for tournament={tournament_id} hint={season_hint!r}")
    print(f"Auto season: {picked['season_name']} (id={picked['season_id']})")
    return int(picked["season_id"]), picked.get("tournament_name")


def main() -> None:
    args = parse_args()
    out_dir = args.output_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    parsed_tid, parsed_sid = parse_tournament_url(args.url)
    tournament_id = args.tournament_id or parsed_tid or DEFAULT_TOURNAMENT_ID
    season_id = args.season_id or parsed_sid

    print(f"Tournament id: {tournament_id}")
    print(f"Season id: {season_id or '(auto)'}")
    print(f"Output dir: {out_dir}")
    if os.environ.get("SOFASCORE_PROXY"):
        print("Proxy: SOFASCORE_PROXY set")

    raw = load_players_dataframe()
    df = attach_base_measures(raw)
    df = df[df["Posição"] != "Goleiro"].copy()
    mapping = build_sofascore_player_map(df, csv_path=args.csv)
    print(f"Mapped players: {len(mapping)}")

    targets = list(mapping.items())
    if args.limit:
        targets = targets[: args.limit]

    state = load_state(out_dir)
    if not state.get("started_at"):
        state["started_at"] = datetime.now(timezone.utc).isoformat()
    state.setdefault("completed", [])
    state.setdefault("failed", {})
    completed_set = set(state["completed"])

    if not targets:
        raise SystemExit("No mapped players found. Check BR26_defensive.csv and site player data.")

    sample_ss_id = int(next(iter(mapping.values()))["sofascore_player_id"])
    competition_name = None
    if not season_id:
        season_id, competition_name = resolve_season(
            tournament_id=tournament_id,
            season_id=None,
            season_hint=args.season_hint,
            sample_sofascore_id=sample_ss_id,
        )
    else:
        competition_name = "Brasileirão Série A"

    state["tournament_id"] = tournament_id
    state["season_id"] = season_id
    save_state(out_dir, state)

    ok = 0
    skipped = 0
    fail = 0

    for idx, (site_id, meta) in enumerate(targets, start=1):
        ss_id = int(meta["sofascore_player_id"])
        json_path = out_dir / f"{site_id}.json"

        if args.resume and is_valid_heatmap(json_path):
            skipped += 1
            if site_id not in completed_set:
                state["completed"].append(site_id)
            print(f"[{idx}/{len(targets)}] SKIP {site_id} ({ss_id}) — already saved")
            continue

        try:
            payload = fetch_player_season_heatmap(
                ss_id,
                tournament_id,
                int(season_id),
                scope=args.scope,
            )
            payload.update(
                {
                    "player_id": site_id,
                    "sofascore_name": meta.get("sofascore_name"),
                    "sofascore_team": meta.get("sofascore_team"),
                    "competition": competition_name,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            save_player_files(out_dir, site_id, payload, save_png=args.png)
            ok += 1
            state["completed"].append(site_id)
            state["failed"].pop(site_id, None)
            print(f"[{idx}/{len(targets)}] OK {site_id} ({ss_id}) → {payload['point_count']} points")
        except Exception as exc:
            fail += 1
            state["failed"][site_id] = str(exc)
            print(f"[{idx}/{len(targets)}] FAIL {site_id} ({ss_id}): {exc}")

        save_state(out_dir, state)
        if idx < len(targets) and args.rate_limit > 0:
            time.sleep(args.rate_limit)

    write_index(out_dir)
    write_manifest(
        out_dir,
        tournament_id=tournament_id,
        season_id=int(season_id),
        scope=args.scope,
        stats={"ok": ok, "skipped": skipped, "failed": fail, "total_targets": len(targets)},
    )

    if args.sync_site:
        copied = sync_to_site(out_dir)
        print(f"Synced {copied} heatmaps → {ROOT / 'data' / 'heatmaps'}")

    print(f"Done: {ok} saved, {skipped} skipped, {fail} failed")
    if fail:
        print(f"Failed players logged in {out_dir / STATE_FILE}")


if __name__ == "__main__":
    main()
