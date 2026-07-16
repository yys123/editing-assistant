import unittest

from services.scraper import parse_html_structured, parse_html_to_text


class HtmlStructuredParserTests(unittest.TestCase):
    def test_cnki_article_keeps_article_data_references_and_drops_reader_chrome(self):
        html = """
        <html>
          <head><title>HTML阅读-《2019年美国突发性聋临床实践指南(更新版)》解读</title></head>
          <body>
            <div id="Tree">1 概述 1 概述 参考文献 参考文献</div>
            <div id="paperRead" class="ChapterContainer">
              <div class="source-info need-print">(期刊) 听力学及言语疾病杂志 2020 (04)</div>
              <h6 class="info">解决无障碍阅读Errors</h6>
              <div class="js-studyAchievement">
                <div class="wrap padding10">
                  <div class="ChapterWrap ChapterH1 js-prefix Content">
                    <h1 class="Chapter">《2019年美国突发性聋临床实践指南(更新版)》解读</h1>
                  </div>
                  <div class="ChapterWrap ChapterMsg js-prefix Content">
                    <ul class="para Chapter-people">
                      <li><a>解决无障碍阅读Errors 刘蓬</a></li>
                      <li><a>解决无障碍阅读Errors 郑芸</a></li>
                    </ul>
                    <ul class="para Chapter-people">
                      <li>四川大学华西医院耳鼻咽喉-头颈外科</li>
                    </ul>
                  </div>
                  <div class="ChapterWrap ChapterP js-prefix Content">
                    <p class="ovhide">作者简介: *刘蓬 (Email:drlp@163.com);</p>
                  </div>
                </div>
                <div class="wrap padding10">
                  <div class="ChapterWrap Content"><p>突发性聋是耳科临床常见的疾病。</p></div>
                  <div class="ChapterWrap Content"><p>美国耳鼻咽喉头颈外科基金会发布指南<sup>1</sup>。</p></div>
                  <div class="ChapterWrap Content"><h1 class="Chapter">1 概述</h1></div>
                  <div class="ChapterWrap Content"><p>2019指南由17位作者共同撰写。</p></div>
                </div>
              </div>
              <div class="references-box padding10">
                <h1>参考文献</h1>
                <p>1 Chandrasekhar SS. Clinical practice guideline:sudden hearing loss(update)[J].</p>
              </div>
            </div>
            <div class="pdf-right-content">
              <div class="h-hide liter-scrolltop">
                <div class="hdbox"><span class="tit-num">参考文献 (1)</span></div>
                <ul class="note-list">
                  <li>1 Chandrasekhar SS. Clinical practice guideline:sudden hearing loss(update)[J].</li>
                </ul>
              </div>
              <div class="h-hide citedLit"><ul class="note-list"><li>[1] 引证文献噪音。</li></ul></div>
            </div>
            <div>文字设置 微软雅黑 欢迎杭州市第一人民医院 折叠 全部目录 下载原图</div>
          </body>
        </html>
        """

        structured = parse_html_structured(html)

        self.assertIn("[H1] 《2019年美国突发性聋临床实践指南(更新版)》解读", structured)
        self.assertIn("来源：(期刊) 听力学及言语疾病杂志 2020 (04)", structured)
        self.assertIn("作者：刘蓬；郑芸", structured)
        self.assertIn("单位：四川大学华西医院耳鼻咽喉-头颈外科", structured)
        self.assertIn("突发性聋是耳科临床常见的疾病。", structured)
        self.assertIn("美国耳鼻咽喉头颈外科基金会发布指南[1]。", structured)
        self.assertIn("[H2] 1 概述", structured)
        self.assertIn("2019指南由17位作者共同撰写。", structured)
        self.assertIn("[H2] 参考文献", structured)
        self.assertIn("[1] Chandrasekhar SS. Clinical practice guideline:sudden hearing loss(update)[J].", structured)
        self.assertNotIn("文字设置", structured)
        self.assertNotIn("欢迎杭州市第一人民医院", structured)
        self.assertNotIn("解决无障碍阅读Errors", structured)
        self.assertNotIn("引证文献噪音", structured)

    def test_yiigle_article_keeps_article_data_and_drops_page_chrome(self):
        html = """
        <html>
          <head>
            <meta name="citation_title" content="儿童隐匿性阴茎手术疗效评估的研究进展">
            <meta name="citation_author" content="汪刚">
            <meta name="citation_author" content="张晔">
            <meta name="citation_journal_title" content="中华小儿外科杂志">
            <meta name="citation_publication_date" content="2025/01/15">
            <meta name="citation_doi" content="10.3760/cma.j.cn421158-20230724-00149">
            <meta name="citation_keyword" content="隐匿性阴茎">
            <meta name="citation_keyword" content="儿童">
          </head>
          <body>
            <div class="front containt">
              <h1>儿童隐匿性阴茎手术疗效评估的研究进展</h1>
            </div>
            <div class="abstract_sec_main">
              <div class="abstract_content">隐匿性阴茎是儿童常见的外生殖器疾病。</div>
            </div>
            <div class="body_content">
              <div id="s1" class="sec">
                <p>患儿阴茎海绵体直径及长度正常<sup>1</sup>。</p>
              </div>
              <div id="s2" class="sec">
                <div class="title">一、隐匿性阴茎的诊断、分型</div>
                <p>目前隐匿性阴茎较为公认的诊断标准包括外观短小。</p>
              </div>
            </div>
            <div class="back">
              <div class="ref_sec">
                <div class="ref_title">参考文献</div>
                <div class="ref_item">[1] Wein AJ. Campbell-Walsh Urology[M].</div>
              </div>
              <div class="trendMD_sec">We recommend QScience Proceedings Privacy policy</div>
              <div class="comment_sec">暂无评论，发表第一条评论抢沙发</div>
            </div>
            <div>《SparkDesk 用户协议》 | 《SparkDesk 隐私政策》</div>
          </body>
        </html>
        """

        structured = parse_html_structured(html)

        self.assertIn("[H1] 儿童隐匿性阴茎手术疗效评估的研究进展", structured)
        self.assertIn("作者：汪刚；张晔", structured)
        self.assertIn("期刊：中华小儿外科杂志", structured)
        self.assertIn("[H2] 摘要", structured)
        self.assertIn("隐匿性阴茎是儿童常见的外生殖器疾病。", structured)
        self.assertIn("患儿阴茎海绵体直径及长度正常[1]。", structured)
        self.assertIn("[H2] 一、隐匿性阴茎的诊断、分型", structured)
        self.assertIn("[H2] 参考文献", structured)
        self.assertIn("[1] Wein AJ. Campbell-Walsh Urology[M].", structured)
        self.assertNotIn("We recommend", structured)
        self.assertNotIn("Privacy policy", structured)
        self.assertNotIn("SparkDesk", structured)

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
    def test_wiley_style_reference_html_drops_page_chrome_before_chunking(self):
        html = """
        <html>
          <body>
            <div class="accessibility-links">
              ?lit$2327208547在新窗口中打开
              ?lit$2327208547打开外部网站
              本网站利用 Cookie 等技术来启用基本网站功能以及分析、个性化定制和有针对性的广告。
            </div>
            <main id="main-content">
              <article class="article">
                <div class="article-header">
                  <div>BJUI Compass</div>
                  <div>Open Access</div>
                  <h1>Concealed penis: A review of multilevel classification and surgical reconstruction techniques</h1>
                  <div>Empty dropzone</div>
                  <p>Bo-yu Xiang, Department of Urology, Xiangya Hospital, Central South University.</p>
                </div>
                <section class="article-section article-section__abstract">
                  <h2>Abstract</h2>
                  <p>Concealed penis is a common pediatric external genital condition.</p>
                </section>
                <section class="article-section article-section__full">
                  <h2>1 INTRODUCTION</h2>
                  <p>Classification and surgical reconstruction should be based on anatomical layers.</p>
                </section>
              </article>
            </main>
          </body>
        </html>
        """

        text = parse_html_structured(html, preserve_leading_text=True)

        self.assertIn("[H1] Concealed penis: A review of multilevel classification and surgical reconstruction techniques", text)
        self.assertIn("[H2] Abstract", text)
        self.assertIn("Concealed penis is a common pediatric external genital condition.", text)
        self.assertIn("[H2] 1 INTRODUCTION", text)
        self.assertIn("Classification and surgical reconstruction should be based on anatomical layers.", text)
        self.assertNotIn("?lit$", text)
        self.assertNotIn("Cookie", text)
        self.assertNotIn("打开外部网站", text)
        self.assertNotIn("Empty dropzone", text)

    def test_cnki_reference_text_keeps_full_article_and_references(self):
        html = """
        <html>
          <head><title>HTML阅读-《2019年美国突发性聋临床实践指南(更新版)》解读</title></head>
          <body>
            <div id="paperRead" class="ChapterContainer">
              <div class="source-info need-print">(期刊) 听力学及言语疾病杂志 2020 (04)</div>
              <div class="js-studyAchievement">
                <div class="wrap padding10">
                  <div class="ChapterWrap ChapterH1 js-prefix Content"><h1 class="Chapter">《2019年美国突发性聋临床实践指南(更新版)》解读</h1></div>
                  <div class="ChapterWrap ChapterMsg js-prefix Content">
                    <ul class="para Chapter-people"><li>刘蓬</li><li>郑芸</li></ul>
                    <ul class="para Chapter-people"><li>四川大学华西医院耳鼻咽喉-头颈外科</li></ul>
                  </div>
                </div>
                <div class="wrap padding10">
                  <div class="ChapterWrap Content"><p>突发性聋是耳科临床常见的疾病。</p></div>
                  <div class="ChapterWrap Content"><h1 class="Chapter">1 概述</h1></div>
                  <div class="ChapterWrap Content"><p>2019指南由17位作者共同撰写。</p></div>
                </div>
              </div>
            </div>
            <div class="pdf-right-content">
              <div class="h-hide liter-scrolltop">
                <div class="hdbox"><span class="tit-num">参考文献 (1)</span></div>
                <ul class="note-list">
                  <li>1 Chandrasekhar SS. Clinical practice guideline:sudden hearing loss(update)[J].</li>
                </ul>
              </div>
            </div>
            <div>文字设置 微软雅黑 折叠 全部目录</div>
          </body>
        </html>
        """

        text = parse_html_to_text(html)

        self.assertIn("《2019年美国突发性聋临床实践指南(更新版)》解读", text)
        self.assertIn("作者：刘蓬；郑芸", text)
        self.assertIn("突发性聋是耳科临床常见的疾病。", text)
        self.assertIn("1 概述", text)
        self.assertIn("参考文献", text)
        self.assertIn("[1] Chandrasekhar SS. Clinical practice guideline:sudden hearing loss(update)[J].", text)
        self.assertNotIn("文字设置", text)
        self.assertNotIn("全部目录", text)

    def test_yiigle_reference_text_keeps_article_data_and_drops_page_chrome(self):
        html = """
        <html>
          <head>
            <meta name="citation_title" content="儿童隐匿性阴茎手术疗效评估的研究进展">
            <meta name="citation_author" content="汪刚">
            <meta name="citation_author" content="张晔">
            <meta name="citation_journal_title" content="中华小儿外科杂志">
            <meta name="citation_publication_date" content="2025/01/15">
            <meta name="citation_doi" content="10.3760/cma.j.cn421158-20230724-00149">
            <meta name="citation_keyword" content="隐匿性阴茎">
          </head>
          <body>
            <div class="abstract_sec_main">
              <div class="abstract_content">隐匿性阴茎是儿童常见的外生殖器疾病。</div>
            </div>
            <div class="body_content">
              <div id="s1" class="sec"><p>正文第一段<sup>1</sup>。</p></div>
              <div id="s2" class="sec"><div class="title">一、诊断</div><p>诊断标准正文。</p></div>
            </div>
            <div class="back">
              <div class="ref_sec"><div class="ref_title">参考文献</div><div>[1] 参考文献正文。</div></div>
              <div class="trendMD_sec">We recommend QScience Proceedings Terms of use</div>
            </div>
            <div>《SparkDesk 用户协议》 | 《SparkDesk 隐私政策》</div>
          </body>
        </html>
        """

        text = parse_html_to_text(html)

        self.assertIn("儿童隐匿性阴茎手术疗效评估的研究进展", text)
        self.assertIn("作者：汪刚；张晔", text)
        self.assertIn("期刊：中华小儿外科杂志", text)
        self.assertIn("摘要", text)
        self.assertIn("隐匿性阴茎是儿童常见的外生殖器疾病。", text)
        self.assertIn("正文第一段[1]。", text)
        self.assertIn("一、诊断", text)
        self.assertIn("参考文献", text)
        self.assertIn("[1] 参考文献正文。", text)
        self.assertNotIn("We recommend", text)
        self.assertNotIn("Terms of use", text)
        self.assertNotIn("SparkDesk", text)

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

    def test_reference_html_converts_post_abbreviation_sup_citation_before_lowercase_text(self):
        html = """
        <article>
          <p>Hadidi et al.<sup>27</sup> suggested that abnormal attachment points can cause CCP.
          Leukocyte count can be 10<sup>9</sup>/L.</p>
        </article>
        """

        text = parse_html_to_text(html)

        self.assertIn("Hadidi et al.[27] suggested", text)
        self.assertIn("10⁹/L", text)

    def test_reference_html_converts_unicode_superscript_citations_after_words(self):
        html = """
        <article>
          <p>Patients may have dysuria, urine retention, urinary tract infection²¹, ³⁴ and so forth.
          Area can be measured in cm².</p>
        </article>
        """

        text = parse_html_to_text(html)

        self.assertIn("urinary tract infection[21,34] and so forth", text)
        self.assertIn("cm²", text)

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
