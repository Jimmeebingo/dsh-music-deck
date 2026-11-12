# 插件市场索引

DSH 的插件市场**没有"提交审核"入口**：它读取的是**用户自己配置的索引 URL**，每个索引就是一份 JSON。所以"上架"= 把包发出去，再提供一份索引文件让别人添加。

| 文件 | 作用 |
|---|---|
| `build-index.mjs` | 从 `package.json` 和当前 git 提交生成 `index.json`，仓库地址取自 `git remote get-url origin` |

`index.json` 随发布提交提供，并指向已推送的源码 commit。更新索引时，必须先推送对应的源码，再生成并提交索引。

## 发布步骤

```bash
git push                                    # 先把代码推上去
node market/build-index.mjs                 # 生成 market/index.json
git add market/index.json
git commit -m "chore: market index"
git push
```

生成结果长这样（`format: 1`）：

```json
{
  "format": 1,
  "title": { "en": "Music deck", "zh": "音乐台" },
  "plugins": [
    {
      "name": "dsh-music-deck",
      "title": { "en": "Music deck", "zh": "音乐台" },
      "icon": "https://raw.githubusercontent.com/Jimmeebingo/dsh-music-deck/main/icon.svg",
      "repository": { "url": "https://github.com/Jimmeebingo/dsh-music-deck" },
      "metadata": { "keywords": ["music", "now-playing", "smtc", "windows"] },
      "versions": [
        {
          "version": "1.0.0",
          "publishTimestamp": 1794000000,
          "source": {
            "type": "git",
            "url": "https://github.com/Jimmeebingo/dsh-music-deck",
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

改 `package.json` 的 `version`，提交推送，再跑一次 `node market/build-index.mjs` 并提交索引 —— 旧版本的安装记录会被识别为「有更新」。
