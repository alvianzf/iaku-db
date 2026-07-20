import { defineConfig } from 'vitest/config';

// Without this, vitest walks up and loads the frontend's vite.config.js from
// the repo root, which imports @vitejs/plugin-react from the other workspace.
export default defineConfig({
  // Vite also searches upward for postcss.config.js and finds the frontend's,
  // which requires tailwindcss — not installed in this workspace. An inline
  // (empty) postcss config stops the search. The server has no CSS at all.
  css: { postcss: {} },
  test: {
    root: import.meta.dirname,
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
