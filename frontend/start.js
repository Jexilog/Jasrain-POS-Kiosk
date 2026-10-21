
import { spawn } from 'node:child_process';

const port = process.env.PORT || '4173';

const server = spawn(
  'serve',
  ['-s', 'dist', '-l', port],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
);

server.on('error', (error) => {
  console.error('Failed to start frontend:', error);
  process.exitCode = 1;
});

server.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
