# 词条规范文件

后端会按词条类型优先读取本目录下的 Markdown 规范文件；文件不存在或内容为空时，回退到 `backend/services/standards.py` 中的内置兜底文本。

目录约定：

- `disease/quality_review.md`：疾病词条质量审评标准
- `disease/content_spec.md`：疾病词条医学知识库词条内容要求规范
- `tumor/quality_review.md`：肿瘤词条质量审评标准
- `tumor/content_spec.md`：肿瘤词条医学知识库词条内容要求规范
- `non_disease/quality_review.md`：非疾病词条质量审评标准
- `non_disease/content_spec.md`：非疾病词条医学知识库词条内容要求规范

评审时，`quality_review.md` 负责定义“如何判断质量问题”，`content_spec.md` 负责定义“词条应该包含什么内容、如何组织内容”。
