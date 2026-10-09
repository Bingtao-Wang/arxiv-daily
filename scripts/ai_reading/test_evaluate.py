from __future__ import annotations

from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from .evaluate import Case, audit_report, audit_source, audit_usage, load_case, main
from .generate import validate_report
from .test_pipeline import FakeConverter, VERSION, html_fixture, report_fixture, source_fixture


class EvaluationTests(unittest.TestCase):
    def test_fixed_html_source_and_local_cache_are_audited_without_model(self):
        case = Case("test HTML", "2402.10329", VERSION, "html", "paper.html")
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / case.filename
            path.write_text(html_fixture(), encoding="utf-8")
            source, input_info = load_case(case, Path(temp), fetch=lambda _url: self.fail("network used"))
        result = audit_source(case, source)
        self.assertTrue(result["ok"], result["checks"])
        self.assertEqual(result["metrics"]["figureCandidates"][0]["label"], "Fig. 1")
        self.assertEqual(input_info["origin"], "local cache; original provenance unverified")
        self.assertEqual(len(input_info["sha256"]), 64)

    def test_pdf_fallback_never_publishes_guessed_image(self):
        case = Case("test PDF", "2402.10329", VERSION, "pdf", "paper.pdf")
        urls = []
        with tempfile.TemporaryDirectory() as temp:
            source, _ = load_case(
                case, Path(temp), fetch_missing=True,
                fetch=lambda url: urls.append(url) or b"%PDF-1.7\nfixture",
                converter=FakeConverter(),
            )
            self.assertTrue((Path(temp) / "paper.pdf").exists())
        self.assertEqual(urls, [f"https://arxiv.org/pdf/{VERSION}"])
        self.assertEqual(source.figures, ())
        self.assertTrue(audit_source(case, source)["ok"])

    def test_report_quotes_and_figure_must_match_locked_source(self):
        source = source_fixture()
        report = validate_report(report_fixture(source), source)
        self.assertTrue(audit_report(source, report)["ok"])
        report["sections"][0]["evidence"][0]["quote"] = "fabricated quotation"
        self.assertFalse(audit_report(source, report)["ok"])
        report = validate_report(report_fixture(source), source)
        report["figures"][0]["sourceImageUrl"] = "https://arxiv.org/html/2402.10329v2/figure.png"
        self.assertFalse(audit_report(source, report)["ok"])
        report = validate_report(report_fixture(source), source)
        report["sourceVersion"] = "2402.10329v2"
        self.assertFalse(audit_report(source, report)["ok"])

    def test_unreported_topic_must_be_explicit_and_has_no_evidence(self):
        source = source_fixture()
        draft = report_fixture(source)
        training = draft["sections"][2]
        training["coverage"] = "not_reported"
        training["content"] = "未报告：论文没有给出可核实的训练目标、损失、监督信号或数据规模细节。需要阅读附录和公开代码后才能确认具体训练设置。"
        training["evidence"] = []
        report = validate_report(draft, source)
        self.assertTrue(audit_report(source, report)["ok"])
        report["sections"][2]["coverage"] = "reported"
        self.assertFalse(audit_report(source, report)["ok"])
        report["sections"][2]["coverage"] = "not_reported"
        report["sections"][2]["evidence"] = report["sections"][0]["evidence"]
        self.assertFalse(audit_report(source, report)["ok"])

    def test_nine_topic_order_is_required(self):
        source = source_fixture()
        report = validate_report(report_fixture(source), source)
        report["sections"][0], report["sections"][1] = report["sections"][1], report["sections"][0]
        self.assertFalse(audit_report(source, report)["ok"])

    def test_pdf_report_with_html_original_figure_fails(self):
        case = Case("test PDF", "2402.10329", VERSION, "pdf", "paper.pdf")
        with tempfile.TemporaryDirectory() as temp:
            (Path(temp) / "paper.pdf").write_bytes(b"%PDF-1.7\nfixture")
            source, _ = load_case(case, Path(temp), converter=FakeConverter())
        report = validate_report(report_fixture(source), source)
        self.assertTrue(audit_report(source, report)["ok"])
        report["figures"] = [{"label": "Fig. 1", "caption": "made up", "matchStatus": "matched",
                              "sourceImageUrl": f"https://arxiv.org/html/{VERSION}/fake.png",
                              "sourceUrl": f"https://arxiv.org/html/{VERSION}#fake"}]
        self.assertFalse(audit_report(source, report)["ok"])

    def test_usage_requires_recorded_tokens_and_one_dollar_budget(self):
        self.assertTrue(audit_usage({"inputTokens": 1000, "outputTokens": 200,
                                     "estimatedUsd": 0.004, "budgetUsd": 1.0})["ok"])
        self.assertFalse(audit_usage({"inputTokens": 0, "outputTokens": 0,
                                      "estimatedUsd": 0, "budgetUsd": 1.0})["ok"])
        self.assertFalse(audit_usage({"inputTokens": 1000, "outputTokens": 200,
                                      "estimatedUsd": 1.01, "budgetUsd": 1.0})["ok"])

    def test_cli_reports_missing_model_results_without_faking_quality(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "2610.08220v1.html"
            path.write_text(html_fixture("2610.08220v1/figure.png").replace(VERSION, "2610.08220v1"),
                            encoding="utf-8")
            out = io.StringIO()
            with redirect_stdout(out):
                with patch("scripts.ai_reading.evaluate.EXPECTED_SECTIONS", {}):
                    status = main(["--case", "vommi-html", "--cache-dir", temp])
        result = json.loads(out.getvalue())
        self.assertEqual(status, 0)
        self.assertEqual(result["modelCalls"], 0)
        self.assertEqual(result["cases"]["vommi-html"]["report"]["status"], "not_evaluated")
        self.assertEqual(result["cases"]["vommi-html"]["usage"]["status"], "not_available")


if __name__ == "__main__":
    unittest.main()
