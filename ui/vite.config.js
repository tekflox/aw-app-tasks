// Component-mode plugin bundle only (this app's declarative /ui page is
// server-rendered separately, see tasks_app/view.py) — Vite lib mode
// building src/plugin.jsx -> dist/tasks.js, the bundle aw-app.json's
// contributes.frontend.bundle points at.
//
// esbuild's JSX transform (applied automatically to .jsx files) is
// repointed at host.h/host.React.Fragment instead of react's own
// createElement (jsxFactory's default), so every component in plugin.jsx —
// all declared INSIDE register(host), closing over `host` — compiles
// against the ONE shared React instance the plugin host provides (ADR "one
// shared React instance"; react/react-dom stay external, never bundled).
import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    jsxFactory: 'host.h',
    jsxFragment: 'host.React.Fragment',
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/plugin.jsx',
      formats: ['es'],
      fileName: () => 'tasks.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
});
