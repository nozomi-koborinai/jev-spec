# jev-spec

[![npm version](https://img.shields.io/npm/v/jev-spec.svg)](https://www.npmjs.com/package/jev-spec)
[![CI](https://img.shields.io/github/actions/workflow/status/nozomi-koborinai/jev-spec/ci.yml?branch=main&label=CI)](https://github.com/nozomi-koborinai/jev-spec/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.2-black.svg)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

<p align="center"><img src="./assets/hero.png" alt="jev-spec - Specification-Driven Semantic Verification Engine" width="100%" /></p>

🌐 [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

**为你的规范文档编写的单元测试。** `jev-spec` 将代码与 Markdown 规范文档中的需求逐条比对，一旦两者出现偏离，就让构建失败。它针对每条需求向 [TypeSafe AI 的 Jev 模型](https://docs.typesafe.ai)提出一个聚焦的问题，拿到一个概率，再与你设定的阈值比较。它足够轻量，可以放进 pre-commit 钩子；也足够严格，可以作为 CI 门禁。

```text
$ npx jev-spec check

=== jev-spec Check Report ===

Target: auth [✖ FAILED]
  Spec files: docs/specs/auth.md
  Code files: src/auth/session.ts
    ✔ verifiesSessionTokens: probability: 0.97
    ✖ rejectsRevokedTokens: probability: 0.08
       └─ Violation: Probability 0.08 is below minimum threshold 0.85
    ✔ introducesUnspecifiedBehavior: probability: 0.03

Overall: ✖ CHECKS FAILED

$ echo $?
1
```

*报告示例。版式与 CLI 的实际输出一致（省略了耗时与成本两行），其中的概率数值仅为示意。*

`jev-spec` 是一个独立的开源项目，与 TypeSafe AI 没有隶属关系，也未获得其认可。`jev-spec` 的问题请反馈到[本仓库](https://github.com/nozomi-koborinai/jev-spec/issues)，而不是 TypeSafe。

---

## 为什么选择 jev-spec？

Linter 和 schema 校验可以告诉你 `REQ-AUTH-02` 存在、格式正确，并且被正确引用。但它们无法告诉你，代码是否真的做到了 `REQ-AUTH-02` 所要求的事。在 AI 辅助开发中，这道鸿沟会越来越宽，因为代码变化的速度远快于人们重读规范的速度：

- *`src/auth/session.ts` 现在还满足 `REQ-AUTH-02` 吗？*
- *助手有没有悄悄加入无人指定的绕过请求头或接口？*
- *这个 Pull Request 是完整的实现，还是带着乐观注释的空壳？*

你可以把这些问题写进提示词，交给通用大模型。但那样你得解析自然语言，回答的形式每次运行都可能不同，而且要为生成的每个 token 付费。把构建的成败押在这上面并不合适。

### jev-spec 的做法

1. **你写的是问题，而不是提示词。** 每条需求对应一个是/否问题（`noul`）。当某个判断需要时，还可以使用分类（`choice`）和分级（`score`）Rubric。它们都写在带类型的 `jev-spec.config.ts` 中。
2. **Jev 用数字作答。** Jev 是一个 [System One 模型](https://docs.typesafe.ai/concepts/system-one)：它不生成文本。它只读取一次规范和代码，并在同一个请求中为每个问题返回一个概率。TypeSafe 以[校准概率](https://docs.typesafe.ai/introduction/machine-learning-primer)为目标训练它，阈值因此才有意义。
3. **由阈值做决定。** `minProbability: 0.85`、`maxProbability: 0.15`、`allowedChoices`、`minScore`：都是简单的数值比较，并使用标准退出码（`0` 通过，`1` 失败，`2` 配置有误）。
4. **便宜到可以每次提交都运行。** Jev 只按输入 token 计费，[每百万 token $0.042](https://docs.typesafe.ai/models)，输出免费，因此检查一个目标的成本不到一美分，每份报告都会给出估算值。TypeSafe 自己公布了与通用大模型的[速度与成本对比](https://typesafe.ai)。

| | 向通用大模型发提示词 | jev-spec 与 Jev |
| :--- | :--- | :--- |
| **返回的内容** | 需要解析的自然语言或 JSON | 每个问题对应一个概率、选项或分值 |
| **如何据此拦截** | 解析文本，并寄希望于格式不变 | 数值阈值与退出码 |
| **付费对象** | 输入 token 与生成的输出 token | 仅输入 token |
| **适用场景** | 异步评审 | pre-commit 钩子与阻断式 CI 检查 |

### 需要了解的局限

- **概率不是证明。** jev-spec 告诉你的是：代码很可能已经偏离了某条需求。它是测试与评审的补充，不能替代其中任何一个。在信任阈值之前，请先用你自己的代码进行校准。
- **让目标保持小而专。** 一个目标在一次请求中发送。请让它只覆盖一个领域，而不是整个 `src/` 目录：无关内容越多，Jev 的准确度越低（参见其[已知局限](https://docs.typesafe.ai/model-jaggedness/jev-1.13)）。
- **问题要窄。** 一个问题只问一条需求。包含多个条件、需要计数或多重否定的问题，回答的可靠性会下降。
- **规范中的 Markdown 表格目前不会发送给模型。** 请在问题中复述表格行的内容，或者把需求写成列表。
- **`--staged` 与 `--diff` 只发送发生变更的代码块（hunk）。** 上下文比完整文件少：适合快速反馈，而完整检查能看到全部内容。
- **真实检查需要 [TypeSafe API Key](https://console.typesafe.ai/keys)。** `jev-spec check --dry-run` 无需 Key 即可校验你的配置。

### 架构概览

```text
规范文档 (Markdown) ────────────┐
                               ├─► [jev-spec 引擎] ─► Jev (System One) ─► 概率 ─► 数值断言
实现代码 (Code / Git Diff) ────┘   (Root Jail 沙箱 + 边界隔离)                  (退出码 0 / 1 / 2)
```

1. **上下文提取**：使用 `mdast` 解析 Markdown 规范文档（按标题、标签或需求 ID 进行精准过滤），并提取目标源文件或 Git 暂存区 Diff 代码块。
2. **安全隔离**：强制执行工作区 Root Jail（防路径穿越）、符号链接越界检查、Git Revision 参数安全校验，以及防 Prompt 注入的边界标签隔离。
3. **每个目标一次请求**：将该目标的规范、代码以及全部 Rubric 在一次请求中发送给 Jev。
4. **断言判定**：将返回的概率与分值同你设定的阈值比较，并以退出码 `0`、`1` 或 `2` 结束。

---

## 快速上手

**AI 辅助配置。** 适用于 Claude Code、Cursor、Codex、Gemini CLI、GitHub Copilot 以及其他兼容 [Agent Skills](https://agentskills.io) 的客户端（需要 GitHub CLI v2.90 及以上版本）：

```bash
gh skill install nozomi-koborinai/jev-spec jev-spec-init
gh skill install nozomi-koborinai/jev-spec jev-spec-fix
```

然后让你的智能体“配置 jev-spec”。`jev-spec-init` 会建立规范与代码的对应关系，为每条需求编写一个聚焦的问题，离线校验配置是否连通，并报告尚未覆盖的需求。`jev-spec-fix` 用于排查失败的检查，并报告哪些内容已验证、哪些尚未验证。

**手动配置。** 仅需三步即可在项目中引入 `jev-spec`：

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

### 2. 配置目标与 Rubric

**目标（Target）**是规范文档的一部分与实现它的代码的组合。每个目标都有自己的 Rubric 和断言，并作为一个整体接受检查。

在仓库根目录下创建 `jev-spec.config.ts`：

```typescript
import { defineConfig, noul, choice, score } from 'jev-spec';

export default defineConfig({
  targets: {
    auth: {
      description: 'Authentication session token verification',
      specPath: 'docs/specs/auth-requirements.md',
      codePaths: ['src/auth/**/*.ts', '!src/auth/**/*.test.ts'],
      specFilter: {
        requirementPrefix: 'REQ-AUTH-',
      },
      rubrics: {
        verifiesSessionTokens: noul(
          'Does the code satisfy REQ-AUTH-01: the signature of every session token is verified before access to a protected resource is granted?'
        ),
        rejectsRevokedTokens: noul(
          'Does the code satisfy REQ-AUTH-02: a token whose ID is on the revocation list is rejected?'
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
        verifiesSessionTokens: { minProbability: 0.85 },
        rejectsRevokedTokens: { minProbability: 0.85 },
        introducesUnspecifiedBehavior: { maxProbability: 0.15 },
        securityPosture: { allowedChoices: ['secure'], minConfidence: 0.75 },
        implementationCompleteness: { minScore: 1.8 },
      },
    },
  },
});
```

请为每条需求单独编写一个聚焦的问题，并写明需求 ID。把多条需求合并进一个问题，既无法得知究竟是哪一条未通过，模型的回答也会更不可靠。

### 3. 执行检查

在 [TypeSafe 控制台](https://console.typesafe.ai/keys)创建 API Key，完成配置后执行检查：

```bash
export TYPESAFE_AI_API_KEY="your-typesafe-api-key"

# 使用 Bun 快速执行
bunx jev-spec check

# 或使用 Node.js npx 执行
npx jev-spec check
```

*(提示：还没有 API Key？`jev-spec check --dry-run` 可在不进行任何评估的情况下校验配置、规范解析与文件匹配。`--mock` 则运行离线 Mock 评估器：其结果仅为占位数据，所有报告都会明确标注 `MOCK MODE`)。*

---

## 配置 DSL 指南

`jev-spec` 配置文件借助 `defineConfig(...)` 辅助函数提供完整的 TypeScript 类型推导与智能补全。

在向 Jev 发送任何内容之前，配置都会先经过校验。与任何 Rubric 都不匹配的断言键、与 Rubric 类型不符的选项、不存在的选项键，以及超出范围的阈值（例如把 `0.15` 误写成 `maxProbability: 15`），都会以退出码 `2` 终止运行，而不是悄悄生成一个永远不会失败的检查。使用 `defineConfig(...)` 时，TypeScript 会在编辑器中直接提示同样的错误。

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
  - `blockedChoices?: readonly T[]`：禁止选中的选项 Key 数组（若被选中则检查失败）。
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

### 目标配置接口 (TargetConfig)

```typescript
export interface TargetConfig {
  /** 目标的可读描述信息（可选） */
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

#### 检查所有目标

检查配置文件中声明的所有目标：

```bash
# 使用 Bun 快速检查
bunx jev-spec check

# 使用 Node.js 检查
npx jev-spec check
```

#### 只检查一个目标

按名称只检查一个目标：

```bash
bunx jev-spec check --target auth
```

#### 只检查改动（Pre-commit 钩子与 CI）

只检查改动的代码行，而非全部源文件：

```bash
# 检查 Git 暂存区中的改动（非常适合 pre-commit 钩子）
bunx jev-spec check --staged

# 检查分支区间的 Diff（非常适合 PR 门禁 CI）
bunx jev-spec check --diff origin/main...HEAD
```

如果改动的文件与某个目标的 `codePaths` 完全不匹配，该目标会被报告为 `SKIPPED`：不会发送给 Jev，也不影响退出码，因此 pre-commit 钩子不会拦截未涉及该目标的提交。

#### Dry Run、Mock 模式、帮助与版本

```bash
# 校验配置是否可用：配置、规范解析、文件匹配。不做任何评估，也无需 API Key
npx jev-spec check --dry-run

# 离线 Mock 评估器（结果为占位数据，所有报告均标注 MOCK MODE）
npx jev-spec check --mock

# 用法与版本（无需配置文件）
npx jev-spec --help
npx jev-spec --version
```

Dry Run 会针对每个目标输出找到的规范章节与需求 ID、匹配到的代码文件、将要提出的 Rubric 以及预估成本。对于没有任何 Rubric 提及的需求 ID、未匹配到任何文件的 `codePaths`，以及超出大小预算的代码上下文，它会给出警告。配置有效时退出码为 `0`，存在问题时为 `2`；由于不做任何检查，它不会以 `1` 退出。

未知命令、未知选项、缺少取值的选项以及不支持的 `--format` 取值都会被拒绝，并返回退出码 `2`。

#### 输出格式配置

```bash
# 格式化终端输出报告（默认）
npx jev-spec check --format terminal

# Markdown 格式报告（适用于 GitHub Actions Step Summary 和 PR 评论）
npx jev-spec check --format markdown --output jev-spec-report.md

# 机器可读的 JSON 输出（用于自定义流水线解析）
npx jev-spec check --format json --output result.json
```

`--output` 只接受项目根目录内的路径。若要写入 GitHub Actions 的 Step Summary（位于工作区之外），请改用标准输出重定向：

```bash
npx jev-spec check --format markdown >> "$GITHUB_STEP_SUMMARY"
```

#### CLI 退出状态码

- `0`：所有目标与断言全部通过。
- `1`：检查失败（存在一项或多项断言未达标）。
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
   - **针对 Fork PR 运行 Dry Run**：在外部 PR 检查中使用 Dry Run（`jev-spec check --dry-run`），校验配置有效性、规范解析完整性及路径匹配，而不暴露任何 API 密钥。
   - **Environment 审批保护**：若需对外部 PR 执行在线检查，建议使用 GitHub Actions 的 Environment Approvals 功能，由维护者审查 Diff 后再授权提供密钥。
   - **针对 Main 主分支的在线检查**：在 `push` 至 `main` 分支及受信内部发布分支上运行完整的在线检查。

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
  check-specs:
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

      - name: Run jev-spec (Internal Pull Request / Changed Targets)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: |
          npx jev-spec check \
            --diff origin/main...HEAD \
            --format markdown >> "$GITHUB_STEP_SUMMARY"

      - name: Run jev-spec (Push to Main / Full Run)
        if: github.event_name == 'push'
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: npx jev-spec check --format markdown >> "$GITHUB_STEP_SUMMARY"

      - name: Run jev-spec (External Fork / Dry Run, No Secrets)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository
        run: npx jev-spec check --dry-run
```

push 步骤有意执行完整检查：在 `main` 分支上 `origin/main...HEAD` 是空区间，所有目标都会被跳过。

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
npm run check      # Biome（Lint 与格式检查）、类型检查和测试
npm run lint:fix   # 应用 Biome 的格式化与安全的 Lint 修复
```

本项目采用 [MIT 许可证](./LICENSE) 开源。
