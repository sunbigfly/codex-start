<p align="center">
  <strong>Codex Start</strong><br/>
  <sub>Interactive TUI Manager for Codex API Profiles</sub>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> &middot;
  <a href="#cli-reference">CLI Reference</a> &middot;
  <a href="#keyboard-shortcuts">Shortcuts</a> &middot;
  <a href="#architecture">Architecture</a>
</p>

---

**Codex Start** (`cs`) 是一个终端原生的多 Profile 管理器，为 [OpenAI Codex CLI](https://github.com/openai/codex) 提供开箱即用的配置切换、连接测试和参数覆盖能力。

使用 [Ink](https://github.com/vadimdemedes/ink) (React for CLI) 构建，运行在任何支持 Node.js 的终端上。

### 解决什么问题

Codex CLI 依赖 `~/.codex/config.toml` + `auth.json` 做全局配置。当你需要在多个 API provider / model / 参数组合间频繁切换时，手动编辑文件既繁琐又容易出错。

`cs` 把每套配置封装为 **Profile**，启动时自动注入对应的 `config.toml` + `auth.json`，用完自动还原。

---

## Features

| 能力 | 说明 |
|------|------|
| **多 Profile 管理** | 增 / 删 / 改 / 克隆 / 排序 / 设默认，每个 Profile 独立保存 URL + Key + 全部参数覆盖 |
| **一键启动** | `cs` 启动默认 Profile；`cs 2` 按序号；`cs run deepseek` 按名称模糊匹配 |
| **连接测试** | 单个 / 批量测试，含耗时统计、15s 超时保护、结果持久化 |
| **参数覆盖** | 40+ 配置项分 11 个分类，支持 Profile 局部覆盖与全局同步 |
| **模型自动发现** | 编辑 model 字段时可直接调用 `GET /v1/models` 拉取 provider 实际支持的模型列表 |
| **配置预览** | 注入前预览完整 `config.toml` 快照，高亮被 Profile 覆盖的字段 |
| **导入 / 导出** | JSON 格式，导出时 API Key 自动掩码，方便团队共享 |
| **模糊搜索** | `cs list` 中按 `/` 实时过滤 Profile 列表 |
| **全键盘主题切换** | 任意界面随时按大写 `W` 热切换极客主题（Mocha, Nord, Dracula等） |
| **历史快照** | 每次写入全局配置自动快照，支持一键回滚到任意历史版本 |
| **中 / 英双语** | `l` 键即时切换界面语言 |
| **自动补全** | `cs run <Tab>` 支持原生 Shell 名称智能联想补全 |

---

## Quickstart

### 手免安装运行（推荐🌟）

只需装有 Node.js 即可直接无痕运行，完全无需全局安装：

```bash
npx codex-start
```

### 传统全局安装

```bash
# 全局安装
npm install -g codex-start

# 或从源码
git clone https://github.com/sunbigfly/codex-start.git
cd codex-start && npm install && npm link
```

### 30 秒上手

```bash
# 1. 添加第一个 Profile
cs add

# 2. 查看所有 Profile
cs list

# 3. 直接启动默认 Profile
cs

# 4. 进入配置管理面板
cs config
```

---

## CLI Reference

```
cs                       启动默认 Profile
cs <N>                   按序号启动（如 cs 2）
cs run <name>            按名称模糊匹配启动
cs list | ls             交互式 Profile 列表
cs config | c            配置管理 TUI
cs add                   添加新 Profile
cs test                  连接性测试
cs export [path]         导出 Profiles（API Key 掩码）
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
Enter        开始测试
Space        勾选 / 取消 Profile（Batch 模式）
a            全选 / 全不选
u / i        Unified Model / Per-profile 策略
Tab / ->     切换到模型选择区
Esc          返回
```

---

## Architecture

```
codex-start/
  bin/cs.js              入口：tsx 透传启动 app.tsx
  src/
    app.tsx              CLI 路由 + cs list TUI
    utils.ts             maskApiKey / fuzzyMatch 工具
    store.ts             JSON 持久化 (~/.codex-start/data.json)
    injector.ts          config.toml + auth.json 注入 / 还原
    theme.ts             Catppuccin Mocha 色板 + 符号表
    types.ts             Profile / AppStore 类型定义
    components/
      ConfigUI.tsx       cs config 主控组件
      config/
        constants.ts     40+ 字段定义 + 模型列表 + 分类
        OverridesPanel.tsx  参数覆盖表格（滚动视口）
        FieldEditor.tsx  字段编辑器（text/select/combo/bool + Fetch Models）
        panels/
          AddProfilePanel.tsx   添加 Profile 向导
          DeleteProfilePanel.tsx 删除确认
          HistoryPanel.tsx       历史快照列表
          TestUI.tsx             单测 / 批量测试面板
```

### 数据流

```
Profile 选择 --> injectProfile() --> 写 ~/.codex/config.toml + auth.json
                                      |
                                      v
                               spawn('codex', args)
                                      |
                                      v
                               退出后 restoreBackup() --> 还原为原始配置
```

---

## 配置存储

| 路径 | 用途 |
|------|------|
| `~/.codex-start/data.json` | Profiles / 备份快照 / 测试结果 / 历史记录 |
| `~/.codex/config.toml` | Codex CLI 运行时配置（启动时注入，退出后还原） |
| `~/.codex/auth.json` | API Key 注入点 |

---

## License

MIT
