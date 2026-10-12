import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Đường dẫn tương đối để chạy được ở subpath (github.io/Pomodoro/) lẫn domain gốc
  base: './',
  plugins: [react()],
  server: { port: 5173, open: true },
});
