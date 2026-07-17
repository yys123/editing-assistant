# AI 整合引用相关性自动核对设计

## 目标

在 AI 整合结果生成后，自动增加一层引用相关性核对：检查正文中每个可点击参考文献序号对应的详情内容，是否能支撑该序号所在的答案句子。核对结果随 AI 整合记录保存，并在前端提示需要人工确认的引用。

## 背景

当前 AI 整合已经具备引用追溯基础：

- 后端会构建 `reference_anchors`，每个 anchor 包含 `citation_key`、`quote`、`context_before`、`context_after`、`title_path` 等信息。
- 后端会把部分粗粒度引用重写成源内引用，例如把 `[3]` 尽量改成 `[3-22]`。
- 前端会把正文中的引用标记转成可点击按钮，并在 `AiCitationPanel` 中显示对应详情。

缺口是：引用序号可能可点击，但点击后的详情不一定与引用所在句子语义相关。用户需要一层自动提醒，降低错误引用混入最终正文的风险。

## 范围

包含：

- AI 整合生成完成后自动执行引用相关性核对。
- 优先核对 `revision_text`；若没有修订正文，则核对完整 `answer`。
- 对正文中识别到的每个可定位引用，提取“引用所在句子”和“引用详情内容”。
- 使用 AI 判定引用是否支撑该句子，并返回结构化核对结果。
- 前端保存核对结果，并在问答记录和引用详情面板中展示。
- 核对失败时不阻塞 AI 整合结果返回。

不包含：

- 自动改写正文引用序号。
- 后台异步任务、轮询或推送。
- 对外部数据库或联网文献进行二次检索。
- 对不可点击、无法定位的纯文本引用做强制推断修复。

## 推荐方案

采用“后端生成后同步核对”。

`/api/generate/ai-integration` 在生成回答、解析 `revision_text`、重写引用标记并构建 `reference_anchors` 后，立即执行引用核对。核对结果作为 `citation_verification` 字段返回。这样历史记录天然保存核对结果，前端无需发第二个请求，错误处理也集中在后端。

## 数据模型

后端新增：

```py
class CitationVerificationItem(BaseModel):
    citation_key: str
    anchor_key: str = ""
    sentence: str = ""
    source_label: str = ""
    quote: str = ""
    status: str = "unverified"  # supported/weak/mismatch/unverifiable/unverified
    reason: str = ""


class CitationVerificationResult(BaseModel):
    status: str = "not_run"  # passed/needs_review/not_run/failed
    items: List[CitationVerificationItem] = []
    warnings: List[str] = []
```

扩展 `AiIntegrationResponse`：

```py
citation_verification: Optional[CitationVerificationResult] = None
```

前端新增对应类型，并扩展 `AiIntegrationRecord`：

```ts
citationVerification?: CitationVerificationResult
```

兼容规则：

- 老记录没有 `citationVerification` 时不显示核对状态。
- `failed` 或 `not_run` 不影响正文展示。
- `supported` 计为通过；`weak`、`mismatch`、`unverifiable` 计为需要人工确认。
- `anchor_key` 用于前端点击面板精确匹配；当同一个 `citation_key` 在前端被拆成 `1-47~1`、`1-47~2` 这类重复引用锚点时，后端核对项应尽量写入对应的 `anchor_key`。若没有 `anchor_key`，前端回退用 `citation_key` 聚合展示。

## 后端流程

1. AI 整合照常生成回答。
2. 后端解析 `revision_text` 和 `change_summary`。
3. 后端执行现有引用重写逻辑，得到 `rewritten_answer` 和 `rewritten_revision_text`。
4. 后端选择核对文本：
   - 若 `rewritten_revision_text` 非空，核对它。
   - 否则核对 `rewritten_answer`。
5. 扫描核对文本中的引用组，例如 `[1-3]`、`[1-3、2-6]`、`[0-18]`。
6. 对每个引用 token，找到所在句子，并用 `reference_anchors` 找对应 anchor。
7. 构建核对输入项：
   - `citation_key`
   - 答案句子
   - 数据源名称和标题路径
   - anchor 的 `quote`
   - 前后文上下文
8. 若没有可核对引用，返回 `status="not_run"` 和提示。
9. 调用 AI 输出 JSON，逐条判断。
10. 合并 AI 输出与原始输入项，返回 `passed` 或 `needs_review`。

## 核对判定

每条引用使用以下状态：

- `supported`：引用详情能够直接支撑答案句子的核心事实。
- `weak`：引用详情与主题相关，但只部分支撑、过于笼统或缺少关键限定。
- `mismatch`：引用详情与答案句子主题、结论、人群、干预、数据或方向明显不匹配。
- `unverifiable`：引用详情信息不足，无法判断是否支撑。
- `unverified`：AI 未返回该条或返回无法解析时的保底状态。

Prompt 要求：

- 只判断“该引用详情是否支撑该句子”，不要评价整段正文。
- 不要求逐字一致；允许同义改写。
- 医学数据、人群、适应证、禁忌证、时间、剂量、结论方向不一致时应标为 `mismatch`。
- 只有主题相近但证据不够完整时标为 `weak`。
- 输出严格 JSON，不能添加 Markdown。

AI JSON 响应形状：

```json
{
  "items": [
    {
      "citation_key": "1-47",
      "anchor_key": "1-47~1",
      "status": "supported",
      "reason": "引用详情直接说明了该治疗措施的起效时间。"
    }
  ]
}
```

后端只信任 `citation_key`、`anchor_key`、`status`、`reason` 字段；其他字段忽略。

## 引用匹配细节

后端引用扫描复用现有引用正则和句子切分思路，避免前后端规则分叉。

匹配规则：

- 优先用 `anchor_key` 或 `citation_key` 精确匹配。
- 多个 anchor 对应同一个 `citation_key` 时，按答案句子和 anchor.quote 的重合度选择最相关的一条。
- `R1-C001` 这类切片 ID 若仍出现在文本中，也应能匹配到 `chunk_id`。
- 原词条引用 `[0-18]` 可以核对原词条 anchor。
- 未找到 anchor 的引用不交给 AI 判定，直接生成 `unverifiable` 项并说明“未找到可点击详情”。

## 前端展示

问答记录展开后，在重点指南状态条附近展示引用核对状态：

- 全部通过：`引用核对通过`
- 有需确认项：`引用核对发现 N 处需人工确认`
- 核对失败：`引用核对未完成，请人工检查`

在 `AiCitationPanel` 中展示当前引用对应的核对结果：

- 状态标签：通过 / 需确认 / 不匹配 / 无法判断
- 原因：后端返回的 `reason`
- 若同一可点击引用聚合了多条核对结果，显示最严重状态，并列出对应句子摘要。

显示原则：

- 不改变正文内容，不隐藏引用。
- `weak` 和 `unverifiable` 使用提醒色；`mismatch` 使用错误色。
- 老历史记录没有核对数据时，面板保持现状。

## 错误处理

- 引用核对 AI 调用失败时，`generate_ai_integration_answer()` 仍返回整合结果，并附带 `CitationVerificationResult(status="failed")`。
- AI 返回非法 JSON 时，尝试剥离代码块并解析；仍失败则返回 `failed`。
- 某条引用无法匹配 anchor 时，只标记该条 `unverifiable`，不让整个核对失败。
- 核对输入项过多时，后端限制数量，优先核对 `revision_text` 中出现的引用，并在 `warnings` 说明部分引用未核对。

## 性能与成本

自动核对会增加一次 AI 调用。为控制成本：

- 只核对最终展示文本，优先 `revision_text`。
- 去重相同的“句子 + citation_key + quote”组合。
- 默认最多核对 40 条引用；超过时返回 warning。
- 核对 prompt 只传句子和 anchor 摘要，不传完整参考文献全文。

## 测试

后端：

- 从 AI 整合正文中提取引用所在句子。
- 将引用 token 匹配到 `reference_anchors`。
- 同一 `citation_key` 多个 anchor 时选择与答案句子更相关的 anchor。
- AI 返回 `supported` 时整体状态为 `passed`。
- AI 返回 `weak/mismatch/unverifiable` 时整体状态为 `needs_review`。
- AI 调用失败时仍返回 AI 整合答案，并将核对状态标为 `failed`。
- 不可定位引用生成 `unverifiable` 项。
- 超过数量上限时产生 warning。

前端：

- `AiIntegrationRecord` 保存 `citationVerification`。
- 问答记录展开时显示通过、需确认、失败三类状态。
- 引用详情面板显示当前引用的核对结论和原因。
- 老记录没有 `citationVerification` 时不显示核对 UI。

## 实施顺序

1. 扩展后端和前端数据模型。
2. 新增后端引用核对辅助函数和 prompt。
3. 在 `generate_ai_integration_answer()` 中接入同步核对和失败降级。
4. 增加后端测试。
5. 前端保存核对结果。
6. 前端增加状态条和引用详情面板展示。
7. 增加前端源代码测试。
8. 运行目标后端测试、前端测试和构建。
