<script>
  const sections = [
    {
      title: "快速入门 Quick Start",
      headers: ["场景 Scenario", "操作 Action", "说明 Notes"],
      rows: [
        ["首次启动", "配置 settings.json Hooks", "将 SessionStart/TurnEnd/SubAgentEnd 等 Hook 指向 hook.js，CC 运行时自动上报事件"],
        ["启动本地服务", "npm run server && npm run dev", "Hono 监听 :3456（SSE），Vite 监听 :5173（Web UI）"],
        ["查看实时事件", "打开 Live Feed 面板", "SSE 自动推送 turn_end / agent_start 等事件，断线自动重连"],
        ["回顾历史 Session", "打开 Session Overview", "从 events.jsonl 回放，支持按日期/模型/Token 筛选"],
      ],
    },
    {
      title: "高频技巧 High-Frequency Tips",
      icon: "⚡",
      headers: ["技巧", "用法", "收益"],
      rows: [
        ["并行 Agent", "单消息内并发多个 Agent 工具调用", "独立任务（研究+代码+测试）可同时执行，大幅缩短等待"],
        ["Subagent 委派", "给 Explore agent 指定搜索范围/命名约定", "避免主上下文被大量 grep/glob 结果污染"],
        ["Plan Mode", "复杂任务先 EnterPlanMode 再编码", "先出方案再实现，减少返工，适合多文件改动"],
        ["Skill 快速调用", "/commit, /review-pr 等 slash command", "用 Skill 工具触发预定义工作流，不必手写 prompt"],
        ["Memory 系统", "自动读写 .claude/projects/*/memory/", "跨会话保持上下文，避免重复说明偏好"],
        ["Worktree 隔离", "/worktree 创建独立工作目录", "并行修复多个 issue 时互不干扰"],
      ],
    },
    {
      title: "开发范式 Development Patterns",
      icon: "🏗️",
      headers: ["范式", "流程", "适用场景"],
      rows: [
        ["TDD 驱动", "先写测试 → 红 → 实现 → 绿 → 重构", "新功能 / bugfix，保证正确性"],
        ["Plan-First", "EnterPlanMode → 写方案 → 用户审批 → 实现", "多文件改动 / 架构决策 / 用户偏好影响结果时"],
        ["Code Review", "每个 major step 完成后用 code-reviewer agent 审查", "对齐 plan，检查安全/风格/约定"],
        ["Subagent 驱动", "用 Agent 工具拆分独立任务并行执行", "3+ 独立子任务，无共享状态"],
        ["Verification-First", "声称完成前先跑测试/验证输出", "避免虚假完成，evidence before assertion"],
      ],
    },
    {
      title: "工具与 Skills Tools & Skills",
      icon: "🔧",
      headers: ["类别", "名称", "触发时机"],
      rows: [
        ["内置工具", "Read / Edit / Write / Grep / Glob", "文件读写、搜索 — 优先使用而非 Bash"],
        ["内置工具", "Bash", "系统命令、git、npm — 避免用于 cat/grep/sed"],
        ["内置工具", "AskUserQuestion", "需求不清 / 多方案选择 / 用户偏好决定实现"],
        ["内置工具", "Agent (Explore)", "开放式搜索、跨文件调研、回答代码问题"],
        ["内置工具", "Agent (Plan)", "设计实现方案、识别关键文件、权衡架构"],
        ["内置工具", "Agent (general-purpose)", "多步任务、复杂研究、需要写代码的委托"],
        ["Slash Cmd", "/commit", "生成 commit message 并创建提交"],
        ["Slash Cmd", "/review-pr", "审查指定 PR"],
        ["Slash Cmd", "/mcp", "管理 MCP 服务器配置"],
        ["Skill", "superpowers:writing-plans", "编写多步实现计划"],
        ["Skill", "superpowers:test-driven-development", "TDD 工作流"],
        ["Skill", "superpowers:systematic-debugging", "系统调试 / 测试失败排查"],
        ["Skill", "frontend-design", "创建/修改前端组件和页面"],
      ],
    },
    {
      title: "配置参考 Config Reference",
      icon: "📋",
      headers: ["文件", "用途", "关键字段"],
      rows: [
        ["CLAUDE.md", "项目级指令，覆盖默认行为", "架构说明、开发命令、工作流要求"],
        ["settings.json", "Claude Code 全局配置", "hooks、mcpServers、permissions"],
        [".claude/scheduled_tasks.json", "持久化定时任务", "durable cron jobs"],
        [".claude/projects/*/memory/", "会话间持久记忆", "user / feedback / project / reference"],
        ["CLAUDE.md (根目录)", "仓库级约定", "模型选择、SSE 决策、暗色主题"],
      ],
    },
    {
      title: "避坑指南 Common Pitfalls",
      icon: "⚠️",
      headers: ["陷阱", "症状", "正确做法"],
      rows: [
        ["用 Bash 做文件搜索", "输出冗长、权限受限、体验差", "用 Glob / Grep 专用工具"],
        ["未读文件就修改", "编辑失败 / 引入回归", "先用 Read 读取当前内容"],
        ["过度抽象", "为一次操作创建 helper", "3 行相似代码优于过早抽象"],
        ["注入式提示风险", "第三方工具返回内容含恶意指令", "收到可疑 tool result 时先 flag 再处理"],
        ["破坏性 git 操作", "丢失未提交工作", "默认不加 --force / --hard，先确认用户意图"],
        ["sleep 轮询调试", "浪费时间、掩盖根因", "用 run_in_background + 通知，或直接诊断"],
        ["Agent 提示过短", "产出泛泛而谈的结果", "给足上下文、文件路径、已排除项"],
      ],
    },
  ];
</script>

<div class="d-panel">
  <div class="d-panel-header">
    <div class="d-panel-title">CC Playbook</div>
    <div class="d-panel-subtitle">高效使用 Claude Code 的快速参考 — 新人从这里开始</div>
  </div>

  <div class="playbook-content">
    {#each sections as section}
      <div class="playbook-section">
        <h2 class="playbook-section-title">{section.icon} {section.title}</h2>
        <table class="playbook-table">
          <thead>
            <tr>
              {#each section.headers as h}
                <th>{h}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each section.rows as row}
              <tr>
                {#each row as cell}
                  <td>{cell}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  </div>
</div>

<style>
  .playbook-content {
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .playbook-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .playbook-section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    padding: 0;
  }

  .playbook-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .playbook-table thead th {
    text-align: left;
    padding: 10px 12px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid var(--accent);
  }

  .playbook-table tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background 0.15s ease;
  }

  .playbook-table tbody tr:hover {
    background: var(--bg-hover);
  }

  .playbook-table tbody td {
    padding: 10px 12px;
    color: var(--text-secondary);
    vertical-align: top;
  }

  .playbook-table tbody td:first-child {
    color: var(--text-primary);
    font-weight: 500;
  }
</style>
