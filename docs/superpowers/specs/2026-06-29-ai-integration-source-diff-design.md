# AI 整合原文对比设计

## 目标

让 AI 整合结果默认保持清洁正文展示，同时支持用户点击“对比原文”查看实际修改过的原文片段和修订后正文。对比视图只展示发生变化的段落，避免用户选择了大范围原词条内容后被整篇原文淹没。

## 背景

当前 AI 整合记录已经保存：

- `answer`：AI 返回内容。
- `originalScope`：本次带入全文、章节或不带入原文。
- `selectedSectionIds`：按章节带入时的章节列表。
- `originalContentSnapshot`：生成时实际带入的原词条内容快照。

这些字段已经具备原文追溯基础。缺口在于：现有 `answer` 可能混合修订正文、说明、证据不足提示和后续建议，前端无法稳定判断哪部分是“改后的正文”。因此需要收紧 AI 整合输出契约，显式保存可对比的修订正文。

## 范围

包含：

- AI 整合返回并保存明确的“修订后正文”。
- 问答记录默认展示清洁版本。
- 有原文快照和修订正文时显示“对比原文”按钮。
- 对比视图左右展示：左侧原文相关片段，右侧修订后正文片段。
- 右侧标注新增、删除、替换等修改痕迹，并以左侧原文作为参照。
- 只展示发生变化的段落块，不展示完整原文。

不包含：

- 自动把修订结果回写到原词条。
- 用户手动选中一句话后做局部对比。
- 多版本合并、人工接受/拒绝每处修改。
- 完全依赖 AI 自报修改清单作为唯一差异来源。

## 推荐方案

采用“结构化输出 + 前端自动差异识别”。

后端要求 AI 整合结果固定包含修订后正文，并将其作为结构化字段返回。前端保存该字段，并基于 `originalContentSnapshot` 与 `revisionText` 计算变更块。这样既避免前端猜测 AI 回答中哪段是正文，也避免完全依赖 AI 自报修改处。

## 数据模型

扩展后端响应：

```py
class AiIntegrationResponse(BaseModel):
    answer: str
    revision_text: str = ""
    change_summary: List[str] = []
    references_used: List[str] = []
    reference_anchors: List[ReferenceAnchor] = []
```

扩展前端记录：

```ts
export interface AiIntegrationRecord {
  id: string
  request: string
  answer: string
  revisionText?: string
  changeSummary?: string[]
  referencesUsed: string[]
  referenceAnchors?: ReferenceAnchor[]
  linkedIssues?: AiIntegrationLinkedIssue[]
  selectedReferences: string[]
  priorityReferences: string[]
  originalScope: 'all' | 'sections' | 'none'
  selectedSectionIds: string[]
  originalContentSnapshot?: string
  createdAt: string
}
```

兼容规则：

- 老记录没有 `revisionText` 时继续展示 `answer`，但不启用“对比原文”。
- 如果 AI 没有返回可解析的修订正文，`revisionText` 为空，前端显示清洁回答但不提供对比。
- 如果本次 `originalScope` 是 `none`，即使有 `revisionText` 也不显示原文对比按钮。

## AI 输出契约

AI 整合 prompt 增加硬性要求：

- 必须输出“修订后正文”区块。
- 修订后正文应是可直接粘贴到词条中的清洁文本。
- 不要把修改说明、证据不足提示、待确认事项混入修订后正文。
- 修改说明、风险提示、待确认事项放入单独区块。

后端解析推荐优先使用结构化 JSON。如果短期仍使用 Markdown 输出，则解析以下标题：

```md
## 修订后正文
...

## 修改说明
...
```

返回字段语义：

- `answer`：完整展示内容，可包含修订后正文、修改说明、证据不足提示。
- `revision_text`：仅修订后正文，用于默认清洁展示和原文对比。
- `change_summary`：AI 自报的修改摘要，只作辅助说明，不作为差异计算的唯一依据。

## 差异识别

前端新增纯函数 `buildAiIntegrationDiff(originalText, revisionText)`。

处理步骤：

1. 将原词条快照按标题、空行和段落拆成块，保留章节标题上下文。
2. 将修订后正文按同样规则拆成块。
3. 为每个修订块寻找最相似的原文块，优先同章节、相邻标题、关键词重合高的块。
4. 过滤完全相同或近似无变化的块。
5. 对保留块做词语或句子级 diff，生成新增、删除、替换标记。
6. 输出变更块列表。

输出结构：

```ts
export interface AiIntegrationDiffBlock {
  id: string
  heading?: string
  originalText: string
  revisedText: string
  originalTokens: DiffToken[]
  revisedTokens: DiffToken[]
  similarity: number
}

export interface DiffToken {
  text: string
  type: 'equal' | 'insert' | 'delete'
}
```

筛选原则：

- 只展示有新增、删除或替换的块。
- 对低相似度但明显新增的修订块，左侧显示“原文无对应段落”。
- 对原文中被移除的块，右侧显示“修订后已删除”。
- 对相似度过低且无法可靠配对的块，放到“需人工确认对应关系”的折叠区，避免制造虚假的逐句对齐。

## UI 设计

问答记录展开后默认展示清洁版：

- 若 `revisionText` 存在，默认展示 `revisionText`。
- 若 `revisionText` 不存在，回退展示 `answer`。
- 保留现有引用点击和引用定位能力。

有可对比内容时，在记录操作区显示：

- `对比原文`：进入对比视图。
- `返回清洁版`：退出对比视图。

对比视图布局：

- 顶部说明：`仅显示发生变化的段落`。
- 左列标题：`原文相关片段`。
- 右列标题：`修订后正文`。
- 每个变更块显示章节标题或段落位置。
- 左侧原文用于定位，不做完整修订痕迹视图，只突出被删改的原文词句。
- 右侧是主审阅区：新增内容用浅绿背景；替换内容用高亮标出；删除内容在对应位置显示浅红删除标记或“已删除：...”行，确保用户主要看右侧即可理解具体改动。
- 替换表现为右侧新增内容旁附带被替换的原文短片段。
- 移动端改为上下堆叠展示，同一变更块内先原文后修订。

空状态：

- 无原文快照：`本条记录没有可对比的原文快照`。
- 无修订正文：`本条记录没有可对比的修订正文`。
- 无明显差异：`未发现明显正文差异`。

## 错误处理

- AI 输出无法解析修订正文时，不阻塞整合结果展示，记录 `revisionText` 为空。
- 差异计算失败时，保留清洁展示，并在对比区域显示可恢复错误。
- 超长文本差异计算应设定块数量和字符数上限，必要时只计算与修订正文最相近的原文块。
- 引用锚点继续基于现有 `referenceAnchors` 工作；差异高亮不改变引用链接逻辑。

## 测试

前端纯函数测试：

- 能从大范围原文中只找出发生修改的段落。
- 能识别新增段落。
- 能识别删除段落。
- 能识别替换内容并在右侧标出新增。
- 对无差异内容返回空变更块。
- 对低相似度配对进入人工确认区或新增块，而不是强行错配。

前端组件测试：

- 老记录无 `revisionText` 时继续展示 `answer`。
- 有原文快照和修订正文时显示“对比原文”按钮。
- `originalScope = 'none'` 时不显示对比按钮。
- 对比视图和清洁视图可切换。

后端测试：

- AI 整合接口返回 `revision_text` 和 `change_summary`。
- Markdown 或 JSON 输出可被解析为修订正文。
- 解析失败时仍返回 `answer`，不让请求失败。
- 旧有引用重写逻辑仍作用于 `answer` 和 `revision_text` 中的引用标记。

## 实施顺序

1. 后端扩展 `AiIntegrationResponse`，增加 `revision_text` 与 `change_summary`。
2. 调整 AI 整合 prompt，要求输出独立“修订后正文”。
3. 增加解析函数和后端测试。
4. 扩展前端 `AiIntegrationRecord` 类型和记录保存逻辑。
5. 新增前端 diff 纯函数与测试。
6. 在 `StepAiIntegration` 历史记录中增加清洁版/对比视图切换。
7. 增加 CSS 样式和移动端布局。
8. 跑前后端测试与构建。

## 后续增强

- 支持用户选中 AI 结果中的某一段后，只对比该段。
- 允许用户逐条接受或忽略修改。
- 将 AI 自报修改说明与程序 diff 结果并排展示。
- 将对比结果导出为 Word 修订痕迹或审稿说明。
