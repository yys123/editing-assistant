import unittest

from models import SectionIssue, IssueAnchor
from services.analyzer import _attach_issue_anchors


class IssueAnchorTests(unittest.TestCase):
    def test_attach_issue_anchors_with_exact_quote(self):
        content = "## 辅助检查\n血清铁蛋白降低，转铁蛋白饱和度下降。\n### 治疗\n补铁治疗。"
        issue = SectionIssue(
            issue_type="accuracy",
            description="铁代谢描述不完整",
            severity="medium",
            examples=[],
            anchors=[IssueAnchor(quote="转铁蛋白饱和度下降")],
        )

        _attach_issue_anchors([issue], content)

        self.assertEqual(len(issue.anchors), 1)
        self.assertEqual(issue.anchors[0].start, content.index("转铁蛋白饱和度下降"))
        self.assertEqual(issue.anchors[0].line_start, 1)
        self.assertEqual(issue.anchors[0].line_end, 1)
        self.assertEqual(issue.anchors[0].match_mode, "exact")

    def test_attach_issue_anchors_with_compact_quote(self):
        content = "图 16 不同铁状态下的机制[892]\n3、 营养不良"
        issue = SectionIssue(
            issue_type="style",
            description="图注格式问题",
            severity="low",
            examples=["图16不同铁状态下的机制[892]"],
        )

        _attach_issue_anchors([issue], content)

        self.assertEqual(len(issue.anchors), 1)
        self.assertEqual(issue.anchors[0].line_start, 0)
        self.assertEqual(issue.anchors[0].match_mode, "compact")


if __name__ == "__main__":
    unittest.main()
