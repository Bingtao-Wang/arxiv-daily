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


class TableItem:
    def __init__(self, markdown: str, page: int | None):
        self.markdown = markdown
        self.prov = [SimpleNamespace(page_no=page)] if page is not None else []

    def export_to_markdown(self, *, doc):
        assert doc is not None
        return self.markdown


def source_fixture() -> PaperSource:
    return parse_html(html_fixture(), VERSION)


def report_fixture(source: PaperSource) -> dict:
    quote = source.passages[0].text[:60]
    sections = [
        {"title": title, "topic": topic, "kind": kind,
         "coverage": "analysis" if kind == "project" else "reported",
         "content": ("第一阶段：固定桌面机械臂验证。第二阶段：轮式平台数据与操作闭环验证。"
                     "第三阶段：轮足机械狗加机械臂联合验证。" if kind == "project"
                     else "详细解析论文给出的条件、方法与适用边界。" * 5),
         "evidence": [] if kind == "project" else [{"locator": source.passages[0].locator, "quote": quote}]}
        for title, topic, kind in (("动机", "motivation", "paper"),
                                   ("架构", "architecture", "paper"),
                                   ("训练", "training", "paper"),
                                   ("数据", "data", "paper"),
                                   ("输入输出", "flow", "paper"),
                                   ("任务推演", "walkthrough", "paper"),
                                   ("实验", "experiments", "paper"),
                                   ("局限", "limitations", "limitations"),
                                   ("MFM-VL", "project", "project"))
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


def topical_claims_fixture(source: PaperSource) -> list[dict]:
    topics = ("motivation", "architecture", "training", "data", "flow",
              "walkthrough", "experiment", "limitation")
    return [{"claim": f"Evidence for {topic}", "topic": topic,
             "locator": passage.locator, "quote": passage.text[:60]}
            for topic, passage in zip(topics, source.passages)]


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

    def test_html_tables_and_equations_have_versioned_evidence_anchors(self):
        table = ('<figure id="S2.T1" class="ltx_table">'
                 '<figcaption class="ltx_caption">Table 1: Grasp success by platform.</figcaption>'
                 '<table class="ltx_tabular"><thead><tr><th>Platform</th><th>Success</th></tr></thead>'
                 '<tbody><tr><td>Fixed arm</td><td>85%</td></tr>'
                 '<tr><td>Mobile arm</td><td>72%</td></tr></tbody></table></figure>')
        equation = ('<table id="S2.E1" class="ltx_equation">'
                    '<tr class="ltx_equation"><td><math alttext="a_t=Kx_t"></math></td>'
                    '<td><span class="ltx_tag_equation">(1)</span></td></tr></table>')
        html = html_fixture().replace('</section><section id="S3"', table + equation + '</section><section id="S3"')
        source = parse_html(html, VERSION)
        lookup = {passage.locator: passage for passage in source.passages}
        self.assertIn('Platform | Success\nFixed arm | 85%\nMobile arm | 72%', lookup['S2.T1'].text)
        self.assertEqual(lookup['S2.T1'].section, 'Method · Table')
        self.assertEqual(lookup['S2.T1'].url, f'https://arxiv.org/html/{VERSION}#S2.T1')
        self.assertEqual(lookup['S2.E1'].text, 'Equation (1): a_t=Kx_t')
        self.assertEqual(lookup['S2.E1'].section, 'Method · Equation')
        self.assertEqual(lookup['S2.E1'].url, f'https://arxiv.org/html/{VERSION}#S2.E1')
        draft = report_fixture(source)
        draft['sections'][1]['evidence'] = [{'locator': 'S2.T1', 'quote': 'Fixed arm | 85%'}]
        report = validate_report(draft, source)
        self.assertIn(f'https://arxiv.org/html/{VERSION}#S2.T1',
                      [item['url'] for item in report['sources']])

    def test_unstructured_tables_and_formula_glyphs_are_not_invented(self):
        table = ('<figure id="S2.T1" class="ltx_table">'
                 '<figcaption class="ltx_caption">Table 1: Missing tabular body.</figcaption></figure>')
        equation = ('<table id="S2.E1" class="ltx_equation">'
                    '<tr><td><math><mi>x</mi></math></td></tr></table>')
        html = html_fixture().replace('</section><section id="S3"', table + equation + '</section><section id="S3"')
        source = parse_html(html, VERSION)
        self.assertEqual(len(source.passages), 8)

    def test_table_math_uses_complete_alttext_once(self):
        table = ('<figure id="S2.T1" class="ltx_table">'
                 '<figcaption class="ltx_caption">Table 1: Error '
                 '<math alttext="\\times 10^{-2}"><semantics><mo>×</mo>'
                 '<annotation>\\times 10^{-2}</annotation></semantics></math>.</figcaption>'
                 '<table class="ltx_tabular"><tr><th>Variant</th><th>'
                 '<math alttext="\\mathrm{SE}(2)"><semantics><mi>SE(2)</mi>'
                 '<annotation>\\mathrm{SE}(2)</annotation></semantics></math></th></tr>'
                 '<tr><td>Parent</td><td><math alttext="3.86\\!\\pm\\!0.06">'
                 '<semantics><mrow><mo>±</mo><mn>0.06</mn></mrow>'
                 '<annotation>3.86\\!\\pm\\!0.06</annotation></semantics>'
                 '</math></td></tr></table></figure>')
        html = html_fixture().replace('</section><section id="S3"', table + '</section><section id="S3"')
        source = parse_html(html, VERSION)
        passage = next(p for p in source.passages if p.locator == 'S2.T1')
        self.assertIn('Error × 10^{-2}', passage.text)
        self.assertIn('Variant | SE(2)', passage.text)
        self.assertIn('Parent | 3.86 ± 0.06', passage.text)
        self.assertEqual(passage.text.count('3.86'), 1)

    def test_table_with_unreadable_math_is_not_offered_as_evidence(self):
        table = ('<figure id="S2.T1" class="ltx_table">'
                 '<figcaption class="ltx_caption">Table 1: Incomplete math.</figcaption>'
                 '<table class="ltx_tabular"><tr><td>Result</td><td>'
                 '<math><mn>42</mn></math></td></tr></table></figure>')
        html = html_fixture().replace('</section><section id="S3"', table + '</section><section id="S3"')
        source = parse_html(html, VERSION)
        self.assertNotIn('S2.T1', {passage.locator for passage in source.passages})

    def test_tables_cannot_make_truncated_prose_pass_full_text_check(self):
        html = ('<article class="ltx_document"><h1 class="ltx_title_document">Partial paper</h1>'
                '<section id="S1" class="ltx_section"><h2 class="ltx_title_section">Method</h2>'
                f'<p id="S1.p1" class="ltx_p">{PARAGRAPH}</p>'
                '<figure id="S1.T1" class="ltx_table">'
                '<figcaption class="ltx_caption">Table 1: Large extracted table.</figcaption>'
                f'<table class="ltx_tabular"><tr><td>{PARAGRAPH * 20}</td></tr></table>'
                '</figure></section><section class="ltx_bibliography">References</section></article>')
        with self.assertRaisesRegex(SourceError, 'Full text appears incomplete'):
            parse_html(html, VERSION)

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

    def test_docling_pdf_tables_have_page_anchored_values_without_duplicates(self):
        from .source import parse_pdf_with_docling

        markdown = ('TABLE A1: Diffusion Policy hyperparameters\n\n'
                    '| Task | Epochs | Batch |\n| --- | ---: | ---: |\n'
                    '| Cup Arrag. | 250 | 512 |')
        class Converter(FakeConverter):
            def convert(self, path):
                document = super().convert(path).document
                items = list(document.iterate_items())
                items.append((FakeText('TABLE A1: Diffusion Policy hyperparameters', 4), 1))
                items.extend((item, 1) for item in (
                    TableItem(markdown, 4), TableItem(markdown, 4),
                    TableItem(markdown.replace('250', '350'), None),
                    TableItem('| col | value |\n| --- | --- |\n| bad | \ufffd |', 4),
                ))
                return SimpleNamespace(document=SimpleNamespace(iterate_items=lambda: iter(items)))

        source = parse_pdf_with_docling(b'%PDF-1.7\nfixture', VERSION, Converter())
        tables = [passage for passage in source.passages if passage.section.endswith(' · Table')]
        self.assertEqual(len(tables), 1)
        self.assertEqual(tables[0].locator, 'page 4, table 1')
        self.assertEqual(tables[0].url, f'https://arxiv.org/pdf/{VERSION}#page=4')
        self.assertIn('Cup Arrag. | 250 | 512', tables[0].text)
        self.assertEqual(len(source.passages), 9)
        draft = report_fixture(source)
        draft['sections'][1]['evidence'] = [{'locator': tables[0].locator, 'quote': 'Cup Arrag. | 250 | 512'}]
        report = validate_report(draft, source)
        self.assertIn(tables[0].url, [item['url'] for item in report['sources']])

    def test_cached_umi_pdf_table_a1_real_docling(self):
        import os
        from pathlib import Path
        from .source import parse_pdf_with_docling

        if os.getenv('AI_READING_REAL_PDF_TEST') != '1':
            self.skipTest('Set AI_READING_REAL_PDF_TEST=1 with the cached UMI PDF and Docling installed')
        pdf_path = Path(__file__).resolve().parents[2] / 'work' / 'ai-reading-audit' / f'{VERSION}.pdf'
        self.assertTrue(pdf_path.is_file(), f'Missing local UMI fixture: {pdf_path}')
        source = parse_pdf_with_docling(pdf_path.read_bytes(), VERSION)
        tables = [passage for passage in source.passages if passage.section.endswith(' · Table')]
        self.assertEqual(len(tables), 3)
        table_a1 = next(passage for passage in tables if 'TABLE A1' in passage.text)
        self.assertEqual(table_a1.locator, 'page 16, table 3')
        self.assertEqual(table_a1.url, f'https://arxiv.org/pdf/{VERSION}#page=16')
        self.assertIn('Cup Arrag.', table_a1.text)
        self.assertIn('250', table_a1.text)
        self.assertIn('512', table_a1.text)
        self.assertIn('4xA10g', table_a1.text)
        self.assertEqual(len(source.passages), 228)
        self.assertEqual(len({passage.locator for passage in source.passages}), len(source.passages))
        self.assertFalse(any(passage.text == table_a1.text.splitlines()[0] and passage.url == table_a1.url
                             for passage in source.passages))

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
        claims = topical_claims_fixture(source)
        draft = report_fixture(source)
        for index, section in enumerate(draft["sections"]):
            section.pop("evidence")
            section["evidenceIds"] = [] if section["kind"] == "project" else [index]
        responses = [
            SimpleNamespace(status="completed", output_text=json.dumps({"claims": claims}),
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
        self.assertEqual(report["figures"][0]["title"], "Overview of synchronized robot observations and actions.")
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
        for index, section in enumerate(draft["sections"]):
            section.pop("evidence")
            section["evidenceIds"] = [] if section["kind"] == "project" else [index]
        claims = topical_claims_fixture(source)
        report = validate_report(draft, source, claims)
        self.assertEqual(report["sections"][0]["evidence"][0],
                         {"locator": claims[0]["locator"], "quote": claims[0]["quote"]})

        draft = report_fixture(source)
        for section in draft["sections"]:
            section.pop("evidence")
            section["evidenceIds"] = [] if section["kind"] == "project" else [1]
        with self.assertRaisesRegex(GenerationError, "topic-matched"):
            validate_report(draft, source, claims)

    def test_six_stop_coverage_and_unreported_topics_are_explicit(self):
        source = source_fixture()
        draft = report_fixture(source)
        draft["sections"][2].update(coverage="not_reported", content="未报告：论文全文未给出可核实的训练目标、损失函数或参数配置。" * 2,
                                    evidence=[])
        report = validate_report(draft, source)
        self.assertEqual(report["sections"][2]["evidence"], [])
        self.assertEqual([section["topic"] for section in report["sections"][:6]],
                         ["motivation", "architecture", "training", "data", "flow", "walkthrough"])

        draft = report_fixture(source)
        draft["sections"][2].update(coverage="not_reported", evidence=[])
        with self.assertRaisesRegex(GenerationError, "unreported topic"):
            validate_report(draft, source)
        draft = report_fixture(source)
        draft["sections"].pop(3)
        with self.assertRaisesRegex(GenerationError, "nine reading topics"):
            validate_report(draft, source)
        draft = report_fixture(source)
        draft["sections"][8]["content"] = "仅提出桌面机械臂验证，缺少后续载体测试和数据链路条件。" * 2
        with self.assertRaisesRegex(GenerationError, "three hardware stages"):
            validate_report(draft, source)


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
