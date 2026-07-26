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

## 最新 iOS / iPhone 16 Pro Max 全站手机重构（2026-07-26）

**Source truth and rendered evidence**

- 规范基线：[Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)、[Apple Design Resources](https://developer.apple.com/design/resources/)、[Layout](https://developer.apple.com/design/human-interface-guidelines/layout)、[Materials](https://developer.apple.com/design/human-interface-guidelines/materials)、[Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode) 与 [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)。代码中的 `ios26-*` 仅作为历史兼容命名，新增规则按 Apple 当前公开设计基线执行。
- 已接受的交互方向：`D:\0------Code\14-----------------------Tools\sw\artifacts\ios26-interaction-directions\01-today-workbench.png`。
- 主验收视口：iPhone 16 Pro Max，440 × 956 CSS px。
- Safari 压力视口：440 × 763 CSS px，用于地址栏占位、软键盘和 Sheet 可用高度验证。
- 浅色证据：`C:\Users\T\AppData\Local\Temp\sw-iphone16pm-qa\home-light-440x956.png`、`week-light-440x956.png`、`settings-light-440x956.png`、`search-light-440x956.png`、`record-sheet-light-440x956.png`。
- 深色证据：`C:\Users\T\AppData\Local\Temp\sw-iphone16pm-qa\home-dark-440x956.png`、`tasks-dark-440x956.png`、`week-dark-440x956.png`、`earnings-dark-440x956.png`、`settings-dark-440x956.png`。
- 压力证据：`C:\Users\T\AppData\Local\Temp\sw-iphone16pm-qa\record-sheet-pressure-440x763.png`。

**Fidelity and mismatch ledger**

1. Hierarchy：手机顶栏固定为 68px；品牌使用 34/41 Large Title 层级，页面标题、正文、辅助说明不再各自漂移。
2. Controls：所有可见交互目标不小于 44 × 44；常规输入为 50px，分段选择器为 44px，主保存操作为 50px。
3. Navigation：底部保持“今日 / 任务 / 周报”三项稳定导航，并将搜索作为独立 56 × 56 玻璃控制；滚动不再缩放整条 Dock。
4. Material：Regular Liquid Glass 只用于导航、搜索和必要浮层；内容卡片使用系统分组表面，避免整页粉色玻璃或多层 blur。
5. Typography：Caption 2 从历史 10.5px 修正为 11/13；分段标签 15px，正文 17px；23 个路由中无低于 11px 的正常可见文本。
6. Sheet：库存、支出、行情三种模式共用同一 44px 分段器与固定页脚；五个账号在 440 × 956 下完整可见，并通过 VisualViewport 在 440 × 763 压力视口保持保存按钮可达。
7. System dark：外观实时跟随 `prefers-color-scheme`，不是应用内自造主题开关；23 个路由未发现不透明近白表面泄漏，active、selected、warning、empty、positive 与 negative 状态保留语义层级。
8. Motion：移除整条 Dock 的缩放和滚动收起；微交互只使用短时 transform / opacity / tint 变化，导航位置保持连续。

**Interaction and runtime evidence**

- 今日 → 任务 → 周报路由、选中状态与返回路径均通过 In-app Browser 实际操作。
- 全局搜索聚焦后输入 `FC` 返回 13 条跨账号、宠物、装备结果；清除按钮为 44 × 44，取消后回到原页面。
- 快速录入的库存、支出、行情模式切换保持同一 Sheet 尺寸和页脚位置；440 × 763 下保存按钮底边仍在可视区内。
- 23 个手机路由在 440 × 956 下逐页扫描：横向溢出 0、可见交互目标不小于 44 × 44、正常可见文字不小于 11px、无 Vite 错误覆盖层。
- 深色模式逐页扫描未发现固定近白表面；In-app Browser 未报告页面错误通知。
- 149 项单元测试、生产构建与 `git diff --check` 通过。
- 无障碍专项适配与专项 QA 按用户明确要求不在本轮范围内。

**Residual**

- [P3] Web `backdrop-filter` 无法一比一复刻原生 Liquid Glass 的实时折射、采样和物理位移；当前以背景透传、饱和度、迎光边、低位阴影和状态 tint 提供稳定近似。

final result: passed

## iOS 26 全站移动排版系统（2026-07-25）

### Official design basis

- Apple HIG Typography 的 Large 默认语义字号被固化为移动端设计令牌：Large Title `34/41`、Title 1 `28/34`、Title 2 `22/28`、Title 3 `20/25`、Headline 与 Body `17/22`、Callout `16/21`、Subheadline `15/20`、Footnote `13/18`、Caption 1 `12/16`、Caption 2 `11/13`（字号/行高，CSS px）。
- 页面标题、分区标题、正文、辅助文案、表头、标签和紧凑数据各自绑定语义样式，不再由页面任意声明字号。首页主任务标题保留 Title 2，常规页面标题使用 Title 1。
- 移动端输入、选择器和多行文本统一为 Body `17/22`；主操作按钮统一为 Headline `17/22`；分段控件统一为 Subheadline `15/20`；密集表格的最小正常文字为 Caption 2 `11/13`。
- 参考：Apple Human Interface Guidelines `Typography`、UIKit `UIFont.TextStyle` 与 WWDC25 `Get to know the new design system`。无障碍和 Dynamic Type 适配按用户要求不在本轮范围内。

### Source and implementation evidence

- 修改前移动端捕获：`C:\Users\T\AppData\Local\Temp\sw-ios26-type-qa\before-home.png`、`before-week.png`、`before-resources.png`、`before-tasks.png`、`before-pets.png`、`before-inventory.png`、`before-settings.png`。
- 修改后移动端捕获：`C:\Users\T\AppData\Local\Temp\sw-ios26-type-qa\after-home.png`、`after-week.png`、`after-resources-reload-430.png`、`after-tasks.png`、`after-pets.png`、`after-inventory.png`、`after-settings.png`。
- 搜索与录入层：`C:\Users\T\AppData\Local\Temp\sw-ios26-type-qa\after-search-393x852.png`、`after-record-sheet-393x852.png`、`after-global-sheet-393x852.png`。
- 同画布前后对照：`C:\Users\T\AppData\Local\Temp\sw-ios26-type-qa\comparison-home-before-after.png`、`comparison-week-before-after.png`、`comparison-resources-before-after.png`、`comparison-tasks-before-after.png`、`comparison-pets-before-after.png`、`comparison-settings-before-after.png`。
- 汇总同画布：`C:\Users\T\AppData\Local\Temp\sw-ios26-type-qa\comparison-all-pages-before-after.png`。

### Findings and fixes

- P1 — 9 个移动样式来源共有 221 处显式 `font-size`，形成 8–32 px 的 23 种字号和 18 种字重；同一级标题、按钮、表头和辅助文字会因页面不同而改变。
- Fix — 在 `ios26-mobile.css` 建立 11 个 Apple 语义字号/行高令牌，并把历史 `--font-*`、`--text-*` 别名桥接到同一套令牌。移动端系统字体栈改为 iOS 系统字体优先。
- P1 — Home、Week、Tasks、Resources、Inventory 和 Earnings 的局部 scoped CSS 覆盖全局层级；Earnings 密集表格存在 8–10 px 正常文字，搜索和录入弹层又使用另一套尺寸。
- Fix — 对七个核心页面及搜索、快照录入、全局录入层做语义化收口；密集表格最低统一到 Caption 2 `11/13`，表头/标签统一到 Footnote `13/18`，输入与主要动作回归 17 px。
- P2 — 393 px 视口下发布页筛选器存在 11 px 横向溢出，资料页的短页面标签会因新字号被逐字换行。
- Fix — 发布筛选列改为弹性主列加 100 px 固定列；紧凑页面标签保持单行。两处修复均不缩小文字。
- Scope — 页面结构、业务字段、底栏几何和既有 Liquid Glass 材质没有被重新设计；本轮只统一全站排版尺寸与相关防溢出布局。

### Verification

- In-app Browser 在 `393 × 852` 与 `430 × 932` 两个 CSS 视口遍历 23 个移动路由；未发现可见正常文字小于 11 px、文本输入小于 17 px、标题偏离语义令牌或页面横向溢出。
- 搜索层实测：标题 `28/34`、结果 `17/22`、说明 `13/18`、输入 `17/22`；录入层实测：标题 `17/22`、分段按钮 `15/20`、紧凑标签 `13/18`、输入与保存按钮 `17/22`。
- 新增移动排版回归契约，覆盖 23 个路由和两个目标视口，并校验根语义令牌、标题、最小文字、输入字号和横向溢出。
- 149 项单元测试、Vue/TypeScript 检查、数据完整性检查、生产构建和 `git diff --check` 通过。
- 无障碍专项检查按用户要求不在范围内。

final result: passed

## iOS 26 移动全局搜索重构（2026-07-25）

**Source and implementation evidence**

- 用户问题截图：`C:\Users\T\AppData\Local\Temp\codex-clipboard-e69c7ff3-b8c8-41f7-95c3-661d2ca0345b.png`。
- 重构前同状态捕获：`C:\Users\T\AppData\Local\Temp\sw-ios26-search-qa\before-430x932.png`。
- 重构后快捷入口：`C:\Users\T\AppData\Local\Temp\sw-ios26-search-qa\after-final-430x932.png`。
- 重构后分组结果：`C:\Users\T\AppData\Local\Temp\sw-ios26-search-qa\after-fc-results-430x932.png`。
- 重构后最近搜索：`C:\Users\T\AppData\Local\Temp\sw-ios26-search-qa\after-recent-search-fixed-430x932.png`。
- 同画布前后对照：`C:\Users\T\AppData\Local\Temp\sw-ios26-search-qa\comparison-before-after-430x932.png`（左侧旧搜索，右侧新搜索）。
- CSS 视口为 430 × 932；in-app Browser 的可捕获内容宽度因可见滚动条为 415 px，前后证据使用完全相同的 415 × 932 像素状态。

**Official design basis**

- Apple HIG 将当前场景定义为独立按钮式 Search tab：点击后立即聚焦、显示键盘，退出后回到之前标签，适合快速定位内容。
- iPhone 搜索字段位于底部；搜索按钮展开为字段，其他标签退出搜索状态后恢复。
- Liquid Glass 仅用于浮动导航和重要控制层。搜索结果属于内容层，不应整页玻璃化；本实现使用 Regular Glass，不叠加 glass-on-glass。
- 依据：Apple HIG `Search fields`、WWDC25 `Build a SwiftUI app with the new design` 与 `Build a UIKit app with the new design` 的 Search 章节。

**Findings and fixes**

- P1 — 旧实现是桌面 Command Palette 直接缩进手机：顶部窄输入、无层级页面长表、桌面键盘提示和方形关闭按钮。
- Fix — 手机端改为独立 Search tab 的四态流程：底栏圆钮 → 原位展开的底部搜索字段 → 即时分组结果 → 取消后恢复原标签。桌面仍保留命令面板和完整键盘导航。
- P1 — 旧结果按“页面优先”简单拼接，精确账号也会被页面列表压后，每行重复“页面”。
- Fix — 引入精确、分词、前缀、包含四级评分；结果按最低匹配分数动态排序并分为账号、宠物、装备、技能、页面，保留原账号/宠物/装备/技能 URL 和查询参数契约。
- P2 — 空查询只是任意前八个页面，没有任务导向。
- Fix — 提供今日、录入、任务、周报、资料、核算六个真实高频入口，并持久化最近四个搜索词；清空、无结果建议和结果计数均可操作。
- P2 — 第一轮最近搜索按钮继承旧 `.command-results button { width: 100% }`，导致“最近搜索”标题被清除按钮挤成两行。
- Fix — 最近搜索标题动作和历史词条显式使用内容宽度；最终 430 × 932 捕获中标题、清除动作与 `FC` 历史词均保持单行。

**Material, typography, spacing, and motion**

- 结果页使用普通浅色内容材质；只有 64 px 底部搜索控制层使用 0.42 中性填充、20 px blur、185% saturation、108% contrast、102% brightness 的 Regular Liquid Glass。
- 输入字段内部透明，不再叠一层玻璃；结果卡仅使用普通白色表面、细边和轻投影。
- 搜索标题为 32 px，结果标题 15.5 px，说明 12.5 px，输入 17 px；所有文本在 430 × 932 和 393 × 852 下无裁切。
- 展开动作以底部右侧搜索圆钮为变形原点，使用 440 ms 连续弹簧曲线；搜索控制层先横向展开，内容层随后淡入和轻微上移，退出时反向恢复。
- 复用 `useVisualViewport`；软件键盘缩短视口时，搜索字段保持在可视区域底部，标题收紧，结果区单独滚动。

**Interaction and runtime evidence**

- 打开后输入框立即获得焦点；Escape、取消和桌面关闭均恢复滚动、背景 inert 与先前焦点。
- `FC` 返回 13 项并按账号、宠物、装备分组，账号结果置顶；点击后进入 `#/accounts/FC`。
- 最近搜索会保存 `FC`，清除动作恢复空查询，无法匹配时显示可点击建议。
- 393 × 852 自动化验证了完整搜索布局、64 px 搜索控制层、17 px 输入、无横向溢出、内容层无玻璃、清除与取消。
- 将视口从 393 × 852 缩到 393 × 600 后，`is-keyboard-open` 生效，底部字段仍位于视觉视口内，结果区保持可滚动。
- in-app Browser 控制台只有 Vite 连接和热更新 debug 记录，无 warning/error。
- 149 项单元测试、17 项完整移动端 E2E、2 项桌面搜索回归、生产构建与 `git diff --check` 均通过。
- 无障碍专项检查按用户要求不在范围内。

**Residual**

- P3 — 桌面设备模拟不显示 iOS 系统键盘；已用 VisualViewport 从 852 px 缩至 600 px 的真实布局变化验证键盘占位与贴底行为。
- P3 — Web `backdrop-filter` 无法复刻系统级像素位移折射；当前以连续形变、背景透传、迎光边缘和低位阴影实现稳定近似。

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

- `D:\0------Code\14-----------------------Tools\sw\artifacts\ios26-dock-393x852-final.png`
- 原始实现截图：1179 × 2556，device scale factor 3；归一化实现与 CSS 视口：393 × 852。
- 全屏同画布对照：`D:\0------Code\14-----------------------Tools\sw\artifacts\ios26-dock-comparison-final.png`（786 × 853；左侧参考、右侧实现）。
- 底栏聚焦同画布对照：`D:\0------Code\14-----------------------Tools\sw\artifacts\ios26-dock-focus-comparison-final.png`（786 × 133；左侧参考、右侧实现）。
- 状态：首页、底栏展开、今日选中、搜索弹层关闭。

**Full-view comparison evidence**

- 实现使用与参考一致的两段式结构：294 × 56 主胶囊、56 × 56 独立搜索圆钮、7px 间距、左右 18px、底部 16px。
- 内容延伸到底栏之后，没有整块不透明底板或顶部分隔线。
- 选中态为约 104.67 × 48 的完整着色玻璃滑块；未选中项保持单色图标与标签。

**Focused region comparison evidence**

- 已在 393px 等宽同画布底部区域检查轮廓、圆角、间距、选中态占比、图标和标签的实际视觉占比。
- 参考与实现的主胶囊/搜索按钮比例、按钮高度和悬浮位置一致；选中按钮均约 105 × 48，主导航图标为 26px，搜索图标为 28px，标签为 10.5px。
- 实现沿用产品橙色强调色，属于既有品牌令牌，不是结构漂移。

**Required fidelity surfaces**

- Fonts and typography: 沿用系统中文字体栈；标签为 10.5px / 650，选中态为 750；避免第一轮视觉放大后的过粗问题，字面高度与参考一致且无截断。
- Spacing and layout rhythm: 56px 高度、28px 圆角、7px 分组间距、18px 横向留白与 16px 底部留白均已测量验证。
- Colors and visual tokens: 使用半透明浅色 Liquid Glass 与产品橙色选中态；未给所有控件着色。
- Image quality and asset fidelity: 底栏使用已有矢量图标组件；主导航图标为 26px / 2.3px 描边，搜索图标为 28px / 2.5px 描边，无占位图、位图拉伸或装饰资产缺失。
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
- Iteration 2 finding [P2]: 第一版内部控件偏小，选中底板仅约 96.67px 宽，标签为 10.5px，主导航图标为 21px，搜索图标为 23px，视觉重量明显弱于参考。
- Fix: 选中底板扩展到约 104.66 × 48；主导航图标提升到 26px，搜索图标提升到 28px并强化描边；标签保持参考图的小型 10.5px 字面，同时将默认/选中字重校准为 650/750；外层横向留白与分组间距收敛到 18px/7px。
- Post-fix evidence: 393px 等宽聚焦同画布对照中，选中底板宽高、文字字面、主图标与搜索图标可见轮廓均与参考一致；尺寸回归断言验证约 105px / 48px / 10.5px / 26px / 28px。

**Implementation checklist**

- [x] 主胶囊与搜索圆钮拆分
- [x] 参考图尺寸与安全区
- [x] 完整选中玻璃滑块
- [x] 按钮、标签和图标视觉尺度
- [x] 搜索真实交互
- [x] 触控尺寸、路由、构建与控制台检查

final result: passed

## iOS 26 Liquid Glass 材质校准（2026-07-25）

**Source and rendered evidence**

- Source visual truth: `C:\Users\T\.codex\codex-remote-attachments\019f9503-9e22-7791-9ff5-845e36732211\634073BC-DAD3-4FC7-876E-88690A8FE519\1-照片-1.jpg`（589 × 1280）。
- Browser-rendered implementation: `C:\Users\T\AppData\Local\Temp\sw-ios26-glass-after-final.png`（378 × 819）。
- In-app Browser viewport override: 393 × 852 CSS px；浏览器内容截图为 378 × 819，参考图按同一 378 × 819 像素尺寸归一化后比较。
- Full-view comparison: `C:\Users\T\AppData\Local\Temp\sw-ios26-glass-reference-vs-final.png`（756 × 819；左参考、右实现）。
- Focused dock comparison: `C:\Users\T\AppData\Local\Temp\sw-ios26-glass-reference-vs-final-focus.png`（756 × 128；左参考、右实现）。
- Before/after focused evidence: `C:\Users\T\AppData\Local\Temp\sw-ios26-glass-before-vs-final-focus.png`（756 × 128；左修改前、右修改后）。
- State: 已登录、浅色界面、周报页、周报选中、搜索弹层关闭。

**Findings and iteration**

- Iteration 3 finding [P2]: 原底栏使用 `rgba(248, 250, 253, 0.70)` 白色填充、28px 均匀模糊和单层阴影；在浅色页面上背景细节被抹平，材质更像白色磨砂卡片，缺少 Liquid Glass 的透色、迎光边缘和折射厚度。
- Fix: 主胶囊和独立搜索圆统一改为 Regular Liquid Glass：0.34 中性填充、18px blur、185% saturation、110% contrast、102% brightness；增加迎光渐变、上下异色折射边和低位环境阴影。选中板改为 0.08 品牌橙 tint，并保留独立高光而不叠第二层 blur。
- Post-fix evidence: 同画布聚焦对照中，底栏仍保持 56px 几何与 105 × 48 选中板，但外壳由不透明白卡片变为可透过底层内容的中性玻璃；搜索圆与主胶囊拥有一致的亮边、暗底缘和环境阴影。

**Required fidelity surfaces**

- Fonts and typography: 10.5px 标签、650/750 字重、26px 主图标和 28px 搜索图标均未改变；材质调整未造成截断、重排或字面发灰。
- Spacing and layout rhythm: 294 × 56 主胶囊、56 × 56 搜索圆、7px 间距、18px 横向留白与 16px 底部安全间距保持不变。
- Colors and visual tokens: 外壳使用中性 Regular glass，不给整条导航染色；仅选中态使用低浓度产品橙 tint，符合 Apple 对选择性 tint 的指导。
- Image quality and asset fidelity: 无新增位图、占位图或近似资产；现有矢量图标保持清晰。
- Copy and content: “今日 / 任务 / 周报”与搜索能力未改变。

**Interaction and runtime evidence**

- In-app Browser: `http://127.0.0.1:4173/#/week`。
- 搜索圆钮可打开“全局搜索”并通过关闭按钮恢复；导航与选中态保持工作。
- 页面身份、有效内容、无框架错误覆盖层和控制台 warning/error 均已检查。
- 149 项单元测试、2 项 Liquid Glass 聚焦移动端 E2E、生产构建与 `git diff --check` 通过。
- 无障碍专项检查按用户要求不在范围内。

**Residual**

- [P3] Web `backdrop-filter` 无法实现原生 Liquid Glass 的实时物理位移贴图；当前以背景透传、明暗调整、几何高光、折射边和触摸形变做稳定近似。

final result: passed

## 语义色系统重构（2026-07-26）

**Source check**

- Apple Design Resources（iOS / iPadOS 27）：https://developer.apple.com/design/resources/
- Apple Dark Mode：采用语义色并让颜色随外观动态切换，避免在组件中硬编码浅色/暗色值：https://developer.apple.com/design/human-interface-guidelines/dark-mode
- Apple Materials：玻璃高光、材质填充和内容色分层处理，不把材质色当普通背景色复用：https://developer.apple.com/design/human-interface-guidelines/materials

**Implementation**

- 新增 `src/styles/colors.css` 作为唯一应用级语义色入口，定义 60 个 token，并为浅色/暗色提供同名映射。
- `tokens.css`、`theme.css`、`workbench.css`、Radar 与 iOS 样式继续保留兼容变量，但颜色值统一映射到语义层；组件优先消费 `--color-*`。
- 共享图生成器统一改用 `src/utils/shareImagePalette.ts`；9 个 Canvas 生成模块不再包含内联 hex / rgb(a) 颜色。
- 账号色统一为 FC / LG1 / LG2 / PT / MYT 五个语义映射；成功、警告、危险、信息、品牌与中性色不再互相借用。
- 对具有局部视觉含义的 Radar、Orbit、iOS Liquid Glass 渐变和高光保留精确值，避免用全局替换破坏现有明暗层级。

**Color inventory**

- 重构前：1,315 个 hex（567 种）、495 个 rgb(a)（348 种）。
- 重构后：826 个 hex（505 种）、475 个 rgb(a)（355 种）。
- 排除中央 `colors.css` 与分享图 palette 后，直接颜色为 1,132 处；按重构前同口径约减少 31%。
- 60 个应用语义 token 中有 58 个已被消费，未解析的 `--color-*` 引用为 0。
- 仍较集中的局部视觉文件：`radar.css`、`orbit.css`、`TaskSettlementDialog.vue`、`ios26-mobile.css`、`workbench.css`。这些主要是渐变、透明叠层、图表/状态组合与 Liquid Glass 细节，不作为跨组件品牌色来源。

**Rendered and interaction evidence**

- Desktop light：首页与本周小结均完成真实浏览器检查；主导航可从首页进入 `#/week`。
- Mobile 440px light/dark：本周小结布局、账号色、成功/警告状态、玻璃表面均完成检查；底部“任务”导航可进入 `#/plans/tasks`。
- 页面标题、有效内容、无框架错误覆盖层均通过；浏览器控制台只有 Vite 连接 debug 日志，无 warning/error。
- 截图：`C:\Users\T\AppData\Local\Temp\color-refactor-desktop-light.png`、`C:\Users\T\AppData\Local\Temp\color-refactor-desktop-week-light.png`、`C:\Users\T\AppData\Local\Temp\color-refactor-mobile-week-light.png`、`C:\Users\T\AppData\Local\Temp\color-refactor-mobile-week-dark.png`。

**Verification**

- `npx vue-tsc -b --pretty false`：通过。
- `npm test`：32 files / 149 tests，通过。
- `npm run build`：通过；保留既有主包 500 kB 提示，体积与基线基本一致。
- Desktop E2E：25 passed / 23 expected skipped / 0 failed。
- Mobile E2E：28 passed / 20 expected skipped / 0 failed。
- `git diff --check`：通过。

**Residual**

- [P3] 仍有组件级装饰色与半透明组合尚未提升为跨组件语义 token；后续新增界面不得直接复用这些字面量，应优先使用 `--color-*`，确有局部含义时在组件根节点定义本地 token。
- [P3] 分享图采用固定浅色导出 palette，与实时 UI 的明暗主题刻意分离；如未来支持暗色分享图，应新增命名 palette，而不是读取页面 CSS。

final result: passed
