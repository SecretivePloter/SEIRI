---
name: Sensei Scheduler
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#454652'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#757683'
  outline-variant: '#c5c5d4'
  surface-tint: '#4157b6'
  primary: '#102b8c'
  on-primary: '#ffffff'
  primary-container: '#2e44a3'
  on-primary-container: '#adbaff'
  inverse-primary: '#b9c3ff'
  secondary: '#5a5f68'
  on-secondary: '#ffffff'
  secondary-container: '#dee2ed'
  on-secondary-container: '#60656e'
  tertiary: '#5d2600'
  on-tertiary: '#ffffff'
  tertiary-container: '#813700'
  on-tertiary-container: '#ffaa7b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b9c3ff'
  on-primary-fixed: '#001257'
  on-primary-fixed-variant: '#273d9d'
  secondary-fixed: '#dee2ed'
  secondary-fixed-dim: '#c2c6d1'
  on-secondary-fixed: '#171c23'
  on-secondary-fixed-variant: '#424750'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#ffb68f'
  on-tertiary-fixed: '#331200'
  on-tertiary-fixed-variant: '#773200'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  headline-md-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  container-padding: 24px
  gutter: 16px
  sidebar-width: 260px
  timeline-row-height: 64px
---

## Brand & Style

The design system is built on a foundation of **Modern Professionalism** with a focus on administrative clarity and educational warmth. It draws inspiration from high-utility productivity tools like Notion and Calendly, prioritizing functional whitespace and a "content-first" interface.

The brand personality is authoritative yet approachable—mimicking the organized, calm nature of a well-run Japanese language institution. The visual style utilizes a **Modern Corporate** approach: a rigorous grid system, refined typography, and a "light-touch" aesthetic where borders and subtle tonal shifts define structure rather than heavy shadows or decorative elements.

The target audience includes school administrators, language instructors (Sensei), and students who require immediate, low-cognitive-load access to scheduling data. The emotional response should be one of "organized serenity."

## Colors

The palette is anchored by a deep **Professional Indigo** (#2E44A3) used for primary actions, navigation states, and brand reinforcement. This is supported by a sophisticated neutral scale that favors cool grays to maintain a clean, clinical feel.

For scheduling clarity, a categorical pastel system is employed:
- **CLT (Conversational Language Training):** Soft Sky Blue.
- **Bimbel (Academic Tutoring):** Pale Mint Green.
- **SSW (Specified Skilled Worker):** Muted Apricot Orange.

Backgrounds should remain primarily white (#FFFFFF) or very light gray (#F8FAFC) to ensure the pastel category markers remain highly legible and distinct within the timeline views.

## Typography

This design system utilizes **Inter** across all levels to ensure maximum legibility and a systematic, utilitarian appearance. 

- **Hierarchy:** Use `display-lg` sparingly for dashboard overviews. 
- **Weights:** Medium (500) and Semi-bold (600) are used for navigation and buttons to provide contrast without the visual "noise" of heavy bolds.
- **Micro-copy:** Labels for class times and category tags use `label-md` or `label-sm` to maintain a compact UI in dense scheduling grids.
- **Letter Spacing:** Headlines utilize slight negative tracking (-1% to -2%) to feel tighter and more "designed," while labels use positive tracking to ensure readability at small scales.

## Layout & Spacing

The layout follows a **Fixed-Fluid hybrid model**. 
- **Sidebar:** A fixed 260px left-hand navigation allows for quick switching between "Calendar," "Students," "Sensei," and "Reports."
- **Main Content:** A fluid area that maximizes the horizontal space for the timeline grid.
- **Grid System:** An 8px base unit (2x 4px) governs all spacing. 
- **Breakpoints:** 
  - *Desktop (1280px+):* Full sidebar and multi-column timeline.
  - *Tablet (768px - 1279px):* Collapsed icon-only sidebar, 16px margins.
  - *Mobile (<767px):* Stacked cards for schedule items, bottom navigation bar, 12px margins.

The "Timeline Grid" should use a rigid vertical rhythm where each hour is represented by a 64px block, allowing for precise 15-minute subdivisions.

## Elevation & Depth

This design system avoids heavy shadows, opting instead for **Tonal Layering** and **Subtle Outlines**.

1.  **Level 0 (Surface):** The main canvas background (#F8FAFC).
2.  **Level 1 (Card/Container):** White surfaces (#FFFFFF) with a 1px border (#E2E8F0). This is used for the main calendar grid and sidebar.
3.  **Level 2 (Floating/Active):** Used for event modals or dropdown menus. These utilize a very soft, diffused shadow: `0px 4px 12px rgba(0, 0, 0, 0.05)`.

Interactive elements like schedule blocks do not use shadows unless dragged. Depth is primarily communicated through color-fill contrast against the white background.

## Shapes

The shape language is "Soft Professional." 
- **Standard Radius:** 0.25rem (4px) for input fields, checkboxes, and small buttons.
- **Large Radius:** 0.5rem (8px) for cards, timeline events, and modal containers.
- **Pill:** Reserved exclusively for status indicators (e.g., "Active," "Completed") and category chips.

This restrained approach to rounding keeps the UI looking sharp and efficient, avoiding the overly "bubbly" look of consumer social apps while remaining friendlier than a strict 0px-radius enterprise tool.

## Components

### Buttons
- **Primary:** Solid Professional Indigo with white text.
- **Secondary:** Transparent with Indigo border and text.
- **Ghost:** No border, Indigo text; for low-priority actions in tables.

### Schedule Cards (Timeline Events)
- Must include a vertical "accent bar" on the left edge using the category color.
- Background should be the soft pastel version of the category color.
- Text should use the high-contrast "text" version of the category color for accessibility.

### Data Tables
- Header: `label-sm` with a light gray background (#F1F5F9).
- Rows: 52px height, subtle 1px bottom border.
- Hover state: Slight background tint (#F8FAFC).

### Input Fields
- Understated 1px borders (#CBD5E1).
- Focus state: Border changes to Professional Indigo with a 2px outer "glow" in the same color at 10% opacity.

### Navigation Sidebar
- High-contrast text on a light background.
- Active state indicated by a vertical bar on the left and a subtle Indigo background tint.