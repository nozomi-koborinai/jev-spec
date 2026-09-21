[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh.md) | [한국어](./README.ko.md)

# jev-spec

[![npm version](https://img.shields.io/npm/v/jev-spec.svg)](https://www.npmjs.com/package/jev-spec)
[![CI](https://img.shields.io/github/actions/workflow/status/nozomi-koborinai/jev-spec/ci.yml?branch=main&label=CI)](https://github.com/nozomi-koborinai/jev-spec/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.2-black.svg)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

<p align="center"><img src="./assets/hero.png" alt="jev-spec - Specification-Driven Semantic Verification Engine" width="100%" /></p>

**TypeSafe AI Jev 기반의 AI 코드 및 명세를 위한 명세 기반 시맨틱 검증 엔진**

---

## 왜 jev-spec인가? 시맨틱 갭(의미적 괴리) 해소

명세 기반 개발(SDD: Specification-Driven Development) 및 AI 지원 개발 워크플로(Cursor, 에이전트 코딩 도구, GitHub Copilot)에서 정적 린터는 Markdown 스키마, 제목 계층, 상호 참조 및 요구사항 ID를 결정론적으로 검증합니다. 그러나 정적 린터만으로는 코드와 명세 사이의 **시맨틱 갭(Semantic Gap, 의미적 괴리)**을 메울 수 없습니다.

- *`src/auth/session.ts`가 `REQ-AUTH-02`에 명시된 기능적 기준을 진정으로 충족하고 있는가?*
- *AI 어시스턴트가 의도치 않은 사이드 이펙트, 우회 헤더, 또는 문서화되지 않은 엔드포인트를 몰래 삽입하지는 않았는가?*
- *이 풀 리퀘스트가 요구사항을 충실히 반영한 완전한 구현체인가, 아니면 TODO 주석만 남겨진 낙관적 스텁(stub)인가?*

### 자기회귀 생성형 LLM의 한계: 코드 검증을 위한 자유 텍스트 생성의 비효율

지금까지 시맨틱 준수 여부를 평가하려면 자기회귀 생성형 언어 모델에 프롬프트 엔지니어링을 수행해야 했습니다.

- **높은 지연 시간**: 순차적인 토큰 단위 생성으로 인해 파일 하나를 검토하는 데 **5초에서 15초**가 소요됩니다.
- **과도한 비용**: 자기회귀 디코딩 방식으로 인해 파일 평가당 **$0.05에서 $0.20 이상**의 비용이 발생합니다.
- **비결정론적 편차**: 취약한 프롬프트 템플릿, 환각 기반 추론, JSON 파싱 실패, 실행마다 달라지는 주관적 편차가 발생합니다.
- **워크플로 단절**: 속도가 너무 느려 Git pre-commit 훅, 스테이징된 변경 사항 검사, 또는 빠른 차단형 CI 게이트로 활용하기 어렵습니다.

### Jev의 핵심 이점: 자유 텍스트 생성을 대체하는 구조화된 결정 프리미티브

광학에서 **콜리메이터(collimator, 시준기)**는 사방으로 퍼지는 빛을 평행하고 집중된 광선으로 모아줍니다. `jev-spec`은 소프트웨어 공학의 시맨틱 콜리메이터 역할을 수행합니다. 즉, AI 코딩 모델이 만들어내는 고엔트로피의 확산된 출력을 수학적으로 보정된 결정론적 검증 판정으로 모아줍니다.

**TypeSafe AI Jev**를 기반으로 작동하는 `jev-spec`은 토큰 단위의 텍스트 생성이 아닌 구조화된 결정 프리미티브를 바탕으로 설계되었습니다.

- **구조화된 결정 프리미티브**: 자유 형식의 산문이나 JSON 문자열을 토큰 단위로 순차 생성하지 않고, 명세 컨텍스트와 구현 코드로부터 타입이 지정된 결정 프리미티브(`noul`, `choice`, `score`)에 대한 캘리브레이션된 확률 분포를 단일 순전파(Single Forward Pass)로 직접 예측합니다.
- **400ms 미만의 초고속 검증**: 단일 순전파 평가를 통해 **70ms ~ 400ms** 내에 완료됩니다.
- **탁월한 비용 효율성**: 입력 토큰 100만 개당 **$0.042**(출력 토큰은 무료)로, 생성형 리뷰 프롬프트 대비 100배 이상 저렴합니다.
- **수학적 캘리브레이션(보정 정확도)**: RLCD(Reinforcement Learning for Calibrated Decisions)로 학습된 타입 정의 결정 프리미티브를 평가합니다. 예측 확률이 0.85라면 해당 명제가 경험적으로 85%의 경우에서 참임을 뜻합니다.
- **병렬 샘플러**: 공유 명세 및 구현 컨텍스트를 바탕으로 불리언 명제(`noul`), 범주형 분포(`choice`), 순서형 루브릭(`score`)을 단일 순전파에서 동시에 평가합니다.
- **결정론적 수치 단언(Assertions)**: 터미널, pre-commit 훅 또는 CI 파이프라인에서 수치 임곗값(`minProbability`, `maxProbability`, `allowedChoices`, `minScore`)과 표준 종료 코드를 사용해 시맨틱 단언을 직접 테스트할 수 있습니다.

| 주요 항목 | 자기회귀 LLM 프롬프트 검토 | jev-spec + Jev (결정 프리미티브) |
| :--- | :--- | :--- |
| **실행 속도** | 파일당 5,000ms ~ 15,000ms | **70ms ~ 400ms** (단일 순전파) |
| **토큰 비용** | 약 $3.00 ~ $15.00 / MTok | **$0.042 / MTok** (출력 토큰 무료) |
| **평가 방식** | 토큰 단위 순차적 자유 텍스트 / JSON 생성 | **타입 정의 결정 프리미티브 대상 단일 순전파** |
| **출력 형태** | 비구조화 산문 또는 파싱 대상 JSON 문자열 | **캘리브레이션 확률 및 범주형 분포** |
| **결정론성** | 주관적 추론 및 포맷 파싱 불안정성 | **수치 임곗값 (예: `minProbability: 0.85`)** |
| **Git 훅 및 빠른 CI** | 도입 불가 (개발 흐름 저해) | **즉시 실행 (Bun 실행 시 100ms 미만)** |

### 아키텍처 개요

```text
명세 문서 (Markdown / MDX) ──────┐
                                ├─► [jev-spec 엔진] ─► Jev 결정 모델 ─► 캘리브레이션 판정 및 단언
구현 코드 (Code / Git Diff) ────┘   (Root Jail + 경계 격리)             (<400ms 내 Pass / Fail 판정)
```

1. **컨텍스트 추출**: `mdast`를 사용하여 Markdown 명세를 파싱(제목, 태그, 요구사항 ID 필터링)하고, 대상 소스 파일이나 스테이징된 Git diff 헝크를 추출합니다.
2. **보안 격리**: 작업 공간 Root Jail(경로 탐색 공격 방지), 심볼릭 링크 이탈 감지, Git 리비전 인자 검증 및 프롬프트 인젝션 방어 태그 격리를 적용합니다.
3. **병렬 순전파**: 공유 컨텍스트와 평가 루브릭을 단일 배치 요청으로 Jev 결정 엔진에 전송합니다.
4. **단언 평가**: 반환된 캘리브레이션 확률과 점수를 수치 임곗값과 대조하여, CI/CD 자동화에 적합한 결정론적 종료 코드로 결과를 반환합니다.

---

## 빠른 시작

단 세 단계로 `jev-spec`을 프로젝트에 도입할 수 있습니다.

### 1. jev-spec 설치

선호하는 패키지 관리자를 통해 개발 의존성으로 설치합니다.

```bash
# Bun (로컬 개발 루프에 권장)
bun add -d jev-spec

# npm
npm install -D jev-spec

# pnpm
pnpm add -D jev-spec
```

*로컬 설치 없이 `bunx jev-spec` 또는 `npx jev-spec`을 통해 즉시 실행할 수도 있습니다.*

### 2. 영역(Zone) 및 루브릭 구성

리포지토리 루트에 `jev-spec.config.ts`를 생성합니다.

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

### 3. 시맨틱 검증 실행

API 키를 환경 변수로 설정하고 검증을 실행합니다.

```bash
export TYPESAFE_AI_API_KEY="your-typesafe-api-key"

# Bun을 통한 빠른 실행
bunx jev-spec check

# Node.js npx를 통한 실행
npx jev-spec check
```

*(참고: API 키 없이 오프라인 테스트 및 로컬 CI 시뮬레이션을 수행하려면 설정에서 `client: { mock: true }`를 전달하세요).*

---

## 설정 DSL 가이드

`jev-spec` 설정은 완벽한 TypeScript 타입 추론과 자동 완성을 제공하는 `defineConfig(...)` 헬퍼 함수를 사용합니다.

### 핵심 DSL 프리미티브

#### noul(question): NoulRubric

**noul**은 `[0, 1]` 범위에서 평가되는 캘리브레이션 불리언 명제입니다. Jev는 명세 컨텍스트와 구현 코드를 종합하여 해당 진술이 참일 경험적 확률을 추정합니다.

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

- **단언 옵션**:
  - `minProbability?: number`: 허용 가능한 최소 확률 임곗값 (`[0, 1]`).
  - `maxProbability?: number`: 허용 가능한 최대 확률 임곗값 (`[0, 1]`).

#### choice(description, options): ChoiceRubric

**choice** 루브릭은 상호 배타적인 옵션들 사이의 이산 범주형 확률 분포를 나타냅니다.

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

- **단언 옵션**:
  - `allowedChoices?: readonly T[]`: 허용되는 선택지 키 배열.
  - `blockedChoices?: readonly T[]`: 금지되는 선택지 키 배열 (선택 시 검증 실패).
  - `minConfidence?: number`: 선택된 선택지에 요구되는 최소 신뢰도 점수 (`[0, 1]`).

#### score(description, levels): ScoreRubric

**score** 루브릭은 2개에서 10개 레벨의 순서 척도에 대해 점수를 평가합니다. 연속 점수, 레벨별 확률 및 신뢰도를 반환합니다.

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
    minScore: 2.0, // 최소 소수 점수 인덱스 (0 = Stub, 3 = Production Ready)
    minConfidence: 0.70,
  },
}
```

- **단언 옵션**:
  - `minScore?: number`: 최소 허용 소수 점수 인덱스.
  - `maxScore?: number`: 최대 허용 소수 점수 인덱스.
  - `minConfidence?: number`: 최소 신뢰도 지표 (`[0, 1]`).

### 영역(Zone) 구성 인터페이스

```typescript
export interface ZoneConfig {
  /** 영역에 대한 설명 (선택 사항) */
  readonly description?: string;

  /** 작업 공간 내 Markdown / MDX 명세 문서의 상대 경로 */
  readonly specPath: string;

  /** 대상 구현 파일의 상대 경로 또는 Glob 패턴 */
  readonly codePaths: readonly string[];

  /** 명세 섹션 추출 필터링 규칙 */
  readonly specFilter?: {
    readonly headings?: readonly string[];       // 제목 기반 필터링
    readonly requirementPrefix?: string;         // 예: 'REQ-AUTH-' 또는 'AC-'
    readonly tags?: readonly string[];           // 해시태그 기반 필터링 (예: ['auth'])
  };

  /** 선언된 Jev 평가 루브릭 */
  readonly rubrics: Record<string, AnyRubric>;

  /** Jev 평가 결과와 대조할 단언 */
  readonly assertions: AssertionMap<R>;
}
```

`specFilter`는 주어진 모든 조건을 만족하는 섹션을 그 하위 섹션과 함께 유지하므로, 더 깊은 제목 아래에 작성된 세부 내용도 요구 사항의 일부로 남습니다. 어떤 섹션과도 일치하지 않는 필터는 문서 전체를 조용히 전송하는 대신 설정 오류(종료 코드 `2`)로 처리됩니다.

### CLI 명령어 레퍼런스

#### 모든 영역 검사

설정에 선언된 모든 영역에 대해 시맨틱 검증을 실행합니다.

```bash
# Bun을 통한 즉시 검사
bunx jev-spec check

# Node.js를 통한 검사
npx jev-spec check
```

#### 특정 영역 지정 검사

특정 영역만을 대상으로 검증을 실행합니다.

```bash
bunx jev-spec check --zone auth
```

#### Git Diff 기반 검사 (Pre-commit 훅 및 CI)

전체 소스 파일 대신 변경된 라인만을 대상으로 시맨틱 검증을 실행합니다.

```bash
# 스테이징된 Git 변경 사항 검증 (pre-commit 훅에 최적)
bunx jev-spec check --staged

# 브랜치 범위 Diff 검증 (PR CI 파이프라인에 최적)
bunx jev-spec check --diff origin/main...HEAD
```

#### 출력 포맷 지정

```bash
# 포맷팅된 터미널 보고서 (기본값)
npx jev-spec check --format terminal

# Markdown 보고서 (GitHub Step Summary 및 PR 댓글에 최적)
npx jev-spec check --format markdown --output jev-spec-report.md

# 기계 가독 JSON 출력 (커스텀 파이프라인 연동용)
npx jev-spec check --format json --output result.json
```

#### CLI 종료 코드

- `0`: 모든 영역과 단언이 통과됨.
- `1`: 검증 실패 (하나 이상의 단언 위반).
- `2`: 설정 또는 런타임 오류 (파일 없음, 잘못된 인자, API 키 누락 등).

---

## 듀얼 런타임 지원 매트릭스

`jev-spec`은 최신 **Node.js** 및 **Bun** 환경에 대해 일등(First-Class) 듀얼 런타임 지원을 제공합니다. 모든 풀 리퀘스트는 자동화된 CI를 통해 지원 대상 버전 전반에서 두 런타임 모두에 대해 철저히 검증됩니다.

| 런타임 | 지원 버전 | 지원 단계 | 권장 환경 | 일반적인 콜드 스타트 |
| :--- | :--- | :--- | :--- | :--- |
| **Bun** | `>= 1.2` (최신) | Tier 1 / 공식 지원 | 초고속 pre-commit 훅, 스테이징 검사, 로컬 개발 루프 | **< 100ms** |
| **Node.js** | `>= 22.0.0` (LTS 22) | Tier 1 / 공식 지원 | 표준 프로덕션 CI/CD 파이프라인, 컨테이너 환경 | 약 350ms ~ 500ms |
| **Node.js** | `>= 24.0.0` (Current 24) | Tier 1 / 공식 지원 | 최신 Node 런타임 환경 | 약 350ms ~ 500ms |

### 왜 Pre-Commit 훅에 Bun을 권장하는가?

Jev가 결정을 내리는 시간은 **1초 미만(70ms ~ 400ms)**에 불과하므로, 로컬 개발 워크플로에서 체감되는 시간의 대부분은 런타임 시작 오버헤드가 차지합니다.

- **즉각적인 실행**: `bunx jev-spec check --staged`는 **100ms 미만**에 실행을 시작하여 기존 런너 대비 3배 이상 빠릅니다.
- **개발 흐름을 방해하지 않는 Git 훅**: 개발자는 스테이징된 변경 사항에 대한 시맨틱 단언 전체를 0.5초 이내에 완료할 수 있습니다.
- **네이티브 TypeScript 실행**: 트랜스파일 오버헤드 없이 `jev-spec.config.ts`를 즉시 직접 로드합니다.

---

## 보안 및 CI 모범 사례

`jev-spec`은 자동화된 CI/CD 환경 및 개발자 워크스테이션에서 안전하게 실행되도록 설계되었습니다.

### CI 위협 모델: 외부 Fork PR 및 시크릿 관리

> [!WARNING]
> 공개 저장소의 신뢰할 수 없는 외부 풀 리퀘스트(`pull_request` 이벤트)에 `TYPESAFE_AI_API_KEY`를 절대 노출하지 마십시오!

1. **신뢰할 수 없는 코드 위험**: 공개 저장소에서 외부 PR은 `jev-spec.config.ts`, 명세 또는 코드를 임의로 변경할 수 있습니다. 민감한 API 자격 증명이 노출된 상태에서 외부 코드를 실행하면 시크릿 탈취 경로가 생길 수 있습니다.
2. **권장되는 심층 방어 전략**:
   - **Fork PR에 오프라인 Mock 모드 적용**: 외부 PR 검사에는 Mock 모드(`client.mock = true`)를 사용하여 API 키 노출 없이 설정 구조, 명세 파싱 및 glob 매칭을 안전하게 검증합니다.
   - **Environment 승인 보호**: 외부 PR에 대해 실제 검증을 수행해야 하는 경우 GitHub Actions의 Environment Approvals를 적용하여 메인테이너가 변경 사항을 확인한 후 시크릿이 제공되도록 설정합니다.
   - **Main 브랜치 검증**: `main` 브랜치로의 `push` 및 신뢰할 수 있는 내부 릴리스 브랜치에서 실제 라이브 시맨틱 검증을 수행합니다.

### 권장 GitHub Actions 워크플로

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

### 기본 탑재 보안 방어 기능

`jev-spec`은 개발자 머신과 CI 런너를 보호하기 위해 광범위한 다층 방어 보안 제어(보안 강화 S-01 ~ S-05)를 구현하고 있습니다.

| 보안 통제 항목 | 구현 내용 및 보장 사항 |
| :--- | :--- |
| **경로 탐색 방지 및 Root Jail** | 작업 공간 경로는 realpath 정규화를 통해 엄격히 검증됩니다(`assertInsideRoot()`). 현재 작업 디렉터리 외부의 절대 경로, `..` 경로 탐색, 저장소 루트를 벗어나는 심볼릭 링크 접근을 원천 차단합니다. |
| **Git 리비전 인자 검증** | `--diff`에 전달되는 인자는 엄격한 정규식 패턴으로 검증됩니다(`assertGitRevision()`). `-`로 시작하는 플래그를 거부하여 명령줄 옵션 인젝션(예: `--output`)을 차단하고, 리비전 범위 앞에 `--end-of-options`를 두어 옵션 파싱을 종료하며 15초 타임아웃을 강제합니다. |
| **프롬프트 경계 격리 보호** | 신뢰할 수 없는 명세 및 코드 내용은 경계 태그(`<specification_context>` 및 `<untrusted_source_code>`)로 엄격히 격리됩니다. 또한 소스 파일 내부에 잠재된 지시문을 무시하도록 Jev에 명시하는 프롬프트 인젝션 방어 지시문이 함께 제공됩니다. |
| **Base URL SSRF 방어** | 기본적으로 모든 요청은 공식 TypeSafe AI 엔드포인트(`https://api.typesafe.ai`)로만 라우팅됩니다. `allowCustomBaseUrl: true`가 명시적으로 설정되지 않는 한 커스텀 API 베이스 URL 접근이 차단됩니다. |
| **자원 소진 방지 제한** | 단일 스캔당 최대 500개 파일, 파일당 2MB 크기 제한, 프롬프트당 글자 수 절단 제한을 강제하여 DoS 공격 및 메모리 고갈을 방지합니다. |

자세한 보안 정책 및 취약점 제보 방법은 [SECURITY.md](./SECURITY.md)를 참고하세요.

---

## 기여 및 라이선스

기여를 환영합니다! 풀 리퀘스트를 제출하기 전에 모든 테스트와 린터 검사를 통과하는지 확인해 주세요:

```bash
npm run check
npm test
```

이 프로젝트는 [MIT 라이선스](./LICENSE)에 따라 제공됩니다.
