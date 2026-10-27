import { defineConfig } from 'astro/config';

// Fully static output, no integrations, no server.
export default defineConfig({
  site: 'https://plan.shudflow.com',
  output: 'static',
  devToolbar: { enabled: false },
});
