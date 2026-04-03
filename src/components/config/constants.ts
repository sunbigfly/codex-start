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
  { key: 'name', label: '配置别名', desc: '环境列表中展示的配置别名，用于标识特定的 API 部署实例', descEn: 'Identify alias name of the environment configuration profile for quick selection', type: 'text', group: 'cfg_profile' },
  { key: 'base_url', label: 'API Base URL', desc: '模型服务提供商的 API 基础路由端点 (例如 https://api.openai.com/v1)', descEn: 'The root gateway Base URL for model API inferences (e.g. https://api.openai.com/v1)', type: 'text', group: 'cfg_profile' },
  { key: 'api_key', label: 'API Key', desc: '用于安全请求远程模型 API 服务的认证密钥 (Bearer Token)', descEn: 'Authentication bearer token used to prove your identity when requesting the remote API', type: 'text', group: 'cfg_profile' },

  // config.toml - Language Model API
  { key: 'model', label: 'model', desc: '主流程处理节点所使用的底层核心语言模型架构标识符 (如 gpt-5.4)', descEn: 'Model the agent should use (e.g., gpt-5.4, o4-mini)', type: 'combo', options: ALL_MODELS, group: 'cfg_model' },
  { key: 'wire_api', label: 'wire_api', desc: '上报数据负载与流式解析时遵循的 API 报文规范标准 (Responses / Completions API)', descEn: 'Underlying protocol gateway (responses or completions)', type: 'select', options: ['responses', 'completions'], group: 'cfg_model' },
  { key: 'service_tier', label: 'service_tier', desc: '云端集群负载均衡分配策略参数：极速低延迟级 (fast) 或 均衡排队吞吐级 (flex)', descEn: 'Node routing tier layer: fast (high priority) or flex (batch load balancer)', type: 'select', options: ['fast', 'flex'], group: 'cfg_model' },
  { key: 'model_verbosity', label: 'model_verbosity', desc: '微调语言模型针对非代码会话上下文生成的连贯拓展与输出补充细节长篇程度限制', descEn: 'Controls the verbosity degree for conversational generations (low/medium/high)', type: 'select', options: ['low', 'medium', 'high'], group: 'cfg_model' },

  // config.toml - Agent Reasoning Engine
  { key: 'model_reasoning_effort', label: 'model_reasoning_effort', desc: '配置系统分配给底层模型的隐式思维链（CoT）推理拓展深度的计算资源耗费基线', descEn: 'Reasoning capability allocation compute allowance for standard tasks (none ~ xhigh)', type: 'select', options: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'], group: 'cfg_reasoning' },
  { key: 'plan_mode_reasoning_effort', label: 'plan_mode_reasoning_effort', desc: '在构架计划与深层逻辑重构专项状态时，允许向系统请求进行边界搜索探测的计算量额度', descEn: 'Deeper effort computation used strictly when framing plans and subtasks', type: 'select', options: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'], group: 'cfg_reasoning' },
  { key: 'model_reasoning_summary', label: 'model_reasoning_summary', desc: '启动二次附属监听端点模块节点：对极大过载的源内建推理链实现抽干信息降噪提取的压缩结果转换', descEn: 'Generate collapsed thinking traces via secondary evaluation (auto/concise/detailed)', type: 'select', options: ['auto', 'concise', 'detailed', 'none'], group: 'cfg_reasoning' },
  { key: 'hide_agent_reasoning', label: 'hide_agent_reasoning', desc: '在控制台打印链路时禁止渲染和记录内部消耗的长周期逻辑编译内容以保持 CLI 显示干净输出区', descEn: 'Suppress verbose background thinking traces from rendering in user interfaces', type: 'bool', group: 'cfg_reasoning' },
  { key: 'show_raw_agent_reasoning', label: 'show_raw_agent_reasoning', desc: '取消 CLI 系统内建的封装格式呈现，向屏幕终端无缓冲输出被接截留前未经整编梳理的原生反馈结构流', descEn: 'Flatten parsed output blocks to show the raw incoming token stream for debugging', type: 'bool', group: 'cfg_reasoning' },

  // config.toml - Safety & Security
  { key: 'global_approval_policy', label: 'approval_policy', desc: '配置指令系统防线：当遇到非白名单内核写与敏感进程动作前需强制触发进行人工请求的回调行为', descEn: 'System-wide policy specifying human-in-the-loop triggers for risky commands', type: 'select', options: ['untrusted', 'on-request', 'never'], group: 'cfg_safety' },
  { key: 'global_sandbox_mode', label: 'sandbox_mode', desc: '定义应用进程树针对本地工作流 OS 文件结构及系统调用的容器控制级限制等级', descEn: 'Sandbox isolation levels dictating writable file and execution access boundaries', type: 'select', options: ['read-only', 'workspace-write', 'danger-full-access'], group: 'cfg_safety' },
  { key: 'disable_response_storage', label: 'disable_response_storage', desc: '设置物理级安全隔断：中止对话进程并使所有上行云端通信缓存组件禁止进行日志同步分析和远端落库', descEn: 'Total privacy shield: disables storing session interactions historically on cloud', type: 'bool', group: 'cfg_safety' },
  { key: 'approvals_reviewer', label: 'approvals_reviewer', desc: '处于阻塞级执行危险命令阶段前选定阻断结果判别的接管终端：人类(user)或是内部权限检查子例程(guardian)', descEn: 'Final decision arbiter: fallback to User or the automated Guardian Subagent', type: 'select', options: ['user', 'guardian_subagent'], group: 'cfg_safety' },

  // config.toml - Environment & TUI
  { key: 'personality', label: 'personality', desc: '微调前端呈现风格：定义回复语言语气与模型倾向（pragmatic: 专注解决型工程师口吻等）', descEn: 'Set conversational personality tone and stylistic flavor of agent interaction', type: 'select', options: ['none', 'friendly', 'pragmatic'], group: 'cfg_env' },
  { key: 'shell_env_inherit', label: 'shell_env_policy.inherit', desc: '调整正在下发建立的运行时环境，对于原生 OS 进程里原持有系统环境变量参差引入配置', descEn: 'Defines how spawned background processes ingest host system environment variables', type: 'select', options: ['core', 'all', 'none'], group: 'cfg_env' },
  { key: 'file_opener', label: 'file_opener', desc: '进程流转自动化组件：自动开启进程监控并调起对应的开发编辑器(如 VSCode/Cursor)打开涉及大批量重写改源', descEn: 'IDE integration hook to automatically pop an editor like VSCode whenever big files change', type: 'select', options: ['vscode', 'vscode-insiders', 'cursor', 'windsurf', 'none'], group: 'cfg_env' },

  // config.toml - Feature Flags
  { key: 'prevent_idle_sleep', label: 'features.prevent_idle_sleep', desc: '长时间挂起大规模自动化构建进程中派发电源中断伪心跳来禁用宿主计算机触发断网黑屏与休眠守护', descEn: 'Inhibit host sleep/network downtime aggressively to prevent long-running death context', type: 'bool', group: 'cfg_features' },
  { key: 'memories', label: 'features.memories', desc: '基于矢量记忆检索引接组件（RAG）对系统多阶段修改动作规律跨会话周期的工作行为习惯本地收集模块', descEn: 'Unlock long-term vectorized memory vault bridging past solutions across contexts', type: 'bool', group: 'cfg_features' },
  { key: 'multi_agent', label: 'features.multi_agent', desc: '挂载扩展系统代理管理体系，授权底层组件拆分布主分支分发并发建立附属专项处理的代理对节点群集', descEn: 'Advanced tier empowering the primary controller to orchestrate a squad of sub-workers', type: 'bool', group: 'cfg_features' },
  { key: 'image_generation', label: 'features.image_generation', desc: '对接到应用服务工作依赖栈区集成原生多模态影像编译库组件能力供大模发起针对图表资产生产类命令使用', descEn: 'Inject native image generation tool into the agents array of visual capabilities', type: 'bool', group: 'cfg_features' },

  // CLI - Execution Bounds
  { key: 'approval_policy', label: '-a / --ask-for-approval', desc: '[局部运行时覆写] 指派当期活动主进程周期里被执行越境代码段强制通过还是按级向主端抛阻断拦截回调异常', descEn: 'CLI runtime override toggling the human-approval safety triggers', type: 'select', options: ['untrusted', 'on-request', 'never'], group: 'cli_bounds' },
  { key: 'sandbox_mode', label: '-s / --sandbox', desc: '[局部运行时覆写] 修改调整主控制应用实例向物理硬件挂接被派发的特定安全可操作范围容器门限配额级', descEn: 'CLI momentary sandbox strictness selector for modifying file accesses', type: 'select', options: ['read-only', 'workspace-write', 'danger-full-access'], group: 'cli_bounds' },
  { key: 'full_auto', label: '--full-auto', desc: '自动构建模式：收回全部手动确认并允许所有文件越阶强制写出动作指令批处理进程管道以加快构建执行频率', descEn: 'Macro for low-friction automatic sandbox executing (combines approvals and sandbox mode)', type: 'bool', group: 'cli_bounds' },
  { key: 'dangerously_bypass', label: '--dangerously-bypass...', desc: '[灾难级风险] 使得所有代码侧阻断沙化审查护墙防线配置彻底崩落关闭并将最高根系统操作全开放予系统接盘', descEn: '[DANGEROUS] Completely tear down authorization barriers and commit full execution access', type: 'bool', group: 'cli_bounds' },

  // CLI - Workspace Context
  { key: 'cd_dir', label: '-C / --cd', desc: '强制应用初始化挂接到指定的宿主系统某个确切的绝对空间节点目录根之下发起构建并将其锁定成其应用树', descEn: 'Explicitly anchor the agent to utilize a targeted root working directory', type: 'text', group: 'cli_workspace' },
  { key: 'add_dir', label: '--add-dir', desc: '显式派发的特别许可路径组，赋予由于挂机根节点所处位置无法对游走在根区外的另外节点代码区执行越界覆盖操作写票据', descEn: 'Secure bypass pass granting the model writable permissions outside of root workspace', type: 'text', group: 'cli_workspace' },

  // CLI - Provider Targeting
  { key: 'oss', label: '--oss', desc: '全局中断请求发往云服务商连接接口的传输路基结构强制指引数据网络回传指向正在系统所在的本地网计算组去跑开源处理', descEn: 'Shutoff remote APIs and funnel logic inference down to a local open source model engine', type: 'bool', group: 'cli_provider' },
  { key: 'local_provider', label: '--local-provider', desc: '设定明确在同主机位部署准备并侦听端口提供代理的推理服务开源计算运行容器 (LMStudio 或 Ollama)', descEn: 'Specific offline runner (i.e., lmstudio, ollama) meant to digest the OSS requests', type: 'select', options: ['lmstudio', 'ollama'], group: 'cli_provider' },

  // CLI - Remote App Server
  { key: 'remote', label: '--remote', desc: '打通跨域 TCP 双工连接劫取处理信道发送本地模型运算任务需求重定位交去挂点于极边端服务端进行数据远洋集群推理', descEn: 'Initiate a remote tunneling protocol to force operation under a distant unmonitored host', type: 'text', group: 'cli_remote' },
  { key: 'remote_auth', label: '--remote-auth-token-env', desc: '发起远程连接会话包协议过程中用于免除输出暴露验证指纹需要向底层去查询隐秘变量并匹配传输鉴证的环境键名称值', descEn: 'Extraction key defining environment variable mapping to secure the websocket channel identity', type: 'text', group: 'cli_remote' },

  // CLI - Terminal & Search
  { key: 'no_alt_screen', label: '--no-alt-screen', desc: '禁绝主程序霸占控制台全复显刷新图层缓冲区绘制输出排版操作行为降效转做标准行模式原始流水印记记录保存特性', descEn: 'Block alternate screen capture behavior, releasing logs straight into scrolling native bash', type: 'bool', group: 'cli_ui' },
  { key: 'cli_search', label: '--search', desc: '将核心语言中枢沟通机制的回路功能组件斩停禁用仅仅做一次底层代码全区静态片段与依存组件特征抓去全量梳收集排查', descEn: 'Launch strictly in codebase harvesting and deep snippet fetching mode suppressing answering', type: 'bool', group: 'cli_ui' },
  { key: 'image', label: '-i / --image', desc: '注入硬盘特定影像作为启动向量向主模型的超分辨图片识别输入区去执行静态光学模态视认知转换系统以协助做视觉交互题', descEn: 'Upload a set of optical physical assets into the pipelines visual cognitive retina channel', type: 'text', group: 'cli_ui' },
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
