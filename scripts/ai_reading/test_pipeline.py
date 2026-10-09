from __future__ import annotations

import json
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from .generate import BudgetError, BudgetLedger, GenerationError, generate_report, validate_report
from .run import callback, main
from .preflight import main as preflight_main
from .source import Figure, PaperSource, Passage, SourceError, _get, fetch_paper, parse_html, resolve_version


VERSION = "2402.10329v1"
PARAGRAPH = "The robot records synchronized observations and actions. " * 12


def html_fixture(image: str = "2402.10329v1/figure.png") -> str:
    sections = "".join(
        f'<section id="S{index}" class="ltx_section">'
        f'<h2 class="ltx_title_section">{heading}</h2>'
        f'<p id="S{index}.p1" class="ltx_p">{PARAGRAPH}</p>'
        f'<p id="S{index}.p2" class="ltx_p">{PARAGRAPH}</p>'
        f'<figure id="S{index}.F1" class="ltx_figure">'
        f'<img src="{image}" />'
        f'<figcaption class="ltx_caption">Fig. {index}: Overview of synchronized robot observations and actions.</figcaption>'
        "</figure></section>"
        for index, heading in enumerate(("Introduction", "Method", "Experiments", "Discussion"), 1)
    )
    return (f'<html><article class="ltx_document"><h1 class="ltx_title_document">Test paper</h1>'
            f'{sections}<section class="ltx_bibliography">References</section></article></html>')


class FakeText:
    def __init__(self, text: str, page: int = 1):
        self.text = text
        self.prov = [SimpleNamespace(page_no=page)]


class SectionHeaderItem(FakeText):
    pass


class FakeConverter:
    def convert(self, _path: str):
        items = []
        for page, heading in enumerate(("Introduction", "Method", "Experiments", "Discussion"), 1):
            items.append((SectionHeaderItem(heading, page), 0))
            items.extend((FakeText(PARAGRAPH, page), 1) for _ in range(2))
        return SimpleNamespace(document=SimpleNamespace(iterate_items=lambda: iter(items)))


def source_fixture() -> PaperSource:
    return parse_html(html_fixture(), VERSION)


def report_fixture(source: PaperSource) -> dict:
    quote = source.passages[0].text[:60]
    sections = [
        {"title": title, "kind": kind, "content": "详细解析、条件和适用边界。" * 5,
         "evidence": [] if kind == "project" else [{"locator": source.passages[0].locator, "quote": quote}]}
        for title, kind in (("问题", "paper"), ("方法", "paper"), ("实验", "paper"),
                            ("局限", "limitations"), ("MFM-VL", "project"))
    ]
    return {
        "titleZh": "测试论文", "summaryZh": "中文摘要", "recommendation": "可参考",
        "sections": sections,
        "diagram": {
            "title": "自绘图", "caption": "基于证据重绘", "nodes": [
                {"id": name, "title": name, "detail": name, "column": index, "row": 0}
                for index, name in enumerate(("data", "model", "robot"))
            ],
            "edges": [{"from": "data", "to": "model", "label": "训练"},
                      {"from": "model", "to": "robot", "label": "部署"}],
        },
        "actionItems": ["桌面验证", "轮式验证", "轮足验证"],
        "selectedFigureId": source.figures[0].figure_id if source.figures else "",
    }


class SourceTests(unittest.TestCase):
    def test_redirect_cannot_change_locked_version_or_host(self):
        class Response:
            def __init__(self, final_url: str): self.final_url = final_url
            def __enter__(self): return self
            def __exit__(self, *_args): return False
            def geturl(self): return self.final_url
            def read(self, _limit): return b"%PDF-1.7"

        source_url = f"https://arxiv.org/pdf/{VERSION}"
        for redirected in (f"https://arxiv.org/pdf/2402.10329v2",
                           f"https://elsewhere.example/pdf/{VERSION}",
                           f"http://arxiv.org/pdf/{VERSION}"):
            with self.subTest(redirected=redirected):
                with patch("scripts.ai_reading.source.urlopen", return_value=Response(redirected)):
                    with self.assertRaisesRegex(SourceError, "redirected"):
                        _get(source_url)
        with patch("scripts.ai_reading.source.urlopen", return_value=Response(source_url + ".pdf")):
            self.assertTrue(_get(source_url).startswith(b"%PDF"))

    def test_version_only_comes_from_submission_history(self):
        page = (b'<div class="submission-history"><a href="/abs/2402.10329v1">[v1]</a>'
                b'<a href="/abs/2402.10329v3">[v3]</a></div>'
                b'<p>unrelated 2402.10329v999</p>')
        self.assertEqual(resolve_version("2402.10329", fetch=lambda _url: page), "2402.10329v3")
        self.assertEqual(resolve_version("2402.10329", fetch=lambda _url: b'<div class="submission-history">[v1]</div>'),
                         "2402.10329v1")

    def test_html_full_text_and_versioned_figure(self):
        source = source_fixture()
        self.assertEqual(source.format, "html")
        self.assertEqual(source.version, VERSION)
        self.assertEqual(len(source.passages), 8)
        self.assertEqual(len(source.figures), 4)
        self.assertTrue(source.figures[0].image_url.startswith(f"https://arxiv.org/html/{VERSION}/"))

    def test_pdf_fallback_uses_docling_page_locators(self):
        def fake_fetch(url: str) -> bytes:
            if "/html/" in url:
                raise SourceError("HTML unavailable")
            if "/pdf/" in url:
                return b"%PDF-1.7\nfixture"
            raise AssertionError(url)

        source = fetch_paper("2402.10329", VERSION, fake_fetch, FakeConverter())
        self.assertEqual(source.format, "pdf")
        self.assertEqual(source.figures, ())
        self.assertTrue(source.passages[0].url.endswith("#page=1"))

    def test_incomplete_html_and_pdf_are_rejected(self):
        with self.assertRaises(SourceError):
            parse_html('<article class="ltx_document"><div class="ltx_abstract">Only abstract</div></article>', VERSION)
        with self.assertRaisesRegex(SourceError, "end-of-document"):
            parse_html(html_fixture().replace('<section class="ltx_bibliography">References</section>', ''), VERSION)
        def fake_fetch(url: str) -> bytes:
            return b"<html>not full text</html>" if "/html/" in url else b"not PDF"
        with self.assertRaisesRegex(SourceError, "No complete full text"):
            fetch_paper("2402.10329", VERSION, fake_fetch, FakeConverter())

    def test_image_mismatch_is_not_published(self):
        source = parse_html(html_fixture("2402.10329v2/figure.png"), VERSION)
        self.assertEqual(source.figures, ())
        report = validate_report(report_fixture(source), source)
        self.assertEqual(report["figures"], [])


class GenerationTests(unittest.TestCase):
    def test_two_pass_generation_uses_structured_outputs(self):
        source = source_fixture()
        claim = {"claim": "Synchronized robot observations", "topic": "method",
                 "locator": source.passages[0].locator, "quote": source.passages[0].text[:60]}
        draft = report_fixture(source)
        for section in draft["sections"]:
            section.pop("evidence")
            section["evidenceIds"] = [] if section["kind"] == "project" else [0]
        responses = [
            SimpleNamespace(status="completed", output_text=json.dumps({"claims": [claim] * 6}),
                            usage=SimpleNamespace(input_tokens=1000, output_tokens=200)),
            SimpleNamespace(status="completed", output_text=json.dumps(draft),
                            usage=SimpleNamespace(input_tokens=1000, output_tokens=300)),
        ]
        calls = []
        client = SimpleNamespace(responses=SimpleNamespace(create=lambda **kwargs: calls.append(kwargs) or responses.pop(0)))
        report, ledger = generate_report(source, client, "gpt-6.1-sol", BudgetLedger())
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0]["text"]["format"]["type"], "json_schema")
        self.assertEqual(report["sourceVersion"], VERSION)
        self.assertEqual(ledger.input_tokens, 2000)

    def test_missing_usage_stops_before_second_model_call(self):
        source = source_fixture()
        calls = []
        response = SimpleNamespace(status="completed", output_text='{"claims": []}', usage=None)
        client = SimpleNamespace(responses=SimpleNamespace(create=lambda **kwargs: calls.append(kwargs) or response))
        with self.assertRaisesRegex(GenerationError, "token usage"):
            generate_report(source, client, "gpt-6.1-sol", BudgetLedger())
        self.assertEqual(len(calls), 1)

    def test_budget_guard_blocks_next_call(self):
        ledger = BudgetLedger(cap_usd=0.01)
        with self.assertRaises(BudgetError):
            ledger.reserve("paper full text " * 2000, 3000)
        self.assertEqual(ledger.input_tokens, 0)

    def test_report_is_full_text_sourced_and_never_must_read(self):
        source = source_fixture()
        report = validate_report(report_fixture(source), source)
        self.assertFalse(report["mustRead"])
        self.assertEqual(report["basis"], "full-text")
        self.assertEqual(report["sourceVersion"], VERSION)
        self.assertEqual(report["figures"][0]["matchStatus"], "matched")
        self.assertEqual(len(report["sources"]), 1)

    def test_unsupported_quote_and_figure_id(self):
        source = source_fixture()
        draft = report_fixture(source)
        draft["sections"][0]["evidence"][0]["quote"] = "a fabricated claim that is not in the paper"
        with self.assertRaises(GenerationError):
            validate_report(draft, source)
        draft = report_fixture(source)
        draft["selectedFigureId"] = "not-a-figure"
        self.assertEqual(validate_report(draft, source)["figures"], [])

    def test_diagram_bounds_reject_oversized_svg(self):
        source = source_fixture()
        draft = report_fixture(source)
        draft["diagram"]["nodes"][0]["column"] = 999
        with self.assertRaisesRegex(GenerationError, "coordinates"):
            validate_report(draft, source)
        draft = report_fixture(source)
        draft["diagram"]["nodes"] *= 5
        with self.assertRaisesRegex(GenerationError, "diagram"):
            validate_report(draft, source)

    def test_claim_indices_materialize_exact_source_quotes(self):
        source = source_fixture()
        draft = report_fixture(source)
        for section in draft["sections"]:
            section.pop("evidence")
            section["evidenceIds"] = [] if section["kind"] == "project" else [0]
        claim = {"locator": source.passages[0].locator, "quote": source.passages[0].text[:60]}
        report = validate_report(draft, source, [claim])
        self.assertEqual(report["sections"][0]["evidence"][0], claim)


class CallbackTests(unittest.TestCase):
    def test_preflight_verifies_worker_before_dependency_install(self):
        with patch.dict("os.environ", {"AI_READING_JOB_ID": "job-123", "AI_READING_ARXIV_ID": "2402.10329",
                                    "AI_READING_RUN_TOKEN": "r" * 43, "OPENAI_API_KEY": "test-key"}):
            with patch("scripts.ai_reading.preflight.callback") as notify:
                self.assertEqual(preflight_main(), 0)
                self.assertEqual(notify.call_args.args[1]["status"], "running")

    def test_missing_run_token_never_fetches_or_calls_model(self):
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key", "AI_READING_RUN_TOKEN": ""}):
            with patch("sys.argv", ["run", "--job-id", "job-123", "--arxiv-id", "2402.10329"]):
                with patch("scripts.ai_reading.run.fetch_paper") as fetch:
                    with patch("scripts.ai_reading.run.callback") as notify:
                        self.assertEqual(main(), 1)
                        fetch.assert_not_called()
                        self.assertEqual(notify.call_args.args[1]["status"], "failed")

    def test_missing_run_token_is_rejected_before_send(self):
        with self.assertRaisesRegex(RuntimeError, "run token"):
            callback("job-123", {"status": "running"}, base_url="https://example.workers.dev",
                     secret="a" * 32, run_token="short", arxiv_id="2402.10329")

    def test_signature_has_worker_format(self):
        captured = []
        class Context:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *_args): return False

        with patch("scripts.ai_reading.callback.urlopen", return_value=Context()):
            with patch("scripts.ai_reading.callback.Request", side_effect=lambda *args, **kwargs: captured.append((args, kwargs)) or object()):
                callback("job-123", {"status": "running"}, base_url="https://example.workers.dev",
                         secret="a" * 32, run_token="r" * 43, arxiv_id="2402.10329")
        args, kwargs = captured[0]
        body = kwargs["data"]
        headers = kwargs["headers"]
        digest = __import__("hmac").new(b"a" * 32,
            headers["X-Callback-Timestamp"].encode() + b"." + headers["X-Callback-Nonce"].encode() + b"." + body,
            __import__("hashlib").sha256).hexdigest()
        self.assertEqual(headers["X-Callback-Signature"], "sha256=" + digest)
        self.assertEqual(json.loads(body)["status"], "running")
        self.assertEqual(json.loads(body)["jobId"], "job-123")
        self.assertEqual(json.loads(body)["runToken"], "r" * 43)
        self.assertEqual(json.loads(body)["arxivId"], "2402.10329")


if __name__ == "__main__":
    unittest.main()
