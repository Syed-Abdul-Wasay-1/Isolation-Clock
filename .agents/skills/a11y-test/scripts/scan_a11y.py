#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "opentest-core @ git+https://github.com/coderphonui/opentest#subdirectory=shared",
# ]
# ///
"""scan_a11y — run axe-core accessibility scan on one or more URLs via Playwright."""

import asyncio
import contextlib
import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import typer

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "shared"))

app = typer.Typer()

# WCAG rule ID → rule info mapping (axe-core rule IDs → WCAG criteria)
WCAG_MAP: dict[str, dict[str, str]] = {
    "color-contrast": {"wcag": "1.4.3", "level": "AA", "category": "visual"},
    "color-contrast-enhanced": {"wcag": "1.4.6", "level": "AAA", "category": "visual"},
    "image-alt": {"wcag": "1.1.1", "level": "A", "category": "images"},
    "image-redundant-alt": {"wcag": "1.1.1", "level": "A", "category": "images"},
    "input-image-alt": {"wcag": "1.1.1", "level": "A", "category": "images"},
    "label": {"wcag": "1.3.1", "level": "A", "category": "forms"},
    "label-content-name-mismatch": {"wcag": "2.5.3", "level": "A", "category": "forms"},
    "heading-order": {"wcag": "1.3.1", "level": "A", "category": "structure"},
    "empty-heading": {"wcag": "1.3.1", "level": "A", "category": "structure"},
    "keyboard": {"wcag": "2.1.1", "level": "A", "category": "keyboard"},
    "focus-visible": {"wcag": "2.4.7", "level": "AA", "category": "keyboard"},
    "focusable-no-name": {"wcag": "4.1.2", "level": "A", "category": "keyboard"},
    "focus-trap": {"wcag": "2.1.2", "level": "A", "category": "keyboard"},
    "link-name": {"wcag": "4.1.2", "level": "A", "category": "links"},
    "link-in-text-block": {"wcag": "1.4.1", "level": "A", "category": "links"},
    "button-name": {"wcag": "4.1.2", "level": "A", "category": "buttons"},
    "aria-roles": {"wcag": "4.1.2", "level": "A", "category": "aria"},
    "aria-required-attr": {"wcag": "4.1.2", "level": "A", "category": "aria"},
    "aria-required-children": {"wcag": "1.3.1", "level": "A", "category": "aria"},
    "aria-required-parent": {"wcag": "1.3.1", "level": "A", "category": "aria"},
    "aria-valid-attr": {"wcag": "4.1.2", "level": "A", "category": "aria"},
    "aria-valid-attr-value": {"wcag": "4.1.2", "level": "A", "category": "aria"},
    "aria-hidden-body": {"wcag": "4.1.2", "level": "A", "category": "aria"},
    "aria-hidden-focus": {"wcag": "4.1.3", "level": "AA", "category": "aria"},
    "document-title": {"wcag": "2.4.2", "level": "A", "category": "structure"},
    "html-has-lang": {"wcag": "3.1.1", "level": "A", "category": "language"},
    "html-lang-valid": {"wcag": "3.1.1", "level": "A", "category": "language"},
    "valid-lang": {"wcag": "3.1.2", "level": "AA", "category": "language"},
    "bypass": {"wcag": "2.4.1", "level": "A", "category": "navigation"},
    "skip-link": {"wcag": "2.4.1", "level": "A", "category": "navigation"},
    "tabindex": {"wcag": "2.4.3", "level": "A", "category": "navigation"},
    "frame-title": {"wcag": "4.1.2", "level": "A", "category": "frames"},
    "frame-focusable-content": {"wcag": "4.1.2", "level": "A", "category": "frames"},
    "meta-refresh": {"wcag": "2.2.1", "level": "A", "category": "timing"},
    "meta-viewport": {"wcag": "1.4.4", "level": "AA", "category": "visual"},
    "scrollable-region-focusable": {"wcag": "2.1.1", "level": "A", "category": "keyboard"},
    "select-name": {"wcag": "4.1.2", "level": "A", "category": "forms"},
    "table-duplicate-name": {"wcag": "1.3.1", "level": "A", "category": "tables"},
    "td-headers-attr": {"wcag": "1.3.1", "level": "A", "category": "tables"},
    "th-has-data-cells": {"wcag": "1.3.1", "level": "A", "category": "tables"},
}

# Standard tag sets for axe-core
STANDARD_TAGS: dict[str, list[str]] = {
    "WCAG2A": ["wcag2a"],
    "WCAG2AA": ["wcag2a", "wcag2aa"],
    "WCAG2AAA": ["wcag2a", "wcag2aa", "wcag2aaa"],
    "best-practice": ["wcag2a", "wcag2aa", "best-practice"],
}


def _validate_url(url: str) -> str:
    """Validate that the URL is a proper http/https URL."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"URL must start with http:// or https://, got: {url!r}")
    if not parsed.netloc:
        raise ValueError(f"URL has no host: {url!r}")
    return url


async def _scan_page(
    page: Any,
    url: str,
    standard: str,
    include_screenshots: bool,
) -> dict[str, Any]:
    """Scan a single already-open page with axe-core."""
    tags = STANDARD_TAGS.get(standard.upper(), STANDARD_TAGS["WCAG2AA"])
    tags_js = json.dumps(tags)

    # Inject axe-core from CDN
    await page.add_script_tag(
        url="https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.0/axe.min.js"
    )

    axe_result: dict[str, Any] = await page.evaluate(f"""
        async () => {{
            return await new Promise((resolve) => {{
                axe.run(document, {{
                    runOnly: {{type: 'tag', values: {tags_js}}},
                }}, (err, results) => {{
                    if (err) resolve({{violations: [], passes: [], incomplete: [], error: String(err)}});
                    else resolve(results);
                }});
            }});
        }}
    """)

    screenshot_b64 = ""
    if include_screenshots:
        import base64

        screenshot_bytes = await page.screenshot(type="png", full_page=True)
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode()

    title = await page.title()
    return _parse_axe_result(axe_result, url, title, screenshot_b64)


async def _scan_urls(
    urls: list[str],
    standard: str,
    include_screenshots: bool,
) -> dict[str, Any]:
    """Scan one or more URLs. Returns single-page result or multi-page rollup."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise RuntimeError(
            "playwright is not installed. Run: pip install playwright && playwright install chromium"
        ) from None

    page_results: list[dict[str, Any]] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        for url in urls:
            page = await context.new_page()
            page_result: dict[str, Any] = {}
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                with contextlib.suppress(Exception):
                    await page.wait_for_load_state("networkidle", timeout=5_000)

                page_result = await _scan_page(page, url, standard, include_screenshots)

            except Exception as exc:
                error_msg = str(exc)
                # Sanitize: don't log credentials that might appear in error messages
                page_result = {
                    "url": url,
                    "page_title": "",
                    "error": error_msg,
                    "total_violations": 0,
                    "total_passes": 0,
                    "total_incomplete": 0,
                    "impact_summary": {"critical": 0, "serious": 0, "moderate": 0, "minor": 0},
                    "violations_by_wcag": {},
                    "violations": [],
                    "screenshot_base64": "",
                }
                print(f"WARNING: failed to scan {url}: {error_msg}", file=sys.stderr)
            finally:
                await page.close()

            page_results.append(page_result)

        await browser.close()

    if len(page_results) == 1:
        result = page_results[0]
        result["standard"] = standard
        return result

    # Multi-page rollup
    all_violations: list[dict[str, Any]] = []
    total_passes = 0
    impact_totals: dict[str, int] = {"critical": 0, "serious": 0, "moderate": 0, "minor": 0}

    for pr in page_results:
        all_violations.extend(pr.get("violations", []))
        total_passes += pr.get("total_passes", 0)
        for k, v in pr.get("impact_summary", {}).items():
            impact_totals[k] = impact_totals.get(k, 0) + v

    by_wcag: dict[str, list[str]] = {}
    for v in all_violations:
        guideline = v.get("wcag_criterion", "other")
        by_wcag.setdefault(guideline, []).append(v["id"])

    return {
        "urls": [pr.get("url", "") for pr in page_results],
        "standard": standard,
        "total_pages": len(page_results),
        "total_violations": len(all_violations),
        "total_passes": total_passes,
        "total_incomplete": sum(pr.get("total_incomplete", 0) for pr in page_results),
        "impact_summary": impact_totals,
        "violations_by_wcag": by_wcag,
        "violations": all_violations,
        "page_results": page_results,
    }


def _parse_axe_result(
    axe_result: dict[str, Any],
    url: str,
    title: str,
    screenshot_b64: str,
) -> dict[str, Any]:
    violations = axe_result.get("violations", [])
    passes = axe_result.get("passes", [])
    incomplete = axe_result.get("incomplete", [])

    enriched_violations = []
    for v in violations:
        rule_id = v.get("id", "")
        wcag_info = WCAG_MAP.get(rule_id, {})

        nodes = []
        for node in v.get("nodes", [])[:5]:
            nodes.append(
                {
                    "html": node.get("html", "")[:300],
                    "target": node.get("target", []),
                    "failure_summary": node.get("failureSummary", ""),
                }
            )

        enriched_violations.append(
            {
                "id": rule_id,
                "impact": v.get("impact", "moderate"),
                "description": v.get("description", ""),
                "help": v.get("help", ""),
                "help_url": v.get("helpUrl", ""),
                "wcag_criterion": wcag_info.get("wcag", ""),
                "wcag_level": wcag_info.get("level", ""),
                "category": wcag_info.get("category", "general"),
                "node_count": len(v.get("nodes", [])),
                "nodes": nodes,
            }
        )

    impact_counts: dict[str, int] = {"critical": 0, "serious": 0, "moderate": 0, "minor": 0}
    for v in enriched_violations:
        impact = v.get("impact", "moderate")
        if impact in impact_counts:
            impact_counts[impact] += 1

    by_wcag: dict[str, list[str]] = {}
    for v in enriched_violations:
        guideline = v.get("wcag_criterion", "other")
        by_wcag.setdefault(guideline, []).append(v["id"])

    return {
        "url": url,
        "page_title": title,
        "total_violations": len(enriched_violations),
        "total_passes": len(passes),
        "total_incomplete": len(incomplete),
        "impact_summary": impact_counts,
        "violations_by_wcag": by_wcag,
        "violations": enriched_violations,
        "screenshot_base64": screenshot_b64,
    }


@app.command()
def main(
    url: str = typer.Option(..., "--url", "-u", help="Primary URL to scan"),
    pages: str = typer.Option(
        "",
        "--pages",
        help="Additional URLs to scan (comma-separated). Combined with --url for a multi-page audit.",
    ),
    standard: str = typer.Option(
        "WCAG2AA",
        "--standard",
        help="WCAG standard to test against: WCAG2A | WCAG2AA | WCAG2AAA | best-practice",
    ),
    screenshots: bool = typer.Option(
        False, "--screenshots", help="Include page screenshots in output"
    ),
    output: Path | None = typer.Option(None, "--output", "-o", help="Write JSON output to file"),
    summary_only: bool = typer.Option(
        False, "--summary", help="Print summary only, not full violation details"
    ),
) -> None:
    """Run axe-core accessibility scan on one or more URLs. Returns structured violations as JSON."""
    # Validate and build URL list
    try:
        _validate_url(url)
    except ValueError as exc:
        typer.echo(f"ERROR: {exc}", err=True)
        raise typer.Exit(1) from exc

    all_urls = [url]
    if pages:
        for extra in pages.split(","):
            extra = extra.strip()
            if extra:
                try:
                    _validate_url(extra)
                    all_urls.append(extra)
                except ValueError as exc:
                    typer.echo(f"WARNING: skipping invalid URL {extra!r}: {exc}", err=True)

    if standard.upper() not in STANDARD_TAGS:
        typer.echo(
            f"WARNING: unknown standard {standard!r}, falling back to WCAG2AA. "
            f"Valid options: {', '.join(STANDARD_TAGS)}",
            err=True,
        )
        standard = "WCAG2AA"

    try:
        result = asyncio.run(_scan_urls(all_urls, standard, screenshots))
    except RuntimeError as exc:
        typer.echo(f"ERROR: {exc}", err=True)
        raise typer.Exit(1) from exc

    if summary_only:
        summary: dict[str, Any] = {
            "standard": result.get("standard", standard),
            "total_violations": result["total_violations"],
            "impact_summary": result["impact_summary"],
            "violations_by_wcag": result["violations_by_wcag"],
        }
        if "urls" in result:
            summary["urls"] = result["urls"]
            summary["total_pages"] = result.get("total_pages", 1)
        else:
            summary["url"] = result.get("url", url)
        print(json.dumps(summary, indent=2))
        return

    out = json.dumps(result, indent=2, default=str)
    if output:
        output.write_text(out)
        typer.echo("Accessibility scan complete.")
        typer.echo(f"Standard: {standard}")
        typer.echo(f"Violations: {result['total_violations']} ({result['impact_summary']})")
        typer.echo(f"Wrote report to {output}")
    else:
        print(out)


if __name__ == "__main__":
    app()
