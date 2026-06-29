import io
import zipfile
import unittest

from services.document import extract_reference_word_text, extract_word_text


DOCX_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _run(text: str, superscript: bool = False, style: str = "") -> str:
    props = []
    if style:
        props.append(f'<w:rStyle w:val="{style}"/>')
    if superscript:
        props.append('<w:vertAlign w:val="superscript"/>')
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    return f"<w:r>{rpr}<w:t>{text}</w:t></w:r>"


def _docx_bytes(paragraph_runs: list[list[tuple]]) -> bytes:
    body = "".join(
        "<w:p>" + "".join(_run(*run) for run in runs) + "</w:p>"
        for runs in paragraph_runs
    )
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{DOCX_NS}"><w:body>{body}</w:body></w:document>'
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("word/document.xml", document_xml)
    return buffer.getvalue()


class ReferenceWordExtractionTests(unittest.TestCase):
    def test_reference_docx_marks_superscript_numeric_citations(self):
        content = _docx_bytes([
            [
                ("The diabetes population could reach 1.31 billion by 2050.", False),
                ("4,5", True),
                (" DPN affects extremities.", False),
                ("1,4,6", True),
                (" Further research is needed.", False),
                ("6,10–12", True),
            ]
        ])

        text = extract_reference_word_text(content, "guide.docx")

        self.assertEqual(
            text,
            "The diabetes population could reach 1.31 billion by 2050.[4,5] "
            "DPN affects extremities.[1,4,6] Further research is needed.[6,10-12]",
        )

    def test_reference_docx_does_not_mark_regular_numbers(self):
        content = _docx_bytes([
            [("HbA1c 7.0% and 2050 are body numbers.", False)],
        ])

        text = extract_reference_word_text(content, "guide.docx")

        self.assertEqual(text, "HbA1c 7.0% and 2050 are body numbers.")

    def test_reference_docx_marks_endnote_reference_style_citations(self):
        content = _docx_bytes([
            [
                ("Diabetic neuropathy requires further research.", False),
                ("6,10–12", False, "EndnoteReference"),
            ],
            [
                ("Another sentence.", False),
                ("13–15", False, "FootnoteReference"),
            ],
        ])

        text = extract_reference_word_text(content, "guide.docx")

        self.assertEqual(
            text,
            "Diabetic neuropathy requires further research.[6,10-12]\n"
            "Another sentence.[13-15]",
        )

    def test_reference_docx_falls_back_to_inline_sentence_citations(self):
        content = _docx_bytes([
            [(
                "DN contributes to morbidity and mortality rates.1,2 "
                "The number of patients could reach 783 million by 2045.3 "
                "Further research is needed.6,10–12 "
                "Serum potassium of 3.5 mmol/L remains a body value.",
                False,
            )],
        ])

        text = extract_reference_word_text(content, "guide.docx")

        self.assertEqual(
            text,
            "DN contributes to morbidity and mortality rates.[1,2] "
            "The number of patients could reach 783 million by 2045.[3] "
            "Further research is needed.[6,10-12] "
            "Serum potassium of 3.5 mmol/L remains a body value.",
        )

    def test_regular_word_extraction_keeps_existing_plain_behavior(self):
        content = _docx_bytes([
            [("Guideline text.", False), ("4,5", True)],
        ])

        text = extract_word_text(content, "article.docx")

        self.assertEqual(text, "Guideline text.4,5")
