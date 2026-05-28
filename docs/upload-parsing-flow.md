# 内容上传解析流程梳理

## 一、总体流程概览

```
用户选择文件/粘贴内容
       |
       v
前端分块上传 (chunkedUpload, 32KB/块)
       |
  init → upload × N → complete
       |
       v
后端按类型路由处理
       |
  ┌────┼────┬────┬────┐
  v    v    v    v    v
文章  QA  PDF  质量  内容
HTML  CSV 参考  标准  规范
TXT  Excel 文献
MD
       |
       v
结构化文本输出 → 章节解析 (AI/正则) → 下游分析
```

## 二、支持的上传类型

| 类型 | 文件格式 | 是否必需 | 用途 |
|------|----------|----------|------|
| 文章内容 | `.html` `.htm` `.txt` `.md` | 必需 | 主体知识库文章 |
| Q&A 数据 | `.csv` `.xlsx` `.xls` | 可选 | 问答对数据 |
| 参考文献 | `.pdf` `.html` `.htm` | 可选 | 多文件，截取前 6000 字 |
| 质量标准 | `.txt` `.md` `.pdf` | 可选 | 覆盖内置质量标准 |
| 内容规范 | `.txt` `.md` `.pdf` | 可选 | 覆盖内置内容规范 |

## 三、前端上传机制

### 3.1 入口组件

**文件**: `frontend/src/components/StepUpload.tsx`

- 文章内容提供两种输入方式：**文件上传** 和 **直接粘贴**
- Q&A 数据上传后预览前 5 行
- 参考文献支持多文件上传，每个文件以卡片形式展示文件名和字数
- 质量标准/内容规范可选上传，不上传则使用内置默认

### 3.2 分块上传协议

**文件**: `frontend/src/api.ts` — `chunkedUpload()` 函数

采用三阶段分块上传：

| 阶段 | 接口 | 说明 |
|------|------|------|
| 初始化 | `POST /api/article/chunk/init` | 发送文件名、总块数、上传类型，返回 `upload_id` |
| 分块上传 | `POST /api/article/chunk/upload` | 每块 32KB，base64 编码，顺序上传 |
| 完成处理 | `POST /api/article/chunk/complete` | 触发后端解析，返回处理结果 |

**重试机制**: 每块最多重试 3 次，指数退避 (1s, 2s, 3s)

**进度**: 分块上传占 0-90%，完成阶段到 95%，返回结果后 100%

### 3.3 遗留接口

仍保留了一套直传接口 (`/upload`, `/upload-b64`, `/upload-pdf`, `/upload-pdf-b64`, `/upload-standard`, `/upload-standard-b64`)，已被分块上传替代。

## 四、后端上传处理

### 4.1 分块管理

**文件**: `backend/routers/article.py`

- 使用内存字典存储上传会话，30 分钟自动过期清理
- `chunk/complete` 时校验所有块已到齐，按序拼接还原完整文件

### 4.2 类型路由

`chunk/complete` 根据 `upload_type` 分发到不同处理函数：

| upload_type | 处理函数 | 说明 |
|-------------|----------|------|
| `article` | `_process_article()` | 文章解析 |
| `qa` | `parse_qa_file()` | Q&A 解析 |
| `pdf` | `extract_pdf_text()` / `parse_html_to_text()` | 参考文献提取 |
| `standard` | `extract_pdf_text()` 或直接读取 | 标准文件提取 |

## 五、解析逻辑详解

### 5.1 文章解析 — HTML

**文件**: `backend/services/scraper.py` — `parse_html_structured()`

处理步骤：
1. BeautifulSoup + lxml 解析 HTML
2. 移除噪音标签 (script, style, nav, footer, sidebar, ads 等)
3. 按 ID/class 模式移除无关元素
4. 逐元素提取内容：
   - `h1-h6` → `[H1]`/`[H2]`/`[H3]` 标记
   - `figure` → `[图片]` 或 `[表格]` 标记
   - `table` → Markdown 表格格式
   - `p`/`li`/`dt`/`dd` → 纯文本段落
   - `<sup class="literature-sup">` → `^[N]` 引用标记
5. 去重连续重复行、移除 UI 噪音文本 (全屏查看、返回顶部等)
6. 丁香园特殊处理：识别 DXY 疾病结构化页面、更新要点卡片等

**图片分析** (`_inject_image_analysis`):
- 从 `<figure class="image">` 提取内嵌 base64 图片
- 调用 Gemini 视觉 API 识别图片中的文字/图表内容
- 在 `[图片]` 标记下方注入 `[图片内容]` 块

### 5.2 文章解析 — TXT

**文件**: `backend/services/scraper.py` — `parse_txt_structured()`

处理步骤：
1. 逐行扫描，识别标题模式：
   - 中文数字前缀 (一、二、三…) → `[H2]`
   - 括号数字 （一）（二） → `[H3]`
   - 独立短标题 (2-8 个中文字符) → `[H3]`
2. 表格模式：遇到 "表 N" 标题激活，Tab 分隔行转 Markdown 表格
3. 文献引用 `[N]` → `^[N]`

### 5.3 文章解析 — Markdown

直接透传，不做额外处理，返回原文和字符数。

### 5.4 Q&A 解析

**文件**: `backend/services/parser.py` — `parse_qa_file()`

- 支持 CSV 和 Excel 格式
- 灵活列名匹配：问题/question、回答/answer、证据/evidence
- 过滤空行和 "nan" 值
- 输出 `QAItem` 列表

### 5.5 PDF 提取

**文件**: `backend/services/pdf.py` — `extract_pdf_text()`

- 优先使用 PyMuPDF (fitz) 提取
- 失败回退到 pypdf
- 默认截取前 6000 字符 (标准文件 12000 字符)
- 在句末 (。.！？) 处截断
- 加密/扫描件 PDF 会抛出 ValueError

### 5.6 编码处理

所有文本类文件统一编码策略：
- 优先 UTF-8-sig 解码
- 失败回退 GBK，errors='replace' 容错

## 六、章节解析 (下游第一步)

**文件**: `backend/services/section_parser.py` — `parse_article_sections()`

**接口**: `POST /api/article/parse-sections`

1. 将结构化文本发送给 Gemini，要求按章节拆分为 JSON
2. AI 失败时使用正则回退解析
3. 输出 `ParsedArticle`：
   - `sections[]`: 每个章节含 id、heading、content、word_count、level、image_count、table_count
   - `total_words`: 总字数 (排除更新要点等摘要段)
4. 后处理修正：修复 "中文and中文" 这类 AI 替换错误

## 七、数据流转格式

### 文章上传返回

```json
{
  "content": "结构化文本 ([H1]/[H2]/[图片]/^[N] 等标记)",
  "source": "文件名",
  "length": 12345
}
```

### Q&A 上传返回

```json
{
  "count": 50,
  "items": [{"question": "...", "answer": "...", "evidence": "..."}],
  "preview": ["前5条"]
}
```

### 参考文献上传返回

```json
[
  {"filename": "xxx.pdf", "text": "提取文本", "char_count": 6000}
]
```

### 标准文件上传返回

```json
{
  "text": "标准内容文本",
  "char_count": 8000
}
```

## 八、配置与限制

| 项目 | 值 | 位置 |
|------|-----|------|
| 分块大小 | 32KB (base64) | `frontend/src/api.ts` |
| 上传会话过期 | 30 分钟 | `backend/routers/article.py` |
| AI 解析文本上限 | 40,000 字符 | `section_parser.py` |
| 纯文本上限 | 30,000 字符 | `section_parser.py` |
| PDF 提取上限 | 6,000 字符 (默认) / 12,000 (标准) | `pdf.py` |
| Gemini 模型 | `gemini-3-flash-preview` | `config.py` |
| JWT 有效期 | 7 天 | `config.py` |
| 上传重试 | 最多 3 次，指数退避 | `frontend/src/api.ts` |

## 九、错误处理

| 场景 | 处理方式 |
|------|----------|
| 不支持的文件格式 | 400 错误 |
| 内容为空 | 400 错误 |
| 编码异常 | UTF-8 → GBK 回退，替换不可解码字符 |
| PDF 提取失败 | PyMuPDF → pypdf 回退 |
| 加密/扫描件 PDF | 抛出 ValueError，返回 400 |
| 图片识别失败 | 返回空字符串，继续处理 |
| AI 章节解析失败 | 正则回退解析 |
| 上传会话过期 | 400 错误 |

## 十、关键文件索引

| 文件 | 职责 |
|------|------|
| `frontend/src/components/StepUpload.tsx` | 上传 UI 组件 |
| `frontend/src/api.ts` | 分块上传协议实现 |
| `backend/routers/article.py` | 上传接口、类型路由 |
| `backend/services/scraper.py` | HTML/TXT 结构化解析 |
| `backend/services/pdf.py` | PDF 文本提取 |
| `backend/services/parser.py` | Q&A CSV/Excel 解析 |
| `backend/services/section_parser.py` | AI 章节解析 |
| `backend/services/gemini.py` | Gemini API 调用 (含图片分析) |
| `backend/models.py` | 数据模型定义 |
| `backend/config.py` | 配置项 |
