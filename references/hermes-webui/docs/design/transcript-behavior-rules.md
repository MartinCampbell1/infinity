# Transcript behavior rules

Status: working behavioral brief for Codex-native transcript redesign

This document defines how the Hermes WebUI transcript should behave if the goal is to feel native to Codex. This is not only about CSS. It is about how different message/event types are prioritized, grouped, and visually expressed.

## Design goal

The transcript should feel like a single coherent work stream.

It should not feel like:
- a dashboard of unrelated widgets
- a stream of every raw event with equal importance
- a sequence of decorative chat bubbles

It should feel like:
- a focused coding conversation
- calm and high-signal
- supportive of long sessions
- truthful about what happened
- compact around tools and process detail

---

## Content types in the transcript

These are the main categories the UI needs to render distinctly:

1. User message
2. Assistant final answer
3. Assistant commentary / in-progress reasoning-like narration
4. Tool start / tool progress / tool completion
5. Approval or warning state
6. Error state
7. System continuity note (reconnect/compression/import context)

Each category should have a different weight.

---

## Priority model

### Highest priority
- user messages
- assistant final answers

These define the actual conversation.

### Medium priority
- commentary that helps the user understand what the agent is doing
- important warnings that affect user decisions

### Lower priority
- tool progress
- repeated activity updates
- operational details
- helper/status metadata

### Rare high-priority interruptions
- approval required
- dangerous failure
- session continuity/recovery problem

---

## User messages

Rules:
- concise visual treatment
- clearly identifiable as user-authored
- should not dominate the page more than assistant output
- preserve Markdown/text fidelity if applicable, but keep styling restrained

Behavioral rule:
- user messages anchor the conversation but should not make the transcript feel like a chat bubble app

---

## Assistant final answers

Rules:
- visually primary among assistant-originated content
- comfortable reading width
- clean Markdown rendering
- code blocks should feel integrated and production-grade
- answer text should not compete with tool chrome

Behavioral rule:
- if the assistant produces commentary and then a final answer, the final answer must feel like the clear culmination of the turn

---

## Assistant commentary

Commentary is useful, but it must be visually secondary.

Rules:
- lighter than final answer
- compact spacing
- avoid making each commentary snippet look like a major content block
- if commentary is frequent, consider grouping or reducing visual weight

Behavioral rule:
- commentary should help explain what is happening without overwhelming the main transcript

Anti-pattern:
- commentary that looks indistinguishable from the final answer

---

## Tool activity

This is the biggest source of “not-Codex” feeling when done poorly.

Rules:
- default view should be compact
- repeated progress items should not each become a heavy card unless absolutely necessary
- start/progress/finish should feel like one activity thread when possible
- details can be expandable or secondary

Desired default experience:
- user sees that tools are running
- user can understand what they are doing
- transcript still feels readable

Behavioral rule:
- tool activity is supporting evidence of work, not the main narrative

Anti-patterns:
- giant verbose tool cards for every action
- equal visual weight for every tool tick
- transcript spam from raw operational events

---

## Approval states

Rules:
- approval UI must interrupt clearly
- but only when genuinely necessary
- danger/approval blocks should feel serious and focused, not flashy
- approval text must state what is blocked and why

Behavioral rule:
- approval states are exceptional and should be instantly legible

---

## Warning states

Rules:
- warnings should be visible but not catastrophic-looking unless truly severe
- temporary warnings (fallback, reconnect, retry) should be compact
- persistent warnings should not bury the transcript

Examples:
- fallback activated
- reconnect attempted
- session imported as CLI-backed view

---

## Error states

Rules:
- errors must be explicit and readable
- distinguish recoverable vs terminal errors
- avoid dumping raw backend payloads directly into transcript unless in expandable debug mode

Behavioral rule:
- user should know whether to retry, wait, approve, switch profile, or inspect diagnostics

---

## Continuity notes

Examples:
- context compressed
- session restored
- imported from CLI transcript
- reconnected after stream interruption

Rules:
- these should exist when relevant
- they should be subtle but visible
- they should not pretend the system remembered something it did not actually remember

Behavioral rule:
- continuity notes must improve trust, not create false confidence

---

## Grouping rules

### Same-turn grouping
Within one user turn, the ideal hierarchy is:
1. user message
2. commentary / compact tool activity while work happens
3. assistant final answer

If possible, multiple tool events in one turn should read as one operational cluster rather than many disconnected blocks.

### Cross-turn rhythm
Adjacent turns should feel rhythmically consistent:
- no giant gaps unless semantically needed
- no alternating “tiny status row / giant box / tiny badge / giant box” chaos

---

## Expansion rules

Default transcript should show high-signal information.
Detailed operational output should be available on demand.

Good candidates for collapsed/secondary treatment:
- long tool outputs
- repetitive progress events
- low-level diagnostics
- clone/import metadata

Good candidates for always-visible treatment:
- final answer
- key commentary
- approval requirement
- major warning or failure

---

## Message density rules

Desired density:
- denser than current WebUI
- less dense than a raw terminal log
- optimized for sustained reading and coding work

This means:
- smaller vertical gaps around role headers
- fewer heavy separators
- compact metadata presentation
- code blocks still need enough room to breathe

---

## Transcript width rules

- keep reading width controlled
- do not stretch prose too wide
- tool metadata can use full width more freely if needed
- final answer text should favor readability over density

---

## Interaction rules

1. Clicking a session should make the transcript trustworthy immediately.
2. Imported/legacy/CLI-backed sessions should surface their nature honestly.
3. The transcript should make it obvious what is current work versus imported history.
4. Tool activity should never make the conversation feel lost.

---

## Behavioral differences we want from current WebUI

Current WebUI tendencies to reduce:
- heavy tool-card feel
- too much UI chrome around every message
- too many equally important visual blocks
- transcript behaving like a collection of panels

Desired Codex-native behavior:
- fewer visual modes
- stronger narrative flow
- more compact operational detail
- calmer distinction between process and answer

---

## First-pass implementation priorities

1. make user/assistant rows calmer
2. make commentary secondary
3. compress tool activity presentation
4. improve final-answer prominence
5. keep errors/warnings honest and legible

---

## Rule for every transcript change

Ask:
- does this improve narrative clarity and calmness?
- does this reduce transcript noise without hiding truth?
- does this make the product feel more native to Codex?

If not, do not keep the change.
