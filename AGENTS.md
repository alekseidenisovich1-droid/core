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
