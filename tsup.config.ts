import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/app.tsx'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  bundle: true,
  minify: true,
  sourcemap: true,
  // 必须开启因为这是 CLI，给最终文件打上可运行权限同时注入 node 解释器
  // 等同于打包时自动给 cli.js 顶部补充 #!/usr/bin/env node
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire } from "module";\nconst require = createRequire(import.meta.url);',
  },
  // 对于 Ink 依赖的 React 进行正确的注入和解析 (如果遇到 JSX 问题)
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
