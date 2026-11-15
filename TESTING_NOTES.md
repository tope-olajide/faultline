# Testing notes

The authoritative verification record lives in
[`docs/TESTING_NOTES.md`](docs/TESTING_NOTES.md).

Latest verified measurements (held-out split, 6 cases):

| Engine | Before learning | After learning |
|---|---|---|
| Vector-only | 0.333 Top-1 | 0.333 Top-1 |
| Fixed graph | 0.000 Top-1 | 0.000 Top-1 |
| Adaptive graph | 0.000 Top-1 | 1.000 Top-1 |

Typecheck and production build are clean. Page and API smoke checks are recorded
in the authoritative file.
