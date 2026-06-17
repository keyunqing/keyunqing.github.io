# 声径 SoundPath

> 面向中文母语成年人的英语解码能力成长系统 —— 桌面应用

它不是背单词软件，也不是儿童拼读软件。它训练的是一种**能持续自我增长的能力**：
掌握英语拼写与发音之间的 106 条核心规律之后，你将「见词能读、听音能写」——
即使将来离开这个软件，每一个新单词都会自己变得好记。

## 产品理念

| 模块 | 设计 |
|:---|:---|
| 知识体系 | 16 个章节 × 106 条拼读规律 × 约 2000 个标注词（音块分解、音节、释义、例句） |
| 记忆体系 | 内置 **FSRS** 间隔重复算法，为每个单词独立建模「难度 + 记忆稳定性」，总在"将忘未忘"的最佳时机安排复习 |
| 学习体系 | 每条规律 = 讲解（看 + 听 + 例词探索）→ 引导练习（5 种题型：听音辨词 / 见词能读 / 听音能写 / 拼读组装 / 规律直觉）→ 例词自动进入记忆系统 |
| 成长体系 | 规律星图（点亮式知识地图）、等级与头衔、连续天数、五维能力雷达、学习热力图、16 项成就 |
| AI 体系 | 双层教练：**本地分析教练**（完全离线，基于真实数据生成每日简报与弱点诊断）+ 可选 **LLM 对话教练**（兼容 OpenAI 接口，自动携带学习数据上下文） |
| 语音 | 系统 TTS（Web Speech API），零成本、完全离线，支持选音与变速 |
| 数据 | 全部保存在本机，支持一键导出 / 导入备份 |

## 快速开始

```bash
cd soundpath
npm install          # 首次需要（已安装可跳过）
npm start            # 启动桌面应用
```

也可以在浏览器中使用：

```bash
npm run web          # 然后访问 http://localhost:5173
```

## 部署到 GitHub Pages

这个目录已经可以直接发布到 GitHub Pages，不需要额外打包。

仓库根目录下的 [.github/workflows/deploy-soundpath.yml](.github/workflows/deploy-soundpath.yml) 会在推送 `master` 时自动把 `soundpath/` 发布到 Pages。

需要在 GitHub 仓库设置中确认两项：

1. `Settings -> Pages -> Source` 选择 `GitHub Actions`
2. `Settings -> Pages -> Custom domain` 填写 `ikesman.app`，并开启 `Enforce HTTPS`

当前发布产物会自动包含 `CNAME` 文件，因此后续重新部署不会丢失自定义域名。

如果域名服务商不支持根域名 CNAME，请给 `ikesman.app` 配置 GitHub Pages 的 A 记录：

```text
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

可选再补充 4 条 AAAA 记录：

```text
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

## 常用脚本

| 命令 | 说明 |
|:---|:---|
| `npm start` | 启动 Electron 桌面应用 |
| `npm run web` | 浏览器预览（http://localhost:5173） |
| `npm test` | 核心逻辑测试（FSRS / 数据 / 练习生成 / 成长体系） |
| `npx electron tests/smoke.cjs` | 端到端冒烟测试（真实走完学习全链路） |
| `npm run build:data` | 从 `../phonics-app/data/rules-master.json` 重新编译课程数据 |

## 目录结构

```
soundpath/
├── electron/main.cjs        # Electron 主进程（内置静态服务）
├── scripts/
│   ├── serve.cjs            # 静态服务器（桌面端与浏览器共用）
│   └── build-course.mjs     # 数据管线：规则库 → 课程数据
├── data/course.json         # 编译后的课程数据
├── index.html
├── css/main.css             # 设计系统（深空夜航主题）
└── js/
    ├── fsrs.js              # FSRS 记忆调度算法（FSRS-5）
    ├── store.js             # 状态存储与持久化
    ├── course.js            # 课程引擎（解锁 / 掌握度）
    ├── scheduler.js         # 复习调度器
    ├── exercises.js         # 练习生成器（5 种题型）
    ├── gamify.js            # 成长体系（XP / 等级 / 成就 / 雷达）
    ├── coach.js             # AI 教练（本地分析 + LLM 接口）
    ├── audio.js             # 语音引擎
    ├── main.js              # 入口与路由
    └── ui/                  # 七个页面 + 共享组件
```

## AI 教练配置（可选）

「设置 → AI 教练接口」中填入任意 OpenAI 兼容服务即可：

| 服务 | API 地址 | 模型示例 |
|:---|:---|:---|
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| OpenAI | 留空 | `gpt-4o-mini` |
| 本地 Ollama | `http://localhost:11434/v1` | `llama3` |

Key 仅保存在本机。未配置时，本地教练的每日简报与弱点诊断完全可用。

## 致谢

本项目的拼读规则与词汇数据基于 [Phonics App](https://github.com/cocojojo5213/phonics-app)（MIT License）开发，特此致谢。
记忆调度算法基于开源的 [FSRS](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler) 研究成果。

## License

MIT
