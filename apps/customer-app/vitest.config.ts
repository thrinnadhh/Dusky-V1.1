import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { 'react-native': fileURLToPath(new URL('./test/react-native.tsx', import.meta.url)) },
  },
  test: { environment: 'node', coverage: { include: ['App.tsx', 'src/**/*.tsx'] } },
});
