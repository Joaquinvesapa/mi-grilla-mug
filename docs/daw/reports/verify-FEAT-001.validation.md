```
/daw-verify-module docs/daw/reports/verify-FEAT-001.md — FAILED (1 FAIL)
────────────────────────────────────────────────────────────────
  ✅ F-VER-01: all 20 AC from the PRD carry a passing verdict
  ✅ F-VER-02: all 6 spec block(s) are accounted for
  ❌ F-VER-06: not one test name could be read from the spec's 'Required tests'. Either the spec promises no tests — which F-SPEC-06 refuses — or the names are in a format this rule cannot parse; both are a NO from a rule that would otherwise pass having measured nothing
  ✅ F-VER-03: line, branch and function coverage all stated and ≥ 80%
  ✅ F-VER-04: the report names sad-path testing
  ✅ F-VER-05: lint / type check reported and clean
  👁  DAW does not run your suite: the numbers above are the report's, not this
      script's. What is checked is that the verdict is COMPLETE — see the header.
────────────────────────────────────────────────────────────────
Total: 5 passed, 1 failed, 0 warnings
Result: FAILED (1 FAIL)
```
