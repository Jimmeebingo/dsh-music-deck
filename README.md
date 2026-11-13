# Music deck

[![platform](https://img.shields.io/badge/platform-Windows-0078d4)](#系统要求)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](#实现原理)

DSH（DeepSeek Harness）的悬浮音乐播放器。它不接任何音乐服务的私有接口，只读 Windows 系统级的媒体会话（GSMTC），可显示 QQ音乐、网易云音乐、Spotify 等向系统发布媒体会话的播放器；具体信息与控制能力取决于客户端提供的支持。

<!-- 截图：把图片放进 docs/ 后取消下面的注释
<p align="center">
  <img src="docs/collapsed.png" width="120" alt="折叠状态">
  <img src="docs/card.png" width="320" alt="展开状态">
  <img src="docs/compact.png" width="180" alt="窗口化紧凑模式">
</p>
-->

## 功能

- 右下角常驻圆形封面 + 播放/暂停的胶囊，点开是完整卡片。
- 显示正在播放的曲目：封面、歌名、歌手、专辑、进度（App 提供时间轴时）。
- 控制：上一首 / 播放暂停 / 下一首；播放器向系统提供跳转能力时，进度条可点击跳转。不支持的操作会禁用。
- 多个播放器同时开着时，点来源标签切换控制对象。
- 在卡片内切到另一个来源并开始播放时，会先暂停正在播放的那个客户端。
- 卡片可拖动，吸附在左右两侧；窗口化时自动切换成不带歌名的紧凑布局。
- 位置、展开状态存在浏览器 localStorage，重启后保留。

## 系统要求

- DSH 宿主运行在 Windows 10 1809（build 17763）及以上，或 Windows 11；使用系统自带的 Windows PowerShell 5.1。
- [DSH](https://github.com/deepseek-ai) 桌面版或 Web 版
- 不需要任何账号、API key 或付费订阅

在非 Windows 平台上插件会安静地停在未激活状态，不会报错。

播放器需要在 DSH 宿主所在的电脑、同一 Windows 登录会话中运行，并向系统发布 SMTC 媒体会话。远程访问 DSH Web 版时，读取的是宿主电脑上的播放器，不是浏览器所在电脑的播放器。没有发布 SMTC 会话的客户端或版本不会出现在来源列表中；插件不会为它们自动添加 SMTC 支持。

## 安装

本仓库当前版本为 **1.0.1**，npm 的 `dsh-music-deck` 包仍为 **1.0.0**。安装当前版本时，在 DSH 里 **设置 → 插件 → 安装 bundle**，输入 GitHub 地址（需要宿主电脑可用的 Git）：

```
git+https://github.com/Jimmeebingo/dsh-music-deck.git
```

也可以将下方市场索引添加到 Discover，由索引安装钉住的代码版本：

```
https://raw.githubusercontent.com/Jimmeebingo/dsh-music-deck/main/market/index.json
```

如果需要 npm 上已发布的 1.0.0，输入包名：

```
dsh-music-deck
```

安装后刷新页面，右下角出现播放器。

其他两种方式：

- **从插件市场**：把 `market/index.json` 的 raw 地址添加到 Discover 后搜索「音乐台」。
- **从源码**：克隆本仓库，把安装目标指向仓库目录。

> 包名安装不需要本机安装 Git。已有链接安装的开发副本请直接更新原目录，不要从 npm 覆盖安装。

## 使用

| 操作 | 效果 |
|---|---|
| 点胶囊 | 展开卡片 |
| 点卡片右上角 `⌄` | 收起回胶囊 |
| 点来源标签（左侧色点 + 名字） | 在多个播放器之间切换，选择的来源会被记住 |
| 拖动卡片 | 左右吸附；纵向自由，越过屏幕中线换边 |
| 右上角 `←` / `→` | 一键换到另一侧 |
| 右上角回位按钮 | 复位到右下角（位置改过才显示） |
| 右键卡片 | 弹出菜单，可隐藏卡片 |

窗口化（视口宽度 < 1280px 或小于屏幕宽度的 86%）时，卡片自动变成两行紧凑布局：上行来源，下行封面 + 三个控制键。

### 多个播放器同时存在时

浏览器标签页、短视频 App 也会向系统发布会话。选择顺序是：

1. 你手动切换过的来源（记住，刷新后不变）
2. 系统声明为音乐且正在播放的会话（不局限于品牌），优先选当前音乐来源；类型缺失时回退到已识别的音乐客户端
3. Windows 标记为当前的会话且正在播放
4. 任意正在播放的会话
5. 剩下的按当前会话 → 第一个

系统声明为音乐的播放来源会优先于短视频来源；不认识的播放器会显示它的应用名而不是统一的「播放器」。

### 设置

| 项 | 作用 |
|---|---|
| 卡片不透明 | 开 = 实色底；关 = 磨砂半透明 |
| 窗口化时自动缩小 | 关掉后窗口化也保持完整卡片 |
| 切换音源时自动暂停 | 关掉后允许多个客户端同时出声 |
| 复制诊断信息 | 复制所有会话的 ID / 进程 / 状态 / 音量，反馈问题用 |

## 实现原理

```
┌─ DSH Web 页面 ─────────────────────────┐
│  client.js  React 组件（悬浮播放器）    │
│      ↕ fetch /music-deck/state,cmd,cover│
├─ DSH Host（Node）──────────────────────┤
│  index.js  三条本地路由 + 子进程管理    │
│  ↕ %TEMP%\dsh-music-deck-<pid>-<random>\ │
├─ PowerShell 常驻代理 ──────────────────┤
│  smtc.ps1  轮询 GSMTC，转发控制指令     │
│  Cover.cs  运行时编译，读专辑封面       │
└────────────────────────────────────────┘
```

几个值得说明的取舍：

- **封面为什么要编译 C#**：PowerShell 拿到的 WinRT 流对象是裸 COM 对象，无法投影成 .NET 接口，`AsStreamForRead`、`DataReader`、强转全部失败。所以 `Cover.cs` 在首次启动时由系统自带的 `csc.exe` 对着 `C:\Windows\System32\WinMetadata` 编译一次，从内存加载；读取跑在 MTA 线程上，否则 `OpenReadAsync` 会永远停在 `Started`。
- **为什么用文件通信**：代理是长期运行的 PowerShell 循环，用 `state.json` 与命令队列交换，避免 stdout 解析和每次轮询起新进程。指令一条一个文件，快速连点不会互相覆盖。代理退出时宿主自动重启它。
- **不抓接口**：没有调用 QQ音乐 / 网易云的任何私有 API，没有绕过 DRM，没有抓音频流。

## 已知限制

| 限制 | 说明 |
|---|---|
| 只控制已打开并发布 SMTC 会话的客户端 | 暂停的会话也可被识别；插件不会替你启动或登录音乐 App |
| 控制能力由播放器提供 | 歌名、封面、进度、跳转和上下曲是否可用取决于客户端实际发布的数据及控制能力 |
| 互斥只挂在播放上 | 卡片内点「播放/暂停」会暂停其他来源；点「下一首/上一首」不会 |
| 封面可能缺失 | 部分 App 暂停时不发布缩略图，此时退回渐变色块 |
| 进度条可能不显示 | App 不发布时间轴时（QQ音乐、网易云常见）隐藏进度条 |
| 网易云音乐不显示专辑名 | 它的 `AlbumTitle` 字段是空字符串；QQ音乐、Spotify 都有值 |
| 未识别的服务显示为「播放器」 | 按进程名子串匹配，认不出时功能仍在，只是标签是通用样式 |

## 排错

先跑自检脚本，它会列出当前系统里所有媒体会话和曲目信息：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File agent\sessions.ps1
```

| 现象 | 检查 |
|---|---|
| 卡片根本不出现 | 插件列表里是否启用；刷新页面；DevTools Console 有没有 `slot entry crashed` |
| 有卡片但一直「没有正在播放的音乐」 | 跑上面的脚本。里面没有对应 App → 那个 App 没发布会话，插件看不到 |
| 封面是渐变色块 | 脚本里 `artwork : no` 就是 App 没提供缩略图 |
| 显示成灰色「播放器」 | 进程名没被识别，功能仍可用；提 issue 附上脚本里的 `app` 行 |
| 服务未就绪提示常驻 | 代理起不来，看 `%TEMP%\dsh-music-deck-*\cover-error.txt` 与 DSH 日志 |

## 项目结构

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半边：三条本地路由、子进程生命周期 |
| `client.js` | Client 半边：悬浮播放器、位置记忆、紧凑布局、设置面板 |
| `agent/smtc.ps1` | 常驻代理：轮询 GSMTC、执行控制指令 |
| `agent/Cover.cs` | 运行时编译的专辑封面读取器 |
| `agent/Volume.cs` | 每应用音量（Core Audio 会话） |
| `agent/sessions.ps1` | 自检脚本（不参与运行） |
| `market/build-index.mjs` | 生成插件市场索引 |
| `cordis.patch.yml` | 插件在 DSH 里的注册行 |
| `locale/*.json` | 插件列表里的标题与描述 |

## 开发

- 改 `client.js`、`locale/`：刷新页面即可生效。
- 改 `index.js`、`agent/`：需要在 DSH 插件列表里禁用再启用，重启代理进程。
- 改 `cordis.patch.yml` 或 `package.json` 的 `name`：需要重新安装 bundle。
- 发版：改 `package.json` 的 `version`，提交推送后跑 `node market/build-index.mjs`，再提交 `market/index.json`。
- 测试：`npm test`；包含来源选择与接口边界测试，Windows 上还运行 PowerShell 5.1 / COM 回归测试。非 Windows 平台跳过原生测试。

> 编辑 `package.json` / `locale/*.json` 时不要写入 UTF-8 BOM —— DSH 读取包清单时按纯 JSON 解析，带 BOM 会直接安装失败。

## 隐私

- 不访问外部音乐服务：前端只请求 DSH 宿主的 `/music-deck/` 路由。远程使用 Web 版时，数据会在浏览器和宿主之间传输。临时曲目信息和封面写入宿主的 `%TEMP%\dsh-music-deck-<pid>-<random>`，插件退出时清理。
- 不收集数据、不含遥测。
- 浏览器 localStorage 保存位置、展开状态、手选来源与界面设置。

## 许可

[MIT](LICENSE)。图标为原创 SVG，未使用任何音乐服务的商标或 Logo。

「QQ音乐」「网易云音乐」「Spotify」是其各自所有者的商标，本项目与它们没有关联，也未获其背书。
