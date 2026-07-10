# 幻唐志账号管理系统

面向五账号资料、宠物装备、宝石升级、神兽任务、对比分析和内容发布的本地优先工作台。

## 在线访问

[https://tlyyy.github.io/sw/](https://tlyyy.github.io/sw/)

## 本地运行

```bash
npm install
npm run dev
```

生产构建与测试：

```bash
npm run build
npm test
npm run test:e2e
```

## 宝石行情识别

行情页支持拖放、文件选择和剪贴板粘贴截图。识别由浏览器端 PP-OCRv6 small 模型完成，截图不会上传；首次使用需要加载 OCR 运行时。确认后的六项价格会写入本地行情历史并形成趋势记录。

## 技术栈

Vue 3、Vite、TypeScript、Vue Router、Pinia、Chart.js、Vitest 和 Playwright。
