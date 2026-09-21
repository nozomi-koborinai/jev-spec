# jev-spec

[![npm version](https://img.shields.io/npm/v/jev-spec.svg)](https://www.npmjs.com/package/jev-spec)
[![CI](https://img.shields.io/github/actions/workflow/status/nozomi-koborinai/jev-spec/ci.yml?branch=main&label=CI)](https://github.com/nozomi-koborinai/jev-spec/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.2-black.svg)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

<p align="center"><img src="./assets/hero.png" alt="jev-spec: 커밋할 때마다 명세와 코드의 어긋남을 잡아낸다" width="100%" /></p>

🌐 [English](README.md) | [日本語](README.ja.md) | [简体中文](README.zh.md)

**커밋할 때마다 명세와 코드의 어긋남을 잡아낸다.** `jev-spec`은 Markdown 명세에 적힌 요구 사항과 코드를 대조하고, 둘이 어긋나면 빌드를 실패시킵니다. 요구 사항마다 초점을 좁힌 질문 하나를 [TypeSafe AI의 Jev 모델](https://docs.typesafe.ai)에 던지고, 돌아온 확률을 여러분이 정한 임계값과 비교합니다. pre-commit 훅에 넣을 만큼 가볍고, CI 게이트로 쓸 만큼 엄격합니다.

```text
$ npx jev-spec check

=== jev-spec Check Report ===

Target: auth [✖ FAILED]
  Spec files: docs/specs/auth.md
  Code files: src/auth/session.ts
  Model: jev-1.13.0
    ✔ REQ-AUTH-01: probability: 0.97
    ✖ REQ-AUTH-02: probability: 0.08
       └─ Violation: Probability 0.08 is below minimum threshold 0.85
    ✔ introducesUnspecifiedBehavior: probability: 0.03

Overall: ✖ CHECKS FAILED

$ echo $?
1
```

*보고서 예시입니다. 레이아웃은 CLI의 실제 출력과 같고(소요 시간과 비용 줄은 생략), 확률 값은 예시입니다.*

`jev-spec`은 독립적인 오픈 소스 프로젝트입니다. TypeSafe AI와 제휴 관계가 없으며 공식 승인을 받지도 않았습니다. `jev-spec`의 문제는 TypeSafe가 아니라 [이 저장소](https://github.com/nozomi-koborinai/jev-spec/issues)에 알려 주세요.

---

## 왜 jev-spec인가?

린터와 스키마 검사는 `REQ-AUTH-02`가 존재하고, 형식이 올바르며, 올바른 곳에서 참조된다는 것을 알려 줍니다. 하지만 코드가 `REQ-AUTH-02`가 말하는 대로 동작하는지는 알려 주지 못합니다. AI 지원 개발에서는 누군가 명세를 다시 읽는 속도보다 코드가 더 빨리 바뀌기 때문에 이 간극이 더 벌어집니다.

- *`src/auth/session.ts`는 지금도 `REQ-AUTH-02`를 만족하는가?*
- *어시스턴트가 아무도 명세하지 않은 우회 헤더나 엔드포인트를 슬쩍 추가하지는 않았는가?*
- *이 풀 리퀘스트는 완전한 구현인가, 아니면 낙관적인 주석만 달린 스텁인가?*

이런 질문을 범용 LLM에 프롬프트로 물을 수는 있습니다. 하지만 그러면 문장을 파싱해야 하고, 답의 형태가 실행할 때마다 달라지며, 생성된 토큰마다 비용을 냅니다. 빌드의 성패를 맡기기에는 불편한 방식입니다.

### jev-spec의 방식

1. **프롬프트가 아니라 질문을 씁니다.** 요구 사항마다 예/아니오 질문(`noul`) 하나를 둡니다. 판단에 필요할 때는 범주형(`choice`)과 단계형(`score`) 루브릭도 쓸 수 있습니다. 모두 타입이 있는 `jev-spec.config.ts`에 작성합니다.
2. **Jev는 숫자로 답합니다.** Jev는 [System One 모델](https://docs.typesafe.ai/concepts/system-one)이며 텍스트를 생성하지 않습니다. 명세와 코드를 한 번 읽고, 같은 요청 안에서 모든 질문에 확률을 돌려줍니다. TypeSafe는 Jev가 [보정된 확률](https://docs.typesafe.ai/introduction/machine-learning-primer)을 내도록 학습시키며, 임계값이 의미를 갖는 것은 그 덕분입니다.
3. **판정은 임계값이 합니다.** `minProbability: 0.85`, `maxProbability: 0.15`, `allowedChoices`, `minScore`. 모두 단순한 비교이며 표준 종료 코드를 사용합니다(`0` 통과, `1` 실패, `2` 설정 오류).
4. **커밋마다 돌릴 수 있을 만큼 저렴합니다.** Jev는 입력 토큰에만 과금하며 [100만 토큰당 $0.042](https://docs.typesafe.ai/models), 출력은 무료입니다. 따라서 대상 하나를 검사하는 비용은 1센트에도 못 미치고, 모든 보고서에 예상 비용이 표시됩니다. 범용 LLM과의 [속도 및 비용 비교](https://typesafe.ai)는 TypeSafe가 직접 공개하고 있습니다.

| | 범용 LLM에 프롬프트 보내기 | jev-spec과 Jev |
| :--- | :--- | :--- |
| **돌아오는 것** | 파싱해야 하는 문장이나 JSON | 질문별 확률, 선택지 또는 점수 |
| **게이트로 쓰는 방법** | 텍스트를 파싱하고 형식이 유지되기를 기대 | 수치 임계값과 종료 코드 |
| **비용이 드는 대상** | 입력 토큰과 생성된 출력 토큰 | 입력 토큰만 |
| **어울리는 자리** | 비동기 리뷰 | pre-commit 훅과 머지를 막는 CI 검사 |

### 알아 두어야 할 한계

- **확률은 증명이 아닙니다.** jev-spec이 알려 주는 것은 코드가 요구 사항에서 벗어났을 가능성이 높다는 사실입니다. 테스트와 리뷰를 보완할 뿐, 어느 쪽도 대체하지 않습니다. 임계값은 신뢰하기 전에 여러분의 코드로 조정하세요.
- **대상은 작게 유지하세요.** 대상 하나는 한 번의 요청으로 전송됩니다. `src/` 전체가 아니라 하나의 도메인으로 잡으세요. 무관한 내용이 늘어날수록 Jev의 정확도가 떨어집니다([알려진 한계](https://docs.typesafe.ai/model-jaggedness/jev-1.13) 참고).
- **질문은 좁게, 글자 그대로.** 질문 하나에 동작 하나. 직접 의문문("Is a token rejected when …?")으로 묻고, 비슷한 부분이 둘 있을 때는 어느 부분을 말하는지 밝히세요. 요구 사항을 주장처럼 바꿔 쓴 질문, 여러 조건을 묶은 질문, 개수를 세는 질문, 부정이 겹친 질문은 답의 신뢰도가 떨어집니다.
- **영어에서 가장 정확합니다.** Jev의 [주된 학습 언어는 영어](https://docs.typesafe.ai/models#language-support)입니다. 한국어·중국어·일본어를 포함한 다른 언어도 입력할 수 있지만 정확도는 떨어지며, TypeSafe도 먼저 자신의 콘텐츠로 시험해 보라고 권합니다. 영어가 아닌 명세에 사용할 때는 게이트로 쓰기 전에 여러분의 문서로 임계값을 조정하세요.
- **명세 안의 Markdown 표는 아직 모델로 전송되지 않습니다.** 표의 행 내용을 질문 안에서 다시 서술하거나, 요구 사항을 목록으로 작성하세요.
- **`--staged`와 `--diff`는 대상을 고를 뿐, 모델이 보는 범위를 줄이지 않습니다.** 파일이 하나도 바뀌지 않은 대상은 건너뛰고, 변경이 닿은 대상은 전체를 검사합니다. `--staged`는 작업 트리가 아니라 스테이징된 내용을 읽습니다. 명세만 바꾼 경우에는 어떤 대상도 선택되지 않으므로 CI에는 전체 검사를 남겨 두세요.
- **실제 검사에는 [TypeSafe API 키](https://console.typesafe.ai/keys)가 필요합니다.** `jev-spec check --dry-run`은 키 없이도 설정을 검증합니다.

### jev-spec은 자기 자신도 검사합니다

jev-spec에는 자체 명세가 있으며, 그 명세에 비추어 검사를 받습니다. [`docs/specs/`](docs/specs)가 요구 사항을 정하고, [`jev-spec.config.ts`](jev-spec.config.ts)가 요구 사항 묶음마다 그것을 구현하는 한 개에서 세 개의 파일을 짝지으며, [`test/probes/`](test/probes)에는 요구 사항마다 그것을 일부러 망가뜨리는 패치가 있습니다. 루브릭은 온전한 코드에서 통과하고 망가진 사본에서 실패할 때에만 게이트에 들어갈 자격이 있습니다. [`docs/probe-results.md`](docs/probe-results.md)에 최근 실행 결과가 기록되어 있습니다. `jev-1.13.0`으로 22개의 프로브 중 22개를 잡아냈습니다. 8개 대상, 22개 루브릭 전체 검사는 4초가 채 걸리지 않으며 예상 비용은 $0.0006입니다. 첫 실행은 이렇지 않았습니다. 바꿔야 했던 것은 임계값이 아니라 질문이었고, 거기서 배운 내용은 설정 파일 머리말 주석에 정리되어 있습니다.

### 아키텍처 개요

```text
명세 문서 (Markdown) ────────────┐
                                ├─► [jev-spec 엔진] ─► Jev (System One) ─► 확률 ─► 단언
구현 코드 (Code / Git Diff) ────┘   (Root Jail + 경계 격리)                     (종료 코드 0 / 1 / 2)
```

1. **컨텍스트 추출**: `mdast`를 사용하여 Markdown 명세를 파싱(제목, 태그, 요구사항 ID 필터링)하고, 각 대상의 소스 파일을 추출합니다(diff 실행에서는 변경이 닿은 대상만).
2. **보안 격리**: 작업 공간 Root Jail(경로 탐색 공격 방지), 심볼릭 링크 이탈 감지, Git 리비전 인자 검증을 적용하고, 모델에 보내는 신뢰할 수 없는 텍스트를 경계 태그로 감쌉니다(완화책이며 보장은 아닙니다).
3. **대상당 한 번의 요청**: 대상의 명세, 코드, 모든 루브릭을 한 번의 요청으로 Jev에 전송합니다.
4. **단언 평가**: 반환된 확률과 점수를 임계값과 비교하고 종료 코드 `0`, `1`, `2` 중 하나로 종료합니다.

---

## 빠른 시작

**AI 지원 설정.** Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot 등 [Agent Skills](https://agentskills.io) 호환 클라이언트용입니다(GitHub CLI v2.90 이상 필요).

```bash
gh skill install nozomi-koborinai/jev-spec jev-spec-init
gh skill install nozomi-koborinai/jev-spec jev-spec-fix
```

그런 다음 에이전트에게 "jev-spec을 설정해 줘"라고 요청하세요. `jev-spec-init`은 명세와 코드를 매핑하고, 요구 사항마다 초점을 좁힌 질문을 하나씩 작성하며, 오프라인으로 연결 상태를 검증하고, 커버되지 않은 요구 사항을 보고합니다. `jev-spec-fix`는 실패한 검사의 원인을 가려내고, 무엇이 검증되었고 무엇이 검증되지 않았는지 보고합니다.

**수동 설정.** 단 세 단계로 `jev-spec`을 프로젝트에 도입할 수 있습니다.

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

### 2. 대상 및 루브릭 구성

**대상(Target)**은 명세의 한 부분과 그것을 구현하는 코드의 묶음입니다. 대상마다 루브릭과 단언을 가지며, 하나의 단위로 검사됩니다.

리포지토리 루트에 `jev-spec.config.ts`를 생성합니다.

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
        'REQ-AUTH-01': noul(
          'Is the signature of a session token checked before access to a protected resource is granted?'
        ),
        'REQ-AUTH-02': noul('Is a token rejected when its ID is on the revocation list?'),
        introducesUnspecifiedBehavior: noul(
          'Does the code add a way to reach a protected resource that the spec does not describe?'
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
        'REQ-AUTH-01': { minProbability: 0.85 },
        'REQ-AUTH-02': { minProbability: 0.85 },
        introducesUnspecifiedBehavior: { maxProbability: 0.15 },
        securityPosture: { allowedChoices: ['secure'], minConfidence: 0.75 },
        implementationCompleteness: { minScore: 1.8 },
      },
    },
  },
});
```

루브릭에는 검사하는 요구 사항의 ID를 이름으로 붙이고, 코드가 해야 할 일을 직접적으로, 글자 그대로 한 가지만 물으세요. 루브릭의 이름은 모델에 전송되지 않고 보고서에 표시되므로, 실패했을 때 어떤 요구 사항인지 바로 알 수 있습니다. ID는 질문 안에 넣지 마세요. [이 저장소 자체에 대한 실측](docs/probe-results.md)에서 "Does the code satisfy REQ-AUTH-01: …?" 형태의 질문은 일부러 망가뜨린 코드에도 "예"라는 답을 받았고, 같은 내용을 직접 물은 질문은 그렇지 않았습니다. 여러 요구 사항을 하나의 질문으로 묶으면 어느 것이 실패했는지 알 수 없습니다.

### 3. 검사 실행

[TypeSafe 콘솔](https://console.typesafe.ai/keys)에서 API 키를 만들고 환경 변수로 설정한 뒤 검사를 실행합니다.

```bash
export TYPESAFE_AI_API_KEY="your-typesafe-api-key"

# Bun을 통한 빠른 실행
bunx jev-spec check

# Node.js npx를 통한 실행
npx jev-spec check
```

*(참고: 아직 API 키가 없다면 `jev-spec check --dry-run`으로 설정, 명세 파싱, 파일 매칭을 검증할 수 있습니다. 아무것도 평가하지 않습니다. `--mock`은 오프라인 Mock 평가기를 실행합니다. 그 결과는 자리 표시용 값이며 모든 보고서에 `MOCK MODE`가 명시됩니다).*

---

## 설정 DSL 가이드

`jev-spec` 설정은 완벽한 TypeScript 타입 추론과 자동 완성을 제공하는 `defineConfig(...)` 헬퍼 함수를 사용합니다.

모든 설정은 Jev로 무엇이든 전송하기 전에 먼저 검증됩니다. 어떤 루브릭과도 일치하지 않는 어서션 키, 루브릭 타입에 맞지 않는 옵션, 존재하지 않는 선택지 키, 범위를 벗어난 임계값(예: `0.15` 대신 `maxProbability: 15`로 잘못 적은 경우)이 있으면, 절대 실패하지 않는 검사를 조용히 만들어 내는 대신 종료 코드 `2`로 실행을 중단합니다. `defineConfig(...)`를 사용하면 TypeScript가 에디터에서 동일한 실수를 알려 줍니다.

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
  - `blockedChoices?: readonly T[]`: 금지되는 선택지 키 배열 (선택 시 검사 실패).
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

### 대상 구성 인터페이스

```typescript
export interface TargetConfig {
  /** 대상에 대한 설명 (선택 사항) */
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

### 모델 고정

```typescript
export default defineConfig({
  client: { model: 'jev-1.13.0' },
  targets: {
    // …
  },
});
```

`client.model`을 지정하지 않으면 jev-spec은 `jev-latest`에 질의합니다. 이것은 TypeSafe가 새 릴리스마다 가리키는 대상을 바꾸는 별칭이므로, 저장소에 아무 변경이 없어도 결과가 달라질 수 있습니다. 임계값을 조정했다면, 조정에 사용한 [버전이 명시된 모델 ID](https://docs.typesafe.ai/models)로 고정하세요(`TYPESAFE_DEFAULT_MODEL`로도 지정할 수 있습니다). 모든 보고서에는 실제로 응답한 모델이 표시되며(`Model: jev-1.13.0`), 모델을 고정하지 않은 동안에는 `--dry-run`이 경고합니다.

### CLI 명령어 레퍼런스

#### 모든 대상 검사

설정에 선언된 모든 대상을 검사합니다.

```bash
# Bun을 통한 즉시 검사
bunx jev-spec check

# Node.js를 통한 검사
npx jev-spec check
```

#### 대상 하나만 검사

이름을 지정해 대상 하나만 검사합니다.

```bash
bunx jev-spec check --target auth
```

#### 변경분만 검사 (Pre-commit 훅 및 CI)

코드가 변경된 대상만 검사합니다. 선택된 대상은 전체를 검사합니다.

```bash
# 스테이징된 Git 변경 사항 검사 (pre-commit 훅에 최적)
bunx jev-spec check --staged

# 브랜치 범위 Diff 검사 (PR CI 파이프라인에 최적)
bunx jev-spec check --diff origin/main...HEAD
```

변경된 파일이 대상의 `codePaths`와 하나도 일치하지 않으면 해당 대상은 `SKIPPED`로 보고됩니다. Jev로 전송되지 않고 종료 코드에도 영향을 주지 않으므로, 대상을 건드리지 않은 커밋을 pre-commit 훅이 막지 않습니다.

#### Dry Run, Mock 모드, 도움말 및 버전

```bash
# 설정 검증: 설정, 명세 파싱, 파일 매칭. 아무것도 평가하지 않으며 API 키도 필요 없음
npx jev-spec check --dry-run

# 오프라인 Mock 평가기 (결과는 자리 표시용 값이며 모든 보고서에 MOCK MODE 표시)
npx jev-spec check --mock

# 사용법 및 버전 (설정 파일 불필요)
npx jev-spec --help
npx jev-spec --version
```

Dry Run은 대상마다 찾아낸 명세 섹션과 요구 사항 ID, 매칭된 코드 파일, 질문할 루브릭, 예상 비용을 출력합니다. 어떤 루브릭도 언급하지 않는 요구 사항 ID, 어떤 파일과도 일치하지 않는 `codePaths`, 크기 한도를 초과하는 코드 컨텍스트에 대해서는 경고합니다. 설정이 올바르면 종료 코드 `0`, 문제가 있으면 `2`로 종료합니다. 아무것도 검사하지 않으므로 `1`로 종료하는 일은 없습니다.

알 수 없는 명령, 알 수 없는 옵션, 값이 누락된 옵션, 지원하지 않는 `--format` 값은 종료 코드 `2`와 함께 거부됩니다.

#### 출력 포맷 지정

```bash
# 포맷팅된 터미널 보고서 (기본값)
npx jev-spec check --format terminal

# Markdown 보고서 (GitHub Step Summary 및 PR 댓글에 최적)
npx jev-spec check --format markdown --output jev-spec-report.md

# 기계 가독 JSON 출력 (커스텀 파이프라인 연동용)
npx jev-spec check --format json --output result.json
```

`--output`은 프로젝트 루트 내부 경로만 허용합니다. GitHub Actions의 Step Summary(워크스페이스 외부에 위치)에 게시하려면 표준 출력을 리디렉션하세요.

```bash
npx jev-spec check --format markdown >> "$GITHUB_STEP_SUMMARY"
```

#### CLI 종료 코드

- `0`: 모든 대상과 단언이 통과됨.
- `1`: 검사 실패 (하나 이상의 단언 위반).
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
   - **Fork PR에 Dry Run 적용**: 외부 PR 검사에는 Dry Run(`jev-spec check --dry-run`)을 사용하여 API 키 노출 없이 설정 구조, 명세 파싱 및 glob 매칭을 안전하게 검증합니다.
   - **Environment 승인 보호**: 외부 PR에 대해 실제 API로 검사해야 하는 경우 GitHub Actions의 Environment Approvals를 적용하여 메인테이너가 변경 사항을 확인한 후 시크릿이 제공되도록 설정합니다.
   - **Main 브랜치 검사**: `main` 브랜치로의 `push` 및 신뢰할 수 있는 내부 릴리스 브랜치에서 실제 API로 검사를 수행합니다.

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

push 단계는 의도적으로 전체를 검사합니다. `main`에서는 `origin/main...HEAD`가 빈 범위가 되어 모든 대상이 건너뛰어지기 때문입니다.

### 기본 탑재 보안 방어 기능

`jev-spec`은 개발자 머신과 CI 런너를 보호하기 위해 광범위한 다층 방어 보안 제어(보안 강화 S-01 ~ S-05)를 구현하고 있습니다.

| 보안 통제 항목 | 구현 내용 |
| :--- | :--- |
| **경로 탐색 방지 및 Root Jail** | 작업 공간 경로는 realpath 정규화를 통해 엄격히 검증됩니다(`assertInsideRoot()`). 현재 작업 디렉터리 외부의 절대 경로, `..` 경로 탐색, 저장소 루트를 벗어나는 심볼릭 링크 접근을 원천 차단합니다. |
| **Git 리비전 인자 검증** | `--diff`에 전달되는 인자는 엄격한 정규식 패턴으로 검증됩니다(`assertGitRevision()`). `-`로 시작하는 플래그를 거부하여 명령줄 옵션 인젝션(예: `--output`)을 차단하고, 리비전 범위 앞에 `--end-of-options`를 두어 옵션 파싱을 종료하며 15초 타임아웃을 강제합니다. |
| **프롬프트 경계(최선의 노력)** | 명세와 코드는 서로 다른 필드에 담기고, 경계 태그(`<specification_context>` 및 `<untrusted_source_code>`)로 감싸이며, 그 안에 포함된 지시문을 무시하라는 안내문과 함께 전송됩니다. 이것은 완화책이며 보장이 아닙니다. TypeSafe는 모델을 유도하려고 쓰인 내용(자신의 분류를 스스로 주장하는 글 포함)이 [답을 바꿀 수 있다](https://docs.typesafe.ai/model-jaggedness/jev-1.13#adversarial-content)고 밝히고 있습니다. "요구 사항을 충족한다"고 주장하는 주석이 바로 그런 글이므로, 신뢰할 수 없는 코드에 대한 통과는 약한 증거로만 취급하세요. |
| **Base URL SSRF 방어** | 기본적으로 모든 요청은 공식 TypeSafe AI 엔드포인트(`https://api.typesafe.ai`)로만 라우팅됩니다. `allowCustomBaseUrl: true`가 명시적으로 설정되지 않는 한 커스텀 API 베이스 URL 접근이 차단됩니다. |
| **자원 소진 방지 제한** | 단일 스캔당 최대 500개 파일, 파일당 2MB 크기 제한, 프롬프트당 글자 수 절단 제한을 강제하여 DoS 공격 및 메모리 고갈을 방지합니다. |

자세한 보안 정책 및 취약점 제보 방법은 [SECURITY.md](./SECURITY.md)를 참고하세요.

---

## 기여 및 라이선스

기여를 환영합니다! 풀 리퀘스트를 제출하기 전에 모든 테스트와 린터 검사를 통과하는지 확인해 주세요:

```bash
npm run check      # Biome(린트 및 포맷 검사), 타입 체크, 테스트
npm run lint:fix   # Biome 포맷팅과 안전한 린트 수정 적용
```

이 프로젝트는 [MIT 라이선스](./LICENSE)에 따라 제공됩니다.
