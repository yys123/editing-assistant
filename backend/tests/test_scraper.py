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


if __name__ == "__main__":
    unittest.main()
