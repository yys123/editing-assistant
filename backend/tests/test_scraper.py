import unittest

from services.scraper import parse_html_structured, parse_html_to_text


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
        self.assertIn("1、对血管的作用", structured)
        self.assertNotIn("[H3] 1、对血管的作用", structured)

    def test_only_chinese_parenthesized_numbers_become_h3(self):
        html = """
        <section class="page_disease-section">
          <div>
            <h2>诊断</h2>
            <div class="ck-content">
              <p>一、 急性中毒风险及病情评估</p>
              <p>（一）风险评估</p>
              <p>1、 药物中毒风险评估应与复苏和(或)支持治疗同步进行，包括“3W”和“2H”:</p>
              <p>(1) What：中毒的药物</p>
              <p>(2) Who：患者因素</p>
            </div>
          </div>
        </section>
        """

        structured = parse_html_structured(html)

        self.assertIn("[H2] 一、 急性中毒风险及病情评估", structured)
        self.assertIn("[H3] （一）风险评估", structured)
        self.assertIn("1、 药物中毒风险评估应与复苏和(或)支持治疗同步进行，包括“3W”和“2H”:", structured)
        self.assertNotIn("[H3] 1、 药物中毒风险评估应与复苏和(或)支持治疗同步进行，包括“3W”和“2H”:", structured)
        self.assertIn("(1) What：中毒的药物", structured)
        self.assertIn("(2) Who：患者因素", structured)
        self.assertNotIn("[H3] (1) What：中毒的药物", structured)
        self.assertNotIn("[H3] (2) Who：患者因素", structured)
        self.assertNotIn("[H4]", structured)
        self.assertNotIn("[H5]", structured)

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


class HtmlReferenceParserTests(unittest.TestCase):
    def test_reference_html_converts_sup_citations_to_markers(self):
        html = """
        <article>
          <p>The diabetes population could reach 1.31 billion by 2050.<sup>4,5</sup>
          DPN causes lower-limb amputations.<sup>1,4,6</sup></p>
          <p>Further research is needed.<sup>6,10–12</sup></p>
        </article>
        """

        text = parse_html_to_text(html)

        self.assertIn("2050.[4,5] DPN causes lower-limb amputations.[1,4,6]", text)
        self.assertIn("Further research is needed.[6,10-12]", text)

    def test_reference_html_converts_numeric_xref_anchors_to_markers(self):
        html = """
        <article>
          <p>Treatment evidence remains limited<a class="xref bibr" href="#R17">17</a>,
          and adverse effects are frequent<a class="xref bibr" href="#R18">18</a>.</p>
        </article>
        """

        text = parse_html_to_text(html)

        self.assertIn("limited[17], and adverse effects are frequent[18].", text)

    def test_reference_html_confirms_anchor_targets_in_reference_list(self):
        html = """
        <article>
          <p>Treatment evidence remains limited<a href="#R17">17</a>,
          and adverse effects are frequent<a href="#ref18">18</a>.</p>
          <figure id="fig1"><figcaption>Figure 1. Mechanism</figcaption></figure>
          <p>See Figure <a href="#fig1">1</a> for the mechanism.</p>
          <section id="references">
            <ol>
              <li id="R17">Reference 17 details.</li>
              <li id="ref18">Reference 18 details.</li>
            </ol>
          </section>
        </article>
        """

        text = parse_html_to_text(html)

        self.assertIn("limited[17], and adverse effects are frequent[18].", text)
        self.assertIn("See Figure 1 for the mechanism.", text)
        self.assertNotIn("Figure [1]", text)

    def test_reference_html_falls_back_to_inline_sentence_citations(self):
        html = """
        <article>
          <p>DN contributes to mortality rates.1,2 The number of patients may reach 783 million by 2045.3
          Further research is needed.6,10–12 Serum potassium of 3.5 mmol/L remains a body value.</p>
        </article>
        """

        text = parse_html_to_text(html)

        self.assertIn("rates.[1,2] The number of patients may reach 783 million by 2045.[3]", text)
        self.assertIn("Further research is needed.[6,10-12]", text)
        self.assertIn("3.5 mmol/L", text)


if __name__ == "__main__":
    unittest.main()
