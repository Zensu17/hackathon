import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig } from 'vitest/config';

type VitestPluginOption = NonNullable<UserConfig['plugins']>[number];

export default defineConfig({
  plugins: [react() as unknown as VitestPluginOption],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
