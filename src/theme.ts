const catppuccinMocha = {
  // === Catppuccin Mocha 定制版 (为终端高亮优化) ===
  primary: '#cba6f7',     // 优雅高光紫 (焦点元素、箭头、激活框)
  secondary: '#89b4fa',   // 清澈冷蓝 (值高亮、重要字段)
  success: '#a6e3a1',     // 柔和春绿 (OK, Check, Success)
  warning: '#f9e2af',     // 奶油琥珀黄 (提示, 警示, 运行时覆盖)
  danger: '#eba0ac',      // 哑光玫红 (错误, 危险提示)
  accent: '#f38ba8',      // 高亮珊瑚粉 (面包屑当前状态, 点缀)
  text: '#cdd6f4',        // 主文字白
  heading: '#b4befe',     // 薰衣草蓝 (用于表格头部栏，非常通透)
  muted: '#a6adc8',       // 磨砂浅灰 (未选中项目、副文本)
  dim: '#6c7086',         // 次级灰 (普通边框、静默文本)
  placeholder: '#585b70', // 更暗的背景灰度 (输入框底字)
  darkBorder: '#45475a',  // 系统框线与分割线专用暗灰
  required: '#fab387',    // 清脆的桃橙色
  tab_active: '#cba6f7',
  tab_inactive: '#45475a',
};

const nord = {
  primary: '#88C0D0',
  secondary: '#81A1C1',
  success: '#A3BE8C',
  warning: '#EBCB8B',
  danger: '#BF616A',
  accent: '#B48EAD',
  text: '#ECEFF4',
  heading: '#E5E9F0',
  muted: '#D8DEE9',
  dim: '#4C566A',
  placeholder: '#434C5E',
  darkBorder: '#3B4252',
  required: '#D08770',
  tab_active: '#88C0D0',
  tab_inactive: '#3B4252',
};

const dracula = {
  primary: '#bd93f9',
  secondary: '#8be9fd',
  success: '#50fa7b',
  warning: '#f1fa8c',
  danger: '#ff5555',
  accent: '#ff79c6',
  text: '#f8f8f2',
  heading: '#f8f8f2',
  muted: '#6272a4',
  dim: '#44475a',
  placeholder: '#282a36',
  darkBorder: '#44475a',
  required: '#ffb86c',
  tab_active: '#bd93f9',
  tab_inactive: '#44475a',
};

const tokyoNight = {
  primary: '#7aa2f7',
  secondary: '#7dcfff',
  success: '#9ece6a',
  warning: '#e0af68',
  danger: '#f7768e',
  accent: '#bb9af7',
  text: '#c0caf5',
  heading: '#a9b1d6',
  muted: '#9aa5ce',
  dim: '#565f89',
  placeholder: '#414868',
  darkBorder: '#24283b',
  required: '#ff9e64',
  tab_active: '#7aa2f7',
  tab_inactive: '#24283b',
};

const themes: Record<string, typeof catppuccinMocha> = {
  mocha: catppuccinMocha,
  nord,
  dracula,
  tokyo: tokyoNight,
};

export const themeOptions = Object.keys(themes);

export const colors = { ...catppuccinMocha };

export function applyTheme(name: string) {
  const theme = themes[name] || themes['mocha'];
  Object.assign(colors, theme);
}

export const symbols = {
  arrow: '\u276F',
  check: '\u2714',
  cross: '\u2718',
  dot: '\u25CF',
  circle: '\u25CB',
  line: '\u2500',
  pipe: '\u2502',
  star: '\u2605',
  required: '*',
  corner_tl: '\u256D',
  corner_tr: '\u256E',
  corner_bl: '\u2570',
  corner_br: '\u256F',
  dash: '\u2508',
  tee_r: '\u251C',
  tee_l: '\u2524',
};
