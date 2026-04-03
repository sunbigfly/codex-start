#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsxBin = join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const app = join(__dirname, '..', 'src', 'app.tsx');

const child = spawn(tsxBin, [app, ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
