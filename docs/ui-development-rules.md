# 手机端 iOS 设计开发规则

本文件是万象册手机端 UI、交互和验收的强制规则。它描述未来开发必须遵循的标准；历史问题、截图和逐轮修复证据继续记录在根目录的 `design-qa.md`。

## 1. 设计基准与版本策略

1. 手机端必须严格遵循 Apple 当前最新公开的 Human Interface Guidelines、Apple Design Resources 和 Apple Developer 官方设计视频。
2. 规范优先级固定为：
   1. 当前最新 Apple HIG；
   2. 当前最新 iOS UI Kit、SF Symbols 和设备规格；
   3. Apple Developer 官方设计与实现视频；
   4. 用户提供的目标截图；
   5. 仓库现有实现与 `design-qa.md`。
3. GitHub、社区组件库、博客和其他应用只能用于了解 Web 实现方式，不能作为 iOS 设计规范来源。
4. 每次较大的手机端 UI 修改开始前，必须重新检查 Apple 官方资料，并在 QA 记录中写明检查日期和采用的 iOS 设计版本。
5. 截至 2026-07-26，Apple Design Resources 的最新公开基准为 iOS 27 / iPadOS 27。现有 `ios26-mobile.css` 是历史文件名，不代表未来开发继续锁定 iOS 26；后续实现必须以当时最新公开规范为准。
6. 本项目是 Web/PWA。可以高保真实现 iOS 的结构、层级、尺寸、动态外观与交互原则，但不得把 CSS 材质近似描述成原生 UIKit 或 SwiftUI 系统渲染。

官方入口：

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Apple Design Resources](https://developer.apple.com/design/resources/)
- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)

## 2. 主适配设备

### 2.1 第一验收目标

手机端的设计、实现和视觉验收必须首先以 **iPhone 16 Pro Max** 为准：

- 竖屏逻辑画布：`440 × 956 pt`
- 物理像素：`1320 × 2868 px @3x`
- 竖屏尺寸类别：Compact Width / Regular Height
- 横屏逻辑画布：`956 × 440 pt`
- 横屏尺寸类别：Regular Width / Compact Height

Web 端首先以 `440 × 956 CSS px` 验收全屏/PWA 逻辑画布。Playwright 的 iPhone 16 Pro Max Safari 描述器在浏览器栏占位后可见区约为 `440 × 763`；它必须作为第二个矮视口压力测试保留，而不能与完整设备画布混为一谈。页面必须使用动态视口与安全区，不能假定始终拥有完整的 956 px 内容高度。

### 2.2 强制兼容回归

在 iPhone 16 Pro Max 通过后，至少复核：

- `430 × 932`：iPhone 16 Plus / 15 Pro Max 等大屏尺寸
- `393 × 852`：iPhone 16 / 15 Pro 等主流尺寸
- `390 × 844`：iPhone 16e 等较窄尺寸
- `956 × 440`：iPhone 16 Pro Max 横屏
- `1440 × 900`：桌面端回归

兼容回归可以重排内容，但不得改变核心任务、删除真实字段或产生横向滚动。

## 3. 页面与信息架构

1. 先确定页面任务、内容优先级和操作路径，再实现视觉样式；禁止只更换颜色、圆角、阴影或玻璃效果来冒充重构。
2. 每个手机页面必须有一个明确的首要任务。首页优先回答“现在应该做什么”，而不是完整展示所有数据。
3. 同一业务状态不得在首屏重复出现。周、日、账号等不同时间或数据粒度必须明确分层。
4. 手机端必须采用窄屏纵向结构；桌面表格不能直接压缩后搬到手机端。
5. 页面先按全屏、边到边内容设计，再使用安全区限制交互控件与关键文字。
6. 不允许在页顶和页底同时提供相同的一级导航。

## 4. 布局、安全区与滚动

1. 使用 `100dvh`、`VisualViewport` 和 `env(safe-area-inset-*)` 适配 Safari 工具栏、软键盘、Dynamic Island 和 Home Indicator。
2. 禁止硬编码状态栏、Dynamic Island 或 Home Indicator 的安全距离。
3. 内容可以延伸到浮动导航之后，但最后一个可操作内容必须能完整滚动到导航上方。
4. 所有核心页面必须满足：
   - `scrollWidth <= clientWidth`
   - 无意外水平滚动
   - 无固定层遮挡正文、输入框或最后一行数据
   - 软键盘打开后当前输入框与主要保存动作仍可到达
5. 大屏 iPhone 不能简单放大所有元素。宽度增加优先用于更自然的留白、更完整的信息和稳定的操作位置。

## 5. iOS 语义排版

手机端只能使用全局语义字体令牌，页面 scoped CSS 不得随意新增字号。

| 语义 | 字号 / 行高 |
| --- | --- |
| Large Title | `34 / 41` |
| Title 1 | `28 / 34` |
| Title 2 | `22 / 28` |
| Title 3 | `20 / 25` |
| Headline / Body | `17 / 22` |
| Callout | `16 / 21` |
| Subheadline | `15 / 20` |
| Footnote | `13 / 18` |
| Caption 1 | `12 / 16` |
| Caption 2 | `11 / 13` |

附加约束：

- 常规页面标题使用 Title 1；卡片或重要任务标题使用 Title 2 / Title 3。
- 主要按钮使用 Headline。
- 输入框和选择器使用 Body。
- 分段控件使用 Subheadline。
- Caption 2 只允许用于密集数据、短标签和表头，不能作为普通说明文字。
- 字体栈使用 Apple 系统字体优先；图标优先使用语义明确、视觉重量一致的现有矢量图标或 SF Symbols 对应图形。

## 6. 颜色与系统深色外观

1. 颜色必须按用途定义为语义令牌，例如 Primary Label、Secondary Label、System Background、Secondary Background、Separator、Tint、Success 和 Destructive；禁止页面直接建立一套固定颜色。
2. 不得把分隔线颜色用于正文，也不得把辅助文字颜色用于背景。
3. 品牌橙只用于主要动作、当前选择和需要强调的状态，不能给所有控件和整块导航染色。
4. 深色模式必须跟随 `prefers-color-scheme`，并在系统外观变化时即时更新；默认不提供应用内独立主题设置。
5. 深色界面不是浅色反相。必须分别校准：
   - Base 与 Elevated 背景层级
   - Primary、Secondary、Tertiary Label
   - Separator 与 Opaque Separator
   - 深色模式系统强调色
   - 图片、图标、图表和阴影
6. 新页面和新浮层必须同时在系统浅色、系统深色下完成验收，不允许出现固定白底漏层或深色文字消失。

## 7. Liquid Glass

1. Liquid Glass 是悬浮在内容之上的功能层，只用于导航、工具、搜索和临时交互控件。
2. 普通卡片、表格和内容区使用系统背景或标准 Material，禁止把整个内容层玻璃化。
3. 内容应能在玻璃层后继续滚动并适度透出，但文字和控件必须保持清晰。
4. 同一位置不得叠加多层 blur，也不得混用 Soft 与 Hard scroll edge。
5. iOS 手机端默认使用 Soft scroll edge；没有悬浮控件时不添加装饰性 scroll edge。
6. 中性状态使用无明显染色的玻璃；只有选中项可以使用低浓度品牌 tint。
7. Web 实现使用透明度、背景模糊、饱和度、迎光边缘、暗侧折射边与环境阴影做稳定近似，不能使用不透明白卡片冒充玻璃。

## 8. 导航与核心控件

1. Tab Bar 只承载一级导航，不承载新增、保存或搜索等动作。
2. 一级目的地在不同页面保持稳定，不因页面状态随机隐藏或改变顺序。
3. 本项目手机端固定保留 `今日 / 任务 / 周报` 三个一级目的地；全局搜索作为独立动作，不伪装成第四个 Tab。
4. Tab Bar、搜索按钮和底部主要动作必须考虑 Home Indicator 安全区。
5. 可见交互控件的有效点击区域不得小于 `44 × 44 pt`；录入输入与底部主要保存按钮保持 50 pt 高度基线。
6. 控件文字、图标和选中底板必须按视觉比例共同校准，不能只放大外壳。
7. Tab Bar 默认保持完整、稳定和可识别；不得把整条 Tab Bar 随滚动整体缩放。只有实现 Apple 当前系统式 compact anatomy 时才允许进入紧凑形态。

## 9. 弹层与录入

1. 库存、支出、行情等同一业务域使用一致的 Sheet 解剖结构：拖拽指示、标题栏、分段控件、正文与固定底部主要动作。
2. 同一 Sheet 不得因切换分段而改变标题栏、分段控件或底部按钮的位置。
3. 库存录入以五个账号和全部真实字段完整可达为尺寸基准；禁止通过删除字段或缩小正常文字来换取“看起来放得下”。
4. 内容超过可视高度时，只滚动正文区域；标题、模式切换和主要保存动作保持稳定。
5. 打开弹层必须保留来源页面上下文，取消后返回原路由和原滚动位置。

## 10. 动效与连续性

1. 动效必须解释状态变化、空间关系或操作结果，不能只为装饰。
2. Liquid Glass 控件的连续形变只动画 `transform` 和 `opacity`；禁止同时动画宽高、定位、网格轨道和大面积 blur。
3. 滚动触发的折叠与展开必须使用方向累计和迟滞阈值，不能因 1–2 px 抖动频繁切换。
4. 路由切换、Sheet 打开、Tab 选择和按钮按压必须保持操作对象连续，不出现闪白、跳位或遮罩先后错乱。
5. 动画完成后布局尺寸、点击区域和选中状态必须与静止状态一致。

## 11. 强制验收流程

每次手机端 UI 或交互修改必须完成：

1. 在 `440 × 956` 的 iPhone 16 Pro Max 竖屏视口首先完成实现和视觉复核。
2. 检查页面身份：URL、标题、有效 DOM、无错误覆盖层。
3. 检查系统浅色与系统深色的即时切换，不刷新页面。
4. 依次复核主页、周报、任务、资料、设置、录入页、全局搜索和所有相关 Sheet。
5. 验证 Tab Bar 在滚动前后保持三项标签稳定可见，并检查当前项、路由切换和独立搜索状态。
6. 验证 Sheet 打开、分段切换、输入、取消、保存后的返回位置和数据状态。
7. 检查无横向溢出、无内容截断、无底栏遮挡；深色模式逐页扫描固定白底、浅色表格和不可见文字漏层。
8. 检查控制台无 warning/error。
9. 保存关键页面截图；有用户参考图时制作同尺寸对照。
10. 通过单元测试、类型检查、生产构建和相关 E2E。
11. 再执行第 2.2 节的兼容视口回归。

未经 iPhone 16 Pro Max 主视口验收，不得仅凭 `393 × 852` 或 `430 × 932` 的结果宣称手机端完成。

## 12. 偏离规则

业务真实性高于视觉照抄。真实字段、数据关系或关键操作与 Apple 示例、用户参考图冲突时，可以做必要偏离，但必须：

1. 保留真实业务能力；
2. 仍使用最接近的 iOS 系统模式；
3. 在 `design-qa.md` 写明原因、影响与验收结果；
4. 不得以“Web 做不到”为由跳过可实现的结构、尺寸、状态或交互规范。

无障碍专项适配目前不作为本阶段交付门槛，但这只是当前项目范围，不是永久禁止规则，也不能作为破坏系统语义、系统外观或基础可操作性的理由。

## 13. 当前工程基线

当前重构已经建立以下手机端基线，后续不得无意回退：

- 首页采用“下一步、今日进度、优先账号、本周脉搏”的任务导向结构。
- 一级导航只保留底部 Tab Bar；搜索是独立按钮。
- Tab Bar 使用 Regular Liquid Glass，滚动时保持三项标签完整稳定，不再整体缩放。
- 库存、支出和行情共用上下文录入 Sheet。
- 五账号库存是录入 Sheet 的核心尺寸与完整显示基准。
- 全站手机端使用统一 iOS 语义排版令牌。
- 全局搜索使用移动端全屏搜索工作区。
- 系统深色外观实时跟随 iOS，不保存独立主题偏好。
- 当前规范覆盖集中在 `src/styles/ios-latest-mobile.css`；历史 `ios26-*` 名称只作为兼容钩子。
- 数据中心与设置页使用单行分段导航和 iOS 分组表单层级。
- 录入 Sheet 接入 VisualViewport，矮视口和软键盘出现时只压缩内部正文区。
- 主页、周报、任务、资料、设置、录入、搜索和录入 Sheet 已建立浅色/深色回归范围。
