import unittest

from services.scraper import parse_html_structured


class HtmlStructuredParserTests(unittest.TestCase):
    def test_promotes_numbered_paragraph_to_h2_heading(self):
        html = """
        <section class="page_disease-section">
          <div>
            <h2>治疗</h2>
            <div class="ck-content">
              <p>（二）临床地位</p>
              <p>1、自20世纪80年代上市以来，ACEI 类药物对于高血压患者具有良好的靶器官保护作用。</p>
              <p>二、ACEI 作用机制</p>
              <p>（一）Ang II 的病理生理机制</p>
              <p>1、对血管的作用</p>
            </div>
          </div>
        </section>
        """

        structured = parse_html_structured(html)

        self.assertIn("[H1] 治疗", structured)
        self.assertIn("[H3] （二）临床地位", structured)
        self.assertIn("[H2] 二、ACEI 作用机制", structured)
        self.assertIn("[H3] （一）Ang II 的病理生理机制", structured)

    def test_preserves_non_reference_superscript_and_subscript(self):
        html = """
        <section class="page_disease-section">
          <div>
            <h2>辅助检查</h2>
            <div class="ck-content">
              <p>白细胞计数单位为 5 × 10<sup>9</sup>/L，二氧化碳写作 CO<sub>2</sub>。</p>
            </div>
          </div>
        </section>
        """

        structured = parse_html_structured(html)

        self.assertIn("5 × 10⁹/L", structured)
        self.assertIn("CO₂", structured)

    def test_converts_plain_numeric_superscript_citation_to_ref_marker(self):
        html = """
        <section class="page_disease-section">
          <div>
            <h2>治疗</h2>
            <div class="ck-content">
              <p>治疗选择有限性<sup>315</sup>，但大多数患者可获益。</p>
            </div>
          </div>
        </section>
        """

        structured = parse_html_structured(html)

        self.assertIn("治疗选择有限性[315]，但大多数患者可获益。", structured)

    def test_converts_xref_superscript_citation_to_ref_marker(self):
        html = """
        <section class="page_disease-section">
          <div>
            <h2>治疗</h2>
            <div class="ck-content">
              <p>对于预防CKD患者低钾血症和高钾血症反复发作具有重要意义<sup class="sup">[<a class="xref bibr" target="_blank" rid="R64" href="javascript:void(0)">64</a>,<a class="xref bibr" target="_blank" rid="R65" href="javascript:void(0)">65</a>,<a class="xref bibr" target="_blank" rid="R66" href="javascript:void(0)">66</a>]</sup>。</p>
            </div>
          </div>
        </section>
        """

        structured = parse_html_structured(html)

        self.assertIn("具有重要意义[64,65,66]。", structured)
        self.assertNotIn("<sup", structured)
        self.assertNotIn("<a ", structured)


if __name__ == "__main__":
    unittest.main()
