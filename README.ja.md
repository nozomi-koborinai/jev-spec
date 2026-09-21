# jev-spec

[![npm version](https://img.shields.io/npm/v/jev-spec.svg)](https://www.npmjs.com/package/jev-spec)
[![CI](https://img.shields.io/github/actions/workflow/status/nozomi-koborinai/jev-spec/ci.yml?branch=main&label=CI)](https://github.com/nozomi-koborinai/jev-spec/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.2-black.svg)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

<p align="center"><img src="./assets/hero.png" alt="jev-spec - Specification-Driven Semantic Verification Engine" width="100%" /></p>

🌐 [English](README.md) | [简体中文](README.zh.md) | [한국어](README.ko.md)

**仕様書に対するユニットテスト。** `jev-spec` は、Markdown の仕様書に書かれた要件とコードを照合し、両者がずれたらビルドを失敗させます。要件ごとに焦点を絞った質問を 1 つずつ [TypeSafe AI の Jev モデル](https://docs.typesafe.ai)に投げ、返ってきた確率を、あなたが決めたしきい値と比べます。pre-commit フックに収まる軽さと、CI のゲートに使える厳密さを両立します。

```text
$ npx jev-spec check

=== jev-spec Verification Report ===

Zone: auth [✖ FAILED]
  Spec files: docs/specs/auth.md
  Code files: src/auth/session.ts
    ✔ verifiesSessionTokens: probability: 0.97
    ✖ rejectsRevokedTokens: probability: 0.08
       └─ Violation: Probability 0.08 is below minimum threshold 0.85
    ✔ introducesUnspecifiedBehavior: probability: 0.03

Overall: ✖ VERIFICATION FAILED

$ echo $?
1
```

*レポートの例です。レイアウトは CLI の実際の出力どおりで（所要時間とコストの行は省略）、確率の値は例示です。*

---

## なぜ jev-spec なのか

リンターやスキーマ検査は、`REQ-AUTH-02` が存在すること、書式が正しいこと、正しい場所からリンクされていることを確かめられます。しかし、コードが `REQ-AUTH-02` の言うとおりに動くかどうかは確かめられません。AI を使った開発では、誰かが仕様書を読み返すより速くコードが変わるため、この溝は広がります。

- *`src/auth/session.ts` は、今も `REQ-AUTH-02` を満たしているか？*
- *アシスタントが、誰も仕様に書いていないバイパスヘッダやエンドポイントをこっそり足していないか？*
- *このプルリクエストは完全な実装か、それとも楽観的なコメントの付いたスタブか？*

こうした問いを、汎用 LLM にプロンプトで尋ねることはできます。ただしその場合、文章をパースする必要があり、回答の形は実行のたびに変わり、生成されたトークンの分だけ費用がかかります。ビルドの合否を預ける相手としては扱いにくいものです。

### jev-spec のやり方

1. **プロンプトではなく、質問を書きます。** 要件ごとに、はい／いいえで答える質問（`noul`）を 1 つ用意します。判断に必要なときは、カテゴリ（`choice`）と段階評価（`score`）のルーブリックも使えます。これらは型付きの `jev-spec.config.ts` に書きます。
2. **Jev は数値で答えます。** Jev は [System One モデル](https://docs.typesafe.ai/concepts/system-one)で、テキストを生成しません。仕様とコードを一度読み込み、同じリクエストの中ですべての質問に確率を返します。TypeSafe は Jev を[校正された確率](https://docs.typesafe.ai/introduction/machine-learning-primer)を返すように訓練しており、しきい値が意味を持つのはそのためです。
3. **合否はしきい値が決めます。** `minProbability: 0.85`、`maxProbability: 0.15`、`allowedChoices`、`minScore`。どれも単純な比較で、終了コードも標準的です（`0` 成功、`1` 失敗、`2` セットアップの不備）。
4. **コミットのたびに回せる安さです。** Jev の料金は入力トークンだけにかかり、[100 万トークンあたり $0.042](https://docs.typesafe.ai/models)、出力は無料です。1 ゾーンの検査は 1 セントに満たず、見積もり額は毎回のレポートに表示されます。汎用 LLM との[速度とコストの比較](https://typesafe.ai)は、TypeSafe が自ら公開しています。

| | 汎用 LLM へのプロンプト | jev-spec と Jev |
| :--- | :--- | :--- |
| **返ってくるもの** | パースが必要な文章や JSON | 質問ごとの確率・選択肢・スコア |
| **合否の決め方** | テキストをパースし、書式が変わらないことを期待する | 数値のしきい値と終了コード |
| **費用がかかる対象** | 入力トークンと、生成された出力トークン | 入力トークンのみ |
| **向いている場面** | 非同期のレビュー | pre-commit フックと、マージを止める CI チェック |

### 知っておくべき限界

- **確率は証明ではありません。** jev-spec が教えるのは、コードが要件からおそらくずれた、ということです。テストやレビューを補うものであり、どちらの代わりにもなりません。しきい値は、信頼する前に自分のコードで調整してください。
- **ゾーンは小さく保ってください。** 1 つのゾーンは 1 回のリクエストで送られます。`src/` 全体ではなく、1 つの領域にしてください。無関係な内容が増えるほど Jev の精度は下がります（[既知の限界](https://docs.typesafe.ai/model-jaggedness/jev-1.13)を参照）。
- **質問は狭く。** 1 つの質問に要件は 1 つ。複数の条件をまとめた質問、数を数える質問、否定が重なる質問は、回答の信頼性が下がります。
- **仕様書内の Markdown テーブルは、まだモデルに送られません。** 行の内容を質問の中で言い直すか、要件をリストで書いてください。
- **`--staged` と `--diff` が送るのは、変更されたハンクだけです。** ファイル全体より文脈が少ないため、素早いフィードバック向きです。すべてを見るのはフルチェックです。
- **実際の検査には [TypeSafe の API キー](https://console.typesafe.ai/keys)が必要です。** `jev-spec check --dry-run` なら、キーなしでセットアップを検証できます。

### アーキテクチャ概要

```text
仕様書 (Markdown) ───────────────┐
                                ├─► [jev-spec エンジン] ─► Jev (System One) ─► 確率 ─► アサーション
実装コード (Code / Git Diff) ────┘   (Root Jail + 境界隔離)                          (終了コード 0 / 1 / 2)
```

1. **コンテキスト抽出**: `mdast` を用いて Markdown 仕様書をパースし（見出し、タグ、要件 ID でフィルタリング）、対象ソースファイルまたはステージングされた Git 差分ハンクを抽出。
2. **セキュリティ隔離**: ワークスペースの root jail（ルートディレクトリ外アクセスの防止）、シンボリックリンク脱出の検出、Git リビジョン引数のサニタイズ、プロンプトインジェクション防御のための境界タギングを適用。
3. **ゾーンごとに 1 リクエスト**: ゾーンの仕様、コード、すべてのルーブリックを、1 回のリクエストで Jev に送信。
4. **アサーション評価**: 返ってきた確率とスコアをしきい値と比較し、終了コード `0`・`1`・`2` のいずれかで終了。

---

## クイックスタート

**AI によるセットアップ。** Claude Code、Cursor、Codex、Gemini CLI、GitHub Copilot など、[Agent Skills](https://agentskills.io) 対応のクライアント向けです（GitHub CLI v2.90 以降が必要）。

```bash
gh skill install nozomi-koborinai/jev-spec jev-spec-init
gh skill install nozomi-koborinai/jev-spec jev-spec-fix
```

そのうえでエージェントに「jev-spec をセットアップして」と依頼してください。`jev-spec-init` は仕様書とコードの対応付けを行い、要件ごとに焦点を絞った質問を 1 つずつ書き、オフラインで配線を検証して、カバーされていない要件を報告します。`jev-spec-fix` は失敗したチェックの原因を切り分け、何が検証され何が検証されていないかを報告します。

**手動セットアップ。** 以下の 3 ステップですぐに `jev-spec` を導入できます。

### 1. jev-spec のインストール

お好みのパッケージマネージャーで開発用依存関係としてインストールします。

```bash
# Bun（ローカルの開発ループに推奨）
bun add -d jev-spec

# npm
npm install -D jev-spec

# pnpm
pnpm add -D jev-spec
```

*ローカルインストールを行わずに、`bunx jev-spec` または `npx jev-spec` で直接実行することも可能です。*

### 2. ゾーンとルーブリックの設定

リポジトリルートに `jev-spec.config.ts` を作成します。

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

質問は要件ごとに 1 つずつ、要件 ID を明記して書いてください。複数の要件を 1 つの質問にまとめると、どの要件で失敗したのか分からなくなり、モデルの回答の信頼性も下がります。

### 3. セマンティック検証の実行

[TypeSafe のコンソール](https://console.typesafe.ai/keys)で API キーを作成し、設定してから検証コマンドを実行します。

```bash
export TYPESAFE_AI_API_KEY="your-typesafe-api-key"

# Bun による高速実行
bunx jev-spec check

# Node.js npx による実行
npx jev-spec check
```

*(補足: まだ API キーが無い場合は、`jev-spec check --dry-run` で設定・仕様のパース・ファイルのマッチングを検証できます。何も評価しません。`--mock` はオフラインのモック評価器を実行します。その結果はプレースホルダであり、すべてのレポートに `MOCK MODE` と明示されます)*

---

## 設定 DSL ガイド

`jev-spec` の設定では、完全な TypeScript の型推論とオートコンプリートを提供する `defineConfig(...)` ヘルパーを使用します。

設定は、Jev へ何かを送信する前に必ず検証されます。どのルーブリックにも一致しないアサーションのキー、ルーブリックの型に合わないオプション、存在しない選択肢のキー、範囲外のしきい値（たとえば `0.15` のつもりで `maxProbability: 15` と書いた場合）があると、決して失敗しないチェックを黙って作ってしまう代わりに、終了コード `2` で実行を止めます。`defineConfig(...)` を使っていれば、同じ誤りを TypeScript がエディタ上で指摘します。

### コア DSL プリミティブ

#### noul(question): NoulRubric

**noul** は、`[0, 1]` の範囲で評価される校正済みブール命題です。Jev は、仕様コンテキストと実装コードを踏まえて、その記述が真である経験的確率を推定します。

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

- **アサーションオプション**:
  - `minProbability?: number`: 許容される最小確率しきい値（`[0, 1]`）。
  - `maxProbability?: number`: 許容される最大確率しきい値（`[0, 1]`）。

#### choice(description, options): ChoiceRubric

**choice** ルーブリックは、相互排他的な選択肢にわたる離散的なカテゴリカル分布を表します。

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

- **アサーションオプション**:
  - `allowedChoices?: readonly T[]`: 許可する選択肢キーの配列。
  - `blockedChoices?: readonly T[]`: 禁止する選択肢キーの配列（選択された場合に失敗）。
  - `minConfidence?: number`: 選択された選択肢に要求される最小信頼度スコア（`[0, 1]`）。

#### score(description, levels): ScoreRubric

**score** ルーブリックは、2〜10 レベルの順序尺度に対して評価を行います。連続的なスコア値、各レベルの確率、および信頼度を返します。

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
    minScore: 2.0, // 最小小数スコアインデックス（0 = Stub、3 = Production Ready）
    minConfidence: 0.70,
  },
}
```

- **アサーションオプション**:
  - `minScore?: number`: 最小小数スコアインデックス。
  - `maxScore?: number`: 最大小数スコアインデックス。
  - `minConfidence?: number`: 最小信頼度指標（`[0, 1]`）。

### ゾーン設定インターフェース

```typescript
export interface ZoneConfig {
  /** ゾーンの概要説明（任意） */
  readonly description?: string;

  /** ワークスペース内の Markdown / MDX 仕様書への相対パス */
  readonly specPath: string;

  /** 対象実装ファイルの相対パスまたは glob パターン */
  readonly codePaths: readonly string[];

  /** 仕様書のセクション抽出フィルタリングルール */
  readonly specFilter?: {
    readonly headings?: readonly string[];       // 見出しタイトルによるフィルタ
    readonly requirementPrefix?: string;         // 例: 'REQ-AUTH-' や 'AC-'
    readonly tags?: readonly string[];           // ハッシュタグによるフィルタ（例: ['auth']）
  };

  /** 宣言された Jev 評価ルーブリック */
  readonly rubrics: Record<string, AnyRubric>;

  /** Jev の評価結果と照合するアサーション */
  readonly assertions: AssertionMap<R>;
}
```

`specFilter` は、指定したすべての条件を満たすセクションを、その配下のサブセクションごと残します。より深い見出しの下に書かれた詳細も、要件の一部として保持されます。どのセクションにも一致しないフィルタは、文書全体を黙って送信する代わりに、設定エラー（終了コード `2`）として扱われます。

### CLI 利用リファレンス

#### すべてのゾーンを検証

設定内で宣言されたすべてのゾーンに対してセマンティック検証を実行します。

```bash
# Bun による即座のチェック
bunx jev-spec check

# Node.js によるチェック
npx jev-spec check
```

#### 特定ゾーンの指定検証

特定のゾーンのみを対象に検証を実行します。

```bash
bunx jev-spec check --zone auth
```

#### Git 差分による検証（Pre-commit フックおよび CI）

ソースファイル全体ではなく、変更された行のみを対象にセマンティック検証を実行します。

```bash
# ステージングされた Git 変更に対して検証（pre-commit フックに最適）
bunx jev-spec check --staged

# ブランチ範囲の Git 差分に対して検証（PR の CI に最適）
bunx jev-spec check --diff origin/main...HEAD
```

変更されたファイルが `codePaths` に 1 つも一致しないゾーンは `SKIPPED` として報告されます。Jev には送信されず、終了コードにも影響しないため、ゾーンに触れていないコミットを pre-commit フックが止めることはありません。

#### ドライラン・Mock モード・ヘルプ・バージョン

```bash
# セットアップの検証: 設定、仕様のパース、ファイルのマッチング。何も評価せず、API キーも不要
npx jev-spec check --dry-run

# オフラインのモック評価器（結果はプレースホルダで、すべてのレポートに MOCK MODE と表示）
npx jev-spec check --mock

# 使い方とバージョン（設定ファイルは不要）
npx jev-spec --help
npx jev-spec --version
```

ドライランは、ゾーンごとに、見つかった仕様のセクションと要件 ID、マッチしたコードファイル、問い合わせる予定のルーブリック、見積もりコストを表示します。どのルーブリックにも言及されていない要件 ID、どのファイルにも一致しない `codePaths`、サイズ上限を超えるコードコンテキストについては警告します。セットアップが正しければ終了コード `0`、不備があれば `2` で終了します。何も検証しないため、`1` で終了することはありません。

不明なコマンド、不明なオプション、値の欠けたオプション、未対応の `--format` 値は、終了コード `2` で拒否されます。

#### 出力フォーマットの指定

```bash
# 整形されたターミナルレポート（デフォルト）
npx jev-spec check --format terminal

# Markdown レポート（GitHub Step Summary や PR コメントに最適）
npx jev-spec check --format markdown --output jev-spec-report.md

# 機械可読な JSON 出力（カスタム集計パイプライン用）
npx jev-spec check --format json --output result.json
```

`--output` に指定できるのはプロジェクトルート内のパスだけです。GitHub Actions の Step Summary（ワークスペースの外にあります）へ出力する場合は、標準出力をリダイレクトしてください。

```bash
npx jev-spec check --format markdown >> "$GITHUB_STEP_SUMMARY"
```

#### CLI 終了コード

- `0`: すべてのゾーンおよびアサーションに合格。
- `1`: 検証失敗（1 つ以上のアサーションに違反）。
- `2`: 設定または実行時エラー（ファイル不在、不正な引数、API キー欠落など）。

---

## デュアルランタイム対応マトリクス

`jev-spec` は、モダンな **Node.js** および **Bun** の両方に対してファーストクラスのデュアルランタイムサポートを提供します。すべてのプルリクエストは、自動 CI によりサポート対象の全バージョンで両ランタイムに対して検証されています。

| ランタイム | サポートバージョン | ステータス | 最適なユースケース | 典型的なコールドスタート |
| :--- | :--- | :--- | :--- | :--- |
| **Bun** | `>= 1.2`（最新） | Tier 1 / フルサポート | 超高速 pre-commit フック、ステージング差分チェック、ローカル開発ループ | **< 100ms** |
| **Node.js** | `>= 22.0.0`（LTS 22） | Tier 1 / フルサポート | 標準的な本番 CI/CD パイプライン、コンテナ環境 | 約 350ms〜500ms |
| **Node.js** | `>= 24.0.0`（Current 24） | Tier 1 / フルサポート | 最先端の Node ランタイム環境 | 約 350ms〜500ms |

### なぜ Pre-Commit フックに Bun が適しているのか？

Jev は判定を **1 秒未満（70ms〜400ms）** で評価するため、ローカル開発フローにおける経過時間の大部分はランタイムの起動オーバーヘッドが占めることになります。

- **即時実行**: `bunx jev-spec check --staged` は **100ms 未満** で起動し、従来のランナー起動と比べて 3 倍以上高速です。
- **摩擦のない Git フック**: 開発者はステージングされた変更に対する完全なセマンティックアサーションを合計 0.5 秒未満で実行できます。
- **ネイティブ TypeScript 実行**: トランスパイルオーバーヘッドなしに `jev-spec.config.ts` を直接読み込みます。

---

## セキュリティと CI ベストプラクティス

`jev-spec` は、自動化された CI/CD 環境および開発者のワークステーションで安全に実行できるように設計されています。

### CI 脅威モデル：Fork PR とシークレットの取り扱い

> [!WARNING]
> パブリックリポジトリの外部プルリクエスト（`pull_request` イベント）に対して、`TYPESAFE_AI_API_KEY` を絶対に公開しないでください！

1. **信頼できないコードのリスク**: パブリックリポジトリでは、PR によって `jev-spec.config.ts`、仕様書、コードが改ざんされる可能性があります。機密性の高い認証情報へのアクセス権を持った状態で信頼できないコードを実行すると、シークレット漏洩の攻撃対象領域となります。
2. **推奨される多層防御パターン**:
   - **Fork PR にはドライランを使用**: PR チェックではドライラン（`jev-spec check --dry-run`）を使用し、API 認証情報を一切公開せずに設定構造、仕様パース、glob パターンの一致を検証します。
   - **Environment Protection（環境保護ルール）**: 外部 PR でライブ検証を行う場合は、GitHub Actions の Environment Approvals を使用し、メンテナーが差分を確認・承認した後にのみシークレットが利用できるようにします。
   - **main ブランチでの検証**: `main` への push や信頼できる内部リリースのブランチに対してライブのセマンティック検証を実行します。

### 推奨 GitHub Actions ワークフロー

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

      - name: Run jev-spec (Internal Pull Request / Changed Zones)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: |
          npx jev-spec check \
            --diff origin/main...HEAD \
            --format markdown >> "$GITHUB_STEP_SUMMARY"

      - name: Run jev-spec (Push to Main / Full Verification)
        if: github.event_name == 'push'
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: npx jev-spec check --format markdown >> "$GITHUB_STEP_SUMMARY"

      - name: Run jev-spec (External Fork / Dry Run, No Secrets)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository
        run: npx jev-spec check --dry-run
```

push 時のステップは意図的にフル検証を実行します。`main` 上では `origin/main...HEAD` が空の範囲になり、すべてのゾーンがスキップされてしまうためです。

### 組み込みセキュリティ防御機能

`jev-spec` は、開発マシンと CI ランナーを保護するための包括的な多層防御セキュリティ機能（Hardening S-01〜S-05）を実装しています。

| セキュリティ対策 | 実装と保証内容 |
| :--- | :--- |
| **パストラバーサル & Root Jail** | ワークスペースパスは realpath 解決により厳密に検証されます（`assertInsideRoot()`）。カレント作業ディレクトリ外の絶対パス、`..` によるディレクトライバーサル、およびリポジトリルートを脱出するシンボリックリンクは拒否されます。 |
| **Git リビジョンのサニタイズ** | `--diff` に渡される引数は、厳格な Git リビジョン正規表現パターンで検証されます（`assertGitRevision()`）。`-` で始まるフラグ（`--output` などのオプションインジェクション）を拒否し、リビジョン範囲の直前に `--end-of-options` を置いてオプション解析を打ち切り、15 秒のコマンドタイムアウトを強制します。 |
| **プロンプト境界防御** | 信頼できない仕様書および実装コードの内容は、境界タグ（`<specification_context>` および `<untrusted_source_code>`）内に隔離されます。さらに、ソースファイル内に埋め込まれた指示を無視するよう Jev に指示するプロンプトインジェクション防御文脈が付与されます。 |
| **Base URL SSRF 防御** | デフォルトでは、リクエストは公式の TypeSafe AI エンドポイント（`https://api.typesafe.ai`）にのみルーティングされます。`allowCustomBaseUrl: true` が明示的に設定されていない限り、カスタム API ベース URL はブロックされます。 |
| **リソース制限** | 1 回のスキャンあたり最大 500 ファイル、ファイルサイズ上限 2MB、プロンプトごとの文字数切り詰めなど、厳格な上限を強制することで DoS や過度なメモリ消費を防止します。 |

詳細なセキュリティポリシーおよび脆弱性報告窓口については、[SECURITY.md](./SECURITY.md) を参照してください。

---

## コントリビューションとライセンス

コントリビューションを歓迎します。プルリクエストを提出する前に、すべてのテストとリンターチェックが合格することをご確認ください。

```bash
npm run check      # Biome（リントとフォーマット検査）、型チェック、テスト
npm run lint:fix   # Biome のフォーマットと安全なリント修正を適用
```

[MIT License](./LICENSE) のもとで公開されています。
