"""Offline, reproducible audits of source extraction and optional AI reports.

No model API is called here. Source files can be cached locally; --fetch-missing
downloads only a fixed, versioned arXiv HTML/PDF URL. Quote matching verifies
traceability, not whether a generated claim is entailed by its quotation.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Any, Callable

from .generate import BudgetLedger, READING_TOPICS, _chunk_passages
from .source import PaperSource, SourceError, _get, parse_html, parse_pdf_with_docling


@dataclass(frozen=True)
class Case:
    name: str
    arxiv_id: str
    version: str
    format: str
    filename: str


CASES = {
    "vommi-html": Case("VOMMI HTML", "2610.08220", "2610.08220v1", "html", "2610.08220v1.html"),
    "umi-pdf": Case("UMI PDF fallback", "2402.10329", "2402.10329v1", "pdf", "2402.10329v1.pdf"),
}

EXPECTED_SECTIONS = {
    "vommi-html": ("Introduction", "Data Collection", "Problem Formulation", "VOMMI",
                   "Experiments", "Limitation"),
    "umi-pdf": ("INTRODUCTION", "METHOD", "EVALUATIONS", "LIMITATIONS", "CONCLUSION"),
}


class EvaluationError(RuntimeError):
    """The audit input could not be read or does not match its fixed case."""


def _check(name: str, ok: bool, detail: str = "") -> dict[str, Any]:
    return {"name": name, "ok": bool(ok), "detail": detail}


def _versioned_url(case: Case) -> str:
    return f"https://arxiv.org/{case.format}/{case.version}"


def load_case(
    case: Case,
    cache_dir: Path,
    *,
    fetch_missing: bool = False,
    fetch: Callable[[str], bytes] = _get,
    converter: object | None = None,
) -> tuple[PaperSource, dict[str, Any]]:
    """Read cached bytes, or fetch the exact arXiv version before caching them."""
    path = cache_dir / case.filename
    downloaded = False
    if path.exists():
        data = path.read_bytes()
    elif fetch_missing:
        data = fetch(_versioned_url(case))
        downloaded = True
    else:
        raise EvaluationError(
            f"Missing {path}; provide a local copy or rerun with --fetch-missing"
        )
    if case.format == "html":
        source = parse_html(data, case.version)
    elif case.format == "pdf":
        source = parse_pdf_with_docling(data, case.version, converter)
    else:
        raise EvaluationError(f"Unsupported case format: {case.format}")
    if downloaded:
        cache_dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return source, {
        "path": str(path.resolve()),
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
        "origin": "fetched from versioned arXiv URL" if downloaded else "local cache; original provenance unverified",
        "url": _versioned_url(case),
    }


def audit_source(case: Case, source: PaperSource) -> dict[str, Any]:
    """Inspect parser coverage, versioned locators and same-version figures."""
    sections = list(dict.fromkeys(p.section for p in source.passages))
    expected_headings = next(
        (headings for key, headings in EXPECTED_SECTIONS.items() if case == CASES[key]), ()
    )
    missing_headings = [
        heading for heading in expected_headings
        if not any(heading.casefold() in section.casefold() for section in sections)
    ]
    locators = [p.locator for p in source.passages]
    characters = sum(len(p.text) for p in source.passages)
    expected_url = _versioned_url(case)
    if case.format == "html":
        links_ok = all(p.url.startswith(expected_url + "#") for p in source.passages)
        image_prefix = expected_url + "/"
        figures_ok = all(
            f.source_url == expected_url + "#" + f.figure_id
            and f.image_url.startswith(image_prefix)
            and f.label.startswith("Fig. ")
            and f.caption.lower().startswith(("fig.", "figure"))
            for f in source.figures
        )
    else:
        links_ok = all(
            p.url.startswith(expected_url + "#page=")
            and p.locator.startswith("page ")
            for p in source.passages
        )
        figures_ok = len(source.figures) == 0
    checks = [
        _check("locked_version", source.arxiv_id == case.arxiv_id and source.version == case.version,
               f"{source.arxiv_id} / {source.version}"),
        _check("format_and_full_text_url", source.format == case.format and source.full_text_url == expected_url,
               f"{source.format}: {source.full_text_url}"),
        _check("body_extent", len(sections) >= 3 and characters >= 4000,
               f"{len(source.passages)} passages, {len(sections)} sections, {characters} characters"),
        _check("expected_chapters", not missing_headings,
               "missing: " + ", ".join(missing_headings) if missing_headings else
               f"{len(expected_headings)} expected chapter labels present"),
        _check("unique_locators", len(set(locators)) == len(locators),
               f"{len(set(locators))}/{len(locators)} unique"),
        _check("versioned_passage_urls", links_ok),
        _check("same_version_figure_policy", figures_ok,
               f"{len(source.figures)} figure candidates" +
               ("; PDF extraction must provide zero original-image URLs" if case.format == "pdf" else "")),
    ]
    chunks = _chunk_passages(source.passages)
    ledger = BudgetLedger()
    extraction_estimate = sum(
        ledger.estimate(f"Paper {case.version}; full-text chunk {i}/{len(chunks)}.\n{chunk}", 2400)
        for i, chunk in enumerate(chunks, 1)
    )
    # The final prompt depends on the model's extracted claims, so this is only
    # a lower bound for the planned synthesis call, not a cost forecast.
    minimum_synthesis_reserve = ledger.estimate("", 6500)
    return {
        "ok": all(check["ok"] for check in checks),
        "checks": checks,
        "metrics": {
            "passages": len(source.passages),
            "characters": characters,
            "sections": sections,
            "firstLocator": locators[0] if locators else None,
            "lastLocator": locators[-1] if locators else None,
            "figureCandidates": [{"label": f.label, "id": f.figure_id, "url": f.image_url}
                                 for f in source.figures],
            "evidenceChunks": len(chunks),
            "approxExtractionReserveUsd": round(extraction_estimate, 4),
            "minimumSynthesisReserveUsd": round(minimum_synthesis_reserve, 4),
            "budgetCaveat": "Approximate reserve omits fixed instructions and unknown synthesis evidence; actual cost requires model token usage.",
        },
    }


def _normalized(text: str) -> str:
    return " ".join(text.split())


def audit_report(source: PaperSource, report: dict[str, Any]) -> dict[str, Any]:
    """Check published data against extracted source without claiming semantic truth."""
    lookup = {p.locator: p for p in source.passages}
    sections = report.get("sections")
    if not isinstance(sections, list):
        sections = []
    evidence_count = 0
    cited: set[str] = set()
    evidence_ok = True
    coverage_ok = True
    for section in sections:
        if not isinstance(section, dict):
            evidence_ok = False
            coverage_ok = False
            continue
        entries = section.get("evidence")
        if not isinstance(entries, list):
            evidence_ok = False
            coverage_ok = False
            continue
        topic = section.get("topic")
        expected_kind = "project" if topic == "project" else "limitations" if topic == "limitations" else "paper"
        if section.get("kind") != expected_kind:
            coverage_ok = False
        coverage = section.get("coverage")
        content = section.get("content")
        if topic == "project":
            if coverage != "analysis" or not isinstance(content, str) or not all(
                stage in content for stage in ("第一阶段", "第二阶段", "第三阶段")
            ):
                coverage_ok = False
        elif coverage == "reported":
            if not entries:
                coverage_ok = False
        elif coverage == "not_reported":
            if entries or not isinstance(content, str) or not content.startswith("未报告："):
                coverage_ok = False
        else:
            coverage_ok = False
        for item in entries:
            evidence_count += 1
            if not isinstance(item, dict):
                evidence_ok = False
                continue
            locator, quote = item.get("locator"), item.get("quote")
            passage = lookup.get(locator) if isinstance(locator, str) else None
            if not passage or not isinstance(quote, str) or len(_normalized(quote)) < 12 \
                    or _normalized(quote) not in _normalized(passage.text):
                evidence_ok = False
            else:
                cited.add(locator)

    source_items = report.get("sources")
    if not isinstance(source_items, list):
        source_items = []
    source_map = {
        item.get("locator"): item.get("url")
        for item in source_items if isinstance(item, dict) and isinstance(item.get("locator"), str)
    }
    source_links_ok = bool(cited) and all(
        source_map.get(locator) == lookup[locator].url for locator in cited
    ) and set(source_map) == cited

    original_figures = report.get("figures")
    if not isinstance(original_figures, list):
        original_figures = []
    allowed = {(f.label, f.caption, f.image_url, f.source_url) for f in source.figures}
    figures_ok = all(
        isinstance(item, dict)
        and item.get("matchStatus") == "matched"
        and (item.get("label"), item.get("caption"), item.get("sourceImageUrl"),
             item.get("sourceUrl")) in allowed
        for item in original_figures
    ) and len(original_figures) <= len(source.figures)

    diagram = report.get("diagram")
    diagram_ok = isinstance(diagram, dict) and isinstance(diagram.get("nodes"), list) \
        and len(diagram["nodes"]) >= 3 and isinstance(diagram.get("edges"), list) \
        and len(diagram["edges"]) >= 2
    checks = [
        _check("locked_report_source", report.get("sourceVersion") == source.version
               and report.get("sourceUrl") == source.full_text_url),
        _check("full_text_not_must_read", report.get("basis") == "full-text"
               and report.get("mustRead") is False),
        _check("nine_topics_in_order", tuple(s.get("topic") if isinstance(s, dict) else None
                                              for s in sections) == READING_TOPICS,
               f"{len(sections)}/{len(READING_TOPICS)} topics"),
        _check("coverage_and_kind", coverage_ok),
        _check("quotes_match_locked_text", evidence_ok and evidence_count > 0,
               f"{evidence_count} citations; {len(cited)} distinct source passages"),
        _check("citation_urls_match_locked_text", source_links_ok),
        _check("same_version_original_figures", figures_ok,
               f"{len(original_figures)} displayed original figures"),
        _check("redrawn_diagram_structure", diagram_ok),
    ]
    return {
        "ok": all(check["ok"] for check in checks),
        "checks": checks,
        "limits": "Exact quotes and URLs are checked. Whether claims follow from quotes requires human review.",
    }


def audit_usage(value: dict[str, Any]) -> dict[str, Any]:
    """Validate the callback's recorded token/cost metadata, when available."""
    input_tokens = value.get("inputTokens")
    output_tokens = value.get("outputTokens")
    estimated = value.get("estimatedUsd")
    budget = value.get("budgetUsd")
    tokens_ok = type(input_tokens) is int and input_tokens > 0 \
        and type(output_tokens) is int and output_tokens > 0
    amounts_ok = type(estimated) in (int, float) and type(budget) in (int, float) \
        and 0 <= estimated <= budget and 0 < budget <= 1.0
    checks = [
        _check("token_usage_recorded", tokens_ok),
        _check("estimated_cost_within_one_dollar_target", amounts_ok,
               f"estimated ${estimated}, target ${budget}"),
    ]
    return {"ok": all(check["ok"] for check in checks), "checks": checks,
            "limits": "Estimated cost uses configured token rates; compare with actual OpenAI billing."}


def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise EvaluationError(f"Expected a JSON object: {path}")
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=Path("work/ai-reading-audit"))
    parser.add_argument("--fetch-missing", action="store_true",
                        help="fetch only absent fixed-version source files from arxiv.org")
    parser.add_argument("--case", action="append", choices=sorted(CASES),
                        help="repeat to select cases; default is both")
    parser.add_argument("--vommi-report", type=Path)
    parser.add_argument("--umi-report", type=Path)
    parser.add_argument("--vommi-usage", type=Path)
    parser.add_argument("--umi-usage", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    report_paths = {"vommi-html": args.vommi_report, "umi-pdf": args.umi_report}
    usage_paths = {"vommi-html": args.vommi_usage, "umi-pdf": args.umi_usage}
    results: dict[str, Any] = {}
    ok = True
    for key in dict.fromkeys(args.case or CASES):
        case = CASES[key]
        try:
            source, input_info = load_case(case, args.cache_dir, fetch_missing=args.fetch_missing)
            source_audit = audit_source(case, source)
            report_audit = audit_report(source, _read_json(report_paths[key])) if report_paths[key] else None
            usage_audit = audit_usage(_read_json(usage_paths[key])) if usage_paths[key] else None
            case_ok = source_audit["ok"] and (report_audit is None or report_audit["ok"]) \
                and (usage_audit is None or usage_audit["ok"])
            results[key] = {
                "name": case.name, "ok": case_ok, "input": input_info,
                "source": source_audit,
                "report": report_audit or {"status": "not_evaluated", "reason": "No generated report supplied"},
                "usage": usage_audit or {"status": "not_available", "reason": "No model usage supplied"},
            }
            ok = ok and case_ok
        except (EvaluationError, SourceError, OSError, ValueError, ImportError) as exc:
            results[key] = {"name": case.name, "ok": False, "error": f"{type(exc).__name__}: {exc}"}
            ok = False
    result = {
        "ok": ok,
        "modelCalls": 0,
        "cases": results,
        "interpretation": "Parser and citation checks only; no claim about model reading quality without generated reports and human review.",
    }
    serialized = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
