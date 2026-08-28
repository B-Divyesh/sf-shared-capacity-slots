# Visual thesis — contour capacity

## Direction and rationale

Shared Capacity Slots uses **topographic cartography** as an operating metaphor. A tiny service business does not have one flat “available/busy” calendar; it has layers—people, rooms, equipment, and service requirements—that overlap like terrain. Contour lines reveal usable valleys without pretending the map is the territory. The interface therefore feels like a working field chart: warm paper, precise coordinate labels, strong ink, and vermilion survey marks.

This is intentionally a single-mode, daylight chart. The parchment ground is part of the information model, not a theme preference, and retains excellent contrast in bright rooms where front-desk planning happens. Browser/OS controls still receive `color-scheme: light`.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#F4F0E4` | page background |
| Paper high | `#FFFCF3` | editable surfaces |
| Ink | `#172D2B` | primary text and linework |
| Slate | `#52635F` | secondary text (≥ 4.5:1 on paper) |
| Moss | `#315F4D` | positive capacity and active controls |
| Vermilion | `#A33E27` | primary action and survey markers |
| Vermilion deep | `#7A2D1B` | hover / strong emphasis |
| Ochre | `#956719` | cautions |
| Fault | `#9A2E31` | errors |
| Contour | `#C9BE9E` | non-text map lines and dividers |
| Night ink | `#0D201E` | high-contrast footer |

State never relies on color alone: statuses pair color with labels, symbols, or patterns.

## Type and numeric language

- Display: Georgia, Cambria, Times New Roman, serif. Its engraved shapes read like a field atlas and make the product unmistakably editorial without a font download.
- Working text: Inter-compatible system sans (`ui-sans-serif`, `system-ui`, sans-serif). It stays compact and familiar in forms.
- The scale is 14 / 16 / 20 / 25 / 40 / 56px. Body copy never drops below 16px; only supplemental coordinate labels use 14px.
- Tables, dates, and capacity figures use tabular numerals and slightly increased tracking.

No runtime or self-hosted font files are needed, keeping the first load resilient and private.

## Spacing, shape, and depth

- Base rhythm: 4px, with primary steps of 8, 12, 16, 24, 32, 48, and 72px.
- Content max: 1240px. Reading measure: 68 characters.
- Corners are clipped or subtly rounded (2–10px), like mounted map sheets—not pill-heavy SaaS chrome.
- Borders are 1px ink/contour rules. Shadows are sparse, offset, and pigment-like; grouping relies on proximity first.
- Touch targets are at least 44×44px and adjacent controls keep 8px clearance.

## Interaction grammar

- Setup follows a visible survey sequence: **Resources → Services → Busy time → Results**. The next required step is always explicit.
- Selected navigation gets a filled coordinate marker, not just a color change.
- Forms use persistent labels and inline, announced errors. Every save confirms locally.
- Results are a weekly map: rows are dates, “contour bands” are offerable times, and a text/table alternative gives the exact same data.
- Destructive actions name their target and require confirmation; imports report skipped malformed events rather than failing silently.

## Motion policy

- New result bands reveal once with 180–240ms opacity and vertical transform, physically emerging from their source row.
- Step changes use a 180ms opacity crossfade. Buttons use 120ms press translation.
- Nothing loops. With `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed and state changes are instant.

## Asset plan and provenance

### Hero relief map

One original raster illustration explains the model: an oblique paper topographic chart where separate green capacity bands flow around vermilion busy-time obstacles and converge into clear slot markers. It contains no interface screenshot and no text, so it cannot imply unsupported capabilities. It will be shown alongside a plain-language caption and treated as meaningful imagery.

Prompt sheet:

> Use case: stylized-concept. Asset type: responsive landing-page hero illustration. Primary request: an editorial topographic capacity map for a tiny service studio, showing several independent scheduling layers flowing around obstacles and resolving into a few clear openings. Scene/backdrop: warm off-white surveyor paper, cropped landscape chart. Subject: elegant contour lines, three moss-green terrain ribbons, small vermilion survey pins and blocked zones, subtle grid coordinates. Style/medium: hand-inked cartographic print with screen-printed pigment, precise but tactile, no photorealism. Composition: wide 3:2, densest terrain on the right with calmer negative space at upper left, no frame. Lighting/mood: flat archival daylight, quietly confident. Palette: parchment, dark teal ink, moss, muted ochre, vermilion. Materials/textures: fine recycled paper grain, crisp engraved linework. Constraints: abstract resources only, no people, no UI, no readable words, no calendar icons, no logos, no watermark. Avoid: gradients, glossy 3D, neon, generic corporate illustration, illegible pseudo-text, brands, real locations.

- Generation tool: Factory Azure image deployment via `/opt/fleet/lib/gen-image.sh`.
- Model/deployment: `factory-image` (Azure AI Foundry).
- Generation date: 2026-08-28.
- License/provenance: original AI-generated artwork created for this product; no third-party source image.
- Source candidates and prompt sidecar live in `assets/src/`; shipped WebP lives in `public/assets/` and is kept below 300KB.

All UI icons are original inline SVG strokes based on survey marks; no icon library or external assets are used.
