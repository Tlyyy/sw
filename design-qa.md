# Design QA — 五条主线推进轨道

## Source and implementation

- Selected source: `C:\Users\T\.codex\generated_images\019f5181-3609-7853-987b-94658feb51f6\exec-ade86cfe-ebea-403f-9011-ecb57b4f08bc.png`
- Source size: 1487 × 1058
- Initial implementation: `docs/refactor/qa/mainline-1487x1058-populated-before.png`
- Initial comparison: `docs/refactor/qa/comparison-source-final.png`
- Final implementation: `docs/refactor/qa/mainline-1487x1058-pass2.png`
- Final comparison: `docs/refactor/qa/comparison-source-pass2.png`
- Supporting checks: `docs/refactor/qa/mainline-mobile-390x844.png`, `docs/refactor/qa/inventory-dialog-mobile-390x844.png`, `docs/refactor/qa/mainline-tablet-768x1024.png`, `docs/refactor/qa/inventory-center-1440x900.png`

## Viewports checked

- Desktop source match: 1487 × 1058
- Desktop secondary-page check: 1440 × 900
- Tablet portrait: 768 × 1024
- Mobile: 390 × 844

## Mandatory comparison

- Layout: the dark full-width navigation, title/action band, five equal account lanes, dense ledger grid, recent-change ledger, and shared-rules panel match the selected direction and order. All five accounts remain visible as rows without an account selector.
- Typography: the Chinese title hierarchy, compact ledger labels, numeric emphasis, account colors, and status chips now track the source density. Small operational text was increased one step after the first pass.
- Color and surfaces: navy header, warm off-white page, orange primary action, thin gray dividers, account colors, and restrained semantic status fills match the source intent. The implementation reuses existing product tokens and components.
- Copy and content: concept-only sample tasks were replaced by the application's real神兽 task calculations. Inventory values and deltas used during QA reproduce the source's five-account example, including LG2 `+2 / +3 / +20,000`.
- Icons and assets: existing application icons are retained. The final primary button uses text only instead of a fabricated camera glyph. Search and local-user controls use the existing icon component.
- Interactions: batch entry records all 15 inventory values plus an effective inventory date; two snapshots produce correct interval deltas; selecting an existing past date reloads that exact batch and exposes an explicit update action.
- Accessibility: the main workbench and history ledger expose table, row, header, and cell semantics. The dialog traps focus, marks the background inert, locks background scroll, restores focus, blocks stacked global search, and guards unsaved edits.
- Responsiveness: root-level horizontal overflow is absent at 390 and 768 pixels. The dense workbench and entry ledger scroll only inside their own containers. The mobile date field does not overflow and the dialog footer remains visible.

## Findings and iteration history

### Pass 1

- P1 data safety: changing to a past inventory date still carried the newest balances, and same-date writes looked like ordinary saves.
- P1 modal behavior: no focus trap, background inert state, body scroll lock, dirty-edit guard, or focus restoration.
- P2 mobile dialog: date help could crowd the date input and the save footer was not sticky.
- P2 fidelity: the header lacked the actual inventory date; the desktop tool cluster differed noticeably; status wording was more abstract than the source.
- P2 state styling: zero deltas inherited the positive orange tone.

### Pass 2 fixes

- Inventory entry now seeds from the exact selected date, otherwise the nearest earlier snapshot, and clears safely when no earlier classified inventory exists.
- Existing dates show an update warning and `更新该日快照`; first migration no longer classifies legacy total eggs as sellable regular eggs.
- Modal focus, inert background, scroll lock, keyboard isolation, unsaved-edit protection, semantic table roles, mobile date layout, and sticky actions were added.
- The top bar now shows local-user context and compact search; the action band shows the actual inventory date and weekday.
- Action states now use `可推进`, `银子可补齐`, or `卖普通蛋可补齐` when applicable. Neutral deltas use muted color.
- Final desktop comparison and mobile/tablet checks found no remaining P0, P1, or P2 issue in the rebuilt core flow.

## Final result

passed
