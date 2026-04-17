# Memory Inspector 页面重新设计

> **目标：** 将 Memory Inspector 从手动输入路径的文件浏览器，改为自动加载全局 + 配置项目的 memory 和配置文件的可视化面板，支持页面内编辑项目列表。

**架构：** 服务端新增 API 读写 `~/.view-claude.json` 配置文件（Windows: `%USERPROFILE%/.view-claude.json`）和各项目的 memory/settings 文件，前端展示为可折叠的分组面板。

**Tech Stack:** Svelte 5, Hono.js

---

## 数据源

```
~/.view-claude.json           ← 用户配置的项目路径列表
~/.claude/                    ← 全局配置目录
  ├── memory/                 ← 全局 memory 文件
  ├── agents/                 ← 全局自定义 Agent
  └── .claude.json            ← 全局主配置

project/.claude/              ← 项目级配置目录
  ├── memory/                 ← 项目 memory 文件
  └── settings.local.json     ← 项目权限

project/CLAUDE.md             ← 项目指令文件
```

## 页面布局

```
┌─────────────────────────────────────────────────┐
│ Memory Inspector                                │
├─────────────────────────────────────────────────┤
│ ▶ Global Memory (~/.claude/memory/)   [2 files] │
│   ┌─────────────────────────────────────────┐   │
│   │ 📄 USER.md     28B   Modified: ...      │   │
│   │ 📄 PROJECT.md  340B  Modified: ...      │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│ ▶ Global Agents (~/.claude/agents/)   [1 agent] │
│   ┌─────────────────────────────────────────┐   │
│   │ 🤖 code-reviewer.md    1.2KB            │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│ Projects                          [+ Add New]   │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ visual-view-claude-code-coding     [Remove] │ │
│ │ ▶ Memory (.claude/memory/)        [2 files]│ │
│ │   📄 USER.md     120B  Modified: ...        │ │
│ │   📄 PROJECT.md  340B Modified: ...         │ │
│ │ ▶ Settings (.claude/settings.local.json)    │ │
│ │   { permissions: {...} }                    │ │
│ │ ▶ CLAUDE.md                      [2.1KB]    │ │
│ │   Content preview...                        │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Add Project                                 │ │
│ │ Path: [ /path/to/project        ] [Save]    │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 交互逻辑

1. **页面加载：** 自动读取 `~/.view-claude.json`，对每个项目拉取 memory + 配置文件信息
2. **全局区域：** 展示 `~/.claude/memory/` 和 `~/.claude/agents/`，点击文件展开内容预览
3. **项目区域：** 每个项目可展开/收起 memory 文件、settings、CLAUDE.md
4. **文件预览：** 点击文件后在下方展开显示内容（前 50 行），支持全屏展开
5. **添加项目：** 输入框填写项目路径，点击 Save 追加到 `~/.view-claude.json` 并刷新
6. **删除项目：** 点击项目卡片的 Remove 按钮，确认后从配置中移除

## API 设计

### 新增接口

**1. `GET /memory/config`**
返回 `~/.view-claude.json` 中的项目列表

```json
{ "projects": ["/path/to/project1", "/path/to/project2"] }
```

**2. `POST /memory/config`**
添加项目

```json
{ "action": "add", "path": "/path/to/new-project" }
```

**3. `DELETE /memory/config`**
删除项目

```json
{ "action": "remove", "path": "/path/to/remove" }
```

**4. `GET /memory/projects/data`**
返回所有配置项目的 memory 文件 + settings + CLAUDE.md 元信息

```json
{
  "/path/to/project1": {
    "name": "project1",
    "memoryFiles": [{ "name": "USER.md", "size": 120, "modified": "..." }],
    "hasSettings": true,
    "settingsContent": "{...}",
    "hasClaudeMd": true,
    "claudeMdSize": 2100
  }
}
```

### 已有接口（复用）

- `GET /memory` — 列出指定目录下的 memory 文件
- `GET /memory/content?path=` — 获取文件内容

## 文件变更清单

**服务端新增/修改：**
- `server/src/routes/memory.js` — 新增 config 路由（CRUD `~/.view-claude.json`）+ 批量获取项目数据
- `server/src/index.js` — 注册 memoryRoutes

**客户端新增/修改：**
- `web/src/stores/memoryConfig.js` — 新增 store：项目配置、全局 memory、全局 agents
- `web/src/views/MemoryInspector.svelte` — 完全重写
- `web/src/components/MemoryFileCard.svelte` — 新增：可展开的文件内容卡片组件
