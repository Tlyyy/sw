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

## Account-first desktop/web refactor — 2026-07-23

### Source truth and implementation evidence

- 用户选定的产品方向：`C:\Users\T\AppData\Local\Temp\codex-clipboard-62ddd34f-4b7c-4c2a-86ff-51f3553421e9.png`，以及随后提供的 iPhone 16 Pro Max 实机截图；核心要求是首页、录入、任务、本周小结与资料目的明确，并且所有进展与周报信息按账号查看，不显示跨账号财务合计。
- 旧桌面结构证据：`C:\Users\T\AppData\Local\Temp\sw-desktop-before.png`，1440px 下仍是模块/主线控制台导向，无法快速判断哪里看信息、哪里录入、哪里分享。
- 新桌面首页：`C:\Users\T\AppData\Local\Temp\sw-desktop-after-1440.png`；响应式证据：`sw-home-1280.png`、`sw-home-1024.png`、`sw-home-981.png`、`sw-home-980.png` 和 `sw-home-440.png`，均位于同一临时目录。
- 新目的页：`sw-record-1440.png`、`sw-tasks-1440-updated.png`、`sw-week-1440.png`、`sw-resources-1440-updated.png`；移动证据为对应的 `sw-mobile-*-440.png`。
- 同画布对照：`C:\Users\T\.codex\visualizations\2026\07\22\019f8a67-fe4e-7972-b773-69a5a26d7e39\web-refactor-qa\desktop-before-after.png`、`mobile-source-responsive.png` 和 `desktop-purpose-routes.png`。
- 视口与状态：桌面 1440 × 900、1280、1024、981；移动 980 与 440 × 956。自动化另使用 Playwright `iPhone 16 Pro Max` 描述器，CSS 视口 440 × 763、DPR 3。页面为已解锁状态，最近账号 PT，库存快照覆盖 2026-07-19 与 2026-07-22。

### Findings and iteration history

1. 旧版桌面将主线、分析、录入和分享同时当成首页重点，一级导航按系统模块命名；改为 `首页 / 录入 / 任务 / 本周小结 / 资料`，首页只回答“这周五个账号分别到哪了”。
2. 首页原先强调跨账号合计；改为固定 `FC / LG1 / PT / LG2 / MYT` 顺序的账号工作台，每行独立显示当前任务、库存、收获、支出、已完成与待完成任务，并明确标注“不显示跨账号合计”。
3. 录入页先选择账号，再处理库存、任务或支出；整个账号行现在可点击、可键盘操作，并与最近账号和支出账号联动。
4. 任务页改为账号进度在前、具体维护在后，默认继承最近账号；统计也改为当前账号范围。首轮 QA 发现 981–1024px 操作列裁切和不完整伪表格语义，已通过中间断点网格和原生分区/文章语义修复。
5. 本周小结保留五个账号逐行信息与 PNG 生成/分享，不展示跨账号收支总数；资料页先给账号与常用资料，发布和设置移到分隔清楚的低频区域。
6. 首轮自动化暴露一个移动首页异步渲染判断竞态；改为等待桌面/移动首页任一真实可见后再分支。另两个首次失败为 8 worker 下的页面加载中止，定向重跑均通过；完整套件随后一次通过。

### Mandatory comparison and fidelity surfaces

- 信息架构：五个一级入口分别承担查看、录入、执行、总结/分享、查询；深层资产、计划、分析、发布、数据和设置仍可通过资料或全局搜索到达，没有删除既有能力。
- 字体与层级：桌面标题、账号标识、关键数值、任务、辅助文案形成稳定层级；移动继续沿用选定参考的深蓝品牌栏、白色卡片、橙色录入、青绿分享语义。
- 间距与布局：1440px 使用横向账号工作台与右侧行动区，981px 仍完整显示；980px 以下切换为移动首页。各目的页在 1440、440 均无页面级横向滚动。
- 颜色与资产：复用项目既有颜色 token 和 `AppIcon` 线性图标族；没有 emoji、占位图、手绘 SVG、CSS 插画或伪造产品素材。
- 文案与数据：所有账号、任务、库存、收支和周报值来自现有业务数据；不通过缩短账号或任务内容来掩盖布局问题。
- 无障碍与交互：主导航当前项、账号筛选 pressed 状态、整行录入按钮、任务筛选/完成/恢复、对话框和固定移动底栏均已覆盖；981px 任务操作不再裁切。
- 浏览器健康：对首页、录入、任务、本周小结、资料在 1440 与 440 共十个路由状态收集 console warning/error 与 pageerror，结果为空；根宽度分别为 1440/1440 与 440/440。

### Verification

- `npm test`: 27 个文件、116 项单元测试通过。
- `npm run build`: 数据生成物检查、Vue/TypeScript、Vite 生产构建和 298 个资源完整性检查通过；仅保留既有 chunk-size warning。
- 桌面重构定向 E2E：19 项通过、3 项按项目条件跳过、0 失败。
- `npm run test:e2e:ci`: 49 项通过、103 项按项目条件跳过、0 失败；覆盖 desktop、两档 tablet、iPhone 16 Pro Max、同步、OCR、PNG 与分享回退。
- 视觉复查：桌面前后对照、移动参考/实现对照和四个目的页同画布均已重新生成并人工检查；没有剩余 P0、P1 或 P2 问题。

final result: passed

## Account-first full mobile refactor — 2026-07-23

### Source truth and evidence

- User references: `1-照片-1.jpg`, `2-照片-2.jpg`, and `3-照片-3.jpg` under `C:\Users\T\.codex\codex-remote-attachments\019f8a67-fe4e-7972-b773-69a5a26d7e39\0C49F0D0-1577-418E-940C-10CD8245E378`.
- Final iPhone 16 Pro Max captures: `home-16pm-viewport.png`, `record-16pm-viewport.png`, `week-16pm-viewport.png`, `resources-16pm-viewport.png`, and `tasks-16pm-viewport.png` under `C:\Users\T\.codex\visualizations\2026\07\23\019f8a67-fe4e-7972-b773-69a5a26d7e39`.
- Mandatory combined comparisons: `comparison-home-account-first.png`, `comparison-tasks-account-first.png`, and `comparison-week-account-first.png` in the same directory.
- Visual viewport: 440 × 956 CSS px, WebKit, 3× device scale, with 59px top and 34px bottom safe areas. The automated Safari viewport gate also uses the Playwright iPhone 16 Pro Max descriptor at 440 × 763.
- Tested state: authenticated local workspace, 2026-07-23, five-account inventory baseline and current snapshot, canonical order `FC / LG1 / PT / LG2 / MYT`.

### Findings and implemented corrections

1. P1 — the home screen's combined weekly totals did not answer which account needed attention. The total card was replaced by five compact account rows showing current task/status, pending tasks, harvest, expense, and completed-task count, each with one 44px detail target.
2. P1 — the weekly summary put combined harvest, expense, inventory and formula cards before the account data. Those aggregate cards and the formula band were removed from both the page and generated PNG; the five accounts now form the primary content.
3. P2 — the mobile chrome and route intros consumed too much vertical space. The header content is now 48px plus the unavoidable iOS safe area, the brand and sync control were tightened, mobile route intros were compressed, and plan navigation became one horizontal row.
4. P2 — recording mixed actions and totals. The record hub now clearly separates inventory, task completion, silver expense, and market entry, then shows today's status for all five accounts.
5. P2 — task progress was global. The task page now starts with five account progress controls that also filter the worklist; the previous aggregate stat strip was removed from related mainline pages.
6. P2 — information and input were mixed. The resources page explicitly acts as lookup-only, begins with five account entries, and separates assets, analysis/planning, and source data.
7. P2 — account order varied by domain. Runtime order is now consistently `FC / LG1 / PT / LG2 / MYT` across home, record, weekly summary, task, inventory, and share-image paths.
8. P2 — the first account-first pass used 8–9px secondary labels and repeated three synonymous weekly headings. Secondary labels were raised to 10px; the weekly page now uses `本周小结` and one `五个账号本周情况` panel, saving about 90px of page height.

### Final comparison result

- The home comparison preserves the reference's short weekly rhythm and orange recording CTA, but correctly replaces the combined progress card with account-level decisions.
- The task comparison reduces the old multi-row plan navigation and removes the four combined stat cells; all five accounts are visible together as progress/filter controls.
- The weekly comparison removes the total-first metrics and calculation formula, bringing FC, LG1, PT, LG2, and MYT directly below the report actions.
- All five reviewed routes report 440px document/client width, so there is no page-level horizontal overflow. Header height is 107px including the 59px safe area; the fixed dock is 106px including the 34px Home Indicator area.
- Console warning/error collection across the five final captures is empty. No remaining P0, P1, or P2 visual finding was observed in the combined comparisons.

### Verification

- `npm test`: 27 files and 116 tests passed.
- `npm run build`: data integrity, Vue/TypeScript, production build, and 298 static assets passed; the existing chunk-size warning remains.
- `npm run test:e2e:ci`: 49 passed, 103 skipped by project conditions, 0 failed.
- iPhone-specific coverage includes safe areas, 44px touch targets, five-account order and navigation, page overflow, task completion, weekly PNG generation, native file sharing fallback, forms, dialogs, and fixed-dock clearance.

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
- User placement annotation: `C:\Users\T\AppData\Local\Temp\codex-clipboard-58f51d38-441b-4c07-9296-520109df2ad6.png`; the red box marks the requested column between `银 / 万` and `碎`.
- Desktop implementation screenshot: `C:\Users\T\AppData\Local\Temp\sw-weekly-silver-egg-column-desktop-final-2.png` at 1280 × 720.
- Mobile implementation screenshot: `C:\Users\T\AppData\Local\Temp\sw-weekly-silver-egg-column-mobile-total.png` at 390 × 844.
- State: authenticated localhost automation session with isolated snapshots for 2026-07-12 and 2026-07-18. The six-column table total is `专 +1 / 普 +4 / 纯银 +198 / 银+蛋 +220 / 碎 +10`.
- Focused evidence: both captures show the new `银+蛋 / 万` column in the exact annotated position, all five account values, and the total row at readable scale.

### Findings and comparison history

#### Pass 1 — supplied screenshot

- P1 missing result: the table exposed five account rows but no cross-account total.
- P1 calculation gap: there was no visible total-silver figure that included ordinary eggs valued at 5.5万 each.

#### Pass 2 — implementation and post-fix evidence

- The first implementation incorrectly put the ordinary-egg equivalent into the table's `银` total, conflating pure silver with the combined valuation. This was rejected by the user and is not the final design.

#### Pass 3 — corrected dual totals

- The five-column table now remains semantically literal: `银 / 万` totals pure silver only (`+198` in the supplied example).
- A separate full-width summary below the table shows `银子 + 普通蛋折算总值`, with the visible breakdown `纯银子 +198万` and `普通蛋 +4 × 5.5万/个 = +22万`, yielding `+220万`.
- The user clarified that the combined valuation belongs inside the table, not in a separate band below it.

#### Pass 4 — exact annotated column placement

- Added `银+蛋 / 万` directly between `银 / 万` and `碎`. The pure-silver column is unchanged; the new column calculates each account as `纯银变化 + 普通蛋变化 × 5.5万`.
- Screenshot-matching values are `FC +74 / LG1 +73.5 / LG2 +54 / PT -54.5 / MYT +73`; their total is `+220` while the pure-silver total remains `+198`.
- Desktop and 390px-mobile header/row edge differences are 0px. Document, report, table, headers, and data cells all have 0px horizontal overflow. Mobile monetary headers stack the unit below the label for legibility.
- Weekly navigation was exercised from 2026-07-13—2026-07-19 to the previous week and back; the new column and `+220` total returned correctly. No P0/P1/P2 issue remains.

### Required fidelity surfaces

- Fonts and typography: both monetary columns use tabular numerals, sign formatting, and semantic weights. At 390px the two monetary unit labels stack to avoid crowding while every numeric value remains single-line.
- Spacing and layout rhythm: the grid now has six explicit tracks in the requested order. The new track fills the annotated gap without changing the outer table width or introducing horizontal scrolling.
- Colors and visual tokens: the new column reuses the existing positive/negative/neutral tokens; the explanatory formula uses the established cyan informational accent.
- Image quality and asset fidelity: this data table contains no product imagery or custom graphic assets. No placeholder, SVG, emoji, CSS illustration, or substitute asset was introduced.
- Copy and content: the formula `银 = 纯银子；银+蛋 = 纯银子 + 普通蛋 × 5.5 万/个` makes the two monetary meanings explicit. Dedicated eggs are not priced into silver.
- Accessibility and interaction: every `银+蛋` account cell announces the account, folded value, and unit; the total cell announces the fixed 5.5万 rate. Week switching remains operable.

### Verification

- `npm test`: 87 passed.
- `npm run build`: passed (data check, Vue/TypeScript check, Vite build, and 298-asset integrity check).
- Mobile Playwright release gate: 6 passed, including the weekly total values, all-row alignment, expanded daily report, and no horizontal overflow.
- Browser page identity: `http://127.0.0.1:4173/#/data/inventory`, title `项目台账`; framework overlay absent; console warnings/errors empty.

final result: passed

## Inventory daily comparison matrix — 2026-07-20

### Source truth and target state

- Source reference: `C:\Users\T\AppData\Local\Temp\codex-clipboard-7d1926ed-c9e2-4c53-ba44-a97d951651d2.png`.
- Implementation: `src/components/InventoryWeeklyReport.vue`.
- Target route/state: `http://127.0.0.1:5173/#/data/inventory` → 每周库存报表 → 按日对比 → 银子.
- Intended viewport coverage: desktop and 390 × 844 mobile.

### Comparison evidence

- Full-view comparison: blocked. The in-app browser reaches the application's access-password gate, so the authenticated inventory screen cannot be captured.
- Focused matrix comparison: blocked for the same reason; no implementation screenshot was available for a valid side-by-side comparison with the source reference.
- Chrome fallback: unavailable. Chrome was not running and the ChatGPT Chrome Extension was not installed in the selected profile, so the existing signed-in application state could not be used.

### Findings and iteration history

1. Retained the reference's useful structure: dates are rows, the five accounts are columns, and the combined total is the final column.
2. Replaced Excel-blue styling with the product's existing teal surfaces, account pills, borders, spacing, and semantic positive/negative colors.
3. Kept the existing summary and record actions as the default workflow; the matrix is an optional `按日对比` view.
4. Added one-metric-at-a-time switching for silver, dedicated eggs, regular eggs, and inner-shard fragments, plus weekly total and interval daily average footer rows.
5. Constrained narrow-screen overflow to the matrix container and kept pressed-state controls at a 44px minimum mobile touch height.
6. Verified type checking, production build, 87 unit tests, and whitespace checks. Visual comparison remains blocked by authentication/browser availability.

final result: blocked

## 万象册移动端信息架构与 iPhone 16 Pro Max 首页 — 2026-07-23

### Source truth and comparison evidence

- 用户选定设计：`C:\Users\T\AppData\Local\Temp\codex-clipboard-62ddd34f-4b7c-4c2a-86ff-51f3553421e9.png`，原始尺寸 851 × 1849。
- 最终浏览器截图：`test-results/design-qa/home-440x956-final.jpg`，440 × 956。
- 同画布全屏对照：`test-results/design-qa/home-comparison.png`，将参考图按宽度无裁切归一为 440 × 956，并与 440 × 956 实现并排比较。
- 不另做局部裁切：并排图保留了 440px 原始可读宽度，标题、七天节奏、主 CTA、任务、三项指标、周报卡和底栏均可直接判读。
- 视觉截图使用 440 × 956 屏幕比例；自动化发布门禁另使用 Playwright `iPhone 16 Pro Max` 的真实 Safari 内容区 440 × 763、screen 440 × 956、DPR 3，并叠加顶部 59px / 底部 34px 安全区。
- 状态差异：参考稿固定为 7月22日，最终实现按上海时区和真实本地数据渲染为 7月23日；这是动态数据差异，不是布局偏差。最终实现还按用户要求增加了任务摘要。

### Mandatory comparison

- 布局与间距：深海军蓝品牌栏、周标题、七列节奏条、橙色“记录今天”、本周三项指标、本周小结卡和五项底栏保持参考稿顺序。任务被放进主记录卡内部，没有再新增一个互相争抢的一级入口。七天条和指标区较参考稿更紧凑，用于容纳新增任务且保证 440 × 763 首屏主操作不被固定底栏遮挡。
- 字体与层级：品牌、`本周`、当天记录标题、数字指标和底栏形成清晰五级层次；中文系统字体、粗细、行高、单行截断和表格数字均在 440px 宽度检查，无挤压或意外换行。
- 颜色与表面：保留参考稿的深蓝、金色品牌、白色卡片、绿色完成态、橙色当天/录入和青绿色分享语义。主橙色调整为 `#bd5500`，白字对比度约 4.71:1；圆角、细边框和轻阴影与参考稿同属轻量卡片体系。
- 图标与资产：全部可见图标使用既有 `AppIcon` 同一线性图标族；没有 emoji、占位图、手绘 SVG、CSS 插画或伪造产品素材。该首页本身不需要照片资产。
- 文案与信息架构：首页回答“本周到哪了”，录入页回答“今天要记什么”，本周小结页负责查看/生成/分享，资料页只承载查询入口；底栏固定为 `首页 / 录入 / 本周小结 / 资料 / 更多`。
- 状态与交互：已验证首页到录入、任务维护、本周小结、资料和更多抽屉；库存弹窗、支出表单自动聚焦、本周小结 PNG 预览、下载和 iPhone 文件分享回退均可用。控制台 warning/error 为空。
- 响应性与无障碍：七列一次完整展示且页面无横向滚动；顶部/底部安全区、Home Indicator、44px 触控区、抽屉焦点陷阱与恢复、精确 `aria-current`/分区 `location`、输入 16px 防自动缩放均通过门禁。

### Findings and iteration history

1. 初版沿用了旧首页的“所有信息同时出现”结构，无法清楚区分查看、录入和分享；最终改成四个目的明确的一级区域和一个“更多”抽屉。
2. 首次视觉实现的当天状态与主 CTA 偏青色；按选定稿改为橙色，并在不牺牲文字对比度的前提下完成品牌色校正。
3. 参考稿没有任务。按用户补充要求，把待完成数量、两个当前任务和任务维护入口并入“记录今天”卡；这是明确的功能扩展，不作为设计偏差。
4. QA 发现库存只更新到较早日期时，较晚支出可能被错误加回“收获”；最终拆分“本周总支出”和“库存比较区间内支出”，首页与 PNG 同时显示可信口径和库存截止日。
5. QA 发现跨周恢复、任务批量栏、复选框宽度、周切换按钮、PNG 关闭按钮和同步入口的移动边界问题；均已修复并加入 440 × 763 WebKit 回归。
6. 最终并排比较没有剩余 P0、P1 或 P2 视觉问题。参考稿更高的七天条和更松的指标卡属于无任务版本的密度；当前压缩是为新增任务和真实 Safari 首屏做的有意取舍，信息层级仍一致。

### Verification

- `npm test`: 27 个文件、114 项单元测试通过。
- `npm run build`: 数据生成物检查、Vue/TypeScript、Vite 构建及 298 个资源完整性检查通过；仅保留既有 chunk-size warning。
- `npm run test:e2e:ci`: 48 项通过、100 项按项目条件跳过、0 失败，覆盖 desktop、tablet、iPhone 16 Pro Max WebKit、同步、OCR、PNG 与分享回退。
- 最终浏览器页：认证后的 `http://127.0.0.1:4173/#/`；440 × 956 截图及同画布对照已人工检查，控制台 warning/error 为空。

final result: passed

## Five-account mainline overview share — 2026-07-20

### Source truth and target state

- Source evidence: `C:\Users\T\AppData\Local\Temp\codex-clipboard-2b662fb9-0615-4c42-8382-b799c6fca0b5.png`, mobile five-account mainline overview.
- Problem: each account card exposed its own share action, so the result described only one account even though this section is a five-account overview.
- Target flow: dashboard → 五号主线推进轨道 → 分享五号进度 → one combined PNG containing FC, LG1, LG2, PT, and MYT.
- Implementation: `src/features/dashboard/DashboardPage.vue`, `src/features/dashboard/mainlineOverviewShareImage.ts`, and `src/styles/radar.css`.

### Implemented behavior

- Replaced the five per-card share controls with one section-level share control beside the inventory baseline.
- The generated 1080 × 1350 image contains all five accounts in order and preserves each account's current task, following two tasks, due dates, mainline finish estimate, semantic resource status, and dedicated eggs / regular eggs / silver / shards.
- Native file sharing remains the first choice. Unsupported sharing downloads the same PNG; cancelling the native share sheet does not trigger a download.
- The mobile share control remains a compact 44 × 44 icon target, while desktop keeps the explicit `分享五号进度` label.

### Browser evidence

- Browser plugin classification: available.
- Page identity passed at `http://127.0.0.1:4173/#/`, title `项目台账`.
- Meaningful authenticated dashboard rendering and share interaction remain blocked by the application's access-password gate; browser console output contained only the normal Vite connection messages.
- No authentication bypass or alternate browser fallback was used.

### Verification

- `npm run build`: passed, including Vue/TypeScript checking and the 298-asset integrity check.
- `npm test`: 90 passed, including the combined five-account canvas-generation branch.
- Standalone TypeScript check for `e2e/mobile-ux.spec.ts`: passed.
- The mobile end-to-end assertion now requires exactly one five-account share control, confirms the five old account-specific controls are absent, and covers native file sharing plus PNG download fallback.
- `git diff --check`: passed with line-ending warnings only.

final result: blocked

## Mobile account share image — 2026-07-20

### Source truth and target state

- Requested flow: authenticated mobile dashboard → tap one account card's share control → generate that account's PNG → open the native file share sheet when supported, otherwise download the PNG.
- Implementation: `src/features/dashboard/DashboardPage.vue`, `src/features/dashboard/accountShareImage.ts`, `src/components/AppIcon.vue`, and `src/styles/radar.css`.
- Intended viewport: mobile widths up to 720px; the generated image is a fixed 1080 × 1350 (4:5) PNG.

### Implemented behavior

- Added a compact 44px share icon beside each mobile account summary without adding another text row.
- The share image contains the inventory date, account identity, current status, four resources, current/next two tasks, and whole-line completion estimate.
- Status colors remain semantic in the generated asset: positive green, caution amber, and blocked/stale red.
- File-capable Web Share is used first; unsupported or failed file sharing falls back to an automatic PNG download. Cancelling the native share sheet does not trigger a download.
- The generation state disables duplicate taps, animates the share control, respects reduced-motion preferences, and reports a short result toast above the mobile dock.

### Browser evidence

- Authenticated button interaction: blocked by the application's access-password gate; the browser session was not read or bypassed.
- The actual Vite-loaded image module was exercised in an isolated temporary preview page, then the preview file was removed.
- Generated asset: visible 1080 × 1350 PNG, 320,303 bytes, with readable account, task, resource, status, and completion sections.

### Verification

- `npm run build`: passed after the final status-color change, including Vue/TypeScript checking and the 298-asset integrity check.
- `npm test`: 87 passed.
- Standalone TypeScript check for `e2e/mobile-ux.spec.ts`: passed.
- Added an end-to-end assertion for a 44px share target, PNG file metadata/content size, native file sharing, and download fallback; execution remains pending authenticated browser access.
- `git diff --check`: passed with line-ending warnings only.

final result: blocked

## Mobile dashboard density — 2026-07-20

### Source truth and target state

- Source problem evidence: `C:\Users\T\AppData\Local\Temp\codex-clipboard-a08ab713-3356-4736-84ce-58c83e28661f.png` at 353 × 764.
- Implementation: `src/features/dashboard/DashboardPage.vue` and `src/styles/radar.css`.
- Target route/state: `http://127.0.0.1:5173/#/`, authenticated mobile dashboard with FC selected.
- Intended viewport: 390 × 844, with additional protection for widths down to 320px.

### Design changes

- Reduced the resource overview from a two-column, three-row block to one five-column summary row on mobile.
- Kept all five values visible while shortening padding, type scale, and divider spacing; the covered-shortage state remains explicit.
- Merged the mainline heading and total completion date into one row, removed the redundant mobile step legend, and tightened task labels, due dates, and track markers.
- Reduced the focus panel bottom inset so the next-action panel enters the viewport earlier without changing any action or data behavior.
- Added regression limits of 100px each for the resource overview and mainline track, plus the existing page-overflow and dock-clearance assertions.

### Comparison evidence

- Full-view browser comparison: blocked. The in-app browser reaches the application's access-password gate before the authenticated dashboard is rendered.
- Focused resource/track comparison: blocked for the same reason; no valid post-change implementation screenshot can be captured without user authentication.
- Browser console warning/error query at the gate returned an empty list.

### Required fidelity surfaces

- Fonts and typography: the existing local UI and monospaced stacks are retained. Mobile resource values use 17px type, labels use 11px, and task titles use 12px with single-line truncation protection.
- Spacing and layout rhythm: only the mobile dashboard breakpoint changes. Desktop/tablet geometry remains unchanged; the compact sections are capped by regression assertions.
- Colors and visual tokens: existing teal, success, danger, border, and surface tokens are reused unchanged.
- Image quality and asset fidelity: this dashboard region contains no image assets, and no placeholder or substitute graphic was introduced.
- Copy and content: all resource values, task labels, due dates, shortage values, and actions remain present. Only the redundant mobile step legend is hidden.
- Accessibility and interaction: semantic sections and headings remain intact; no control or route behavior changed.

### Verification

- `npm run build`: passed, including Vue/TypeScript checking and the 298-asset integrity check.
- `npm test`: 87 passed.
- Standalone TypeScript check for `e2e/mobile-ux.spec.ts`: passed.
- `git diff --check`: passed with line-ending warnings only.

final result: blocked

## Mobile mainline account cards — 2026-07-20

### Source truth and target state

- Source problem evidence: `C:\Users\T\AppData\Local\Temp\codex-clipboard-7fbef8b5-4487-4f49-911b-f3d08c151773.png` at 353 × 527.
- Implementation: `src/features/dashboard/DashboardPage.vue` and `src/styles/radar.css`.
- Target route/state: authenticated dashboard at `http://127.0.0.1:5173/#/`, five-account timeline, mobile width.
- Intended verification viewport: 390 × 844.

### Audit findings and implemented changes

1. P1 — Three tasks and three dates shared one narrow row, causing every useful label to be ellipsized. The mobile card now gives the current task a full identity row and the two later steps one half-width column each with wrapping instead of forced truncation.
2. P2 — The current task and resource advice were repeated in a large paragraph below the timeline. The mobile-only card replaces that duplicate paragraph with a compact five-part resource strip: dedicated eggs, regular eggs, silver, shards, and actionable resource status.
3. P2 — Status and detail occupied a separate full-width footer, increasing every account card's height. They now sit with the account/current-task header while the detail link retains a 44px touch height.
4. P2 — The selected-account state relied mostly on background tint. The revised card uses the account tone on both the border and a 3px inset marker.
5. Desktop and tablet continue to render the original five-column table; the new summary markup is visible only at the mobile breakpoint.

### Comparison evidence

- Full-view browser comparison: blocked. The in-app browser stops at the application's access-password gate before the authenticated dashboard can render.
- Focused card comparison: blocked for the same reason. Chrome fallback is unavailable because Chrome is not running and the ChatGPT Chrome Extension is not installed in the selected profile.
- Browser console warning/error query at the access gate returned an empty list.

### Required fidelity surfaces

- Fonts and typography: existing UI and monospaced stacks remain. Current and next task names use wrapping and 12–13px hierarchy; metadata uses 10–11px labels.
- Spacing and layout rhythm: the mobile card targets a maximum height of 210px and removes the old account column, repeated paragraph, and standalone footer. Desktop tracks are unchanged.
- Colors and visual tokens: existing account, interaction, success, danger, surface, and divider tokens are reused.
- Image quality and asset fidelity: the card contains no image assets; the existing `AppIcon` chevron is retained and no substitute art was introduced.
- Copy and content: current task, next two tasks, dates, finish estimate, four inventory values, resource status, and account detail link remain available.
- Accessibility and interaction: visible detail links retain a 44px touch target, account selection behavior remains on each row, and mobile content does not add a new route or control model.

### Verification

- `npm run build`: passed after the component and layout changes.
- `npm test`: 87 passed.
- Standalone TypeScript check for `e2e/mobile-ux.spec.ts`: passed.
- The new release assertion checks five visible mobile summary cards, a maximum 210px card height, unclipped task titles, 44px detail targets, and no page-level horizontal overflow.

final result: blocked

## Inventory report share images — 2026-07-20

### Source truth and target state

- Source evidence: `C:\Users\T\AppData\Local\Temp\codex-clipboard-c497c920-191c-481e-8401-a4ae12308722.png`, mobile inventory daily-comparison view.
- Target flow: data center → inventory weekly report → choose summary or daily comparison/metric → share → native image share or PNG download fallback.
- Implementation: `src/components/InventoryWeeklyReport.vue` and `src/components/inventoryReportShareImage.ts`.
- Generated asset: fixed 1080 × 1350 PNG.

### Implemented behavior

- Added a desktop text/share control and a compact 44px mobile share icon beside the report view switch.
- Summary mode generates the five-account latest inventory table plus the current week's net-change table.
- Daily comparison mode generates the currently selected metric matrix, including all seven days, five accounts, total, weekly total, and interval average.
- The silver-plus-eggs image retains the fixed `silver + regular eggs × 5.5 万/个` conversion note.
- File-capable Web Share is preferred; unsupported sharing falls back to a download, while native-share cancellation does not download.

### Browser evidence

- Browser plugin classification: available.
- Page identity passed at `http://127.0.0.1:4173/#/data/inventory`, title `项目台账`.
- Meaningful authenticated report rendering and interaction remain blocked by the application's access-password gate; console warning/error query returned no entries.
- An isolated data-URL preview was rejected by the Browser security policy, so no alternate browser surface or Playwright fallback was used.

### Verification

- `npm run build`: passed, including Vue/TypeScript checking and the 298-asset integrity check.
- `npm test`: 89 passed, including both summary and matrix canvas-generation branches.
- Standalone TypeScript check for `e2e/mobile-ux.spec.ts`: passed.
- Added mobile end-to-end assertions for the 44px share target, current-view filenames, PNG size, native file sharing, and download fallback; runtime execution remains pending authenticated browser access.
- `git diff --check`: passed with line-ending warnings only.

final result: blocked

## Current Design QA status — 2026-07-23

The latest source-to-implementation comparison, findings, interaction coverage, accessibility review, and final verification are recorded above under `Account-first full mobile refactor — 2026-07-23`. That pass supersedes the older blocked historical entries: authenticated 440 × 956 comparisons cover home, task, and weekly-summary flows; the iPhone 16 Pro Max 440 × 763 WebKit gate is green; and final console warning/error collection is empty.

final result: passed

## Current Design QA status — account-first web — 2026-07-23

The latest desktop/web comparison and release verification are recorded above under `Account-first desktop/web refactor — 2026-07-23`. It extends the mobile account-first structure to desktop, preserves the iPhone 16 Pro Max flow, and supersedes older module-first desktop findings. Desktop, tablet, and mobile checks are green; final console warning/error collection is empty.

final result: passed
