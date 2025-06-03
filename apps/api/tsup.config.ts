import { defineConfig, type Options } from 'tsup';

export default defineConfig((options: Options) => ({
  entryPoints: ['server.ts'],
  format: ['esm'],
  clean: true,
  ...options,
})); 