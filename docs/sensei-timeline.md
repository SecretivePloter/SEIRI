# Daily sensei timeline

The daily timeline follows the supplied Excel workbook and screenshot: numbered
teacher rows, alternating gray/white backgrounds, 28 half-hour columns from
07:30 to 21:30, room colors, outlined class labels, Plan/Actual columns, interval
totals, and a room legend. A red outline highlights the current half-hour in WIB
only when the selected date is today. Overlapping schedules use separate lanes.
The board fills available height; smaller screens can scroll without shrinking
the labels indefinitely. Weekly/monthly views and the room timeline keep their
existing components.

## Data and calculations

- The workbook is a visual reference, not a database import. Names, schedules,
  rooms and session rules continue to come from SEIRI.
- Color mappings are transcribed from the workbook legend. Unknown rooms have
  a neutral color rather than receiving a misleading existing room color.
- Plan uses the same proportional `kategori_sesi` rule as the database reports.
  Only active, counted occurrences contribute. Cancelled/original replacement
  markers and planning/nonactive schedules contribute zero.
- Each interval receives its exact overlap fraction. Rounding occurs only at
  display time, so three displayed 0.33 cells can correctly total 1.0 session.
- The database fallback for an unconfigured category is one session per slot.
- Plan includes the full duration if a schedule extends beyond the visible axis;
  a note explains that interval totals then cover only the visible period.
- Actual is unavailable, shown as a dash, because SEIRI does not store attendance
  or actual teaching durations. Shift, travel and management activities are not
  inferred from teacher names or inserted as fabricated schedules.
- Public signage uses the same board. Its current RPC omits room details and
  session rules, so it shows neutral blocks and unavailable session figures.
  This change does not broaden public database access.

## Validation

Run `node --test tests/scheduleBoard.test.mjs`, `npm run typecheck`, and
`npm run build`. Calculation tests cover exact allocation, partial intervals,
exceptions, planning, missing rules, adjacent/overlapping schedules and colors.

Browser visual verification and testing against the live database are separate
from these checks; a successful production build does not establish either.
