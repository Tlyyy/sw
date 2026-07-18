# 项目台账

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

## 自动云同步

应用使用 InstantDB 做跨设备同步，公共应用 ID 已写入 `instant.config.ts`。业务数据始终先保存到当前浏览器，再由访问密码在浏览器内加密后上传；InstantDB 只接收密文。

应用所有者首次部署时必须先发布远端结构和权限规则；在这两条规则成功前不要公开部署新版：

```bash
npx instant-cli@latest login
npx instant-cli@latest push schema --app 80a03c7e-5599-470a-bafa-497807bda457 --yes
npx instant-cli@latest push perms --app 80a03c7e-5599-470a-bafa-497807bda457 --yes
```

当前固定 App ID 对应的加密工作区已经预置，因此可直接执行上面的命令。权限规则会禁止浏览器新建或删除工作区，只允许持有正确访问密码的设备更新这条密文。若将来更换 InstantDB App ID，必须先用管理员凭据预置同一个工作区，再发布 `create: false` 的权限规则；不要只替换 ID 后直接上线。

旧版密码校验值曾进入公开 Git 历史。权限发布后，先在本地运行新版，用原密码登录，等待“云端已同步”，然后在“设置 → 更换访问密码”中换成一条从未复用过、至少 16 个字符的新长密码。应用会通过带版本检查的事务原地重新加密云端数据；轮换成功后再部署新版。

中国大陆网络如果暂时无法连接 InstantDB，已勾选“记住 7 天”的设备仍可离线打开和编辑，网络恢复后继续同步。新设备、主动退出或未记住密钥后的首次解锁必须联网，以便用云端密文验证密码；连接失败不会删除浏览器中的业务数据。

## 宝石行情识别

行情页支持拖放、文件选择和剪贴板粘贴截图。识别使用浏览器端离线数字模板完成，不上传截图、不加载外部 CDN 或大型模型；确认后的六项价格会写入本地行情历史并形成趋势记录。

## 技术栈

Vue 3、Vite、TypeScript、Vue Router、Pinia、Chart.js、Vitest 和 Playwright。
