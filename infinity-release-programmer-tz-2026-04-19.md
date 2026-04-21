# Infinity — полное ТЗ для программиста по доведению системы до release-ready состояния

Дата: `2026-04-19`  
Статус документа: `implementation directive / no-go recovery plan`  
Приоритет: `P0`

---

## 1. Назначение документа

Этот документ — жёсткое рабочее ТЗ для программиста/агента, который должен довести проект `Infinity` до реально работающего состояния.

Документ основан на:

- статическом аудите кода;
- runtime-проверке локального dev-стека;
- проверке маршрутов, API, rollout-состояния и тестового контура;
- сравнении фактической реализации с `AGENTS.md`, master spec и текущим implementation plan.

Цель документа:

1. не дать исполнителю уйти в косметику вместо критического пути;
2. зафиксировать, что именно сломано сейчас;
3. задать правильный порядок работ;
4. дать критерии, по которым можно честно сказать `done`;
5. обеспечить максимально автономную работу без постоянных уточнений.

---

## 2. Короткий вердикт по текущему состоянию

Текущее состояние проекта: `NO-GO`.

Причина: система содержит много кода и частично реализованных контуров, но **release seam не закрыт**.

Критический практический вывод:

- `shell` не владеет корневым входом `/`;
- `work-ui` и `shell` живут как два отдельных dev-entrypoint;
- `shell ↔ work-ui` launch/bootstrap контракт не доведён до рабочего состояния;
- `rollout-status` подтверждает, что интеграция не готова;
- ключевые release-критичные срезы всё ещё завязаны на `placeholder` / `mock_file_backed` / synthetic state.

Иными словами: проблема не в “нескольких багфикcах”, а в том, что **архитектурный путь до production не завершён**.

---

## 3. Проверенные факты, которые нужно считать истинными

Ниже — факты, подтверждённые аудитом и runtime-проверками. Исполнитель не должен их игнорировать.

### 3.1 Frontdoor и маршрутизация

- `shell` dev реально работает на `http://127.0.0.1:3737`
- `work-ui` dev реально работает на `http://localhost:5173`
- `GET http://127.0.0.1:3737/` возвращает `404`
- `GET http://127.0.0.1:3737/execution` возвращает рабочую shell-страницу
- `GET http://localhost:5173/` возвращает work-ui

Следствие:

- у продукта **нет одного корректного entrypoint**;
- в dev пользователь фактически попадает в две разные системы;
- это надо считать release-blocker.

### 3.2 Rollout / host / bootstrap

Проверка `GET /api/control/execution/workspace/rollout-status` дала:

- `ready = false`
- `integrationState = "placeholder"`
- `workUiBaseUrl = "http://127.0.0.1:3101"`
- `launchSecretConfigured = false`

Следствие:

- workspace embedding/launch path формально не готов;
- shell ожидает не тот work-ui origin;
- launch/bootstrap seam не готов для релиза.

### 3.3 Port/origin drift

Сейчас одновременно присутствуют и конфликтуют следующие runtime-допущения:

- shell origin: `3737`
- фактический work-ui dev origin: `5173`
- stale expected work-ui base в shell: `3101`
- legacy API base / dev assumptions в work-ui: `8080`

Следствие:

- контракт окружения не согласован;
- нельзя считать локальный запуск репрезентативным;
- любой агент обязан сначала чинить topology/origin contract, а не косметику UI.

### 3.4 Mock truth на core path

В коде и API подтверждено наличие `mock_file_backed`, mock builders и placeholder-состояния на release-критичных поверхностях.

Особенно важно:

- `/execution`
- `/execution/sessions`
- `/execution/groups`
- `/execution/accounts`
- `/execution/approvals`
- `/execution/recoveries`
- `/execution/workspace/[sessionId]`

Следствие:

- наличие страниц и ответов API не считается достаточным;
- пока release-critical path опирается на `mock_*`, работа не считается закрытой.

### 3.5 Orchestration и runtime

Подтверждено, что:

- planner сейчас строит фиксированный шаблонный граф;
- task graph / assembly / verification / delivery пока синтетичны или облегчены;
- execution-kernel — минимальный `in-memory` сервис, а не production runtime.

Следствие:

- текущее состояние нельзя считать “реальной orchestrated execution system”;
- есть только scaffold, а не завершённая операционная платформа.

### 3.6 Тестовый контур

Подтверждено, что:

- `shell:test` проходил;
- `shell:typecheck` проходил;
- `work-ui:check` проходил;
- `shell:build` проходил;
- `work-ui:build` проходил, но с warnings;
- `go test ./...` для `services/execution-kernel` проходил;
- `work-ui:test` висит из-за watch-mode;
- прямой `vitest run` в монорепо вскрывает alias-проблемы и падение части тестов;
- есть contract drift минимум в двух shell-тестах.

Следствие:

- нельзя опираться на “локально всё зелёное”;
- release gate сейчас не считается trustworthy.

---

## 4. Обязательные архитектурные решения по умолчанию

Эти решения считаются принятыми по умолчанию для автономного исполнителя. Отступать от них можно только по прямому явному указанию оператора.

### 4.1 Кто владеет `/`

По умолчанию считать, что:

- корневой route `/` должен принадлежать `FounderOS shell`;
- `Open WebUI adaptation` не должен быть корневым shell приложения;
- `work-ui` должен открываться как embedded workspace внутри shell-owned route.

### 4.2 Один продукт из двух приложений

Не строить giant SPA. Правильная композиция:

- `FounderOS` = shell / boards / operator control plane;
- `Open WebUI adaptation` = workspace feel и message-first рабочая поверхность;
- `Hermes` = поведенческий reference, не третий root app.

### 4.3 Live truth важнее mock convenience

Для release-critical path:

- `mock_file_backed` не считается финальной truth-моделью;
- `placeholder` не считается рабочим rollout state;
- synthetic records не считаются production execution evidence.

### 4.4 Никаких giant rewrites

Исполнитель должен:

- делать thin integration seams;
- чинить topology и truth layers;
- не начинать “переписывать всё с нуля”.

### 4.5 Автономность без фантазий

Если решение не определено явно, исполнитель должен:

1. выбрать путь, который ближе всего к `AGENTS.md` и master spec;
2. предпочесть существующие контракты и текущую архитектуру;
3. не придумывать новый продукт, новые слои истины или новый shell.

---

## 5. Что именно нужно сделать

Работа делится на 6 фаз. Переход к следующей фазе без закрытия acceptance criteria предыдущей фазы запрещён.

---

## 6. Фаза 0 — topology freeze и единый frontdoor

### Цель

У продукта должен появиться один нормальный вход и один согласованный runtime-контракт.

### Что сделать

1. Реализовать корректный route-owner для `/`.
2. Сделать так, чтобы shell был публичной точкой входа.
3. Устранить расхождение между:
   - `3737`
   - `5173`
   - `3101`
   - `8080`
4. Выровнять shell/work-ui origin resolution.
5. Зафиксировать один env/runtime contract для:
   - shell origin
   - work-ui origin
   - work-ui base URL
   - API base URL
   - launch/bootstrap secret
6. Убрать stale defaults, которые направляют shell или work-ui не в тот сервис.

### Зоны кода, которые почти наверняка придётся трогать

- `apps/shell/apps/web/app/*`
- `apps/shell/apps/web/lib/server/control-plane/workspace/rollout-config.ts`
- `apps/work-ui/src/lib/founderos/shell-origin.ts`
- `apps/work-ui/src/lib/constants.ts`
- `apps/work-ui/vite.config.ts`
- root/run scripts, если они закрепляют неправильные стартовые assumptions

### Acceptance criteria

- `GET /` на основном dev/release origin не возвращает `404`
- product entry соответствует shell-owned model
- shell и work-ui используют согласованные origin/base URL
- `rollout-status` больше не указывает на заведомо неправильный work-ui base URL

### Что считается провалом

- если `/` всё ещё отдаёт 404;
- если shell и work-ui остаются двумя независимыми frontdoor;
- если внутри кода продолжают одновременно жить несовместимые дефолты `3101/5173/8080`.

---

## 7. Фаза 1 — довести workspace launch / bootstrap / embedded host до рабочего состояния

### Цель

Сделать так, чтобы shell реально открывал embedded workspace по живому контракту.

### Что сделать

1. Довести `rollout-status` до состояния `ready=true`.
2. Настроить `launchSecretConfigured=true`.
3. Починить launch token / bootstrap / session exchange flow.
4. Убедиться, что workspace реально принимает:
   - `founderos.bootstrap`
   - host meta
   - account/session context
5. Убедиться, что shell реально получает:
   - `workspace.ready`
   - tool events
   - approval events
   - workspace error events
6. Убрать placeholder/degraded behavior из core embedded path.

### Зоны кода

- `apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts`
- `apps/shell/apps/web/app/api/control/execution/workspace/*`
- `apps/shell/apps/web/app/(shell)/execution/workspace/[sessionId]/*`
- `apps/work-ui/src/lib/founderos/bootstrap.ts`
- `apps/work-ui/src/lib/founderos/launch.ts`
- `apps/work-ui/src/lib/founderos/index.ts`
- `apps/work-ui/src/routes/(app)/+layout.svelte`

### Acceptance criteria

- shell открывает workspace без ручной подмены URL;
- bootstrap/launch contract проходит end-to-end;
- workspace сообщает `ready`, shell получает события;
- на рабочем пути нет placeholder rollout state.

### Что считается провалом

- если embedded mode зависит от ручного костыля;
- если shell route существует, но живёт на mock launch model;
- если valid launch token по-прежнему не даёт рабочий вход.

---

## 8. Фаза 2 — убрать mock truth с release-critical control-plane paths

### Цель

Все release-критичные boards и workspace route должны работать на реальной истине, а не на mock builders.

### Release-critical surfaces

Обязательны к переводу на live/durable truth:

- `/execution`
- `/execution/sessions`
- `/execution/groups`
- `/execution/accounts`
- `/execution/approvals`
- `/execution/recoveries`
- `/execution/review`
- `/execution/workspace/[sessionId]`

### Что сделать

1. Убрать `buildMockWorkspaceLaunchViewModel(...)` из critical launch path.
2. Убрать `ExecutionLegacyPlaceholderSurface` из критичного маршрута релиза.
3. Убрать `mock_file_backed` и `mock_*` storageKind с основных API/boards в release mode.
4. Явно развести:
   - fixture/dev mode
   - release-like mode
5. Убедиться, что boards отражают реальные session/group/account/recovery/approval объекты.

### Acceptance criteria

- core boards не строятся на mock builders;
- workspace route получает live session truth;
- API critical path больше не возвращают `mock_*` как финальную storage truth;
- оператор может перейти из board → workspace и не попасть в placeholder branch.

### Что считается провалом

- если страницы визуально выглядят “готовыми”, но данные всё ещё mock-backed;
- если route существует только как shell around mock state.

---

## 9. Фаза 3 — превратить orchestration из scaffold в реальную систему

### Цель

Project Factory flow должен стать реальным рабочим процессом, а не демонстрационным конвейером.

### Что сделать

1. Заменить template planner на brief/spec-driven planner.
2. Сделать реальное построение task graph из содержимого brief/spec, а не fixed 3-node graph.
3. Сделать реальную materialization batch/run.
4. Привязать assembly к реальным output/artifact данным.
5. Привязать verification к реальным quality gates.
6. Привязать delivery к реальному handoff, а не только к локальным путям/placeholder-описаниям.

### Зоны кода

- `apps/shell/apps/web/lib/server/orchestration/planner.ts`
- `apps/shell/apps/web/lib/server/orchestration/task-graphs.ts`
- `apps/shell/apps/web/lib/server/orchestration/assembly.ts`
- `apps/shell/apps/web/lib/server/orchestration/verification.ts`
- `apps/shell/apps/web/lib/server/orchestration/delivery.ts`
- `apps/work-ui/src/lib/apis/orchestration/*`
- `apps/work-ui/src/routes/(app)/project-intake/*`
- `apps/work-ui/src/routes/(app)/project-brief/*`
- `apps/work-ui/src/routes/(app)/project-run/*`

### Acceptance criteria

- approved brief реально порождает осмысленный task graph;
- graph отражает содержание brief/spec;
- run/assembly/verification/delivery несут реальную операционную ценность;
- пользователь проходит путь intake → brief → planner → run → result без декоративных заглушек.

### Что считается провалом

- если planner всё ещё template-driven;
- если graph/assembly/verification/delivery лишь создают synthetic записи;
- если Project Factory flow формально есть, но не запускает реальную оркестрацию.

---

## 10. Фаза 4 — сделать execution-kernel durable и операционным

### Цель

Execution runtime не должен быть одноразовым `in-memory` демо-сервисом.

### Что сделать

1. Убрать зависимость от purely in-memory truth.
2. Добавить durable storage для batch/attempt/session execution state.
3. Добавить restart-safe recovery.
4. Добавить worker lifecycle / retry / reassignment / failover semantics.
5. Добавить heartbeat/stream integrity там, где это нужно для фактической эксплуатации.
6. Убедиться, что перезапуск kernel не уничтожает run-state.

### Зоны кода

- `services/execution-kernel/internal/service/*`
- `services/execution-kernel/internal/handler/*`
- `services/execution-kernel/internal/events/*`
- storage/migrations, если потребуется
- shell/work-ui integration code, где runtime status читается или отображается

### Acceptance criteria

- run-state не теряется при restart;
- batch/attempt state можно восстановить;
- retry/failover — реальные действия, а не только UI affordance;
- runtime пригоден для operator-facing control plane.

### Что считается провалом

- если после restart в run пропадает truth;
- если attempt/batch остаются process-local объектами;
- если recoveries опираются только на видимость в UI, а не на durable state.

---

## 11. Фаза 5 — approvals / recoveries / quota / accounts как first-class operator layer

### Цель

Сделать operator control plane реально управляемым, а не обзорной витриной.

### Что сделать

#### 11.1 Approvals / recoveries

1. Сделать durable approvals model.
2. Сделать durable recovery incidents.
3. Сделать операторские действия:
   - approve once
   - approve session
   - approve always
   - deny
   - retry same account
   - retry fallback account
4. Убедиться, что approval/recovery видны и в shell, и в workspace.
5. Логировать operator interventions как auditable events.

#### 11.2 Quota / accounts

1. Убрать путаницу между ChatGPT-authenticated quota truth и API-key semantics.
2. Довести accounts board до реального capacity layer.
3. Убедиться, что upstream quota truth действительно отображается там, где она должна быть canonical.
4. Довести preferred account / schedulable / pressure model до рабочего состояния.

### Acceptance criteria

- approvals и recoveries существуют как durable objects;
- operator может реально вмешиваться в execution flow;
- shell и workspace синхронно отражают approval/recovery state;
- accounts board показывает честную capacity truth.

### Что считается провалом

- если approvals/recoveries остаются process-local или условно-декоративными;
- если quota truth остаётся derived placeholder без реального upstream источника;
- если operator actions есть в UI, но не влияют на реальную execution state.

---

## 12. Фаза 6 — закрыть release gate, тесты, smoke и UAT

### Цель

Нельзя заявлять “готово”, пока нет воспроизводимого релизного validation path.

### Что сделать

#### 12.1 Исправить test harness

1. Заменить `work-ui:test` на non-watch команду для CI/automation.
2. Починить monorepo alias resolution для `vitest`.
3. Исправить выявленный contract drift в shell tests.

Известные конкретные проблемы:

- `briefs/route.test.ts` ожидает `brief_ready`, а код отдаёт `planning`
- `launch-token/route.test.ts` даёт `accepted=false`, хотя ожидается `true`

#### 12.2 Закрыть build/runtime warnings

1. Разобрать warnings в `work-ui:build`
2. Отдельно triage:
   - `@sveltejs/svelte-virtual-list`
   - browser externalization `node:*`
   - `pyodide`
   - oversized chunks
3. Либо устранить, либо formalize risk acceptance с доказанной безопасностью

#### 12.3 Ввести обязательный validation path

Минимум должны быть автоматизированы или жёстко документированы:

1. shell frontdoor smoke
2. shell → workspace embedded smoke
3. initiative creation
4. brief approval
5. planner/run launch
6. approval roundtrip
7. retry/failover flow
8. accounts/quota view
9. review/delivery visibility
10. reload/restart resilience

### Acceptance criteria

- есть non-watch test command;
- тесты проходят в monorepo/CI context;
- e2e happy path реально прогоняется;
- release gate не зависит от ручной удачи локального запуска.

### Что считается провалом

- если tests формально есть, но запускаются только в watch-mode;
- если smoke path можно пройти только руками через обходы;
- если CI не способен честно воспроизвести release-критичный flow.

---

## 13. Обязательные ограничения и анти-цели

Исполнителю запрещено:

1. переписывать Open WebUI на React;
2. делать monolithic mega-SPA;
3. добавлять ещё один truth layer;
4. уводить shell в chat-first приложение;
5. держать approvals/recoveries в памяти процесса как финальный вариант;
6. считать сборку или typecheck достаточным доказательством работоспособности;
7. тратить время на polishing до закрытия P0/P1;
8. править внешние reference repos вместо локального `/Users/martin/infinity`;
9. скрывать runtime complexity за “магией”, вместо явных recoveries/retries/operator actions;
10. тащить raw provider events напрямую в UI как primary representation.

---

## 14. Приоритетный порядок выполнения

Исполнитель должен идти строго в этом порядке:

1. `Frontdoor + topology + origin contract`
2. `Workspace launch/bootstrap/embedded readiness`
3. `De-mock release-critical control plane`
4. `Real orchestration`
5. `Durable runtime kernel`
6. `Approvals/recoveries/quota/accounts`
7. `Tests + smoke + release gate`

Если исполнитель начинает с polish, visual cleanup или non-critical UX before P0, это считается отклонением от ТЗ.

---

## 15. Definition of Done для этой работы

Работа считается завершённой только если одновременно выполнены все условия:

1. `/` работает как единый frontdoor продукта.
2. shell и work-ui используют согласованный runtime contract.
3. `rollout-status` показывает ready state.
4. shell реально открывает embedded workspace.
5. Project Factory happy path проходит end-to-end.
6. release-critical boards не зависят от `mock_*` как финальной истины.
7. planner/task graph/run path больше не synthetic scaffold.
8. execution-kernel durable и restart-safe.
9. approvals/recoveries operator-actionable и durable.
10. accounts/quota layer показывает честную capacity truth.
11. test suite запускается в non-watch режиме.
12. smoke/UAT сценарии подтверждают реальную работу системы.

Если хоть один пункт не выполнен — итоговый статус не `done`, а `partial`.

---

## 16. Обязательная QA / UAT матрица

Ниже минимальный набор, который должен быть пройден до объявления релиза.

| ID | Сценарий | Тип | Что должно быть доказано |
|---|---|---|---|
| QA-01 | Открытие `/` | Smoke | Нет 404, пользователь попадает в корректный frontdoor |
| QA-02 | Переход `/` → shell navigation → workspace | Integration | Один product flow без ручной подмены URL |
| QA-03 | Создание initiative | Integration | Initiative создаётся через живой orchestration path |
| QA-04 | Переход от intake к brief | Integration | Brief truth сохраняется и читается корректно |
| QA-05 | Brief approval → planner | Integration | Planner строит осмысленный graph |
| QA-06 | Run launch | Integration | Создаётся реальный batch/run |
| QA-07 | Shell открывает embedded workspace | Smoke | Launch/bootstrap работают корректно |
| QA-08 | Workspace отдаёт tool/progress events | Integration | Host получает и отображает их корректно |
| QA-09 | Approval request roundtrip | Integration/UAT | Approval виден и в shell, и в workspace |
| QA-10 | Approve / deny | UAT | Операторское решение реально меняет execution flow |
| QA-11 | Retry same account | UAT | Retry создаёт осмысленное продолжение исполнения |
| QA-12 | Retry fallback account | UAT | Failover реально меняет account path |
| QA-13 | Accounts/quota board | Integration/UAT | Видна честная capacity truth |
| QA-14 | Review/result visibility | Integration/UAT | Видны реальные outputs и verification state |
| QA-15 | Reload resilience | Smoke | Перезагрузка не ломает execution truth |
| QA-16 | Restart resilience | Resilience | Перезапуск сервиса не уничтожает run-state |
| QA-17 | Non-watch test suite | CI | Команды запускаются автоматически и завершаются корректно |
| QA-18 | Release validation script | CI/UAT | Happy path воспроизводится предсказуемо |

---

## 17. Обязательные исходные документы и файлы для чтения перед началом работ

Исполнитель обязан прочитать минимум:

1. `AGENTS.md`
2. `agents.md`
3. `unified-control-plane-super-spec-v2-2026-04-10.md`
4. `latest-plan.md`
5. этот документ: `infinity-release-programmer-tz-2026-04-19.md`

Также почти наверняка понадобятся:

- `apps/shell/apps/web/lib/server/control-plane/contracts/*`
- `apps/shell/apps/web/lib/server/control-plane/workspace/*`
- `apps/shell/apps/web/lib/server/orchestration/*`
- `apps/work-ui/src/lib/founderos/*`
- `apps/work-ui/src/lib/apis/orchestration/*`
- `apps/work-ui/src/routes/(app)/*`
- `services/execution-kernel/*`
- `scripts/validation/run_infinity_validation.py`

---

## 18. Режим автономной работы исполнителя

Чтобы исполнитель работал максимально автономно и не ушёл не туда, он обязан придерживаться следующего режима:

1. Сначала читать этот документ и `AGENTS.md`, потом код.
2. Не спрашивать разрешение на каждую мелочь.
3. Принимать по умолчанию, что shell владеет `/`.
4. Принимать по умолчанию, что work-ui — embedded workspace, а не второй root app.
5. Не останавливаться на “build green”.
6. После каждой фазы проверять runtime-путь, а не только статическую сборку.
7. Не переходить к polish до закрытия P0/P1.
8. Если выбор между `mock convenience` и `live truth`, всегда выбирать `live truth`.
9. Любое решение, создающее новый truth-layer или новый product direction, считать запрещённым.
10. Финализировать работу только после validation evidence, а не по ощущениям.

---

## 19. Самая короткая инструкция исполнителю

Если совсем коротко:

> Сначала сделай один рабочий frontdoor.  
> Потом почини shell ↔ work-ui launch seam.  
> Потом убери mock truth с critical path.  
> Потом доведи orchestration и runtime до реальной операционности.  
> Потом закрой approvals, recoveries, quota и release gate.  
> Не переписывай продукт, не делай косметику раньше времени, не объявляй done до end-to-end доказательства.
