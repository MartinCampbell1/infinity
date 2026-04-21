# Жёсткий список того, что осталось сделать исполнителю

Ниже не обзор, а **исполнительский checklist**: что именно ещё не закончено, в каком порядке, и что нельзя пропускать.

С учётом нового фронтенда из:

`/Users/martin/Downloads/Infinity-frontend`

ситуация теперь такая:
- frontend концептуально уже готов как target language;
- его **нельзя просто копипастнуть** в продукт как есть;
- его нужно **встроить в текущий shell app** поверх существующих data contracts и orchestration truth;
- параллельно всё ещё остаются backend/runtime/topology долги.

---

## Общий принцип интеграции

**Нельзя** заменять живой shell статическим prototype-кодом.

Пакет `Infinity-frontend` — это:
- static prototype;
- `index.html` + Babel/CDN React;
- global `window.*` mocks;
- local state surface switching;
- mock data через `src/data.jsx`.

Текущий продукт — это:
- Next.js shell;
- route-driven control plane;
- server-backed orchestration;
- embedded workspace launch contracts;
- durable state/event truth.

Значит интеграция должна быть такой:
- **переносим visual grammar**;
- **не переносим mock/runtime model**.

---

# Step 0 — не трогать `next-env.d.ts` руками

Сейчас в рабочем дереве уже есть изменение:

- `apps/shell/apps/web/next-env.d.ts`

Исполнителю нужно:
1. проверить, почему файл изменился;
2. не считать это meaningful product work;
3. либо откатить, либо регенерировать корректно через normal Next flow;
4. не строить дальнейшую работу вокруг этого diff.

---

# Step 1 — сначала зафиксировать baseline в Git

Это обязательно до любых следующих переносов.

## Нужно сделать
1. Проверить root `.gitignore`.
2. Убедиться, что не трекаются:
   - `.next/`
   - `.turbo/`
   - `.control-plane-state/`
   - `.local-state/`
   - `node_modules/`
   - `dist/`
   - `build/`
   - `.svelte-kit/`
   - `coverage/`
   - `.DS_Store`
3. Проверить `git status`.
4. Создать baseline commit перед следующим циклом.

## DoD
- Есть чистый rollback point перед frontend integration.

---

# Step 2 — разобрать и встроить Claude Design frontend ПРАВИЛЬНО

## Источник
`/Users/martin/Downloads/Infinity-frontend`

## Что это такое по сути
Подтверждено:
- `index.html` — static prototype runtime;
- `src/frontdoor.jsx` — frontdoor target;
- `src/runs-board.jsx` — runs board target;
- `src/primary-run.jsx` — run target;
- `src/result.jsx` — result target;
- `tokens.css` — visual token source.

## Что делать нельзя
Нельзя:
- переносить `index.html` runtime модель;
- переносить `window.__INFINITY_DATA__`;
- переносить `src/data.jsx` как source of truth;
- заменять Next routes на local surface switching;
- заменять live shell pages статическим React/Babel prototype.

## Что нужно сделать

### 2.1. Перенести только visual system
Сопоставление:
- `tokens.css` → `apps/shell/apps/web/app/globals.css`
- `src/primitives.jsx` → `components/execution/plane-run-primitives.tsx` + shell primitives
- `src/shell-frame.jsx` → `components/shell/shell-frame.tsx` / `plane-shell-frame.tsx`

### 2.2. Обновить реальные shell surfaces
Нужно адаптировать prototype visual language в:
- `components/frontdoor/plane-ai-home-surface.tsx`
- `components/frontdoor/plane-root-composer.tsx`
- `components/execution/autonomous-record-board.tsx`
- `components/execution/session-surface.tsx`
- `components/execution/primary-run-surface.tsx`
- `components/orchestration/delivery-summary.tsx`
- delivery/handoff pages

### 2.3. Сохранить текущую truth architecture
Нельзя сломать:
- route scope;
- server-backed shell data;
- approvals/recoveries/events contracts;
- workspace launch bridge.

## DoD
- Infinity визуально переходит на новый frontend language;
- но все данные остаются live/server-backed;
- prototype mock model нигде не становится продуктовой truth layer.

---

# Step 3 — довести frontend integration по маршрутам

Нужно жёстко обновить 4 главные shell поверхности под новый дизайн:

## 3.1 Frontdoor
Файлы:
- `app/page.tsx`
- `components/frontdoor/plane-ai-home-surface.tsx`
- `components/frontdoor/plane-root-composer.tsx`

Цель:
- сделать frontdoor визуально как в новом prototype;
- оставить one-prompt entry;
- не ломать shell-owned root.

## 3.2 Runs board
Файлы:
- `app/(shell)/execution/runs/page.tsx`
- `components/execution/autonomous-record-board.tsx`
- `components/execution/session-surface.tsx`

Цель:
- перенести dense board + right drawer grammar;
- не потерять live session/recovery/preview truth.

## 3.3 Primary run
Файлы:
- `app/(shell)/execution/runs/[initiativeId]/page.tsx`
- `components/execution/primary-run-surface.tsx`

Цель:
- сделать main run surface ровно тем сильным экраном, который теперь нарисовал Claude Design;
- сохранить живую привязку к task graph / agents / recoveries / preview / handoff.

## 3.4 Delivered/result surface
Файлы:
- `app/(shell)/execution/delivery/[deliveryId]/page.tsx`
- `components/orchestration/delivery-summary.tsx`
- связанные handoff/previews surfaces

Цель:
- результат должен визуально соответствовать новому target;
- при этом показывать real delivery truth, а не fake completion screen.

## DoD
- 4 ключевые shell поверхности визуально соответствуют новому target;
- shell остаётся живым Next-продуктом, а не статическим прототипом.

---

# Step 4 — убрать manual-stage leakage из secondary routes

Это всё ещё не закрыто.

## Файлы
- `apps/work-ui/src/routes/(app)/project-intake/+page.svelte`
- `apps/work-ui/src/routes/(app)/project-brief/[id]/+page.svelte`
- `apps/work-ui/src/routes/(app)/project-run/[id]/+page.svelte`
- `apps/work-ui/src/routes/(app)/project-result/[id]/+page.svelte`

## Что обязательно сделать
Убрать как primary-looking CTA:
- `Launch planner manually`
- `Finalize brief manually`
- `Build assembly manually`
- `Refresh assembly manually`
- `Run verification manually`
- `Create delivery manually`

Их можно оставить только если они:
- вторичны;
- явно override/recovery;
- визуально демотированы;
- не выглядят как canonical happy path.

## DoD
- user-visible staged flow больше не продаётся как нормальный путь.

---

# Step 5 — исправить split-port localhost topology

Это один из главных незакрытых backend/product вопросов.

## Текущее состояние
Сейчас локально всё ещё есть несколько портов:
- shell
- work-ui
- execution-kernel

Подтверждающие файлы:
- `scripts/start-localhost.mjs`
- `package.json`
- `apps/shell/apps/web/lib/server/control-plane/workspace/rollout-config.ts`

## Что нужно сделать
Исполнителю нужно определить и реализовать **одну чёткую финальную localhost topology policy**:

### Вариант, который нужен для solo-v1
- пользователь входит через **один shell-owned localhost entry**;
- split services могут существовать технически,
- но не должны ощущаться как второй/третий продукт;
- конфликтные fallback-порты (`3101`, `5173`, и др.) должны быть устранены или жёстко нормализованы.

## Конкретно
1. убрать конфликт defaults;
2. зафиксировать canonical local topology;
3. привести launcher, rollout-config, validation runner и workspace launch contract к одной схеме;
4. явно решить, остаётся ли work-ui отдельным origin локально, или проксируется/прячется полностью behind shell.

## DoD
- больше нет плавающей локальной topology с несколькими конкурирующими defaults;
- shell-first unified-entry goal реализован честно.

---

# Step 6 — довести delivery truth до честного состояния

Это всё ещё не закрыто до конца.

## Проблема
Сейчас часть runnable-result proof всё ещё может опираться на scaffold artifact, а не на реально собранный requested product.

## Ключевые файлы
- `apps/shell/apps/web/lib/server/orchestration/delivery.ts`
- `apps/shell/apps/web/lib/server/orchestration/attempt-artifacts.ts`
- `apps/shell/apps/web/lib/server/orchestration/verification.ts`
- `apps/shell/apps/web/lib/server/orchestration/assembly.ts`

## Что сделать
1. Разделить окончательно:
   - wrapper preview,
   - runnable result,
   - handoff evidence.
2. `delivery.ready` запрещено выставлять, если поднялся только shell-generated artifact.
3. Launch proof должен проверять именно real output target.
4. Новый delivered/result UI должен показывать это явно.

## DoD
- `ready` = реально runnable итоговый продукт, а не synthetic scaffold.

---

# Step 7 — довести runtime до честного localhost-grade состояния

## Что уже хорошо
- localhost-only auth guard есть;
- timeouts есть;
- file-backed persistence есть;
- kernel tests проходят.

## Что ещё не закрыто
Runtime всё ещё слишком scaffold-first по глубине.

## Файлы
- `services/execution-kernel/internal/auth/noop.go`
- `services/execution-kernel/internal/daemon/server.go`
- `services/execution-kernel/internal/service/service.go`
- `services/execution-kernel/internal/supervisor/doc.go`
- `services/execution-kernel/internal/realtime/doc.go`

## Что сделать
1. сделать failure model богаче и полезнее shell-у;
2. улучшить restart/retry/recoverability semantics;
3. убрать ощущение, что kernel — это только thin local stub;
4. не уходить в full enterprise runtime — только честный solo-v1 local runtime.

## DoD
- kernel больше не выглядит как demo runtime;
- shell получает более правдивую runtime truth.

---

# Step 8 — добить auth seam

## Проблема
Хотя стало лучше, `localStorage.token` fallback всё ещё жив.

## Файл
- `apps/work-ui/src/lib/founderos/credentials.ts`

## Что сделать
1. session exchange / session grant сделать единственным primary path;
2. legacy localStorage fallback оставить только как compatibility escape hatch;
3. убрать зависимость embedded happy path от browser token storage.

## DoD
- primary embedded auth path больше не завязан на `localStorage.token`.

---

# Step 9 — переписать validation так, чтобы он действительно доказывал готовность

## Проблема
Сейчас validation проходит, но переоценивает readiness.

## Что нужно сделать

### 9.1. Исправить validation truth
Файлы:
- `scripts/validation/run_infinity_validation.py`
- `apps/shell/apps/web/lib/server/orchestration/validation.ts`

Убрать synthetic overclaim там, где validation подменяет настоящие проверки упрощёнными командами.

### 9.2. Расширить shell test scope
Сейчас `shell:test` слишком узкий.
Нужно сделать так, чтобы default validation действительно включал важные orchestration tests.

### 9.3. Сохранить уже сильные smoke checks
Не ломать:
- root shell proof;
- workspace bootstrap proof;
- session exchange proof.

## DoD
- green validation действительно означает, что backend + orchestration + localhost result path честно готовы.

---

# Step 10 — финальная проверка перед закрытием цикла

Исполнитель не может писать “готово”, пока не ответит “да” на всё ниже.

1. Есть baseline git checkpoint?
2. Новый frontend реально встроен в shell, а не просто лежит рядом?
3. Frontdoor / Runs / Primary Run / Result визуально мигрированы?
4. Secondary routes больше не учат staged manual flow?
5. Localhost topology больше не плавает между несколькими competing ports?
6. `delivery.ready` означает real runnable result?
7. Runtime больше не выглядит как thin stub?
8. Embedded auth больше не зависит от `localStorage` как primary path?
9. Validation действительно доказывает готовность, а не только “что-то запустилось”? 

Если хотя бы один ответ “нет” — цикл не закрыт.

---

# Приоритеты

## Абсолютный порядок исполнения
1. Git baseline check
2. Claude Design frontend integration into shell
3. Secondary route cleanup
4. Localhost topology cleanup
5. Delivery truth cleanup
6. Runtime truth hardening
7. Auth seam cleanup
8. Validation truth hardening

---

# Короткий вывод

Исполнителю осталось сделать **не косметику**, а ещё один реальный жёсткий цикл:
- правильно интегрировать новый frontend,
- убрать staged/manual leakage,
- убрать topology debt,
- починить delivery/runtime/auth/validation truth.

То есть сейчас состояние не “всё готово”, а:

**“foundation strong, target frontend ready, but critical integration and backend truth work still remain.”**