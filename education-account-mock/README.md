# Education Account - portal mock (single-file HTML prototypes)

- `admin-portal-moe.html` - admin portal (MOE HQ + School User views): fee catalogue, Fee Handbook, Assign fees (MOE bill / School bill), charge history, student fees & dashboard, top-ups, FAS.
- `eservice-portal-parent.html` - parent e-Service portal: charges, Education Account payments.

Open either file directly in a browser (no build step).

## Regression suites (Node, no deps)

```
node smoke-schoolfee.js   # school-user fee flows incl. Assign fees (MOE bill vs School bill)
node smoke-feedash.js     # MOE HQ fee dashboard
node sit-r4.js            # SIT R4
node sit-r5.js            # SIT R5
```

Every suite prints PASS/FAIL lines and exits non-zero on any FAIL.

## Key behaviour encoded in the suites

- MOE fee types are mandatory and assigned **whole** to a whole cohort (level).
- School bills are the school's own fee types: component cherry-picking + target = whole level / one class / selected students (level -> class -> name search, down to a single student).
- MOE bills and school bills are never mixed in one generation.
- All search bars are fuzzy and refresh locally (typing keeps focus).
