import { defineConfig,loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
// 1. Load env file based on the current "mode" (e.g., development, production)
  // process.cwd() tells Vite to look in the root directory of your project
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [tailwindcss(), react()],
    resolve: {
    alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: parseInt(env.VITE_PORT) || 5273,
      host: '0.0.0.0',
      strictPort: true // Tells it to crash if *your* specific port is taken
    },
  }
})
// export default defineConfig({
//   plugins: [tailwindcss(), react()],
//   resolve: {
//     alias: {
//       '@': path.resolve(__dirname, '.'),
//     },
//   },
//   server: {
//     port: 5173,
//     host: '0.0.0.0',
//   },
// });
