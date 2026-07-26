# 重构决策记录

- 框架：Vue 3 + Vite + TypeScript。
- 路由：Vue Router Hash History，兼容当前静态服务器。
- 状态：Pinia 只保存可变状态，派生结果由纯函数计算。
- 数据：旧全局脚本完成一次性迁移后删除，新应用只读取经过 Zod 校验的目录数据。
- 样式：单一设计令牌与组件样式，不加载旧页面 CSS。
- 手机设计：以 Apple 当前最新公开 HIG 和 Design Resources 为准，历史 `ios26-mobile.css` 文件名不构成版本锁定。
- 主适配设备：iPhone 16 Pro Max，竖屏主验收视口为 440 × 956 pt；其他手机尺寸作为兼容回归。
- 手机 Shell：三项 Tab Bar 保持稳定，不再通过整栏缩放模拟 compact；导航、搜索和顶部操作采用 Regular Liquid Glass，内容卡片使用系统背景。
- 移动视口：440 × 956 验收全屏/PWA，440 × 763 单独验证 Safari 浏览器栏和矮视口压力；Sheet 使用 VisualViewport 保持底部操作可达。
- 发布：功能与数据验收完成后切换根入口，并删除旧页面、脚本和样式。
