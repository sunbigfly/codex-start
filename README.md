<p align="center">
  <strong>Codex Start</strong><br/>
  <sub>Interactive TUI Manager for Codex API Profiles</sub>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#cli-reference">CLI Reference</a> &middot;
  <a href="#keyboard-shortcuts">Shortcuts</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#friends">Friends</a>
</p>

---

**Codex Start** (`cs`) 是一个终端原生的配置（Profile）管家，专为 [OpenAI Codex CLI](https://github.com/openai/codex) 打造。

Codex 默认依赖 `config.toml` 配置。当你在多个 API 提供商、不同模型、不同参数之间频繁切换时，每次手动修改配置文件既繁琐又易错。`cs` 帮您把每一套配置环境封装为**独立的 Profile**。启动时自动将参数注入到全局环境，退出后无缝还原，全程**0污染**！

基于 [Ink](https://github.com/vadimdemedes/ink) (React for CLI) 构建，运行在绝大部分支持 Node.js 的终端。

---

## Features / 核心功能

- **多 Profile 大管家**: 增、删、改、克隆、自定义拖拽排序、设为默认。每个 Profile 独立保留其专属 URL、Key 及 40+ 参数覆盖！
- **一键极速点火**: `cs` 直接唤醒默认环境；`cs <序号>` 或 `cs run <名称>` 按名称模糊匹配快速启动。
- **连接性压力测试**: 支持单点与**一键批量测速**。自带延迟统计、15s 超时断路保护以及结果缓存。告别盲人摸象。
- **所见即所得的参数配置**: 内置沉浸式管理 TUI。支持动态预览注入后的 `.toml`；11 大分类参数分层管理。
- **云端模型动态感知**: 编辑模型名时，一键拉取服务商真实的 `GET /v1/models` 模型列表。
- **自动快照与穿梭**: 每当更新全局配置系统都会帮你自动建立快照，支持一键回溯旧时光！
- **离线分享与 JSON 流转**: 自带 API Key 脱敏机制的安全 Export/Import，轻松跟团队共享整套设定。
- **原生终端的极致体验**: 
  - TUI 界面任意位置按大写 `W` 热切换极客主题（Mocha, Nord, Dracula等）。
  - 支持中英文无缝切换（按 `l` 键）。
  - 接入原生 Shell 深度智能补全 (`cs run <Tab>`)。

---

## Quickstart

**零感体验（推荐）**

仅需 Node.js 即可直接无痕运行：

```bash
npx codex-start
```

**传统全局安装**

```bash
# 全局安装 (NPM)
npm install -g codex-start

# 或从源码搭建
git clone https://github.com/sunbigfly/codex-start.git
cd codex-start && npm install && npm link
```

**30 秒快速上手**

```bash
cs add        # 1. 建立首个专属 Profile
cs test       # 2. 测一下连通性 
cs config     # 3. 开启 TUI 配置参数面板进行微调
cs            # 4. 直接起飞体验！
```

---

## CLI Reference

```
cs                       启动默认 Profile
cs <N>                   按序号启动（如 cs 2）
cs run <name>            按名称模糊匹配启动
cs list | ls             交互式 Profile 列表 TUI
cs config | c            配置管理面板 TUI
cs add                   添加新 Profile
cs test                  连接性测试面板
cs export [path]         安全导出 Profiles（API Key 脱敏）
cs import <path>         从 JSON 文件导入 Profiles
cs --setup-completion    在系统 (.zshrc/.bashrc) 中一键安装智能补全
```

---

## Keyboard Shortcuts

### `cs list` -- Profile 列表

```
Enter        启动选中 Profile
e            编辑
a            添加
c            克隆
t            测试连接
x            导出
/            搜索过滤
Space        设为默认
J / K        上移 / 下移排序
Esc          退出
```

### `cs config` -- 参数面板

**左栏 (Profile 列表)**

```
Enter / ->   进入右栏编辑
a            添加     c   克隆     d   删除
t            测试     x   导出     h   历史回滚
Space        设默认   l   切换语言
J / K        排序     Esc 退出
```

**右栏 (参数覆盖)**

```
Enter / ->   编辑当前字段值
g            同步专属值到全局 config.toml
p            预览注入后的完整配置
Tab          跳转下一分类
Up / Down    逐项导航
l            切换语言
Esc / <-     返回左栏
```

### 测试面板

```
b            切换 Single / Batch 模式
Enter        开始全部/选定测试
Space        勾选 / 取消 Profile（Batch 模式）
a            全选 / 全不选
u / i        Unified Model / Per-profile 策略
Tab / ->     切换到模型选择区
```

---

## Architecture

```
codex-start/
  bin/cs.js              CLI 原生入口
  src/
    app.tsx              完整路由 + ListUI 主页
    store.ts             JSON 本地存储 (~/.codex-start/data.json)
    injector.ts          配置挂载 / 安全还原代理
    theme.ts             Catppuccin 等主题色板及符号系统支持包
    types.ts             Profile 的核心数据结构规范
    components/
      ConfigUI.tsx       系统主控控制台
      config/
        constants.ts     40+ 关键配置、分类结构与渲染规则数据字典
        OverridesPanel.tsx 参数表格容器
        FieldEditor.tsx  类型化数据编辑器（包含动效拉取组件）
```

---

## 配置存储

| 路径 | 用途 |
|------|------|
| `~/.codex-start/data.json` | Profiles 数据存储、备份、测速等全局数据。 |
| `~/.codex/config.toml`     | Codex CLI 目标配置文件（`cs` 将在此热插拔配置）。 |
| `~/.codex/auth.json`       | 高清 API Key 隔离存储机制注入点。 |

---

## Friends

- [LINUX DO - 新的理想型社区](https://linux.do)

---

## License

MIT
