```
/daw-validate-spec docs/daw/specs/spec-FEAT-006c.md — PASSED
────────────────────────────────────────────────────────────────
  ✅ F-SPEC-01: all 6 FR from the PRD are referenced by a block
  ✅ F-SPEC-02: all 10 AC from the PRD are named by at least one test
  ✅ F-SPEC-03: all 2 NFR carry a technical strategy
  ·  6 block(s) found
  ✅ F-SPEC-04: every block lists the files it creates or modifies
  ✅ F-SPEC-05: every block has a verifiable completion criterion
  ✅ F-SPEC-06: every block lists at least one required test
  ✅ F-SPEC-07: every endpoint carries a complete contract
  ✅ F-SPEC-08: every schema declares its constraints
  ✅ F-SPEC-09: every block taking input documents its validation
  ✅ F-SPEC-10: every block documents its error handling
  ✅ F-SPEC-16: every documented error is named by a test
  ✅ F-SPEC-11: dependencies between blocks are declared
  ⚠️ W-SPEC-02: large block, consider splitting: Block 1 (`listGroupPicks` en el servicio de grupos) (4 files, 540 words), Block 2 (Reglas puras del grupo en la grilla y la copia del dispositivo) (11 files, 649 words), Block 3 (Selector de grupo e iniciales en la grilla (presentación)) (12 files, 466 words), Block 4 (El grupo en la pantalla, la página y la copia) (16 files, 632 words), Block 5 (E2E del grupo en la grilla) (5 files, 505 words), Block 6 (Bloques cortos con amigos: horario a su alto y nombre a 1 línea (vuelta 1)) (6 files, 450 words)
  👁  F-SPEC-12 (contradicts the PRD) and F-SPEC-13 (terminology diverging from
      the PRD) are MANUAL: judge them and say so explicitly in your report.
  ✅ F-SPEC-LOOP: 0 loop(s) since a human decided, under the ceiling of 3; 1 in total for this document
────────────────────────────────────────────────────────────────
Total: 13 passed, 0 failed, 1 warnings
Result: PASSED
```
