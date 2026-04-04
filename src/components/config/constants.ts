export interface FieldDef {
  key: string;
  label: string;
  desc: string;
  descEn?: string;
  type: 'text' | 'select' | 'bool' | 'combo';
  group?: string;
  options?: string[];
}

// Source: https://developers.openai.com/codex/models (2026-04)
const CODEX_MODELS = {
  recommended: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.3-codex-spark'],
  alternative: ['o4-mini', 'gpt-5.2-codex', 'gpt-5.2', 'gpt-5.1-codex-max', 'gpt-5.1', 'gpt-5.1-codex', 'gpt-5-codex', 'gpt-5-codex-mini'],
  legacy: ['o3', 'o1', 'o3-mini', 'gpt-4o', 'gpt-4.5-preview'],
  thirdParty: ['claude-3.7-sonnet', 'claude-3.5-sonnet', 'deepseek-chat', 'deepseek-reasoner', 'qwen-max', 'gemini-2.5-pro'],
};
export const ALL_MODELS = [...CODEX_MODELS.recommended, ...CODEX_MODELS.alternative, ...CODEX_MODELS.legacy, ...CODEX_MODELS.thirdParty];

export const TABS = [
  { id: 'cfg_profile', title: '基础:连接配置' },
  { id: 'cfg_model', title: '核心:大模型' },
  { id: 'cfg_reasoning', title: '心智与推理' },
  { id: 'cfg_context', title: '核心:上下文控制' },
  { id: 'cfg_safety', title: '安全及日志' },
  { id: 'cfg_env', title: '交互与环境' },
  { id: 'cfg_features', title: '高级实验特性' },
  { id: 'cli_bounds', title: 'CLI:覆盖安全' },
  { id: 'cli_workspace', title: 'CLI:挂载目录' },
  { id: 'cli_provider', title: 'CLI:本地引擎' },
  { id: 'cli_remote', title: 'CLI:全天候远端' },
  { id: 'cli_ui', title: 'CLI:执行界面' },
];

export const OVERRIDE_FIELDS: FieldDef[] = [
  // Profile Basics
  { key: 'name', label: '配置别名', desc: '环境配置别名，用于在列表中快速识别和切换', descEn: 'Identify alias name of the environment configuration profile for quick selection', type: 'text', group: 'cfg_profile' },
  { key: 'base_url', label: 'API Base URL', desc: '服务商的 API 请求网关地址 (例如 https://api.openai.com/v1)', descEn: 'The root gateway Base URL for model API inferences (e.g. https://api.openai.com/v1)', type: 'text', group: 'cfg_profile' },
  { key: 'api_key', label: 'API Key', desc: '请求模型服务所需的认证密钥 (Bearer Token)', descEn: 'Authentication bearer token used to prove your identity when requesting the remote API', type: 'text', group: 'cfg_profile' },

  // config.toml - Language Model API
  { key: 'model', label: 'model', desc: '系统所使用的核心语言模型 (如 gpt-5.4, o4-mini)', descEn: 'Model the agent should use (e.g., gpt-5.4, o4-mini)', type: 'combo', options: ALL_MODELS, group: 'cfg_model' },
  { key: 'wire_api', label: 'wire_api', desc: '底层的 API 通信数据传输协议 (responses 或 completions)', descEn: 'Underlying protocol gateway (responses or completions)', type: 'select', options: ['responses', 'completions'], group: 'cfg_model' },
  { key: 'service_tier', label: 'service_tier', desc: '云端集群负载均衡路由层级：fast (极速高优) 或 flex (均衡批处理排队)', descEn: 'Node routing tier layer: fast (high priority) or flex (batch load balancer)', type: 'select', options: ['fast', 'flex'], group: 'cfg_model' },
  { key: 'model_verbosity', label: 'model_verbosity', desc: '非代码生成的日常对话文本的长度与详尽程度 (low / medium / high)', descEn: 'Controls the verbosity degree for conversational generations (low/medium/high)', type: 'select', options: ['low', 'medium', 'high'], group: 'cfg_model' },

  // config.toml - Agent Reasoning Engine
  { key: 'model_reasoning_effort', label: 'model_reasoning_effort', desc: '分配给底层大模型隐式思维链 (CoT) 的推理算力额度 (none ~ xhigh)', descEn: 'Reasoning capability allocation compute allowance for standard tasks (none ~ xhigh)', type: 'select', options: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'], group: 'cfg_reasoning' },
  { key: 'plan_mode_reasoning_effort', label: 'plan_mode_reasoning_effort', desc: '在专职制定规划和深入重构时，允许模型使用的最深层推理算力级别', descEn: 'Deeper effort computation used strictly when framing plans and subtasks', type: 'select', options: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'], group: 'cfg_reasoning' },
  { key: 'model_reasoning_summary', label: 'model_reasoning_summary', desc: '用一个附属节点将过长且冗余的原生推理过程压缩并转化为简短总结', descEn: 'Generate collapsed thinking traces via secondary evaluation (auto/concise/detailed)', type: 'select', options: ['auto', 'concise', 'detailed', 'none'], group: 'cfg_reasoning' },
  { key: 'hide_agent_reasoning', label: 'hide_agent_reasoning', desc: '在控制台输出中隐藏长篇的思维推理流程，保持界面整洁', descEn: 'Suppress verbose background thinking traces from rendering in user interfaces', type: 'bool', group: 'cfg_reasoning' },
  { key: 'show_raw_agent_reasoning', label: 'show_raw_agent_reasoning', desc: '[调试用] 关闭内建排版格式，以无缓冲流形式强制打印最原始的推理输出', descEn: 'Flatten parsed output blocks to show the raw incoming token stream for debugging', type: 'bool', group: 'cfg_reasoning' },

  // config.toml - Context & Compaction
  { key: 'model_auto_compact_token_limit', label: 'model_auto_compact_token_limit', desc: '触发历史记忆和死代码折叠动态压缩的上下文 Token 长度阈值 (如 32000、128000)', descEn: 'Token limit threshold triggering automatic history compaction to preserve context window', type: 'text', group: 'cfg_context' },
  { key: 'enable_request_compression', label: 'features.enable_request_compression', desc: '强效请求级压缩：开启底层的算法削减冗余代码片段向模型释放可用带宽池', descEn: 'Enable aggressive request compression to squeeze more prompt into hard API limits', type: 'bool', group: 'cfg_context' },

  // config.toml - Safety & Security
  { key: 'global_approval_policy', label: 'approval_policy', desc: '全局安全防线：遇到敏感命令和系统环境修改时，拦截并请求人工审批的程度', descEn: 'System-wide policy specifying human-in-the-loop triggers for risky commands', type: 'select', options: ['untrusted', 'on-request', 'never'], group: 'cfg_safety' },
  { key: 'global_sandbox_mode', label: 'sandbox_mode', desc: '限制文件写入和系统执行权限的全局沙盒隔离级别 (推荐 workspace-write)', descEn: 'Sandbox isolation levels dictating writable file and execution access boundaries', type: 'select', options: ['read-only', 'workspace-write', 'danger-full-access'], group: 'cfg_safety' },
  { key: 'cli_auth_credentials_store', label: 'cli_auth_credentials_store', desc: 'Token 保存介质策略：选择密钥和鉴权资料的保险箱存放位置 (OS底层密钥环或普通文本)', descEn: 'Underlying vault selector ensuring credential persistance mapping in safe keyrings or texts', type: 'select', options: ['file', 'keyring', 'auto'], group: 'cfg_safety' },
  { key: 'disable_response_storage', label: 'disable_response_storage', desc: '顶级隐私屏蔽：彻底禁止云端远洋节点长期缓存和保存历史通信日志', descEn: 'Total privacy shield: disables storing session interactions historically on cloud', type: 'bool', group: 'cfg_safety' },
  { key: 'approvals_reviewer', label: 'approvals_reviewer', desc: '审批仲裁者：当遇到危险命令阻断时，由谁来进行最后确认放行 (user 或 guardian)', descEn: 'Final decision arbiter: fallback to User or the automated Guardian Subagent', type: 'select', options: ['user', 'guardian_subagent'], group: 'cfg_safety' },

  // config.toml - Environment & TUI
  { key: 'file_opener', label: 'file_opener', desc: '设定终端日志和代码块审查时挂载弹出的默认代码编辑器 (如 vscode, cursor, windsurf)', descEn: 'Set preferred external application for opening code blocks from within terminal logs', type: 'select', options: ['vscode', 'cursor', 'windsurf', 'none'], group: 'cfg_env' },
  { key: 'allow_login_shell', label: 'allow_login_shell', desc: '准许衍生挂载的控制台环境模拟真正的 login_shell 处理全局配置文件', descEn: 'Give permission to inject global rc files and emulate a login-flavored environment shell', type: 'bool', group: 'cfg_env' },
  { key: 'background_terminal_max_timeout', label: 'background_terminal_max_timeout', desc: '守护进程超时机制：最大允许子服务静默休眠多久后即强行阻断 (默认 300000ms)', descEn: 'Safeguard value explicitly stopping zombie sub-processes taking up resource past MS limit', type: 'text', group: 'cfg_env' },
  { key: 'check_for_update_on_startup', label: 'check_for_update_on_startup', desc: '系统唤醒检测：启动阶段并发检视并核对远程 npm 源以获取最新的二进制 CLI 版本', descEn: 'Turn on background polling for the latest matching NPM repository terminal client update', type: 'bool', group: 'cfg_env' },
  { key: 'personality', label: 'personality', desc: '定义 AI 在交流时的人设风格语气 (例如 pragmatic: 务实解决型工程师)', descEn: 'Set conversational personality tone and stylistic flavor of agent interaction', type: 'select', options: ['none', 'friendly', 'pragmatic'], group: 'cfg_env' },
  { key: 'shell_env_inherit', label: 'shell_env_policy.inherit', desc: '定义系统在拉起后台子进程时，继承宿主机系统环境变量的策略 (core/all/none)', descEn: 'Defines how spawned background processes ingest host system environment variables', type: 'select', options: ['core', 'all', 'none'], group: 'cfg_env' },

  // config.toml - Feature Flags
  { key: 'multi_agent', label: 'features.multi_agent', desc: '启用子系统协作框架：授权主控制器可分发并调配从节点组共同处理并发专项任务', descEn: 'Advanced tier empowering the primary controller to orchestrate a squad of sub-workers', type: 'bool', group: 'cfg_features' },
  { key: 'image_generation', label: 'features.image_generation', desc: '挂载本地原生的影像视觉编译库模块，允许大模型在本地生成并输出多模态图片资源', descEn: 'Inject native image generation tool into the agents array of visual capabilities', type: 'bool', group: 'cfg_features' },
  { key: 'smart_approvals', label: 'features.smart_approvals', desc: '预测执行放流机制：启动智能分析判定阻绝拦截必要性，降低简单且低级变动的弹窗审查骚扰率', descEn: 'Trigger predictive execution allowance bypassing nuisance prompts on low-risk iterations', type: 'bool', group: 'cfg_features' },
  { key: 'memories', label: 'features.memories', desc: '基于 RAG 的矢量记忆库，负责收集长效行为习惯并在未来提供跨会话解决方案关联', descEn: 'Unlock long-term vectorized memory vault bridging past solutions across contexts', type: 'bool', group: 'cfg_features' },
  { key: 'undo', label: 'features.undo', desc: '底层动作回溯：建立基于分支版本树的隐式缓存机制支持对全盘代码修改执行时间线级别的回溯甚至逆向', descEn: 'Deploy file state histories effectively tracking every edit step for version reversal trees', type: 'bool', group: 'cfg_features' },
  { key: 'prevent_idle_sleep', label: 'features.prevent_idle_sleep', desc: '长时间挂机自动执行构建时，发送心跳禁止宿主系统屏幕变黑或断网休眠', descEn: 'Inhibit host sleep/network downtime aggressively to prevent long-running death context', type: 'bool', group: 'cfg_features' },
  { key: 'shell_snapshot', label: 'features.shell_snapshot', desc: '审计取证备份模式：开启深层系统全局快照生成支持把在本次终端上触发的任意一行日志保存落盘', descEn: 'Full system audit footprint mapping each internal step straight to local forensics logs', type: 'bool', group: 'cfg_features' },

  // CLI - Execution Bounds
  { key: 'full_auto', label: '--full-auto', desc: '自动化宏模式：撤下确认屏障和沙盒保护极速下放所有修改指令', descEn: 'Macro for low-friction automatic sandbox executing (combines approvals and sandbox mode)', type: 'bool', group: 'cli_bounds' },
  { key: 'approval_policy', label: '-a / --ask-for-approval', desc: '[运行时覆写] 覆盖当前进程命令审批与拦截放行的临时通行级别', descEn: 'CLI runtime override toggling the human-approval safety triggers', type: 'select', options: ['untrusted', 'on-request', 'never'], group: 'cli_bounds' },
  { key: 'sandbox_mode', label: '-s / --sandbox', desc: '[运行时覆写] 覆盖本地沙盒隔离的权限配额等级', descEn: 'CLI momentary sandbox strictness selector for modifying file accesses', type: 'select', options: ['read-only', 'workspace-write', 'danger-full-access'], group: 'cli_bounds' },
  { key: 'dangerously_bypass', label: '--dangerously-bypass...', desc: '[高度危险] 彻底移除所有安全墙和沙盒保护，获取最高根级执行许可满载运行', descEn: '[DANGEROUS] Completely tear down authorization barriers and commit full execution access', type: 'bool', group: 'cli_bounds' },

  // CLI - Workspace Context
  { key: 'cd_dir', label: '-C / --cd', desc: '将当前会话强制锚定在某个指定的绝对目录路径之下进行作业', descEn: 'Explicitly anchor the agent to utilize a targeted root working directory', type: 'text', group: 'cli_workspace' },
  { key: 'add_dir', label: '--add-dir', desc: '特殊安全通行证：授予锁定于工作区外的少数指定路径能够跨区写入的绿灯权限', descEn: 'Secure bypass pass granting the model writable permissions outside of root workspace', type: 'text', group: 'cli_workspace' },

  // CLI - Provider Targeting
  { key: 'oss', label: '--oss', desc: '切断云端网络传输，下放所有请求交给本地的开源模型计算引擎推演', descEn: 'Shutoff remote APIs and funnel logic inference down to a local open source model engine', type: 'bool', group: 'cli_provider' },
  { key: 'local_provider', label: '--local-provider', desc: '指定要侦听并承载这部分本地开源算法作业运算容器的部署形式 (LMStudio 或者 Ollama)', descEn: 'Specific offline runner (i.e., lmstudio, ollama) meant to digest the OSS requests', type: 'select', options: ['lmstudio', 'ollama'], group: 'cli_provider' },

  // CLI - Remote App Server
  { key: 'remote', label: '--remote', desc: '打通 TCP 连接并劫持当前作业交由指定的远程服务端进行数据运算处理', descEn: 'Initiate a remote tunneling protocol to force operation under a distant unmonitored host', type: 'text', group: 'cli_remote' },
  { key: 'remote_auth', label: '--remote-auth-token-env', desc: '建立远程连接套接字信道时使用的通信环境验证密码键名称', descEn: 'Extraction key defining environment variable mapping to secure the websocket channel identity', type: 'text', group: 'cli_remote' },

  // CLI - Terminal & Search
  { key: 'cli_search', label: '--search', desc: '阻断模型回答行为，直接深入只搜集代码特征抓取与全量片段排查', descEn: 'Launch strictly in codebase harvesting and deep snippet fetching mode suppressing answering', type: 'bool', group: 'cli_ui' },
  { key: 'image', label: '-i / --image', desc: '上载照片参数给本地光学引擎转为向量传给底层逻辑进行配合多模态推理答疑', descEn: 'Upload a set of optical physical assets into the pipelines visual cognitive retina channel', type: 'text', group: 'cli_ui' },
  { key: 'no_alt_screen', label: '--no-alt-screen', desc: '禁用替换屏幕渲染 TUI 视图：直接使用纯滚屏打印输出控制台流以便保存日志印记', descEn: 'Block alternate screen capture behavior, releasing logs straight into scrolling native bash', type: 'bool', group: 'cli_ui' },
];

export function getGlobalVal(config: Record<string, any>, field: FieldDef): string {
  // 处理嵌套 key 如 features.xxx
  if (field.key === 'shell_env_inherit') {
    return config.shell_environment_policy?.inherit || '';
  }
  if (field.key.startsWith('features.') || field.label.startsWith('features.')) {
    const fk = field.key.replace('features.', '').replace('_flag', '');
    return String(config.features?.[fk] ?? '');
  }
  return String(config[field.key] ?? '');
}
