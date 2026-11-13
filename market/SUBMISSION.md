# DSH 市场投稿

按照 [awesome-dsh-plugin 贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) 准备。

## 投稿文件

本目录的 `submission/Jimmeebingo__dsh-music-deck.yml` 是投稿文件。向 `awesome-dsh-plugin/awesome-dsh-plugin` 提交 PR 时，只把它放到目标仓库的 `data/plugins/Jimmeebingo__dsh-music-deck.yml`。不要手动修改目标仓库的 README，也不要改其他插件条目。

- 分类：`ui`，悬浮播放器界面及系统媒体控制。
- `package.json` 已声明 `dsh.bundle.patch`，指向根目录的 `cordis.patch.yml`。
- 根包名、补丁插件名与私有市场索引中的插件名均为 `dsh-music-deck`。
- 市场图标为 GitHub 托管的 PNG；插件运行时继续使用原来的 SVG。
- 仓库需要公开、未归档、创建满 24 小时，并带有 `dsh-plugin` topic。
- 此插件从源码可直接安装，不需要构建步骤；npm 和 Release tarball 都是收录的可选项。

## 版本与安装边界

当前 GitHub 代码版本为 `1.0.1`；npm 已发布的版本仍为 `1.0.0`。本次索引使用 Git 来源，钉住包含 `1.0.1` 代码的完整 commit，不把未发布的版本声明成 npm 来源。

包的 `repository` 已指向本仓库。将来单独发布 npm 新版本后，市场才能从注册表关联该版本的元数据；YAML 不应添加 `npm:` 字段。

插件使用 Windows GSMTC，因此要求 Windows 10 1809 / build 17763 及以上、或 Windows 11，以及系统 Windows PowerShell 5.1。音乐软件必须在 DSH 宿主的同一电脑和登录会话中发布 SMTC。远程浏览器读取的是宿主上的媒体。不能承诺识别未提供 SMTC 的客户端或所有电脑上的所有播放器。

## 提交后的状态

把本项目更新到 GitHub 不等于已被市场收录。市场 PR 的 CI 和维护者评审通过并合并后才会进入列表。若被要求修改，推送到同一个投稿分支即可。
