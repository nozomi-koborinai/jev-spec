[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh.md) | [한국어](./README.ko.md)

# jev-spec

[![npm version](https://img.shields.io/npm/v/jev-spec.svg)](https://www.npmjs.com/package/jev-spec)
[![CI](https://img.shields.io/github/actions/workflow/status/nozomi-koborinai/jev-spec/ci.yml?branch=main&label=CI)](https://github.com/nozomi-koborinai/jev-spec/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.2-black.svg)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

<p align="center"><img src="./assets/hero.png" alt="jev-spec - Specification-Driven Semantic Verification Engine" width="100%" /></p>

**基于 TypeSafe AI Jev 构建的 AI 代码与规范语义验证引擎（面向规范驱动开发）**

---

## 为什么选择 jev-spec？填补语义鸿沟

在规范驱动开发（SDD: Specification-Driven Development）与 AI 辅助编程工作流（Cursor、智能编码 Agent、GitHub Copilot）中，传统的结构检查工具可以确定性地校验 Markdown 结构、标题层级、交叉引用以及需求 ID。然而，静态语法检查工具无法跨越代码与规范之间的**语义鸿沟（Semantic Gap）**：

- *`src/auth/session.ts` 是否真正满足了 `REQ-AUTH-02` 中规定的功能性验收标准？*
- *AI 助手是否悄悄引入了未声明的副作用、未授权的绕过 Header 或未经文档记录的隐蔽端点？*
- *当前 Pull Request 是一个功能完整的真实实现，还是仅包含 TODO 注释的乐观桩代码（Stub）？*

### 自回归生成式 LLM 的困境：使用自由文本生成进行代码验证

以往，评估语义合规性通常依赖针对自回归生成式语言模型的提示词工程（Prompt Engineering）：

- **高延迟**：逐 Token 的顺序生成导致单个文件的审查耗时长达 **5 至 15 秒**。
- **高昂成本**：自回归解码导致单次文件评估消耗 **$0.05 至 $0.20+**。
- **非确定性漂移**：脆弱的 Prompt 模板、幻觉推理、JSON 解析失败，以及多次执行之间的主观结果漂移。
- **工作流摩擦**：速度过慢，无法应用于 Git pre-commit 钩子、暂存区 Diff 审查或快速阻断式 CI 门禁。

### Jev 的核心优势：超越自由文本生成的结构化决策原语

在光学物理中，**准直器（Collimator）** 能够将发散杂乱的光束校准为高度平行的聚集光束。`jev-spec` 正是软件工程中的语义准直器：将 AI 编程模型产生的高熵、发散输出，校准收敛为具备数学校准精度的确定性验证决策。

`jev-spec` 基于 **TypeSafe AI Jev** 构建，摒弃了逐 Token 的自由文本生成架构，直接建立在结构化决策原语之上：

- **结构化决策原语**：Jev 不在无约束空间中逐 Token 吐出自然语言或 JSON 字符串，而是在单次前向传播中，基于共享的规范与代码上下文，直接预测类型化决策原语（`noul`、`choice`、`score`）的校准概率分布。
- **低于 400ms 的超高速验证**：单次前向传播评估仅需 **70ms 至 400ms**。
- **极致的成本效益**：输入 Token 每百万仅需 **$0.042**（输出 Token 免费）——比生成式 Review 便宜 100 倍以上。
- **严格的数学校准（Empirical Calibration）**：评估通过“校准决策强化学习”（RLCD: Reinforcement Learning for Calibrated Decisions）训练的类型化决策原语。预测概率为 0.85 意味着该命题在经验统计上有 85% 的概率为真。
- **并行采样器**：在单次前向传播中，针对共享的规范与实现代码，同时评估布尔命题（`noul`）、类别分布（`choice`）与有序等级（`score`）。
- **确定性数值断言**：在终端、pre-commit 钩子或 CI 流水线中，直接通过数值阈值（`minProbability`、`maxProbability`、`allowedChoices`、`minScore`）进行语义断言，并返回标准退出码。

| 核心维度 | 自回归 LLM 提示词评审 | jev-spec + Jev（决策原语） |
| :--- | :--- | :--- |
| **执行速度** | 单文件 5,000ms – 15,000ms | **70ms – 400ms**（单次前向传播） |
| **Token 资费** | 约 $3.00 – $15.00 / MTok | **$0.042 / MTok**（输出 Token 完全免费） |
| **评估模式** | 逐 Token 的自由文本 / JSON 顺序解码 | **针对类型化决策原语的单次前向传播** |
| **输出形式** | 非结构化自然语言或待解析 JSON 字符串 | **校准概率分布与分类概率分布** |
| **确定性** | 主观推理过程与格式解析漂移 | **严格的数值阈值（如 `minProbability: 0.85`）** |
| **Git 钩子与快速 CI** | 无法落地（严重打断开发节奏） | **即时执行（Bun 冷启动 <100ms）** |

### 架构概览

```text
规范文档 (Markdown / MDX) ──────┐
                               ├─► [jev-spec 引擎] ─► Jev 决策模型 ─► 校准决策与数值断言
实现代码 (Code / Git Diff) ────┘   (Root Jail 沙箱 + 边界隔离)        (<400ms 内完成通过/阻断判定)
```

1. **上下文提取**：使用 `mdast` 解析 Markdown 规范文档（按标题、标签或需求 ID 进行精准过滤），并提取目标源文件或 Git 暂存区 Diff 代码块。
2. **安全隔离**：强制执行工作区 Root Jail（防路径穿越）、符号链接越界检查、Git Revision 参数安全校验，以及防 Prompt 注入的边界标签隔离。
3. **并行前向传播**：将共享上下文和评估准则以单个批处理请求发送至 Jev 决策引擎。
4. **断言判定**：将返回的校准概率和分值与预设数值阈值进行比对，以确定性状态码退出，无缝接入 CI/CD 自动化。

---

## 快速上手

仅需三步即可在项目中引入 `jev-spec`：

### 1. 安装 jev-spec

使用你习惯的包管理器将其安装为开发依赖：

```bash
# Bun（推荐，本地开发体验最佳）
bun add -d jev-spec

# npm
npm install -D jev-spec

# pnpm
pnpm add -D jev-spec
```

*也可以无需本地安装，直接通过 `bunx jev-spec` 或 `npx jev-spec` 运行。*

### 2. 配置验证区域与评估准则

在仓库根目录下创建 `jev-spec.config.ts`：

```typescript
import { defineConfig, noul, choice, score } from 'jev-spec';

export default defineConfig({
  zones: {
    auth: {
      description: 'Authentication session token verification',
      specPath: 'docs/specs/auth-requirements.md',
      codePaths: ['src/auth/**/*.ts', '!src/auth/**/*.test.ts'],
      specFilter: {
        requirementPrefix: 'REQ-AUTH-',
      },
      rubrics: {
        satisfiesRequirements: noul(
          'Does the code satisfy functional criteria defined in REQ-AUTH-01 and REQ-AUTH-02?'
        ),
        introducesUnspecifiedBehavior: noul(
          'Does the implementation introduce undocumented endpoints, global state mutability, or unauthenticated bypasses?'
        ),
        securityPosture: choice('Security posture of session management', {
          secure: 'Proper signature validation and revocation checks present',
          insecure: 'Missing verification, weak crypto, or tokens logged',
        }),
        implementationCompleteness: score('Degree of completeness', [
          'Stub: Empty function signatures or TODO comments',
          'Partial: Happy path implemented, error handling missing',
          'Feature Complete: Complete implementation meeting all criteria',
        ]),
      },
      assertions: {
        satisfiesRequirements: { minProbability: 0.85 },
        introducesUnspecifiedBehavior: { maxProbability: 0.15 },
        securityPosture: { allowedChoices: ['secure'], minConfidence: 0.75 },
        implementationCompleteness: { minScore: 1.8 },
      },
    },
  },
});
```

### 3. 执行语义验证

配置 API Key 并执行验证命令：

```bash
export TYPESAFE_AI_API_KEY="your-typesafe-api-key"

# 使用 Bun 快速执行
bunx jev-spec check

# 或使用 Node.js npx 执行
npx jev-spec check
```

*(提示：在配置中传入 `client: { mock: true }` 可在无 API Key 的情况下进行离线测试和本地 CI 模拟)。*

---

## 配置 DSL 指南

`jev-spec` 配置文件借助 `defineConfig(...)` 辅助函数提供完整的 TypeScript 类型推导与智能补全。

### 核心 DSL 原语

#### noul(question): NoulRubric

**noul** 是一个在 `[0, 1]` 区间内进行评估的校准布尔命题。Jev 会根据给定的规范上下文与实现代码，推算该陈述为真的经验概率。

```typescript
rubrics: {
  implementsRateLimit: noul('Does the rate limiter enforce a 60 req/min bucket?'),
  hasBypassHeader: noul('Does the implementation permit any unauthenticated bypass header?'),
},
assertions: {
  implementsRateLimit: { minProbability: 0.85 },
  hasBypassHeader: { maxProbability: 0.10 },
}
```

- **断言配置项**：
  - `minProbability?: number`：最低可接受概率阈值（`[0, 1]`）。
  - `maxProbability?: number`：最高容忍概率阈值（`[0, 1]`）。

#### choice(description, options): ChoiceRubric

**choice** 准则表示一组互斥选项上的离散分类概率分布。

```typescript
rubrics: {
  architecturePattern: choice('Architectural pattern applied', {
    hexagonal: 'Domain logic isolated with ports and adapters',
    layered: 'Classic controller-service-repository layered pattern',
    spaghetti: 'Tightly coupled concerns without distinct abstraction boundaries',
  }),
},
assertions: {
  architecturePattern: {
    allowedChoices: ['hexagonal', 'layered'],
    blockedChoices: ['spaghetti'],
    minConfidence: 0.80,
  },
}
```

- **断言配置项**：
  - `allowedChoices?: readonly T[]`：允许选中的选项 Key 数组。
  - `blockedChoices?: readonly T[]`：禁止选中的选项 Key 数组（若被选中则验证失败）。
  - `minConfidence?: number`：选中该选项所需的最低置信度阈值（`[0, 1]`）。

#### score(description, levels): ScoreRubric

**score** 准则用于在 2 到 10 个有序梯级上进行连续分值评估。返回连续分值、各梯级分布概率以及置信度指标。

```typescript
rubrics: {
  implementationCompleteness: score('Implementation depth relative to specification', [
    'Stub: Function signatures with empty bodies or TODO comments',
    'Partial: Happy path implemented, error handling or edge cases missing',
    'Feature Complete: Happy path and error branches fully handled',
    'Production Ready: Complete implementation with validation and defensive bounds',
  ]),
},
assertions: {
  implementationCompleteness: {
    minScore: 2.0, // 最低小数分值索引（0 = Stub, 3 = Production Ready）
    minConfidence: 0.70,
  },
}
```

- **断言配置项**：
  - `minScore?: number`：最低允许的小数分值索引。
  - `maxScore?: number`：最高允许的小数分值索引。
  - `minConfidence?: number`：最低置信度指标（`[0, 1]`）。

### 区域配置接口 (ZoneConfig)

```typescript
export interface ZoneConfig {
  /** 区域的可读描述信息（可选） */
  readonly description?: string;

  /** 工作区内 Markdown / MDX 规范文档的相对路径 */
  readonly specPath: string;

  /** 目标代码文件的相对路径或 Glob 匹配模式 */
  readonly codePaths: readonly string[];

  /** 规范文档片段提取过滤规则 */
  readonly specFilter?: {
    readonly headings?: readonly string[];       // 按标题过滤
    readonly requirementPrefix?: string;         // 如 'REQ-AUTH-' 或 'AC-'
    readonly tags?: readonly string[];           // 按标签过滤（如 ['auth']）
  };

  /** 声明的 Jev 评估准则 */
  readonly rubrics: Record<string, AnyRubric>;

  /** 针对 Jev 评估结果的断言规则 */
  readonly assertions: AssertionMap<R>;
}
```

`specFilter` 会保留满足全部条件的章节及其嵌套的子章节，因此写在更深层标题下的细节仍然属于该需求。若过滤条件未匹配到任何章节，将被视为配置错误（退出码 `2`），而不是悄悄发送整份文档。

### CLI 命令参考

#### 检查所有区域

对配置文件中声明的所有区域执行语义验证：

```bash
# 使用 Bun 快速校验
bunx jev-spec check

# 使用 Node.js 校验
npx jev-spec check
```

#### 指定特定区域验证

仅对单一指定区域执行校验：

```bash
bunx jev-spec check --zone auth
```

#### 基于 Git Diff 校验（Pre-commit 钩子与 CI）

仅对改动的代码行而非全部源文件进行针对性语义验证：

```bash
# 校验 Git 暂存区中的改动（非常适合 pre-commit 钩子）
bunx jev-spec check --staged

# 针对分支区间的 Diff 进行校验（非常适合 PR 门禁 CI）
bunx jev-spec check --diff origin/main...HEAD
```

#### 输出格式配置

```bash
# 格式化终端输出报告（默认）
npx jev-spec check --format terminal

# Markdown 格式报告（适用于 GitHub Actions Step Summary 和 PR 评论）
npx jev-spec check --format markdown --output jev-spec-report.md

# 机器可读的 JSON 输出（用于自定义流水线解析）
npx jev-spec check --format json --output result.json
```

#### CLI 退出状态码

- `0`：所有区域与断言全部通过。
- `1`：验证失败（存在一项或多项断言未达标）。
- `2`：配置或运行时错误（文件丢失、参数无效、未提供 API Key 等）。

---

## 双运行时支持矩阵

`jev-spec` 为现代 **Node.js** 与 **Bun** 提供一流的双运行时支持。所有 Pull Request 都会在自动化 CI 中针对所有支持的版本进行严格测试。

| 运行时环境 | 支持版本 | 支持层级 | 推荐适用场景 | 典型冷启动耗时 |
| :--- | :--- | :--- | :--- | :--- |
| **Bun** | `>= 1.2`（最新） | Tier 1 / 完全支持 | 极速 pre-commit 钩子、暂存区检查、本地开发循环 | **< 100ms** |
| **Node.js** | `>= 22.0.0`（LTS 22） | Tier 1 / 完全支持 | 标准生产级 CI/CD 流水线、容器化构建环境 | 约 350ms – 500ms |
| **Node.js** | `>= 24.0.0`（Current 24） | Tier 1 / 完全支持 | 前沿 Node 运行时与实验性环境 | 约 350ms – 500ms |

### 为什么推荐使用 Bun 运行 Pre-Commit 钩子？

由于 Jev 评估决策耗时仅在 **亚秒级（70ms 至 400ms）**，本地开发流程中耗时占比最高的部分实际上是运行时的启动开销：

- **毫秒级启动**：`bunx jev-spec check --staged` 启动耗时 **低于 100ms**，比传统运行时快 3 倍以上。
- **无感 Git 钩子**：开发者仅需不到半秒钟即可完成对暂存区修改的完整语义断言。
- **原生 TypeScript 执行**：直接读取执行 `jev-spec.config.ts`，无需任何转译额外耗时。

---

## 安全与 CI 最佳实践

`jev-spec` 专为自动化 CI/CD 流程与开发者本地环境的安全执行而设计。

### CI 威胁模型：外部 Fork PR 与密钥管理

> [!WARNING]
> 切勿向公开仓库中不受信任的外部 Pull Request（`pull_request` 事件）暴露 `TYPESAFE_AI_API_KEY`！

1. **不可信代码风险**：在公开开源仓库中，外部 PR 可能篡改 `jev-spec.config.ts`、规范或执行脚本。在持有高权限 API 密钥的环境下执行不可信代码存在密钥外泄风险。
2. **推荐的纵深防御实践**：
   - **针对 Fork PR 运行离线 Mock 模式**：在外部 PR 检查中使用 Mock 模式（`client.mock = true`），校验配置有效性、规范解析完整性及路径匹配，而不暴露任何 API 密钥。
   - **Environment 审批保护**：若需对外部 PR 执行在线验证，建议使用 GitHub Actions 的 Environment Approvals 功能，由维护者审查 Diff 后再授权提供密钥。
   - **针对 Main 主分支在线验证**：在 `push` 至 `main` 分支及受信内部发布分支上运行完整的真实语义校验。

### 推荐的 GitHub Actions 工作流配置

```yaml
name: Specification Semantic Gate

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  verify-specs:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install Dependencies
        run: npm ci

      - name: Run jev-spec (Internal / Main)
        if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: |
          npx jev-spec check \
            --diff origin/main...HEAD \
            --format markdown \
            --output $GITHUB_STEP_SUMMARY

      - name: Run jev-spec (External Fork / Mock Mode)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository
        run: |
          npx jev-spec check \
            --diff origin/main...HEAD \
            --format terminal
```

### 内置纵深安全防御机制

`jev-spec` 内置全面的防御性安全机制（加固项 S-01 至 S-05），全方位保护开发者设备与 CI 执行环境：

| 安全防御项 | 机制实现与保证 |
| :--- | :--- |
| **路径遍历防御与 Root Jail** | 所有工作区路径均通过 realpath 规范化解析严格校验（`assertInsideRoot()`）。拒绝工作目录之外的绝对路径、`..` 目录遍历以及逃逸出仓库根目录的符号链接。 |
| **Git Revision 参数净化** | 传入 `--diff` 的参数严格按照 Git 版本格式正则校验（`assertGitRevision()`）。拒绝任何以 `-` 开头的注入选项（防御类似 `--output` 的参数注入），在版本区间参数之前使用 `--end-of-options` 终止选项解析，并强制执行 15 秒命令超时。 |
| **提示词边界隔离防御** | 不受信任的规范文档与代码内容被严格封闭在明确的边界标签（`<specification_context>` 与 `<untrusted_source_code>`）中，并配有严格的防注入指令，指示 Jev 忽略代码内部潜藏的 Prompt 劫持指令。 |
| **Base URL SSRF 防御** | 默认情况下，请求严格限定在官方 TypeSafe AI 域名（`https://api.typesafe.ai`）。除非显式设置 `allowCustomBaseUrl: true`，否则拒绝所有自定义 API 地址，杜绝内网探测与 SSRF 风险。 |
| **资源耗尽保护** | 限制单次扫描最多 500 个文件，单个文件体积上限 2MB，并对单次评估 Prompt 执行严格的字符截断，防止 DoS 攻击与内存耗尽。 |

关于漏洞报告与安全政策的详细信息，请参阅 [SECURITY.md](./SECURITY.md)。

---

## 贡献与开源协议

欢迎社区贡献！在提交 Pull Request 之前，请确保所有测试用例与检查均顺利通过：

```bash
npm run check
npm test
```

本项目采用 [MIT 许可证](./LICENSE) 开源。
