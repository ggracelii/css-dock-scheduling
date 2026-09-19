# WHOI Dock Manager

Waterfront scheduling and berth management built from the supplied 1997 through 2019 synthetic dock workbook.

The application turns the legacy visual calendar into searchable records, checks berth conflicts and vessel fit automatically, recommends the smallest available berth that fits, and keeps prototype changes in the browser. It is a static React application designed for GitHub Pages.

## Reference files

- [Implementation plan](PLAN.md)
- [Synthetic dock schedule workbook](Dock%20Schedule%20-%20Synthetic%20Sample.xlsx)

## What works

- Month timeline for eight discovered waterfront resources
- 2,186 reservations imported from 23 annual schedule sheets
- Vessel, event, and operational-closure records
- Search across vessel names, berths, and years
- Reservation details with workbook sheet/cell provenance
- Create, edit, and delete flows persisted in `localStorage`
- Inclusive-date conflict detection that blocks invalid saves
- Vessel-length validation against berth capacity
- Best-fit berth recommendations with an explanation
- Historical issue review split into schedule integrity and reference-data quality
- Low-confidence import indicators and source coordinates
- Responsive layouts and keyboard-accessible controls
- Reset action that restores the generated source dataset
- Page-defined WebMCP tools for availability checks and reservation creation in supporting browsers

## Source data and importer

The workbook is not a relational table. It stores reservations as text inside 23 annual calendar grids. Horizontal merged ranges encode inclusive reservation duration, date columns move between month sections, berth capacities live in row labels, and the `Science` and `Yachts` sheets are semi-structured directories.

The importer therefore:

1. Discovers annual sheets and month blocks.
2. Builds a column-to-calendar-date map for each block.
3. Discovers resource rows and parses embedded capacities.
4. Reads each merged range once from its top-left cell.
5. Classifies vessel stays, waterfront events, closures, and annotations.
6. Reconciles schedule labels with normalized vessel identities.
7. Preserves the original sheet, cell or range, raw label, and import confidence.
8. Runs conflict, capacity, and reference-data validation without changing the historical source.
9. Compares 56 calculated 2006 through 2013 resource/year totals with the independent `8YR Dock Summary` and reports differences instead of forcing agreement.

Generated application data lives in `src/data/generated`. The source workbook is not duplicated in this repository; pass its location when regenerating:

```bash
npm run import-data -- "/path/to/Dock Schedule - Synthetic Sample.xlsx"
```

The supplied sample currently produces:

| Result | Count |
| --- | ---: |
| Annual sheets | 23 |
| Reservations | 2,186 |
| Vessels | 569 |
| Berths/resources | 8 |
| Events | 71 |
| Closures | 9 |
| Retained annotations | 25 |

### Import assumptions

- Merged horizontal cells define inclusive reservation date ranges.
- A populated unmerged cell on a berth row is a one-day entry.
- The `Tours` sheet is ancillary reference data, not evidence of berth occupancy.
- A missing berth capacity remains unknown; it is not treated as unlimited.
- Historical conflicts are preserved and flagged. New invalid reservations are blocked.
- Early sheets that provide only a day-one anchor use sequential columns through the known number of days in that calendar month.
- Month blocks explicitly labeled with another year are treated as carryover/reference content. They bound adjacent sections but are not imported into the annual sheet's canonical year.
- Legacy summary discrepancies remain validation findings; they do not rewrite parsed reservations.

## Architecture

`scripts/parseWorkbook.ts` owns legacy-workbook interpretation. Generated JSON is the boundary between migration logic and the application.

Pure functions in `src/lib` own inclusive date overlap, conflict detection, vessel fit, and best-fit recommendations. The React interface never reimplements those rules. `LocalStorageReservationRepository` overlays browser-local changes on the committed seed, while `ReservationProvider` exposes one state and action surface to both the UI and WebMCP tools.

This separation is intentional: a production version can replace local storage with an authenticated API without rewriting the importer, domain rules, or most components.

## Run and verify

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
npm test
npm run build
```

Tests cover inclusive overlap boundaries, same-berth conflict detection, known versus unknown capacity, best-fit recommendations, shifted month columns, early-sheet date anchors, vessel-name normalization, and dimension parsing.

## Deploy to GitHub Pages

The included workflow builds and publishes `dist` on every push to `main`.

1. Push the repository to GitHub.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. Run the **Deploy to GitHub Pages** workflow or push to `main`.

Vite uses a relative asset base, so project-site URLs such as `https://owner.github.io/repository/` work without a repository-name-specific setting.

## Prototype boundaries

This GitHub Pages version is intentionally single-user and device-local. It has no authentication, shared editing, audit log, or server-side persistence. Browser data can be cleared, and concurrent staff do not see one another's changes. A production rollout should add authenticated shared storage, role-based access, optimistic concurrency, a migration review workflow for low-confidence records, backups, and server-side enforcement of the same domain rules.

The import is reproducible and auditable, but not every legacy value can be resolved automatically: 407 vessel identities have no verified length and five have conflicting recorded dimensions. The interface surfaces those unknowns instead of inventing measurements.
