# CORE engineering rules

CORE is a real-time Three.js organism with seven stable visual states. A stable state, a topology transition, a visual entity, a director, and an appearance parameter are separate concepts.

Before changing visual, state, or transition code:

1. Read `docs/ARCHITECTURE.md`, `docs/STATE_GRAPH.md`, `docs/TRANSITION_CONTRACTS.md`, and `docs/VISUAL_OWNERSHIP.md`.
2. Inspect the implementation; documentation is a contract to verify, not a substitute for code.
3. Perform a blast-radius check: owner, consumers, shared mutable values, dependent states/transitions, and possible regressions.
4. Give each mutable concept one authoritative writer. One topology owns matter except during documented morph overlap.
5. Do not patch a transition with unrelated source/destination checks. Extend or repair the owning transition primitive.
6. Do not use opacity/emission as lifecycle cleanup or stop unrelated clocks through a generic lock.
7. Reuse transition primitives. Test every state pair that shares a changed primitive, including rapid retarget and return.
8. Keep architecture refactors behavior-preserving; make visual changes in a separate phase.
9. Record discovered debt in `docs/TECH_DEBT.md`; do not silently add a workaround.
10. If requested behavior conflicts with an invariant, stop and report it before coding.

Before completion: build, run relevant transition regressions, inspect the diff, confirm unrelated stable states did not change, and update architecture docs only when their contract changed.

## Multi-agent orchestration

The primary agent is the orchestrator and final integrator. The user describes the desired outcome; do not ask the user to choose models, roles, branches, or task decomposition when the agent can decide safely.

Before substantive work, classify the request into distinct workstreams and assess the complexity and risk of each one. Delegate automatically when independent bounded workstreams can materially improve speed, context quality, or verification. Do not spawn an agent for a tiny task when coordination would cost more than doing it directly.

Use the cheapest role that can complete a workstream reliably:

- `scout`: Luna/low for read-only file and symbol search, bounded investigation, usage tracing, log analysis, and simple checks.
- `mechanic`: Luna/low for explicit, local, mechanical, low-risk edits with clear acceptance criteria.
- `implementer`: Terra/medium for normal feature work, UI behavior, multi-file changes, moderate refactors, debugging, tests, and optimization.
- `specialist`: Sol/high for architecture, ambiguous or repeated failures, difficult debugging, high-risk changes, system refactors, or mechanisms spanning multiple subsystems.
- `reviewer`: Terra/high for independent correctness, regression, security, and test review. Use `specialist` for a second review when the change is especially critical.

Escalate only when evidence requires it: Luna -> Terra -> Sol. An agent that finds its assignment more ambiguous, broad, or risky than expected must stop speculative work, report the blocker and evidence, and recommend the next role.

Run read-only exploration, log analysis, tests, and reviews in parallel only when they are independent. Do not let write agents edit overlapping files or shared concepts concurrently. Sequence dependent work and give each mutable concept one authoritative writer.

Give subagents the minimum sufficient context. Prefer no inherited turns or a small bounded turn window when the task can be described independently. Include the exact objective, scope, constraints, expected output, and whether edits are allowed. Require concise summaries with evidence, changed files, commands run, test results, and remaining uncertainty.

Subagent output is evidence, not an automatic approval. The primary agent must inspect the integrated diff, reconcile cross-module assumptions, run the relevant checks from this file and the repository, fix failures, and return one consolidated result to the user.
