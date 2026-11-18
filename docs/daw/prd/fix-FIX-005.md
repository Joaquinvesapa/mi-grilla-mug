# Fix FIX-005: Marcar FEAT-006 como hecho en su índice

- **Bug**: el índice del PRD padre de FEAT-006 dice que FEAT-006a está `active` y que 006b y 006c están `pending`, pero los tres ya se mergearon en `main` (PR #11, #13 y #15). Los cierres no lo actualizaron.
- **Change**: docs/daw/prd/prd-FEAT-006.md:15-17 — la columna Status de las tres filas pasa a `done`, y debajo de la tabla se agrega la nota de integración con el PR de cada sub-ticket.
- **Regression test**: `test-index-feat-006-done`: `grep -cE '^\| FEAT-006[abc] .*\| done \|$' docs/daw/prd/prd-FEAT-006.md` da 0 antes del cambio y 3 después; y `validate_prd.py docs/daw/prd/prd-FEAT-006.md` sigue en PASSED (F-PRD-10 y F-PRD-11).
- **Risk**: ninguno. Es solo documentación: no toca código, ni la app, ni la CI.
