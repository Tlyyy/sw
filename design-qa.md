# iOS 26 Mobile Refactor — Design QA

## Visual source of truth

- Selected direction: `artifacts/ios26-interaction-directions/01-today-workbench.png`
- Navigation correction annotation: `C:\Users\T\AppData\Local\Temp\codex-clipboard-431aa04a-9ffd-41e2-aa20-d81644b35e78.png`
- Source canvas: 1536 × 1024 px
- Compared phone crops:
  - Today: x 13, y 53, 363 × 922
  - Inventory sheet: x 395, y 53, 363 × 922
  - Task settlement: x 777, y 53, 363 × 922
  - Week report: x 1158, y 53, 363 × 922
- Browser CSS viewport: 375 × 928, device pixel ratio 1.5
- Browser screenshot transport raster: 360 × 890, normalized to 375 × 928 only for side-by-side comparison
- Navigation correction viewport: 430 × 932 CSS px at DPR 1.5; implementation capture 415 × 899 px

## Final implementation evidence

- Today: `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\final-home-375x928.png`
- Inventory sheet: `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\final-inventory-375x928.png`
- Task overview: `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\final-tasks-375x928.png`
- Swiped task row: `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\final-task-swipe-375x928.png`
- Settlement sheet: `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\final-settlement-375x928.png`
- Week report: `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\final-week-375x928.png`
- Desktop regression: `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\final-desktop-1440x900.png`
- Combined comparisons:
  - `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\comparison-final-home.png`
  - `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\comparison-final-inventory.png`
  - `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\comparison-final-settlement.png`
  - `C:\Users\T\AppData\Local\Temp\sw-ios26-design-qa\comparison-final-week.png`
- Navigation correction:
  - Before: `C:\Users\T\AppData\Local\Temp\sw-ios26-nav-qa\before-week-duplicate-nav.png`
  - After: `C:\Users\T\AppData\Local\Temp\sw-ios26-nav-qa\after-week-single-nav.png`
  - Full-view comparison: `C:\Users\T\AppData\Local\Temp\sw-ios26-nav-qa\comparison-nav-full.png`
  - Focused navigation comparison: `C:\Users\T\AppData\Local\Temp\sw-ios26-nav-qa\comparison-nav-focused.png`
- Liquid Glass Tab Bar correction:
  - User annotation: `C:\Users\T\AppData\Local\Temp\codex-clipboard-21528ab6-e18c-43ba-acd5-86636c344d75.png`
  - Before, 430 × 932: `C:\Users\T\AppData\Local\Temp\sw-ios26-tabbar-qa\before-flat-tabbar.png`
  - Expanded, 430 × 932: `C:\Users\T\AppData\Local\Temp\sw-ios26-tabbar-qa\after-floating-expanded.png`
  - Compact-on-scroll, 430 × 932: `C:\Users\T\AppData\Local\Temp\sw-ios26-tabbar-qa\after-floating-compact.png`
  - Full-view source/implementation comparison: `C:\Users\T\AppData\Local\Temp\sw-ios26-tabbar-qa\comparison-tabbar-full.png`
  - Focused source/implementation comparison: `C:\Users\T\AppData\Local\Temp\sw-ios26-tabbar-qa\comparison-tabbar-focused.png`
  - Transform-only motion states: `C:\Users\T\AppData\Local\Temp\sw-ios26-tabbar-qa\motion-after-expanded.png`, `motion-after-mid.png`, and `motion-after-compact.png`
  - Expanded/transition/compact sequence: `C:\Users\T\AppData\Local\Temp\sw-ios26-tabbar-qa\motion-sequence-transform-only.png`

## Pass history

### Pass 1 findings and fixes

- P1 — Mobile shell used a blue square mark, blue add action, and floating dock instead of the selected direction's text brand, orange circular action, and full-width tab bar. Rebuilt the mobile shell.
- P1 — The task page expanded all 58 tasks at once. Replaced it with one next task per account, account drill-down, and a horizontally revealed processing action.
- P1 — Quick record first opened a picker and then a second inventory dialog. Replaced it with one contextual segmented sheet for inventory, expense, and market entry.
- P2 — Settlement covered the whole viewport and hid the originating task. Changed it to a bottom detent that preserves task context.
- P2 — Today had an extra secondary heading not present in the selected direction. Reduced it to the single account-overview heading.
- P2 — Click focus boxes visually drifted from the mobile target. Removed the mobile-only browser focus artifact from these tab controls.

### Pass 2 navigation annotation and fix

- P1 — The same `今日 / 任务 / 周报` destinations appeared as both a sticky top tab row and a persistent bottom tab bar. The user annotation identified both duplicated regions.
- Fix — Removed the top navigation markup and its mobile CSS, retained the iPhone-style bottom Tab Bar as the single primary navigation, and reduced the main viewport height offset from 114 px to 64 px.
- Post-fix evidence — The full-view and focused comparisons show that weekly content now begins immediately below the app header, the bottom Tab Bar remains persistent, and an additional content card fits above the fold.

### Pass 3 Liquid Glass Tab Bar correction

- Official reference — Apple HIG `Tab bars` states that the iOS tab bar floats above content on Liquid Glass, allowing underlying content to remain visible. Apple HIG `Materials` treats Liquid Glass as a distinct functional layer above content. WWDC25 `Build a UIKit app with the new design` shows the iPhone tab bar minimizing while scrolling down and expanding while scrolling back up.
- P1 — The retained bar was still a traditional edge-attached, full-width, opaque-white web tab bar: 430 px wide, bottom 0, radius 0, and background `rgba(255,255,255,.94)`. This did not satisfy the official floating Liquid Glass hierarchy.
- Fix — Rebuilt the bar as one 406 × 64 px floating capsule with 12 px side insets, an 8 px bottom gap, 28 px radius, translucent material, 28 px backdrop blur, saturation, inset highlight, and layered elevation. Content remains visible around and underneath the floating navigation layer.
- Interaction fix — Added a scroll-direction state: scrolling down collapses the bar to a centered 50 px-high icon capsule with labels smoothly withdrawn; scrolling up or reaching the top restores the expanded icon-and-label layout. Pressing a tab adds the short scale response expected from an interactive glass control.
- Selection fix — Kept the familiar orange product tint while reducing the selected treatment to a light translucent icon well inside the shared glass material. There is no separate solid selected card competing with the tab bar.
- Post-fix measurements — Expanded state: left/right 12 px, bottom 8 px, height 64 px, radius 28 px. Compact state: left/right 58 px at 430 CSS px, height 50 px, radius 25 px. The `今日 / 任务 / 周报` destinations remain operational in both states.
- Comparison result — The full-view and focused combined images place the exact before and after renders together at the same 430 × 932 viewport. The revised bar is visibly detached from the screen edge, reveals the page behind it, preserves a single navigation layer, and leaves the page hierarchy unchanged.

### Pass 4 motion-system correction

- P1 — The first motion pass animated `left`, `right`, `height`, `min-height`, `grid-auto-rows`, icon dimensions, and label `max-height` together. Those layout-changing properties force repeated reflow while the same surface is also running a 28 px backdrop filter.
- P1 — The application's global `prefers-reduced-motion` rule uses `transition: none !important`; the verification browser reports reduced motion enabled, so the dock morph was being replaced by an immediate visual jump. Accessibility adaptation remains explicitly outside this refactor's requested scope.
- Fix — Kept one stable 391 × 64 px layout box and moved the entire glass morph to compositor-friendly `translate3d + scale3d`. Icons use a matching counter-scale so they remain optically stable, while labels use only opacity and transform. No width, height, inset, grid-track, or label-height property changes during the animation.
- Timing — Added a sampled 420 ms under-damped spring curve with approximately 1.1% overshoot and a restrained settle. The dock transitions remain explicitly enabled for this component, including in the current reduced-motion test environment.
- Scroll intent — Replaced the 8 px direction flip with hysteresis: 24 px of downward travel minimizes the dock, 14 px of upward travel restores it, and travel resets at the top or on a direction change. Small momentum reversals no longer make the bar chatter.
- Responsive correction — Declared `position: fixed` in the iOS 26 layer itself so the dock remains floating throughout its full ≤980 px breakpoint, including landscape-phone and tablet widths, instead of relying on a legacy ≤720 px rule.
- State correction — Dock scroll tracking now runs only while the ≤980 px media query matches and resets when crossing the breakpoint. Desktop scrolling can no longer leave a stale compact state when the viewport later becomes mobile.
- Bounce correction — Scroll input is clamped to the document's real 0…maximum range before direction travel is accumulated. Bottom rubber-band overscroll therefore cannot manufacture reverse travel and reopen the bar.
- Performance evidence — Across 34 sampled transition points, `offsetWidth` remained 391 px and `offsetHeight` remained 64 px with exactly one unique layout size; only the visual transform changed. Sampling averaged 17.06 ms with an 18 ms maximum interval. The inverse expansion also retained one stable layout size.
- Interaction evidence — Starting near the page top, 10/20/25 px positions remain expanded; after intentional travel to 40 px the dock is compact. Small upward steps remain compact until accumulated reverse travel reaches the 14 px threshold, then the bar expands. Tapping the current tab still restores the expanded state.
- Edge evidence — At the weekly report's 186 px maximum scroll, a request for 306 px remains clamped at 186 px and compact. Upward movement of 5 and 10 px leaves the bar compact; accumulated intentional reverse travel of 15 px expands it.
- Visual result — The three-state comparison shows continuous centered contraction with stable icon scale, no label collision, no clipping, and no glass-layer flash. Independent visual review found no remaining P1/P2 motion issue.

### Final comparison result

- Today matches the selected hierarchy: adaptive next step, five-account overview, pending summary, and one persistent bottom navigation.
- Inventory uses the same contextual sheet composition and segmented entry model. It intentionally retains four real inventory fields rather than the mock's two simplified fields.
- Tasks match the pending-first account overview. Horizontal reveal exposes the orange processing action and opens settlement without navigating away.
- Settlement matches the source's contextual bottom-sheet behavior. The real egg settlement contains additional required fields and calculations that cannot be removed without changing business rules.
- Week matches the selected week switcher, date strip, summary card, account results, and supplement call-to-action. Displayed values come from current real local data rather than the mock.
- The browser/PWA implementation now follows the iOS 26 Liquid Glass tab-bar hierarchy and scroll behavior; optical material is a CSS approximation and does not claim native UIKit system rendering.
- Desktop navigation and page composition remain unchanged at 1440 × 900.

## Functional QA

- Verified `今日 → 快速录入` opens the integrated sheet.
- Verified inventory, expense, and market segments render their real forms.
- Verified task status tabs, one-row-per-account overview, account drill-down, and settlement opening.
- Verified horizontal task-row reveal reaches `scrollLeft = 66` and exposes the 66 px processing action.
- Verified settlement cancel leaves task data unchanged.
- Verified week supplement keeps both route and scroll position (`#/week`, 240 px before/during/after).
- Verified the top mobile navigation no longer exists (`0` matching elements) and exactly one bottom dock remains.
- Verified the retained bottom dock switches `今日 → 任务 → 周报`, with the expected route and page content after every transition.
- Verified the bottom dock begins expanded, becomes compact after scrolling the weekly report from 0 to 160 px, and expands again after scrolling upward to 90 px.
- Verified compact-state navigation switches to `#/plans/tasks`, updates the selected destination, and resets the bar to expanded state on route change.
- Verified tapping the already-selected `周报` tab while compact immediately restores the expanded state.
- Verified the weekly report's final page container retains 26.3 px of visible clearance above the compact dock at maximum scroll; main bottom padding remains 82 px plus the device safe area.
- Verified computed Liquid Glass geometry/material: expanded 406 × 64 px at x 12/y 860, bottom 8 px, radius 28 px, `blur(28px) saturate(1.8)`, and translucent background.
- Verified the final motion uses only dock/icon/label transforms and opacity; the dock's layout width and height remain constant for every sampled animation point.
- Fresh mobile and desktop browser sessions produced no console warnings or errors; Vite connection debug logs only.
- TypeScript check, 149 unit tests, production build, and `git diff --check` passed.
- Accessibility-specific QA was intentionally excluded from scope.

## Homepage information architecture refactor — 2026-07-25

### Source and implementation evidence

- User source: `C:\Users\T\AppData\Local\Temp\codex-clipboard-461e3a0b-bb43-4eb8-a79e-8be4a17214d1.png`
- Before-state browser capture: `C:\Users\T\AppData\Local\Temp\sw-home-audit\01-home-current.png`
- Final implementation, 430 × 932 CSS px at DPR 1.5: `C:\Users\T\AppData\Local\Temp\sw-home-refactor-qa\02-home-refactored-full.jpg`
- Full source/implementation comparison: `C:\Users\T\AppData\Local\Temp\sw-home-refactor-qa\03-home-source-vs-implementation.png`
- Focused information-architecture comparison: `C:\Users\T\AppData\Local\Temp\sw-home-refactor-qa\04-home-focus-source-vs-implementation.png`

### Pass 5 findings and fixes

- P1 — The previous home screen repeated one global inventory state across five account rows, mixed today and week scopes in the same table, then repeated the same 58-task total in a second card. The five-row block consumed most of the first viewport without helping the user choose the next action.
- Fix — Replaced the table and duplicate backlog card with one three-metric `今日进度` summary: inventory is represented once, today's task/expense activity is grouped by its true time scope, and the pending total includes affected-account context.
- Fix — Added `优先处理账号`, limited to two accounts. Before today's inventory is recorded it ranks by pending-task volume; after inventory is recorded it ranks by current resource executability. Each row exposes the current mainline task, concise resource status, pending count, and direct account-filtered task navigation.
- Fix — Added the compact `本周脉搏` surface for income, expense, and balance, preserving a clear route to the full weekly report without mixing week values into every account row.
- Interaction — The adaptive hero remains the primary action. `记录今日库存` opens the existing integrated recording sheet, priority account rows now open the task workspace already focused on that account, and `本周脉搏` opens the weekly report.
- Typography and layout — Maintained the existing iOS 26 type scale, 17 px card radii, restrained separators, orange action tint, semantic green/red status colors, and the floating Liquid Glass tab bar. The refactored content fits comfortably above the dock at the verified mobile viewport.
- Copy — Removed `五个账号今日概览` and `今日待办速览`; replaced them with decision-oriented labels that distinguish `今日进度`, `优先处理账号`, and `本周脉搏`.
- Assets — No additional imagery was necessary; the page uses the established icon set and account identity colors.

### Pass 5 functional QA

- Verified the old five-row overview and duplicate backlog labels are absent.
- Verified the inventory state appears once in the progress summary, the pending total is 58 across five accounts, and exactly two priority accounts render.
- Verified `记录今日库存` opens `记录今日信息` with the inventory segment selected; cancel returns to the unchanged home state.
- Verified the MYT priority row navigates to `#/plans/tasks?account=MYT` and the mobile task workspace opens directly in the MYT 15-task detail.
- Verified `本周脉搏` navigates to `#/week`.
- Verified viewport geometry reports no horizontal overflow at 430 × 932 CSS px.
- Browser logs contain Vite debug entries only, with no warnings or errors.
- Vue/TypeScript check, all 149 unit tests, production build, and `git diff --check` passed after the refactor.
- Accessibility-specific QA remains intentionally excluded from scope.

final result: passed

## Desktop five-account combined inventory entry — 2026-07-25

### Source and implementation evidence

- Source visual truth: `C:\Users\T\AppData\Local\Temp\codex-clipboard-f5f8445d-9f9f-468d-83a7-2d7fc4f406aa.png`
- Source pixels: 1653 × 1376.
- Browser-rendered implementation: `C:\Users\T\AppData\Local\Temp\sw-desktop-combined-entry-qa\implementation-desktop-1653x1376.png`
- Implementation pixels and CSS viewport: 1653 × 1376 at the Browser capture density.
- State: desktop `/#/record`, existing 2026-07-25 snapshot loaded, inventory dialog open.
- Full-view comparison: `C:\Users\T\AppData\Local\Temp\sw-desktop-combined-entry-qa\comparison-full-1653x1376.png`
- Focused component comparison: `C:\Users\T\AppData\Local\Temp\sw-desktop-combined-entry-qa\comparison-modal-focused-final.png`
- Density normalization: full views use equal pixel dimensions; the focused comparison scales both modal crops to 900 px width so typography, controls, row rhythm, tokens, and copy remain directly readable.

### Findings and iteration history

- P1 — The first responsive implementation kept both desktop and mobile input branches in the DOM and hid one with CSS. Although only one branch was visible, repeated labels made strict interaction targeting ambiguous.
- Fix — The component now renders exactly one branch with a reactive 721 px media query. Desktop receives the combined table; mobile receives the existing sequential stepper.
- Post-fix evidence — Desktop exposes exactly five account rows and 20 inputs with no “下一账号” action. Mobile at 393 × 852 exposes exactly five account tabs, four inputs for the current account, and “下一账号 · LG1”. Both targeted interaction regressions pass.
- P3 — The first combined table repeated a tiny “账号” caption below every colored account pill.
- Fix — Removed the repeated caption because the column header already establishes the account dimension.
- Final comparison — No actionable P0/P1/P2 mismatch remains. Replacing the five-step navigator with a five-row matrix is the requested intentional product change; the title, date control, loaded-snapshot warning, account colors, field order, footer treatment, and amber primary action remain grounded in the source.

### Required fidelity surfaces

- Fonts and typography — Existing application font family, weights, numeric tabular styling, hierarchy, and button typography are retained. Column headings and values remain readable at the normalized component scale without wrapping or truncation.
- Spacing and layout rhythm — The dialog expands to 980 CSS px and uses one account row per line with four equal input tracks. All five rows, helper text, and footer fit without horizontal or vertical scrolling at the desktop target.
- Colors and visual tokens — Existing ink, muted, surface, line, account-pill, warning, cyan-focus, and amber-action tokens are unchanged.
- Image quality and assets — The form contains no raster product imagery. The existing close icon component and account badges remain unchanged; no placeholder or generated asset was introduced.
- Copy and content — Desktop copy now states “五个账号同屏填写，一次统一保存。” All five real accounts and all four real inventory fields remain present. Mobile keeps the original sequential guidance.

### Verification

- Browser page identity: `http://127.0.0.1:4173/#/record`, title `万象册`.
- Browser interaction: opened “检查并更新”, confirmed five rows / 20 inputs / zero next-account buttons, changed MYT ordinary eggs from 5 to 6, and observed the updated value in the rendered dialog.
- Responsive interaction: 393 × 852 switches to the existing FC step panel with five tabs, four visible inputs, and the LG1 next action.
- Browser console: no warnings or errors.
- Automated checks: all 149 unit tests pass; production build passes; three focused desktop E2E tests pass; the focused mobile VisualViewport/stepper regression passes.
- Accessibility-specific QA remains intentionally excluded from scope.

final result: passed

## Inventory-first sheet visibility correction — 2026-07-25

### Source and implementation evidence

- Source visual truth: `C:\Users\T\.codex\codex-remote-attachments\019f9503-9e22-7791-9ff5-845e36732211\6D2DD8AF-2F29-475A-B3B1-B44E6F12E54C\1-照片-1.jpg`
- Source pixels: 589 × 1280, normalized to 393 × 852 for comparison.
- Implementation screenshot: `C:\Users\T\AppData\Local\Temp\sw-inventory-core-qa\after-inventory-complete.png`
- Implementation pixels and CSS viewport: 393 × 852 at the Browser capture density.
- State: home route, global record sheet open, inventory segment selected, seeded five-account inventory.
- Full-view comparison: `C:\Users\T\AppData\Local\Temp\sw-inventory-core-qa\comparison-source-vs-complete.png`
- Focused comparison was not needed because the full normalized comparison keeps every table label, value, row boundary, and footer control readable.

### Pass 7 findings and fixes

- P1 — The previous shared 62dvh detent left only 299 px for a 467 px inventory body. LG2 was clipped and MYT was completely below the visible body while the fixed save footer remained visible.
- Fix — Inventory is now the sizing source of truth. The shared mobile sheet uses a large `min(83dvh, 780px)` detent, while retaining the same fixed header, segmented control, footer, and small-screen internal-scroll fallback.
- Post-fix evidence — At 393 × 852 the sheet measures 707.16 px, the inventory body measures 477 px client and scroll height, and all five rows are visible at scrollTop 0. MYT ends at 748.34 px, leaving 28.99 px before the footer begins at 777.33 px.
- Cross-mode evidence — Inventory, expense, and market all retain the same 144.84 px sheet top and 707.16 px sheet height. Market retains zero horizontal overflow.
- Typography — The established 17 px title, 13 px labels, 16 px / 600 inputs, and 50 px input controls remain unchanged.
- Spacing and layout rhythm — The only major-region change is the shared detent height. Existing padding, grid tracks, row rhythm, radii, separators, and fixed footer geometry remain unchanged.
- Colors and visual tokens — No color, material, tint, shadow, or semantic-state token changed.
- Image quality and assets — No product imagery or generated assets are involved in this form; the existing application icon components remain unchanged.
- Copy and content — All five real account rows and all four inventory values remain unchanged; no content was removed to make the layout fit.
- Smaller-screen fallback — The 440 × 700 regression still verifies equal sheet geometry and allows only overflowing bodies to scroll; modes that already fit do not gain artificial scrolling.
- Accessibility-specific QA remains intentionally excluded from scope.

### Pass 7 verification

- The 393 × 852 inventory regression verifies that the body needs no scrolling, MYT is completely within the body, and the last row does not intersect the fixed save footer.
- The multi-mode regression verifies unchanged common top/height, typography, field geometry, and conditional internal scrolling.
- Browser console contains no relevant warnings or errors.

final result: passed

## Global record sheet consistency — 2026-07-25

### Source and implementation evidence

- User sources:
  - Market: `C:\Users\T\.codex\codex-remote-attachments\019f9503-9e22-7791-9ff5-845e36732211\63D9F23D-B12B-4928-ABDF-B2414D3A9A54\1-照片-1.jpg`
  - Expense: `C:\Users\T\.codex\codex-remote-attachments\019f9503-9e22-7791-9ff5-845e36732211\63D9F23D-B12B-4928-ABDF-B2414D3A9A54\2-照片-2.jpg`
  - Inventory: `C:\Users\T\.codex\codex-remote-attachments\019f9503-9e22-7791-9ff5-845e36732211\63D9F23D-B12B-4928-ABDF-B2414D3A9A54\3-照片-3.jpg`
- Final implementation captures, 393 × 852 CSS px:
  - `C:\Users\T\AppData\Local\Temp\sw-record-sheet-unify-qa\after-inventory.png`
  - `C:\Users\T\AppData\Local\Temp\sw-record-sheet-unify-qa\after-expense.png`
  - `C:\Users\T\AppData\Local\Temp\sw-record-sheet-unify-qa\after-market.png`
- Combined source/implementation comparison:
  - `C:\Users\T\AppData\Local\Temp\sw-record-sheet-unify-qa\comparison-all-modes.png`

### Pass 6 findings and fixes

- P1 — The three real iPhone captures used three content-driven sheet heights: market approximately 627 physical px, expense 708 px, and inventory 742 px. Switching modes therefore moved the sheet top by approximately 115 px.
- Fix — Replaced mobile `max-height`-only sizing with one shared `clamp(480px, 62dvh, 620px)` detent. The mobile sheet is now a fixed flex column; its header, segmented control, error, and footer remain fixed while only the body scrolls.
- P1 — Inventory values used 40 px controls at 14 px, while expense and market used 50 px controls at 16 px. Inventory account labels, table headings, account pills, notes, and units also followed unrelated scales.
- Fix — Added one sheet typography/control token set: 17 px title, 13 px labels, 16 px / 600 input values, 12 px metadata and units, and 50 px input controls. Inventory, expense, and market now consume the same tokens; account pills use a consistent 44 px height.
- P2 — The market input's intrinsic width exceeded its grid track, clipping the right-column unit text and adding horizontal body overflow.
- Fix — Added a zero minimum inline size to the market input group. Both columns now remain inside the 16 px sheet insets with no horizontal overflow.
- Interaction — Dense inventory and expense content now scrolls inside the form body. The title, mode switcher, and primary save action remain stationary, so switching modes no longer changes the user's spatial context.
- Scope — Inventory keeps all five real accounts and four real value columns. The unified medium detent intentionally reveals a partial next row as a natural scroll cue instead of shrinking the numeric controls again.

### Pass 6 verification

- At 393 × 852 CSS px, all three modes measured the same sheet top (`323.76 px`), height (`528.24 px`), header (`62 px`), segmented item (`42 px`), and footer (`74.67 px`).
- All three modes measured 13 px labels, 16 px / 600 input values, 50 px fields, and a 50 px / 16 px primary save button.
- Inventory body measured `299 px` client height and `467 px` scroll height; expense measured `299 / 380 px`; market measured `299 / 301 px`. Scrolling is owned by `.ios26-record-body`, while the sheet itself remains `overflow: hidden`.
- Market geometry measured a 361 px grid inside the 393 px viewport and a matching 361 px scroll width; no horizontal overflow remains.
- The focused mobile Playwright regression passed for identical top/height, shared typography, shared control geometry, and internal scrolling across all three modes.
- All 149 unit tests, production build, and `git diff --check` passed.
- Accessibility-specific QA remains intentionally excluded from scope.

final result: passed
## iOS 26 Liquid Glass 手机底栏（2026-07-25）

**Source visual truth**

- `C:\Users\T\.codex\codex-remote-attachments\019f9503-9e22-7791-9ff5-845e36732211\634073BC-DAD3-4FC7-876E-88690A8FE519\1-照片-1.jpg`
- 原图像素：589 × 1280；按参考截图约 1.5 倍密度归一化为 393 × 853。

**Rendered implementation**

- `D:\0------Code\14-----------------------Tools\sw\artifacts\ios26-dock-393x852.png`
- 实现像素与 CSS 视口：393 × 852，density 1。
- 同画布对照：`D:\0------Code\14-----------------------Tools\sw\artifacts\ios26-dock-comparison.png`（786 × 853；左侧参考、右侧实现）。
- 状态：首页、底栏展开、今日选中、搜索弹层关闭。

**Full-view comparison evidence**

- 实现使用与参考一致的两段式结构：297.33 × 56 主胶囊、56 × 56 独立搜索圆钮、8px 间距、左右 16px、底部 16px。
- 内容延伸到底栏之后，没有整块不透明底板或顶部分隔线。
- 选中态为约 96.67 × 48 的完整着色玻璃滑块；未选中项保持单色图标与标签。

**Focused region comparison evidence**

- 已在同画布底部区域检查轮廓、圆角、间距、选中态占比、图标与标签层级。
- 参考与实现的主胶囊/搜索按钮比例、按钮高度和悬浮位置一致；实现沿用产品橙色强调色，属于既有品牌令牌，不是结构漂移。

**Required fidelity surfaces**

- Fonts and typography: 沿用系统中文字体栈；10.5px 标签、约 21–23px 图标与参考的小型底栏层级一致，无截断。
- Spacing and layout rhythm: 56px 高度、28px 圆角、8px 分组间距、16px 横向与底部留白均已测量验证。
- Colors and visual tokens: 使用半透明浅色 Liquid Glass 与产品橙色选中态；未给所有控件着色。
- Image quality and asset fidelity: 底栏仅使用已有矢量图标组件，无占位图、位图拉伸或装饰资产缺失。
- Copy and content: 保留本产品的“今日 / 任务 / 周报”和现有全局搜索能力；参考图的 Apple Music 文案不属于本产品复刻范围。

**Findings**

- 无 P0/P1/P2。
- [P3] 浏览器 CSS 的玻璃折射无法完全复刻原生 `UITabBar` 的动态透镜效果；当前 blur、saturate、内高光与阴影已达到 Web 可实现的稳定近似。

**Interaction and runtime evidence**

- 独立搜索按钮可打开“全局搜索”对话框并关闭。
- 今日、任务、周报路由与选中状态通过移动端 E2E。
- 393 × 852 下控制台无 warning/error。
- 149 项单元测试、3 项底栏聚焦 E2E 与生产构建通过。

**Comparison history**

- Iteration 1 finding [P2]: 实现底部间距为 8px，低于参考图约 16–19px；搜索按钮关闭弹层后出现品牌色焦点外圈。
- Fix: 底部改为 `max(16px, env(safe-area-inset-bottom))`，正文预留同步增至 90px，并移除搜索按钮非必要焦点外圈。
- Post-fix evidence: 最终同画布对照中底栏底边与参考位置一致；搜索圆钮恢复纯玻璃轮廓。

**Implementation checklist**

- [x] 主胶囊与搜索圆钮拆分
- [x] 参考图尺寸与安全区
- [x] 完整选中玻璃滑块
- [x] 搜索真实交互
- [x] 触控尺寸、路由、构建与控制台检查

final result: passed
