#!/usr/bin/env python3
"""Drive this app's UI/data as an external agent via the pairing-code JSON API.

Python twin of scripts/agent-cli.ts — same commands, same session file, same
pairing flow: copy the code from the app header ("Start AI agent pairing"
button), `login --pairing-code <code>`, then read screens/data/forms or drive
the browser. The pairing stays usable while the paired *browser* keeps polling
(max 5 minutes idle); the agent cannot keep itself alive.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_BASE_URL = "http://localhost:8787"
# Same file and the same camelCase keys as scripts/agent-cli.ts, so both CLIs
# can share one saved login.
SESSION_FILE = Path.cwd() / ".agent-session.json"


def load_session() -> dict[str, str]:
    """Read the saved session; a missing or corrupt file means "not logged in"."""
    if not SESSION_FILE.exists():
        return {}
    try:
        data = json.loads(SESSION_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_session(session: dict[str, str]) -> None:
    SESSION_FILE.write_text(json.dumps(session, indent=2), encoding="utf-8")


def clear_session() -> None:
    SESSION_FILE.unlink(missing_ok=True)


def base_url() -> str:
    """Session file (--base-url of login), AGENT_BASE_URL env, or localhost:8787."""
    return (
        load_session().get("baseUrl")
        or os.environ.get("AGENT_BASE_URL")
        or DEFAULT_BASE_URL
    )


def headers() -> dict[str, str]:
    """Headers for every agent request; the pairing code authenticates the call."""
    return {
        "Content-Type": "application/json",
        "X-Pairing-Code": load_session().get("pairingCode", ""),
    }


def parse_json(text: str) -> Any:
    """Return decoded JSON, or the raw text when the body is not JSON."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def parse_json_arg(text: str, what: str) -> Any:
    """Decode a JSON string given on the command line, or exit with an error."""
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"Invalid {what} (JSON parse error: {e})", file=sys.stderr)
        sys.exit(1)


def print_json(data: Any) -> None:
    print(json.dumps(data, indent=2))


def api_url(path: str) -> str:
    return f"{base_url().rstrip('/')}/{path.lstrip('/')}"


def request(method: str, path: str, body: Any = None) -> None:
    """Send one API call and pretty-print the response; exit(1) on failure."""
    req = urllib.request.Request(
        api_url(path),
        method=method,
        headers=headers(),
        data=json.dumps(body).encode("utf-8") if body is not None else None,
    )
    try:
        with urllib.request.urlopen(req) as res:
            print_json(parse_json(res.read().decode("utf-8")))
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="replace")
        print(e.code, parse_json(text), file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(
            f"Request failed: {e.reason} (is the app running at {base_url()}?)",
            file=sys.stderr,
        )
        sys.exit(1)


def cmd_login(args: argparse.Namespace) -> None:
    session: dict[str, str] = {"pairingCode": args.pairing_code}
    if args.base_url:
        session["baseUrl"] = args.base_url
    save_session(session)
    print("Pairing code saved — testing the connection (GET /agent/screen)…")
    req = urllib.request.Request(f"{api_url('/agent/screen')}", headers=headers())
    try:
        with urllib.request.urlopen(req) as res:
            screen = parse_json(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="replace").strip()
        # 401 means the code was rejected (invalid/unread/expired) — a saved
        # broken code would only confuse later calls, so drop the session file.
        if e.code == 401:
            clear_session()
        print(f"Connection test failed (HTTP {e.code}): {text}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError:
        print(
            f"Connection test failed: the app is not reachable at {base_url()} "
            "(is it running? did you need --base-url?)",
            file=sys.stderr,
        )
        sys.exit(1)
    print("Connection OK — the paired app reported:")
    print_json(screen)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="agent-cli",
        description="Drive this app's UI/data as an external AI agent (pairing-code auth).",
        epilog=(
            "Commands: login, logout, screen, data, form, screens, navigate, "
            "product_list, product_create, product_update, product_delete\n"
            "form       — the browser session's last new/edit form submission "
            "(values + the errors the UI showed)\n"
            "product_list — one page of products (8 per page), optionally "
            "filtered by the starting letters of the name (--q)\n"
            "product_update sends the FULL product as a complete replacement — "
            "omitted description/price are cleared"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True, metavar="command")

    login = sub.add_parser("login", help="save the pairing code and verify the connection")
    login.add_argument(
        "--pairing-code",
        required=True,
        help="code from the app header ('Start AI agent pairing' button)",
    )
    login.add_argument("--base-url", help=f"app base URL if not {DEFAULT_BASE_URL}")

    sub.add_parser("logout", help="drop the saved session file")

    read_cmds = {
        "screen": ("/agent/screen", "current screen name + params + route"),
        "data": ("/agent/data", "row data for the current screen"),
        "form": ("/agent/form", "last new/edit form submission (values + errors)"),
        "screens": ("/agent/screens", "screen registry (route + context keys)"),
    }
    for name, (path, help_text) in read_cmds.items():
        sub.add_parser(name, help=help_text).set_defaults(path=path)

    navigate = sub.add_parser("navigate", help="ask the browser to Inertia-visit a route")
    navigate.add_argument(
        "screen",
        help="products, products/new, products/edit, products/delete",
    )
    navigate.add_argument(
        "params",
        nargs="?",
        help='JSON params, e.g. \'{"id": 1}\' (edit/delete screens need id)',
    )

    listing = sub.add_parser(
        "product_list",
        help="list products (name-prefix filter + page number)",
    )
    listing.add_argument(
        "--q",
        default="",
        help="name prefix; matches the starting letters of the product name",
    )
    listing.add_argument(
        "--page",
        type=int,
        default=1,
        help="1-based page number (the response carries a hasMore flag)",
    )

    create = sub.add_parser("product_create", help="create a product")
    create.add_argument("product", nargs="?", default="{}", help="product JSON, e.g. '{\"productName\": \"Pen\"}'")

    edit = sub.add_parser("product_update", help="replace a product (full replacement, not merge)")
    edit.add_argument("id", type=int, help="product id")
    edit.add_argument("product", nargs="?", default="{}", help="full product JSON")

    delete = sub.add_parser("product_delete", help="delete a product")
    delete.add_argument("id", type=int, help="product id")

    return parser


def main() -> None:
    args = build_parser().parse_args()

    if args.command == "login":
        cmd_login(args)
        return
    if args.command == "logout":
        clear_session()
        print("Logged out")
        return
    if args.command == "navigate":
        screen = args.screen
        params = parse_json_arg(args.params, "parameters JSON") if args.params is not None else {}
        request("POST", "/agent/navigate", {"screen": screen, "params": params})
        return
    if args.command == "product_list":
        query = {"q": args.q}
        if args.page != 1:
            query["page"] = args.page
        request("GET", f"/agent/products?{urllib.parse.urlencode(query)}")
        return
    if args.command == "product_create":
        request("POST", "/agent/products", parse_json_arg(args.product, "product JSON"))
        return
    if args.command == "product_update":
        request("PATCH", f"/agent/products/{args.id}", parse_json_arg(args.product, "product JSON"))
        return
    if args.command == "product_delete":
        request("DELETE", f"/agent/products/{args.id}")
        return

    # screen / data / form / screens — plain GETs whose URL the subparser stashed.
    request("GET", args.path)


if __name__ == "__main__":
    main()
