export const DEFAULT_PROFILE_EXTRAS = {
  personality: '',
  model_reasoning_summary: 'auto',
  service_tier: 'fast',
};

export interface Profile {
  id: string;
  name: string;
  // 必填
  base_url: string;
  api_key: string;
  // 可选覆盖（空字符串 = 不覆盖，保持 config.toml 原值）
  model: string;
  model_reasoning_effort: string;
  wire_api: string;
  personality: string;
  model_reasoning_summary: string;
  service_tier: string;
  disable_response_storage: string;  // 'true' / 'false' / ''
  approval_policy: string;           // 覆盖全局
  sandbox_mode: string;              // 覆盖全局
  web_search: string;                // 覆盖全局
  // 元数据
  requires_openai_auth: boolean;
  isDefault: boolean;
  createdAt: string;
  [key: string]: any; // Allow arbitrary override fields without breaking types
}

export interface AppHistoryEntry {
  id: string;
  timestamp: string;
  message: string;
  authJson: Record<string, unknown>;
  configToml: string;
}

export interface AppStore {
  profiles: Profile[];
  backup: {
    authJson: Record<string, unknown>;
    configToml: string;
  } | null;
  history?: AppHistoryEntry[];
  testResults?: Record<string, string>;
  /** 每个 profile 最后一次测试的耗时 (ms) */
  testDurations?: Record<string, number>;
}

export type View = 'main' | 'list' | 'config' | 'add' | 'edit' | 'test';
