#!/usr/bin/env python3
"""Coleta estatísticas defensivas e duelos por jogador/jogo (SofaScore).

Usa tacoscore para parsear modelos, mas as requisições HTTP passam pelo Chromium
(Playwright) quando a Akamai bloqueia curl_cffi com HTTP 403.

Dependências:
  pip install tacoscore curl_cffi pandas playwright
  python -m playwright install chromium

Exemplo (Windows — se der 403 "challenge", use Chrome visível):
  python -u allmatch/fetch_defensive_league.py ^
    --url "https://www.sofascore.com/football/tournament/brazil/brasileirao-serie-c/1281#id:90642" ^
    --output ./BRC26_Defensive/BRC26_defensive.csv ^
    --channel chrome --headed --warmup-wait 20 ^
    --resume --rate-limit 5.0
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

# Colunas defensivas + duelos (box score SofaScore)
DEFENSIVE_STAT_COLUMNS = [
    "total_tackle",
    "won_tackle",
    "interception_won",
    "total_clearance",
    "outfielder_block",
    "ball_recovery",
    "clearance_off_line",
    "last_man_tackle",
    "error_lead_to_a_shot",
    "error_lead_to_a_goal",
    "challenge_lost",
    "duel_won",
    "duel_lost",
    "aerial_won",
    "aerial_lost",
]

API_ROOT = "https://www.sofascore.com/api/v1"

STEALTH_INIT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {} };
Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
"""


def log(msg: str = "") -> None:
    print(msg, flush=True)


def parse_tournament_url(url: str) -> tuple[int, int]:
    url = url.strip()
    if "#id:" not in url:
        raise ValueError(
            "URL precisa do fragmento da temporada, ex.: "
            ".../serie-a/325#id:87678"
        )
    path_part, frag = url.split("#id:", 1)
    season_id = int(frag.split("&")[0].split("/")[0].strip())
    path_clean = path_part.rstrip("/").split("?")[0]
    match = re.search(r"/(\d+)$", path_clean)
    if not match:
        raise ValueError(f"Não encontrei tournament id em: {path_part}")
    return int(match.group(1)), season_id


def tournament_page_url(url: str) -> str:
    """URL da página da liga (sem #id), para warm-up Akamai."""
    return url.strip().split("#")[0].split("?")[0]


def resolve_proxy(explicit: str | None) -> str | None:
    return (
        explicit
        or os.environ.get("TACOSCORE_PROXY")
        or os.environ.get("SOFASCORE_PROXY")
        or os.environ.get("HTTPS_PROXY")
        or os.environ.get("HTTP_PROXY")
    )


def proxy_dict(proxy_url: str | None) -> dict[str, str] | None:
    if not proxy_url:
        return None
    return {"https": proxy_url, "http": proxy_url}


def playwright_proxy_settings(proxy_url: str | None) -> dict[str, str] | None:
    if not proxy_url:
        return None
    parsed = urlparse(proxy_url)
    if not parsed.hostname:
        return {"server": proxy_url}
    scheme = parsed.scheme or "http"
    port = parsed.port or (443 if scheme == "https" else 80)
    server = f"{scheme}://{parsed.hostname}:{port}"
    out: dict[str, str] = {"server": server}
    if parsed.username:
        out["username"] = parsed.username
    if parsed.password:
        out["password"] = parsed.password
    return out


class BrowserSofascoreHttp:
    """GET na API SofaScore usando fetch dentro da aba (mesmos cookies da sessão)."""

    def __init__(
        self,
        *,
        proxy_url: str | None = None,
        headless: bool = True,
        channel: str | None = None,
        warmup_url: str | None = None,
        warmup_wait_ms: int = 8000,
        storage_state: Path | None = None,
        user_data_dir: Path | None = None,
        get_retries: int = 8,
        get_retry_delay_s: float = 2.5,
    ) -> None:
        from playwright.sync_api import sync_playwright

        self._get_retries = max(1, get_retries)
        self._get_retry_delay_s = get_retry_delay_s
        self._storage_state_path = storage_state
        self._pw = sync_playwright().start()
        self._owns_browser = True

        launch_args = ["--disable-blink-features=AutomationControlled"]
        pw_proxy = playwright_proxy_settings(proxy_url)

        context_kwargs: dict[str, Any] = {
            "locale": "pt-BR",
            "viewport": {"width": 1366, "height": 768},
        }
        if storage_state and storage_state.is_file():
            context_kwargs["storage_state"] = str(storage_state)
        # Com --channel chrome, deixe o UA nativo do Chrome (menos sinal de bot).
        if not channel:
            context_kwargs["user_agent"] = (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            )

        if user_data_dir:
            user_data_dir.mkdir(parents=True, exist_ok=True)
            persistent_kwargs: dict[str, Any] = {
                "headless": headless,
                "args": launch_args,
                "locale": context_kwargs.get("locale", "pt-BR"),
                "viewport": context_kwargs["viewport"],
            }
            if channel:
                persistent_kwargs["channel"] = channel
            if pw_proxy:
                persistent_kwargs["proxy"] = pw_proxy
            if "user_agent" in context_kwargs:
                persistent_kwargs["user_agent"] = context_kwargs["user_agent"]
            try:
                self._ctx = self._pw.chromium.launch_persistent_context(
                    str(user_data_dir),
                    **persistent_kwargs,
                )
            except Exception as exc:
                self._pw.stop()
                raise self._launch_error(exc) from exc
            self._browser = None
            self._page = self._ctx.pages[0] if self._ctx.pages else self._ctx.new_page()
        else:
            launch_kwargs: dict[str, Any] = {
                "headless": headless,
                "args": launch_args,
            }
            if channel:
                launch_kwargs["channel"] = channel
            if pw_proxy:
                launch_kwargs["proxy"] = pw_proxy
            try:
                self._browser = self._pw.chromium.launch(**launch_kwargs)
            except Exception as exc:
                self._pw.stop()
                raise self._launch_error(exc) from exc
            self._ctx = self._browser.new_context(**context_kwargs)
            self._page = self._ctx.new_page()

        self._ctx.add_init_script(STEALTH_INIT)
        self._warmup(warmup_url, warmup_wait_ms)

    @staticmethod
    def _launch_error(exc: Exception) -> RuntimeError:
        hint = (
            "Navegador do Playwright indisponível. Rode:\n"
            "  python -m playwright install chromium\n"
            "Ou use Chrome instalado no PC:\n"
            "  --channel chrome --headed"
        )
        return RuntimeError(f"{exc}\n\n{hint}")

    def _warmup(self, warmup_url: str | None, warmup_wait_ms: int) -> None:
        log("Warm-up: abrindo SofaScore …")
        self._page.goto(
            "https://www.sofascore.com/",
            wait_until="domcontentloaded",
            timeout=90_000,
        )
        self._page.wait_for_timeout(min(4000, warmup_wait_ms))

        if warmup_url:
            log(f"Warm-up: página da liga → {warmup_url}")
            self._page.goto(warmup_url, wait_until="domcontentloaded", timeout=90_000)
            try:
                self._page.wait_for_load_state("networkidle", timeout=25_000)
            except Exception:
                pass
            self._page.wait_for_timeout(warmup_wait_ms)

        # Tenta “acordar” cookies Akamai antes da coleta.
        probe = f"{API_ROOT}/config/default-unique-tournaments/BR/top"
        for attempt in range(1, 4):
            if self._fetch_once(probe)[0] == 200:
                log("Warm-up: sessão API OK.")
                return
            log(f"Warm-up: API ainda bloqueada (tentativa {attempt}/3), aguardando …")
            self._page.wait_for_timeout(int(warmup_wait_ms * 0.75))

    def _fetch_once(self, url: str) -> tuple[int, str]:
        payload = self._page.evaluate(
            """async (url) => {
                const res = await fetch(url, {
                    credentials: "include",
                    headers: {
                        accept: "application/json, text/plain, */*",
                        "x-requested-with": "XMLHttpRequest",
                    },
                });
                return { status: res.status, text: await res.text() };
            }""",
            url,
        )
        return int(payload["status"]), str(payload["text"])

    def _is_challenge_response(self, status: int, text: str) -> bool:
        if status != 403:
            return False
        return "challenge" in text.lower() or '"reason"' in text

    def get(self, path: str) -> dict[str, Any]:
        url = f"{API_ROOT}/{path.lstrip('/')}"
        last_status = 0
        last_text = ""

        for attempt in range(1, self._get_retries + 1):
            status, text = self._fetch_once(url)
            last_status, last_text = status, text
            if status == 200:
                data = json.loads(text)
                if not isinstance(data, dict):
                    raise RuntimeError(f"Resposta inesperada (não é objeto JSON) em {url}")
                return data

            if self._is_challenge_response(status, text) and attempt < self._get_retries:
                log(
                    f"  Akamai challenge em {path} "
                    f"({attempt}/{self._get_retries}) — aguardando {self._get_retry_delay_s}s …"
                )
                self._page.wait_for_timeout(int(self._get_retry_delay_s * 1000))
                continue

            break

        # Fallback: navegação direta (como colar a URL na barra do Chrome).
        nav = self._page.goto(url, wait_until="domcontentloaded", timeout=90_000)
        nav_status = nav.status if nav else 0
        if nav_status == 200:
            body = self._page.locator("body").inner_text().strip()
            data = json.loads(body)
            if isinstance(data, dict):
                return data

        hint = (
            "\n\nAkamai ainda bloqueou (403 challenge). Tente:\n"
            "  1) python -m playwright install chromium\n"
            "  2) Rode com Chrome real e janela visível:\n"
            '     --channel chrome --headed --warmup-wait 25000\n'
            "  3) Salve cookies após abrir o site manualmente uma vez:\n"
            "     --save-storage ./sofascore_state.json\n"
            "     (depois use --load-storage ./sofascore_state.json)\n"
            "  4) Perfil persistente:\n"
            "     --user-data-dir ./pw_sofascore_profile"
        )
        raise RuntimeError(
            f"HTTP {last_status} (fetch) / {nav_status} (goto) em {url}: "
            f"{last_text[:300]}{hint}"
        )

    def save_storage_state(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._ctx.storage_state(path=str(path))
        log(f"Sessão salva em {path.resolve()}")

    def close(self) -> None:
        if self._storage_state_path and self._storage_state_path.parent.exists():
            try:
                self.save_storage_state(self._storage_state_path)
            except Exception:
                pass
        self._ctx.close()
        if self._browser is not None:
            self._browser.close()
        self._pw.stop()


def patch_tacoscore_client(client: Any, browser_http: BrowserSofascoreHttp) -> None:
    """Substitui client._http.get pelo fetch via browser."""
    client._http.get = browser_http.get  # type: ignore[method-assign]


def list_finished_matches(client: Any, tournament_id: int, season_id: int) -> list[Any]:
    by_round = client.season_events(tournament_id, season_id)
    matches: list[Any] = []
    seen: set[int] = set()
    for match_list in by_round.values():
        for summary in match_list.events:
            if summary.event_id in seen:
                continue
            seen.add(summary.event_id)
            if summary.is_finished and summary.has_player_statistics:
                matches.append(summary)
    matches.sort(key=lambda m: m.start_timestamp)
    return matches


def fetch_match_defensive_rows(client: Any, event_id: int) -> list[dict[str, Any]]:
    """Duas chamadas por jogo: event + lineups."""
    event_detail = client.event(event_id)
    lineups = client.event_lineups(event_id)
    summary = event_detail.summary

    meta = {
        "event_id": event_id,
        "match_date": summary.start_timestamp.isoformat(),
        "home_team": summary.home_team.name,
        "away_team": summary.away_team.name,
    }

    rows: list[dict[str, Any]] = []
    for side_name, side in [("home", lineups.home), ("away", lineups.away)]:
        for entry in side.players:
            stats = entry.statistics
            row: dict[str, Any] = {
                **meta,
                "player_id": entry.player.id,
                "player_name": entry.player.name,
                "position": entry.position_match or entry.player.position or "",
                "shirt_number": entry.shirt_number,
                "is_home": side_name == "home",
                "side": side_name,
                "minutes_played": stats.minutes_played,
            }
            for col in DEFENSIVE_STAT_COLUMNS:
                row[col] = getattr(stats, col, 0)
            rows.append(row)
    return rows


def run_collection(
    client: Any,
    tournament_id: int,
    season_id: int,
    out_path: Path,
    *,
    resume: bool,
    limit: int | None,
    rate_limit: float,
) -> int:
    import pandas as pd

    done_path = out_path.with_suffix(".done.json")

    log(f"Listando jogos · tournament={tournament_id} season={season_id} …")
    matches = list_finished_matches(client, tournament_id, season_id)
    if limit:
        matches = matches[:limit]
    log(f"Encontrados {len(matches)} jogos finalizados com stats de jogador.")

    done: set[int] = set()
    if resume and done_path.exists():
        done = set(json.loads(done_path.read_text(encoding="utf-8")))

    all_rows: list[dict[str, Any]] = []
    if resume and out_path.exists():
        existing = pd.read_csv(out_path)
        all_rows = existing.to_dict("records")
        log(f"Resume: {len(all_rows)} linhas já no CSV.")

    for i, match in enumerate(matches, 1):
        event_id = match.event_id
        label = f"{match.home_team.name} {match.display_score} {match.away_team.name}"
        if event_id in done:
            log(f"[{i}/{len(matches)}] SKIP {event_id} · {label}")
            continue

        log(f"[{i}/{len(matches)}] {event_id} · {label}")
        try:
            rows = fetch_match_defensive_rows(client, event_id)
            all_rows.extend(rows)
            done.add(event_id)
            done_path.write_text(json.dumps(sorted(done), indent=2), encoding="utf-8")

            tackles = sum(int(r.get("total_tackle") or 0) for r in rows)
            log(f"  → {len(rows)} jogadores · {tackles} desarmes no jogo")

            pd.DataFrame(all_rows).to_csv(out_path, index=False)
        except Exception as exc:
            log(f"  ERRO: {type(exc).__name__}: {exc}")
            time.sleep(max(2.0, rate_limit))

        if rate_limit > 0:
            time.sleep(rate_limit)

    log(f"\nConcluído · {len(all_rows)} linhas → {out_path.resolve()}")
    log(f"Colunas defensivas: {', '.join(DEFENSIVE_STAT_COLUMNS)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Coleta defesa + duelos de uma liga/temporada SofaScore."
    )
    parser.add_argument(
        "--url",
        required=True,
        help="URL da liga com #id:SEASON (ex.: .../brasileirao-serie-c/1281#id:90642)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("defensive_league.csv"),
        help="CSV consolidado (default: defensive_league.csv)",
    )
    parser.add_argument("--rate-limit", type=float, default=0.5, help="Pausa entre jogos (s)")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--limit", type=int, default=None, help="Só N jogos (teste)")
    parser.add_argument("--proxy", default=None, help="Proxy HTTPS")
    parser.add_argument(
        "--no-playwright",
        action="store_true",
        help="Usar só curl_cffi do tacoscore (costuma levar 403)",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Navegador visível (recomendado se Akamai retornar challenge)",
    )
    parser.add_argument(
        "--channel",
        default=None,
        help="chrome, msedge ou chromium embutido (default: chromium)",
    )
    parser.add_argument(
        "--warmup-wait",
        type=int,
        default=8000,
        help="Ms extras após abrir a página da liga (default: 8000)",
    )
    parser.add_argument(
        "--load-storage",
        type=Path,
        default=None,
        help="JSON de cookies/storage gerado por --save-storage",
    )
    parser.add_argument(
        "--save-storage",
        type=Path,
        default=None,
        help="Ao fechar, grava storage_state (cookies) neste arquivo",
    )
    parser.add_argument(
        "--user-data-dir",
        type=Path,
        default=None,
        help="Perfil Chromium persistente (reutiliza cookies entre execuções)",
    )
    args = parser.parse_args()

    try:
        from tacoscore import TacosScoreClient
        import pandas as pd  # noqa: F401 — valida dependência cedo
    except ImportError:
        log("Instale: pip install tacoscore curl_cffi pandas playwright")
        log("Depois: python -m playwright install chromium")
        return 1

    tournament_id, season_id = parse_tournament_url(args.url)
    out_path = args.output
    out_path.parent.mkdir(parents=True, exist_ok=True)
    proxy_url = resolve_proxy(args.proxy)
    league_page = tournament_page_url(args.url)

    client = TacosScoreClient(
        rate_limit_seconds=max(0.0, args.rate_limit),
        proxies=proxy_dict(proxy_url),
    )

    browser_http: BrowserSofascoreHttp | None = None
    if not args.no_playwright:
        log("Abrindo sessão Playwright para passar a Akamai …")
        browser_http = BrowserSofascoreHttp(
            proxy_url=proxy_url,
            headless=not args.headed,
            channel=args.channel,
            warmup_url=league_page,
            warmup_wait_ms=args.warmup_wait,
            storage_state=args.load_storage,
            user_data_dir=args.user_data_dir,
            get_retries=10 if args.headed else 8,
        )
        patch_tacoscore_client(client, browser_http)

    try:
        return run_collection(
            client,
            tournament_id,
            season_id,
            out_path,
            resume=args.resume,
            limit=args.limit,
            rate_limit=args.rate_limit,
        )
    finally:
        if browser_http is not None:
            if args.save_storage:
                browser_http.save_storage_state(args.save_storage)
            browser_http.close()


if __name__ == "__main__":
    raise SystemExit(main())
