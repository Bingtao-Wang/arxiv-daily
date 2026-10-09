"""Fetch a fixed arXiv version and extract the paper body and its figures.

The HTML parser accepts images only when the figure, caption and image are all
inside the same versioned arXiv HTML document. PDF conversion never guesses an
image URL.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Callable
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup


ARXIV_ID = re.compile(r"^(?:arXiv:)?(?P<id>\d{4}\.\d{4,5})(?:v(?P<version>[1-9]\d*))?$")
USER_AGENT = "arxiv-daily-ai-reading/1.0 (research reading; https://github.com/Bingtao-Wang/arxiv-daily)"
MAX_DOWNLOAD_BYTES = 32 * 1024 * 1024


class SourceError(RuntimeError):
    """The full paper could not be obtained or safely parsed."""


@dataclass(frozen=True)
class Passage:
    locator: str
    text: str
    section: str
    url: str


@dataclass(frozen=True)
class Figure:
    figure_id: str
    label: str
    caption: str
    image_url: str
    source_url: str


@dataclass(frozen=True)
class PaperSource:
    arxiv_id: str
    version: str
    title: str
    full_text_url: str
    format: str
    passages: tuple[Passage, ...]
    figures: tuple[Figure, ...]


def split_arxiv_id(value: str) -> tuple[str, str | None]:
    match = ARXIV_ID.fullmatch(value.strip())
    if not match:
        raise SourceError(f"Unsupported arXiv identifier: {value!r}")
    number = match.group("id")
    version = f"{number}v{match.group('version')}" if match.group("version") else None
    return number, version


def _get(url: str, max_bytes: int = MAX_DOWNLOAD_BYTES) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html, application/pdf"})
    with urlopen(request, timeout=45) as response:
        requested = urlparse(url)
        final = urlparse(response.geturl())
        allowed_paths = {requested.path}
        if requested.path.startswith("/pdf/"):
            allowed_paths.add(requested.path + ".pdf")
        if final.scheme != "https" or final.netloc != "arxiv.org" or final.path not in allowed_paths:
            raise SourceError("arXiv redirected the locked source to a different host or paper version")
        content = response.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise SourceError(f"Source exceeds {max_bytes} bytes: {url}")
    return content


def resolve_version(arxiv_id: str, supplied_version: str | None = None,
                    fetch: Callable[[str], bytes] = _get) -> str:
    number, version_in_id = split_arxiv_id(arxiv_id)
    if supplied_version:
        _, version = split_arxiv_id(supplied_version)
        if version is None or not version.startswith(number + "v"):
            raise SourceError("Requested version does not match the paper")
        if version_in_id and version != version_in_id:
            raise SourceError("Two different arXiv versions were requested")
        return version
    if version_in_id:
        return version_in_id
    try:
        page = fetch(f"https://arxiv.org/abs/{number}").decode("utf-8", "replace")
    except Exception as exc:
        raise SourceError("Cannot resolve the current arXiv version") from exc
    history = BeautifulSoup(page, "html.parser").select_one(".submission-history")
    if history is None:
        raise SourceError("The arXiv abstract page has no submission history")
    versions = [int(value) for value in re.findall(r"\[v([1-9]\d*)\]", history.get_text(" ", strip=True))]
    if not versions:
        raise SourceError("The arXiv submission history did not expose a version")
    return f"{number}v{max(versions)}"


def _clean(value: str) -> str:
    return " ".join(value.split())


def _validate_body(passages: tuple[Passage, ...]) -> None:
    sections = {passage.section for passage in passages}
    characters = sum(len(passage.text) for passage in passages)
    if len(sections) < 3 or characters < 4_000:
        raise SourceError(
            f"Full text appears incomplete ({len(sections)} sections, {characters} characters); "
            "refusing abstract-only or truncated analysis"
        )


def parse_html(html: bytes | str, version: str) -> PaperSource:
    number, parsed_version = split_arxiv_id(version)
    if parsed_version is None:
        raise SourceError("HTML parser requires a versioned arXiv identifier")
    html_url = f"https://arxiv.org/html/{version}"
    soup = BeautifulSoup(html, "html.parser")
    article = soup.select_one("article.ltx_document")
    if article is None:
        raise SourceError("The arXiv HTML page has no LaTeXML paper body")
    if article.select_one(".ltx_bibliography") is None:
        raise SourceError("The arXiv HTML page lacks an end-of-document bibliography")
    title_tag = article.select_one("h1.ltx_title_document")
    title = _clean(title_tag.get_text(" ", strip=True)) if title_tag else version

    passages: list[Passage] = []
    abstract = article.select_one(".ltx_abstract")
    if abstract:
        abstract_text = _clean(abstract.get_text(" ", strip=True))
        if abstract_text:
            passages.append(Passage("abstract", abstract_text, "Abstract", html_url + "#abstract1"))
    seen_paragraphs: set[str] = set()
    for section in article.select("section.ltx_section"):
        heading = section.select_one("h2.ltx_title_section")
        section_title = _clean(heading.get_text(" ", strip=True)) if heading else section.get("id", "Section")
        for paragraph in section.select("p.ltx_p"):
            if paragraph.find_parent("figure") or paragraph.find_parent("section", class_="ltx_bibliography"):
                continue
            content = _clean(paragraph.get_text(" ", strip=True))
            if len(content) < 25:
                continue
            locator = paragraph.get("id") or f"{section.get('id', 'section')}.p{len(passages)}"
            if locator in seen_paragraphs:
                continue
            seen_paragraphs.add(locator)
            passages.append(Passage(locator, content, section_title, html_url + "#" + locator))
    result_passages = tuple(passages)
    _validate_body(result_passages)

    figures: list[Figure] = []
    for figure in article.select("figure.ltx_figure"):
        caption_tag = figure.select_one("figcaption.ltx_caption")
        image_tag = figure.select_one("img[src], object[data]")
        if not caption_tag or not image_tag or not figure.get("id"):
            continue
        caption = _clean(caption_tag.get_text(" ", strip=True))
        number_match = re.match(r"(?i)^(?:fig(?:ure)?\.?)[\s\u00a0]*([0-9]+)\s*[:.]?", caption)
        if not number_match or len(caption) < 25:
            continue
        src = image_tag.get("src") or image_tag.get("data") or ""
        image_url = urljoin(html_url, src)
        parts = urlparse(image_url)
        if parts.scheme != "https" or parts.netloc != "arxiv.org" or not parts.path.startswith(f"/html/{version}/"):
            continue
        figure_id = figure["id"]
        figures.append(Figure(figure_id, f"Fig. {number_match.group(1)}", caption,
                              image_url, html_url + "#" + figure_id))
    return PaperSource(number, version, title, html_url, "html", result_passages, tuple(figures))


def parse_pdf_with_docling(pdf_bytes: bytes, version: str, converter: object | None = None) -> PaperSource:
    """Use Docling text items and page provenance; never fabricate PDF image URLs."""
    import tempfile
    from pathlib import Path

    if not pdf_bytes.startswith(b"%PDF"):
        raise SourceError("The versioned PDF endpoint did not return a PDF")
    if converter is None:
        try:
            from docling.document_converter import DocumentConverter
        except ImportError as exc:
            raise SourceError("Docling is required for PDF fallback") from exc
        converter = DocumentConverter()
    with tempfile.TemporaryDirectory(prefix="arxiv-reading-") as temp_dir:
        path = Path(temp_dir) / f"{version}.pdf"
        path.write_bytes(pdf_bytes)
        try:
            document = converter.convert(str(path)).document  # type: ignore[attr-defined]
        except Exception as exc:
            raise SourceError("Docling could not convert the versioned PDF") from exc

    pdf_url = f"https://arxiv.org/pdf/{version}"
    passages: list[Passage] = []
    section = "Front matter"
    heading_count = 0
    try:
        items = document.iterate_items()
    except AttributeError as exc:
        raise SourceError("Docling did not return structured PDF text") from exc
    for item, _level in items:
        value = _clean(getattr(item, "text", ""))
        if not value:
            continue
        if "SectionHeader" in type(item).__name__:
            section = value
            heading_count += 1
            continue
        provenance = getattr(item, "prov", None) or []
        page = getattr(provenance[0], "page_no", None) if provenance else None
        if not isinstance(page, int) or page < 1:
            continue
        if len(value) < 25:
            continue
        locator = f"page {page}, passage {len(passages) + 1}"
        passages.append(Passage(locator, value, section, pdf_url + f"#page={page}"))
    result_passages = tuple(passages)
    _validate_body(result_passages)
    if heading_count < 3:
        raise SourceError("Docling PDF extraction did not recover enough section headings")
    pages = getattr(document, "pages", None)
    if isinstance(pages, dict) and pages:
        expected_last = max(int(page) for page in pages)
        seen_last = max((int(passage.url.rsplit("=", 1)[-1]) for passage in result_passages), default=0)
        if seen_last < expected_last - 1:
            raise SourceError("Docling did not extract text through the end of the PDF")
    number, _ = split_arxiv_id(version)
    return PaperSource(number, version, version, pdf_url, "pdf", result_passages, ())


def fetch_paper(arxiv_id: str, supplied_version: str | None = None,
                fetch: Callable[[str], bytes] = _get,
                converter: object | None = None) -> PaperSource:
    version = resolve_version(arxiv_id, supplied_version, fetch)
    try:
        html = fetch(f"https://arxiv.org/html/{version}")
        return parse_html(html, version)
    except Exception as html_error:
        try:
            pdf = fetch(f"https://arxiv.org/pdf/{version}")
            return parse_pdf_with_docling(pdf, version, converter)
        except Exception as pdf_error:
            raise SourceError(
                f"No complete full text for {version}; HTML: {html_error}; PDF: {pdf_error}"
            ) from pdf_error
