# Design QA — 雷达式行动推进台重构

## Source truth and evidence

- Selected design source: `docs/refactor/concepts/radar-workbench-dark.png` (1487 × 1058).
- Final implementation capture: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\implementation-radar-desktop.png`.
- Full-view combined comparison: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\comparison-radar-desktop.png`.
- Focused command-workspace comparison: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\comparison-radar-focus.png`.
- Responsive evidence: `implementation-radar-tablet.png` at 768 × 1024 and `implementation-radar-mobile.png` at 390 × 844 in the same visualization directory.
- Desktop browser viewport: 1440 × 1024. Chrome captured the 1425 × 1013 page area after native scrollbars; the source was proportionally normalized to that exact capture size for the combined comparison.
- Tested state: authenticated root route, inventory date 2026-07-17, LG2 selected, realistic five-account data.

## Mandatory comparison

- Layout and spacing: the source's left account rail, central decision workspace, right P1–P3 action dock, and lower five-account timeline are all present in the same hierarchy. Existing page orientation and snapshot status remain above the workspace so product context and test contracts are preserved. Panels use square, thin-bordered operational surfaces rather than generic rounded cards.
- Typography: compact Chinese UI text, monospaced dates and quantities, strong account codes, and restrained 9–14px operational labels match the source density. The faint metadata token was raised to `#71877f` for readable small text.
- Colors and tokens: near-black/green surfaces, cyan navigation and live state, amber selection and primary action, account-specific rail colors, and red shortages match the reference direction. Thin luminous dividers replace the previous light dashboard chrome.
- Image and asset fidelity: the design reference is used only as QA source truth and is not shipped as fake product imagery. Visible controls use the existing `AppIcon` component; menu, close, search, chevron, and refresh glyphs stay in one stroke family. No emoji, placeholder art, CSS illustration, or fabricated avatar was introduced.
- Copy and content: concept placeholders were replaced with the application's real five-account projections, inventory, shortage hints, dates, task names, and routes. Primary and secondary actions are coherent with the standalone product.
- States and interactions: selecting FC/LG1/LG2/PT/MYT updates the central decision, action dock, and active timeline row. The inventory CTA opens the 20-field `录入库存快照` dialog and closes cleanly. Mobile navigation opens as the `主导航` dialog and restores the menu state when closed. Search semantics remain intact.
- Accessibility: semantic headings, complementary regions, tables, row/cell roles, pressed account state, named close controls, focus-managed mobile navigation, visible focus styles, reduced-motion handling, and practical mobile targets are retained.
- Responsiveness: desktop root width is 1425/1425 with no horizontal overflow; the desktop timeline viewport and table are both 1133px and the last cell aligns with the table edge. At 768px, the root remains 753/753 and only the 828px internal timeline scrolls inside its 699px viewport. At 390px, the root remains within the 375px client width; accounts and status metadata use intentional thin internal scrollers, while the timeline becomes stacked cards.
- Browser health: final console warning/error query returned an empty list.

## Findings and iteration history

### Pass 1

- P1 color/surface: legacy `.mainline-table-scroll` white background leaked through transparent dark rows; sticky first headers/cells also retained light backgrounds.
- P1 responsiveness: the 721–980px layout kept an 828px timeline behind `overflow:hidden`, silently clipping right-side content.
- P2 accessibility: several 9–10px metadata labels used a low-contrast faint token.
- P2 mobile density: the snapshot strip inherited a column direction and consumed unnecessary height; native account scrollbars were visually heavy.
- P2 state styling: the legacy `ready-now-task` white fill could reappear when a task became immediately completable.

### Pass 2 fixes

- Added an explicit dark timeline base, dark first-header and first-cell states, a consistent active account inset, and dark ready-now treatment.
- Added internal tablet horizontal scrolling only for 721–980px while retaining zero root overflow and the desktop no-scroll contract.
- Increased faint-text contrast, reused the improved token for track completion labels, and kept muted/semantic colors distinct.
- Forced the snapshot strip back to a compact horizontal status line and added thin themed scrollbars for status/account rails.
- Simplified the mobile timeline account cell by removing duplicate date text where it could crowd the track.
- Re-captured desktop, tablet, and mobile states and re-ran the combined full-view and focused comparisons. No P0, P1, or P2 issue remains in the rebuilt core flow.

## Verification

- `npm test`: 59 passed.
- `npm run build`: passed (Vue type check, Vite build, 298-asset integrity check).
- `npm run test:e2e:core`: 21 passed, 47 skipped, 0 failed.

## Typography refinement — 2026-07-17

### Source truth and browser evidence

- Source visual truth: `C:\Users\T\AppData\Local\Temp\codex-clipboard-c9ba2bf4-01c6-476c-a1eb-3dd61dc8ea3a.png` (3828 × 1920 user screenshot).
- DPI-normalized source: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\typography-before-normalized.png`.
- Browser-rendered desktop implementation: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\typography-after-desktop.png`.
- Full-view combined comparison: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\typography-comparison-full.png`.
- Focused title/decision comparison: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\typography-comparison-focus.png`.
- Responsive implementation: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\typography-after-mobile.png`.
- Viewports: desktop 2048 × 1024 (2033 × 1017 captured content after native scrollbars); mobile 390 × 844 (375px content width after native scrollbar).
- State: authenticated root route, FC selected, dark theme, inventory date 2026-07-13.

### Findings and comparison history

#### Pass 1 — source screenshot

- P2 typography hierarchy: dashboard-specific CSS bypassed the 16px global body scale and reduced most operational text to 8–11px. At the supplied wide viewport, labels, dates, status hints, and table metadata did not remain comfortably scannable.
- P2 font consistency: UI text and numeric text repeated ad-hoc family declarations, without one explicit local Chinese UI stack and one shared monospaced numeric stack.
- P2 rhythm: several headings and small labels inherited generic line heights, which weakened title/body separation and made dense table copy feel compressed.

#### Pass 2 — implemented fixes and post-fix evidence

- Added local-only `--font-ui` and `--font-mono` stacks; no CDN font or external request was introduced.
- Raised the dashboard baseline from 14px to 15px and rebuilt the visual scale: 30px page title, 28px decision title, 16px section headings, 14–15px body/actions, and 10–13px dense operational metadata.
- Added explicit heading, label, numeric, and helper line heights, plus tabular numeric alignment for dates, quantities, and account codes.
- Preserved the existing palette, component geometry, copy, and interaction model; the combined comparison shows the intended improvement is typographic rather than a second layout redesign.
- Post-fix desktop computed values: navigation 15px, page title 30px/36px, body 15px/24px, decision title 28px/33.6px, primary action 15px. Mobile computed values: page title 25px and workbench body 15px.
- No P0, P1, or P2 finding remains. The remaining 10px timeline helper text is intentional dense-data treatment, now paired with 1.35–1.5 line height and stronger hierarchy.

### Required fidelity surfaces

- Fonts and typography: local Chinese/Latin fallback order, weights, sizes, line heights, letter spacing, truncation, and tabular numerals were checked in the full and focused comparisons. Title, decision, body, helper, and button levels are visibly distinct without awkward wrapping.
- Spacing and layout rhythm: no spacing token or grid track was changed. The enlarged type remains inside the existing account rail, decision panel, action cards, and timeline cells.
- Colors and tokens: color values were intentionally left unchanged for this pass; semantic cyan, amber, success, and danger roles remain intact.
- Image quality and assets: the page contains no product imagery requiring replacement. Existing icon components remain sharp and unchanged; no placeholder, emoji, CSS illustration, or custom image substitute was introduced.
- Copy and content: all application copy, account names, shortages, dates, and actions remain unchanged.
- Responsiveness: desktop root width is 2033/2033 and timeline width is 1625/1625, so neither has horizontal overflow. Mobile root width is 375/375; the 840px account rail scrolls intentionally inside its 353px local viewport.
- Accessibility and interactions: navigation/title/body/button computed sizes remain above the existing E2E minimums. FC account selection updated the central decision successfully. Browser console warnings/errors: none.

### Verification

- `npm test`: 59 passed.
- `npm run build`: passed (Vue type check, Vite build, 298-asset integrity check).
- `npm run test:e2e:core`: 21 passed, 47 skipped, 0 failed, including desktop/tablet/mobile overflow and navigation coverage.

## Account visibility and timeline scale — 2026-07-17

### Source truth and browser evidence

- Source visual truth 1: `C:\Users\T\AppData\Local\Temp\codex-clipboard-907d66de-79b7-4282-9249-dbcbe8f308b3.png` — account rail with truncated task names.
- Source visual truth 2: `C:\Users\T\AppData\Local\Temp\codex-clipboard-bcba05d0-82a7-4b1d-ab80-380bf86bf0b0.png` — timeline table with undersized text.
- Browser-rendered desktop implementation: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\visibility-size-fix-desktop.png`.
- Browser-rendered timeline implementation: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\visibility-size-fix-timeline.png`.
- Browser-rendered mobile implementation: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\visibility-size-fix-mobile.png`.
- Complete account-region comparison: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\visibility-size-account-comparison.png`.
- Complete timeline-region comparison: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\visibility-size-timeline-comparison.png`.
- Viewports: desktop 1440 × 900; mobile 390 × 844. State: authenticated root route, dark theme, FC selected. The supplied sources are focused component crops rather than full browser frames, so each complete crop was normalized by width and compared to the same route/state without claiming pixel-level outer-page alignment.
- Full-view evidence: `visibility-size-fix-desktop.png` verifies the account rail, command workspace, action rail, and timeline still form one coherent page after the width change.
- Focused evidence: the two combined comparison images above show the complete supplied account and timeline targets at readable scale; no smaller detail crop was needed.

### Findings and comparison history

#### Pass 1 — supplied screenshots

- P2 account visibility: `.radar-account-copy b` used single-line ellipsis inside a 216px/190px rail, leaving only enough width for labels such as `隐攻蛇 · …` and `剑气蛇 · …`.
- P2 table readability: timeline column headers were 11px, task metadata 10px, resource hints 10px, and rows 88px high. The information was technically present but required unnecessary visual effort.

#### Pass 2 — fixes and post-fix evidence

- Increased the desktop account rail to 270px and the mid-width rail to 250px; horizontal account cards are now 220px and 210px at smaller breakpoints.
- Removed name ellipsis and allowed full labels to render. Desktop `隐攻蛇 · 皮肤` now measures 114px client/scroll width; mobile measures 83px client/scroll width, confirming no clipping.
- Raised timeline column headers to 13px, task titles to 15px, account dates to 13px, resource titles to 14px, metadata to 11–12px, and row height to 108px.
- Increased the account/date column to 132px and kept the date on one line, preventing the enlarged date from collapsing into one character per row.
- Post-fix desktop root width is 1425/1425 and table width is 1080/1080. Mobile root width is 375/375; the 1050px account strip scrolls intentionally inside its 353px local viewport.
- No actionable P0, P1, or P2 finding remains.

### Required fidelity surfaces

- Fonts and typography: full account names, 13–15px table hierarchy, 11–12px support text, line heights, wrapping, and truncation were checked in the combined comparisons. Names, dates, task titles, and resource hints remain legible without collision.
- Spacing and layout rhythm: rail and first table column widths were increased only as needed. The central workspace, action rail, table dividers, row rhythm, and responsive stacking remain intact.
- Colors and tokens: no palette, semantic color, border, radius, or elevation token changed in this pass.
- Image quality and assets: no image asset or icon was added, removed, or approximated. Existing icon components remain unchanged.
- Copy and content: all account names, task labels, dates, resource values, statuses, and action copy remain application data; no content was shortened to make the layout fit.
- Responsiveness and accessibility: desktop, tablet, and mobile root overflow checks pass. The mobile account rail retains intentional local scrolling and full accessible button names. LG1 → FC account switching was tested successfully, and browser console warnings/errors are empty.

### Verification

- `npm test`: 59 passed.
- `npm run build`: passed (Vue type check, Vite build, 298-asset integrity check).
- `npm run test:e2e:core`: 21 passed, 47 skipped, 0 failed, including tablet/mobile overflow and navigation coverage.

## Full-site dark-theme consistency — 2026-07-17

### Source truth and browser evidence

- User source truth: `C:\Users\T\AppData\Local\Temp\codex-clipboard-3a654182-289f-4b2c-aa71-c6d4077cc5b1.png`, `codex-clipboard-e4096784-4b8a-4fee-8368-963454e3a5b8.png`, `codex-clipboard-ed580b52-546d-4408-bc70-04641f2111a8.png`, `codex-clipboard-6c396d61-7fc2-49c7-b497-76f704002586.png`, and `codex-clipboard-1f8274cd-fdbf-4ddd-a22b-c934955b4a83.png`.
- Final browser captures: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\theme-final-account-desktop.png`, `theme-final-pets-desktop.png`, `theme-final-plans-desktop.png`, `theme-final-matrix-desktop.png`, and `theme-final-data-desktop.png`.
- Responsive evidence: `theme-mobile-evidence-after.png` in the same visualization directory.
- Viewports: desktop 1440 × 900; mobile 390 × 844. State: authenticated local preview, representative account, asset, plan, analysis, publish, data, and settings routes.
- Full-view comparison evidence: the supplied account, plan, and data screenshots were opened in the same comparison inputs as their matching final captures. The old hybrid theme showed black page canvas, navy/low-contrast text, and white table blocks; the revised views use one continuous near-black/green surface system with readable light text and cyan/amber accents.
- Focused comparison evidence: matrix filters, stat cells, skill chips, task status segments, publish presets, asset filters, selected pet rows, and mobile evidence rows were inspected separately because their inherited legacy selectors were too small to judge reliably in full-page views.

### Findings and comparison history

#### Pass 1 — supplied screenshots

- P1 color consistency: legacy routes retained light-theme variables and explicit white surfaces after the shell moved to the radar dark canvas, producing large white tables and nearly invisible navy text.
- P1 accessibility: headings, table values, status copy, and helper text used foreground colors designed for white backgrounds and lost practical contrast on the new canvas.
- P2 state consistency: inputs, selects, active rows, tabs, chips, and matrix cells mixed light and dark interaction states.
- P2 responsive issue: the screenshot-evidence route allowed long filenames to create 73px page-level horizontal overflow at 390px.

#### Pass 2 — shared theme correction

- Remapped the legacy `--ink`, `--muted`, `--paper`, `--line`, semantic, and `--workbench-*` tokens inside the application shell to the radar palette.
- Added shared dark surfaces for page sections, tables, lists, cards, forms, sub-navigation, buttons, selected states, dialogs, task controls, data maintenance, and matrix content.
- Preserved small semantic skill badges and real in-product screenshots while removing unintended large light surfaces.

#### Pass 3 — specificity and responsive corrections

- Overrode legacy high-specificity selectors for asset filters, selected pet rows, task status buttons, publish presets, matrix group tabs, matrix stat cells, matrix skills, and option controls.
- Raised low-contrast explicit legacy copy to the shared muted token on plan resource tables, history rows, task summaries, and inventory values.
- Reflowed evidence rows on mobile into three columns, allowed filenames to wrap, and moved metadata below the filename. Root and main overflow now both measure 0px.
- Re-scanned all 18 implemented routes at desktop and mobile widths. Every route reports zero unintended light surfaces; desktop routes report zero page-level overflow, and all mobile routes report zero page-level overflow after the evidence-row fix.
- No actionable P0, P1, or P2 finding remains.

### Required fidelity surfaces

- Fonts and typography: the existing local UI/mono stacks, hierarchy, weights, wrapping, and numeric alignment were preserved. Dark-theme foregrounds now support the established type scale on every route.
- Spacing and layout rhythm: existing route grids and density were retained. Only the mobile evidence row was reflowed to prevent filename overflow.
- Colors and tokens: one shared near-black/green canvas, layered dark surfaces, cyan navigation/focus, amber primary actions, green success, and red danger roles now cover all routes and interaction states.
- Image quality and assets: pet/evidence screenshots remain unchanged, sharp, and correctly cropped. No placeholder imagery, custom SVG art, emoji, or CSS illustration was added.
- Copy and content: application data, route copy, dates, task labels, and asset names remain unchanged; no content was shortened to hide layout problems.
- Accessibility and interactions: form controls use dark color-scheme styling, visible focus/selection states, and readable foregrounds. Task status switching, matrix group switching, and publish presets were exercised successfully. Browser warnings/errors: none.

### Verification

- `npm run build`: passed (Vue type check, Vite build, 298-asset integrity check).
- `npm test`: 59 passed.
- `npm run test:e2e:core`: 21 passed, 47 skipped, 0 failed.

## Palette role normalization — 2026-07-17

### Source truth and browser evidence

- Source visual truth: the browser-rendered dashboard before normalization, `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\palette-before-dashboard.png`.
- Final dashboard: `C:\Users\T\.codex\visualizations\2026\07\17\019f6f85-7b2c-7080-b79c-020127b6020f\palette-unified-dashboard.png`.
- Focused final views: `palette-unified-assets.png` and `palette-unified-matrix.png` in the same directory.
- Responsive evidence: `palette-unified-assets-mobile.png` at 390 × 844.
- Full-view comparison evidence: the before and after dashboard captures were opened together at the same route and state. The original selected account used a muddy amber block while account hues, shortage red, live green, CTA amber, and interaction cyan all competed in the same region. The final selected state is cyan; account hues are reduced to compact identity marks.
- Focused comparison evidence: asset role chips and matrix cells were inspected at readable scale because they contain the densest mix of identity, semantic, and category colors.

### Findings and comparison history

#### Pass 1 — palette audit

- P2 semantic collision: amber represented selection, primary action, priority, and category identity simultaneously.
- P2 visual noise: five account colors appeared on text, dots, large badges, and timeline states, competing with risk and completion semantics.
- P2 component drift: pet role chips and matrix role badges retained light-theme fills and several unrelated hues.

#### Pass 2 — normalization and specificity correction

- Established five roles: cyan interaction/selection, amber primary/attention, red risk/blocker, green success/live, and desaturated account hues for identity only.
- Replaced the dashboard's amber selected-account surface with cyan and kept account hues on code outlines, thin row markers, and compact matrix headers.
- Normalized task progress, pending/done/edited dots, status labels, segmented controls, account switches, and role chips.
- Corrected legacy selector specificity so pet tags and matrix pet names no longer fall back to light fills or dark-on-dark text.
- No actionable P0, P1, or P2 finding remains.

### Required fidelity surfaces

- Fonts and typography: the established UI/mono stacks, type scale, wrapping, and numeric alignment are unchanged and remain readable.
- Spacing and layout rhythm: no layout tracks, padding, radii, or density changed; only visual roles were normalized.
- Colors and tokens: shared neutral chip, pending, semantic, and desaturated account identity tokens now provide one consistent mapping across dashboard, assets, plans, and analysis.
- Image quality and assets: screenshots and icon assets remain unchanged; no substitute imagery or CSS illustration was introduced.
- Copy and content: all application copy and live data remain unchanged.
- Responsiveness and accessibility: the 390 × 844 asset view has no visible page-level overflow, controls remain usable, and semantic colors retain text/shape cues instead of relying on hue alone.

### Verification

- `npm run build`: passed (Vue type check, Vite build, 298-asset integrity check).
- `npm test`: 59 passed.
- `npm run test:e2e:core`: 21 passed, 47 skipped, 0 failed.

final result: passed

## Inventory weekly-change alignment — 2026-07-19

### Source truth and browser evidence

- User-reported desktop source: `C:\Users\T\AppData\Local\Temp\codex-clipboard-ddb47475-e6b4-4856-981a-1b1d60dcfeec.png`.
- User-reported mobile source: `C:\Users\T\AppData\Local\Temp\codex-clipboard-1639ebe5-da33-41c6-b67f-3dd9ae894d60.png`.
- Revised desktop capture: `C:\Users\T\AppData\Local\Temp\inventory-weekly-alignment-desktop-after.png` at 1980 × 900.
- Revised mobile capture: `C:\Users\T\AppData\Local\Temp\inventory-weekly-alignment-mobile-after.png` at 390 × 844.
- State: current natural week with two actual inventory records so the weekly-change table is visible.
- Full-view and focused evidence: both supplied screenshots and both revised captures were opened in one comparison input; the table itself is the focused region, so no smaller crop was required.

### Findings and comparison history

1. P2 — Numeric headers were left-aligned while numeric values were right-aligned, and account badges were centered below a left-aligned account header. The separation increased on wide screens.
2. Fix — Aligned the account badge to the start of its grid track and applied the same right alignment to numeric headers and numeric row cells.
3. Post-fix — Desktop account left edges both measure 56.79px; numeric header/value right edges both measure 792.42px, 1164.24px, 1536.05px, and 1907.86px. Mobile account left edges both measure 23.67px; numeric right edges both measure 149px, 216.33px, 283.67px, and 351px. No P0/P1/P2 mismatch remains.

### Required fidelity surfaces

- Fonts and typography: unchanged; existing weights, sizes, line heights, and tabular numerals are preserved.
- Spacing and layout rhythm: the existing five-track grid and gaps are preserved; only the alignment inside those tracks changed.
- Colors and visual tokens: unchanged.
- Image quality and asset fidelity: no image assets are present in this table and none were introduced or replaced.
- Copy and content: unchanged.

### Browser verification

- Page identity: `http://127.0.0.1:4173/#/data/inventory`, title `项目台账`.
- Primary interaction: opened the missing 2026-07-14 day, saved a temporary snapshot, verified the weekly-change table rendered, then deleted the temporary record.
- Mobile document client and scroll widths are both 375px; there is no page-level horizontal overflow.
- Console warnings/errors: none. Framework overlay: absent.
- Temporary authentication and inventory test state were removed after verification.

final result: passed

## Inventory weekly-change total — 2026-07-19

### Source truth and browser evidence

- Source visual truth: `C:\Users\T\.codex\codex-remote-attachments\019f781d-a7ac-7471-ae59-a4bfd1b48214\DED73E1C-14BC-4F9E-94A8-9A220025B845\1-照片-1.jpg`.
- Desktop implementation screenshot: `C:\Users\T\AppData\Local\Temp\sw-weekly-total-split-desktop.png` at 1280 × 720.
- Mobile implementation screenshot: `C:\Users\T\AppData\Local\Temp\sw-weekly-total-split-mobile.png` at 390 × 844.
- State: authenticated localhost automation session with isolated snapshots for 2026-07-12 and 2026-07-18. The five account deltas exactly match the supplied source. The table total is `专 +1 / 普 +4 / 纯银 +198 / 碎 +10`; the separate valuation summary is `纯银 +198万 + 普通蛋 4 × 5.5万 = +220万`.
- Focused evidence: both captures show the complete five-column change table, its pure-silver total row, and the separate silver-plus-ordinary-egg valuation summary at readable scale.

### Findings and comparison history

#### Pass 1 — supplied screenshot

- P1 missing result: the table exposed five account rows but no cross-account total.
- P1 calculation gap: there was no visible total-silver figure that included ordinary eggs valued at 5.5万 each.

#### Pass 2 — implementation and post-fix evidence

- The first implementation incorrectly put the ordinary-egg equivalent into the table's `银` total, conflating pure silver with the combined valuation. This was rejected by the user and is not the final design.

#### Pass 3 — corrected dual totals

- The five-column table now remains semantically literal: `银 / 万` totals pure silver only (`+198` in the supplied example).
- A separate full-width summary below the table shows `银子 + 普通蛋折算总值`, with the visible breakdown `纯银子 +198万` and `普通蛋 +4 × 5.5万/个 = +22万`, yielding `+220万`.
- Desktop and 390px-mobile numeric header/row edge differences are 0px. Document, report, table, and summary horizontal overflow are all 0px.
- Weekly navigation was exercised from 2026-07-13—2026-07-19 to the previous week and back; the pure-silver row and separate `+220万` valuation returned correctly. No P0/P1/P2 issue remains.

### Required fidelity surfaces

- Fonts and typography: the pure-silver total inherits the table's existing tabular numerals, responsive numeric scale, sign formatting, and semantic weights. The separate valuation uses a larger final value and a compact readable breakdown.
- Spacing and layout rhythm: the original five-column tracks, padding, gaps, dividers, and left/right alignment are preserved. The separate valuation occupies its own full-width band and does not create a misleading sixth column.
- Colors and visual tokens: both totals reuse the existing dark surfaces and positive/negative/neutral tokens; the explanatory note uses the established cyan informational accent.
- Image quality and asset fidelity: this data table contains no product imagery or custom graphic assets. No placeholder, SVG, emoji, CSS illustration, or substitute asset was introduced.
- Copy and content: the formula names the exact fixed rate and visibly separates pure silver, ordinary-egg equivalent, and combined valuation. Dedicated eggs are not priced into silver.
- Accessibility and interaction: the total row has the accessible name `本周净变化合计`; its silver cell announces that it excludes ordinary-egg conversion. The separate summary is exposed as `银子加普通蛋折算总值`. Week switching remains operable.

### Verification

- `npm test`: 86 passed.
- `npm run build`: passed (data check, Vue/TypeScript check, Vite build, and 298-asset integrity check).
- Mobile Playwright release gate: 6 passed, including the weekly total values, all-row alignment, expanded daily report, and no horizontal overflow.
- Browser page identity: `http://127.0.0.1:4173/#/data/inventory`, title `项目台账`; framework overlay absent; console warnings/errors empty.

final result: passed
