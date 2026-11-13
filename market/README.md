# 插件市场索引

本目录提供两种独立材料：用户可自行添加的 DSH format 1 索引，以及向 awesome-dsh-plugin 社区列表投稿的 YAML。前者不代表已经通过社区收录；社区投稿步骤见 [SUBMISSION.md](SUBMISSION.md)。

| 文件 | 作用 |
|---|---|
| `build-index.mjs` | 从 `package.json` 和当前 git 提交生成 `index.json`，仓库地址取自 `git remote get-url origin` |

`index.json` 随仓库提供。Git 来源必须钉住真实存在、包含当前插件代码的 commit；npm 来源必须对应已经发布的版本。

## 发布步骤

当前 GitHub 代码为 1.0.1，npm 为 1.0.0，因此当前索引使用 Git 来源。先提交代码，再从该提交生成索引：

```bash
# 先提交插件代码，并确保该提交会推送到仓库
node market/build-index.mjs --git # 生成 market/index.json，钉住当前 HEAD
git add market/index.json
git commit -m "chore: market index"
git push
```

Git 来源要求 DSH 宿主可用的 Git。将来发布 npm 新版本并验证可下载后，才可以运行默认的 `node market/build-index.mjs` 改用 `{ "type": "npm" }`，安装走 `dsh-music-deck@<version>`，用户机器不需要 Git。不要用默认模式为尚未发布的 npm 版本生成索引。

```json
{
  "format": 1,
  "title": { "en": "Music deck", "zh": "音乐台" },
  "plugins": [
    {
      "name": "dsh-music-deck",
      "title": { "en": "Music deck", "zh": "音乐台" },
      "icon": "https://raw.githubusercontent.com/Jimmeebingo/dsh-music-deck/main/assets/icon-180.png",
      "repository": { "url": "https://github.com/<owner>/<repo>" },
      "metadata": { "keywords": ["music", "now-playing", "smtc", "windows"] },
      "versions": [
        {
          "version": "1.0.1",
          "publishTimestamp": 1794000000,
          "source": {
            "type": "git",
            "url": "https://github.com/<owner>/<repo>",
            "commit": "<40 位 commit SHA>"
          }
        }
      ]
    }
  ]
}
```

## 别人怎么用

DSH → **设置 → Discover / 插件市场 → 添加索引**，填：

```
https://raw.githubusercontent.com/Jimmeebingo/dsh-music-deck/main/market/index.json
```

填完就能搜到「音乐台」并一键安装。如果没有 Discover 页面，也可以直接照 README 的"从源码安装"手动指向仓库目录。

## 字段速查（格式 1）

必填：`format: 1`、`plugins[].name`、`plugins[].versions[].version`、`.publishTimestamp`（**秒**，不是毫秒）、`.source`。

`source` 两种：

- `{ "type": "npm" }` —— 包已发布到 npm，安装走 `name@version`
- `{ "type": "git", "url": "https://github.com/u/r", "commit": "<40 位小写 hex>", "path": "子目录（可选）" }`

插件在仓库根目录时省略 `path`。

`icon` 可以是绝对 URL、相对索引文件的路径，或 ≤32KB 的 `data:` URI。

## 版本更新时

改 `package.json` 的 `version`，提交代码，选择已发布的 npm 版本或已提交的 Git 代码作为来源，再生成并提交索引。索引里的包名必须与 `package.json` 一致。
