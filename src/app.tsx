import React, { useState } from 'react';
import { render, useApp } from 'ink';
import { spawn } from 'node:child_process';
import { parse as parseToml } from 'smol-toml';
import { ConfigUI } from './components/ConfigUI.js';
import { ListUI, ListAction } from './components/ListUI.js';
import { loadStore, saveStore, ensureBackup, exportProfiles, importProfiles } from './store.js';
import { injectProfile, buildLaunchArgs, restoreBackup } from './injector.js';
import { colors, symbols, applyTheme, themeOptions } from './theme.js';
import { fuzzyMatch } from './utils.js';
import type { Profile, AppStore } from './types.js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import cfonts from 'cfonts';
import omelette from 'omelette';

const comp = omelette('cs|codex-start <action> <profile>');
comp.on('action', ({ reply }) => {
  reply(['run', 'list', 'config', 'test', 'add', 'export', 'import', 'help', '--setup-completion']);
});
comp.on('profile', ({ reply, line }) => {
  if (line.includes(' run ')) {
    try {
      const store = loadStore();
      const names = store.profiles.map(p => p.name);
      reply(names.map(n => n.includes(' ') ? `"${n}"` : n));
    } catch { reply([]); }
  } else {
    reply([]);
  }
});
comp.init();

// 去除 launch 时的庞大 Logo 输出

// --- 启动信息打印 ---

function launchCodex(profile: Profile) {
  const store = ensureBackup(loadStore());
  restoreBackup(store.backup);
  injectProfile(profile);
  const args = buildLaunchArgs(profile);

  // 在 inject 和 spawn 之间读取注入后的 config.toml（此时还未 restore）
  let cfgModel = profile.model;
  let cfgEffort = profile.model_reasoning_effort;
  try {
    const cfgPath = join(homedir(), '.codex', 'config.toml');
    if (existsSync(cfgPath)) {
      const cfg = parseToml(readFileSync(cfgPath, 'utf-8'));
      if (!cfgModel && cfg.model) cfgModel = String(cfg.model);
      if (!cfgEffort && cfg.model_reasoning_effort) cfgEffort = String(cfg.model_reasoning_effort);
    }
  } catch { /* 读取失败不影响启动 */ }
  
  // 1. 设置终端标题
  process.stdout.write(`\x1b]0;Codex [cs]: ${profile.name}\x07`);

  const sep = ' \x1b[38;5;240m|\x1b[0m ';
  const parts = [
    `\x1b[1m${profile.name}\x1b[0m`,
    profile.base_url ? `\x1b[38;5;243m${profile.base_url}\x1b[0m` : '',
    profile.api_key ? `\x1b[38;5;243m${profile.api_key}\x1b[0m` : '',
    cfgModel ? `\x1b[38;5;147m${cfgModel}\x1b[0m` : '',
    cfgEffort ? `\x1b[38;5;215m${cfgEffort}\x1b[0m` : '',
  ].filter(Boolean).join(sep);
  process.stdout.write(`\x1b[38;5;45m[cs]\x1b[0m ${parts}\n\n`);

  const child = spawn('codex', args, { stdio: 'inherit' });
  
  const cleanup = () => {
    restoreBackup(store.backup, profile);
  };

  // 确保不管父进程收到何种退出信号，都能进行还原操作
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, () => {
      cleanup();
      process.exit(0);
    });
  });

  child.on('error', (err) => {
    cleanup();
    console.error(`\n  \x1b[31mFailed:\x1b[0m ${err.message}`);
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

// --- CLI 命令路由（非 TUI，直接 console 输出） ---

function printHelp() {
  const lines = [
    ['cs', 'Launch default profile'],
    ['cs list', 'Interactive profile list'],
    ['cs <N>', 'Launch profile by number'],
    ['cs run <name>', 'Launch profile by name'],
    ['cs config', 'Open config manager'],
    ['cs add', 'Add new profile'],
    ['cs test', 'Test connectivity'],
    ['cs export [file]', 'Export profiles'],
    ['cs import <file>', 'Import profiles'],
    ['cs help', 'Show this help message']
  ];

  console.log('  Usage:');
  for (const [cmd, desc] of lines) {
    console.log(`    \x1b[36m${cmd.padEnd(17, ' ')}\x1b[0m ${desc}`);
  }
  console.log('');
}

function handleCli(): boolean {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    const store = ensureBackup(loadStore());
    const def = store.profiles.find((p) => p.isDefault) || store.profiles[0];
    if (!def) {
      console.log('\n  No profiles yet. Run \x1b[36mcs config\x1b[0m to add one.\n');
      process.exit(0);
    }
    launchCodex(def);
    return true;
  }

  const cmd = args[0];

  if (cmd === 'config' || cmd === 'c') return false;
  if (cmd === 'list' || cmd === 'ls') return false;
  if (cmd === 'add') return false;
  if (cmd === 'test') return false;

  // cs run <name>
  if (cmd === 'run') {
    const query = args.slice(1).join(' ');
    if (!query) {
      console.log('\n  \x1b[31mUsage:\x1b[0m cs run <profile-name>\n');
      process.exit(1);
    }
    const store = ensureBackup(loadStore());
    const matches = fuzzyMatch(store.profiles, query);
    if (matches.length === 0) {
      console.log(`\n  \x1b[31mNo profile matching:\x1b[0m "${query}"\n`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.log(`\n  \x1b[33mMultiple matches for:\x1b[0m "${query}"`);
      matches.forEach(i => console.log(`    ${i + 1}. ${store.profiles[i].name}`));
      console.log('  Please be more specific.\n');
      process.exit(1);
    }
    launchCodex(store.profiles[matches[0]]);
    return true;
  }

  // cs --setup-completion
  if (cmd === '--setup-completion') {
    comp.setupShellInitFile();
    console.log('\n  \x1b[32mAuto-completion setup successfully!\x1b[0m');
    console.log('  Please restart your terminal or run \x1b[36msource ~/.zshrc\x1b[0m (or equivalent) to apply.\n');
    process.exit(0);
  }

  // cs export
  if (cmd === 'export') {
    const store = loadStore();
    if (store.profiles.length === 0) {
      console.log('\n  No profiles to export.\n');
      process.exit(0);
    }
    const json = exportProfiles(store.profiles);
    const outFile = args[1] || join(homedir(), '.codex-start', 'profiles-export.json');
    writeFileSync(outFile, json + '\n');
    console.log(`\n  \x1b[32mExported ${store.profiles.length} profiles\x1b[0m -> ${outFile}\n`);
    return true;
  }

  // cs import <file>
  if (cmd === 'import') {
    const file = args[1];
    if (!file || !existsSync(file)) {
      console.log('\n  \x1b[31mUsage:\x1b[0m cs import <json-file>\n');
      process.exit(1);
    }
    try {
      const json = readFileSync(file, 'utf-8');
      const imported = importProfiles(json);
      const store = loadStore();
      store.profiles.push(...imported);
      saveStore(store);
      console.log(`\n  \x1b[32mImported ${imported.length} profiles\x1b[0m from ${file}\n`);
    } catch (e: any) {
      console.log(`\n  \x1b[31mImport failed:\x1b[0m ${e.message}\n`);
      process.exit(1);
    }
    return true;
  }

  // cs N
  const num = parseInt(cmd, 10);
  if (!isNaN(num)) {
    const store = ensureBackup(loadStore());
    if (num < 1 || num > store.profiles.length) {
      console.log(`\n  \x1b[31mInvalid profile number ${num}\x1b[0m (have ${store.profiles.length} profiles)\n`);
      process.exit(1);
    }
    launchCodex(store.profiles[num - 1]);
    return true;
  }

  if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
    console.log('');
    printHelp();
    return true;
  }

  console.log(`\n  \x1b[31mUnknown command:\x1b[0m ${cmd}`);
  printHelp();
  return true;
}

// --- cs config TUI ---

function ConfigApp({ cmd, editId }: { cmd: string; editId?: string }) {
  const { exit } = useApp();
  const [store, setStore] = useState<AppStore>(() => ensureBackup(loadStore()));

  return (
    <ConfigUI
      store={store}
      initialMode={cmd}
      initialEditId={editId}
      onUpdate={(newStore) => { setStore(newStore); saveStore(newStore); }}
      onExit={() => exit()}
    />
  );
}

// --- Entry Point ---

function ListAppWrapper({ onAction }: { onAction: (a: ListAction) => void }) {
  const { exit } = useApp();
  const [store, setStore] = useState<AppStore>(() => ensureBackup(loadStore()));
  
  return (
    <ListUI 
      store={store} 
      onUpdate={setStore} 
      onAction={(action) => {
        onAction(action);
        exit();
      }} 
    />
  );
}

async function main() {
  // --- Ultimate Flicker-Free Rendering Engine ---
  // 原有的 Ink 底层算法在输出新帧时，会暴力全屏向下清除（\x1b[2K / \x1b[0J），
  // 在普通终端和 SSH（如 MobaXterm）中这会导致巨大的撕裂、黑屏和闪烁。
  // 我们在此实现底层的“差分覆盖代理”：
  // 1. 彻底拦截并摘除强制清空指令。
  // 2. 改为保留 Cursor Up 时，逐行在新帧上覆盖并在行尾实施局部擦除 `\x1b[K`。
  // 3. 补齐行差，避免底部残留旧帧，真正实现完美的 60Hz 回写级动画！
  try {
    let origWrite = process.stdout.write.bind(process.stdout);
    let buf = '';
    let scheduled = false;
    let prevLines: string[] = [];

    (process.stdout as any).write = (
      chunk: string | Buffer,
      encOrCb?: BufferEncoding | ((err?: Error) => void),
      cb?: (err?: Error) => void,
    ): boolean => {
      buf += (typeof chunk === 'string' ? chunk : chunk.toString());
      const callback = typeof encOrCb === 'function' ? encOrCb : cb;
      
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(() => {
          scheduled = false;
          let currentBuf = buf;
          buf = '';
          
          // Ink / log-update 帧刷新必然会包含清除宏 \x1b[2K
          const isLogUpdateFrame = /\x1B\[2K/i.test(currentBuf);

          if (isLogUpdateFrame) {
            // 提取所有的光标归位/擦除前导控制符
            let preambleMatch = currentBuf.match(/^((?:\x1B\[2K|\x1B\[1A|\x1B\[G|\x1B\[0J|\x1B\[\?25[hl])+)/i);
            let preamble = preambleMatch ? preambleMatch[1] : '';
            
            // 剔除暴力的“清屏”与“清行”指令，仅保留“光标上移”与“状态切换”
            let movingPreamble = preamble.replace(/\x1B\[2K/gi, '').replace(/\x1B\[0J/gi, '');
            
            // 提取纯净的新帧文本内容并按行切割
            let payload = currentBuf.substring(preamble.length);
            let newLinesArray = payload.split('\n');

            let out = movingPreamble; 
            for (let i = 0; i < newLinesArray.length; i++) {
               let line = newLinesArray[i];
               let isLastLine = i === newLinesArray.length - 1;

               // 【真·双层缓冲差分 Diffing】
               // 如果这一行完全没有变化，我们直接斩断网络数据传输（不发 ANSI 重绘指令）！
               if (prevLines[i] === line) {
                   if (!isLastLine) {
                       // 仅发送换行符将光标导向下一行，跳过当前行的渲染
                       out += '\n';
                   }
               } else {
                   // 若内容变化，才打印这行新字符，并在尾部补上一刀局部擦除 \x1B[K
                   out += line + '\x1B[K';
                   if (!isLastLine) {
                       out += '\n';
                   }
               }
            }
            
            // 如果旧帧更长，在新帧画完后清理残余尸体，并把光标重置回逻辑底部
            if (newLinesArray.length < prevLines.length) {
               let diff = prevLines.length - newLinesArray.length;
               let cleanup = '';
               for (let i = 0; i < diff; i++) {
                   cleanup += '\n\x1B[K';
               }
               cleanup += `\x1B[${diff}A`;
               out += cleanup;
            }

            prevLines = newLinesArray;
            origWrite(out);
          } else {
            // 非连续动画帧（如 Initial Render 或 Console 清理场景）
            origWrite(currentBuf);
            // 建立初始缓冲帧基线
            prevLines = currentBuf.split('\n');
          }
        });
      }
      if (callback) queueMicrotask(() => callback());
      return true;
    };
  } catch { /* 如果环境过老则 fallback */ }

  const initialStore = ensureBackup(loadStore());
  if (initialStore.globalTheme) applyTheme(initialStore.globalTheme);

  if (handleCli()) return;

  const cmd = process.argv[2] || 'config';

  if (cmd === 'list' || cmd === 'ls') {
    while (true) {
      let resolvedAction: ListAction | undefined;
      
      console.clear();
      
      const { waitUntilExit } = render(
        <ListAppWrapper onAction={(a) => { resolvedAction = a; }} />,
        { patchConsole: false }
      );
      
      await waitUntilExit();

      const act: any = resolvedAction;
      if (!act || act.type === 'exit') {
        return;
      } else if (act.type === 'launch') {
        const currentStore = loadStore();
        const p = currentStore.profiles.find((x: any) => x.id === act.profileId);
        if (p) launchCodex(p);
        return;
      } else if (act.type === 'edit') {
        console.clear();
        const { waitUntilExit: wExit } = render(<ConfigApp cmd="config" editId={act.profileId} />, { patchConsole: false });
        await wExit();
      } else if (act.type === 'add') {
        console.clear();
        const { waitUntilExit: wExit } = render(<ConfigApp cmd="add" />, { patchConsole: false });
        await wExit();
      } else if (act.type === 'test') {
        console.clear();
        const { waitUntilExit: wExit } = render(<ConfigApp cmd="test" />, { patchConsole: false });
        await wExit();
      }
    }
  }

  console.clear();
  const { waitUntilExit } = render(<ConfigApp cmd={cmd} />, { patchConsole: false });
  await waitUntilExit();
}

main();
