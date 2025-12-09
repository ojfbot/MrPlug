#!/usr/bin/env node

/**
 * Inject environment variables from env.json into a TypeScript file
 * This script runs BEFORE build to make env vars available to the extension
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Read env.json
const envPath = resolve(rootDir, 'env.json');
if (!existsSync(envPath)) {
  console.warn('⚠️  env.json not found. Using default empty config.');

  // Write empty config
  const emptyConfigTs = `// Auto-generated - no env.json found
export const ENV_CONFIG = null;
`;

  const envTsPath = resolve(rootDir, 'src/lib/env.ts');
  writeFileSync(envTsPath, emptyConfigTs);
  process.exit(0);
}

const env = JSON.parse(readFileSync(envPath, 'utf-8'));

// Create TypeScript file with environment config
const envTs = `// Auto-generated from env.json - DO NOT COMMIT
// This file is regenerated on every build

export const ENV_CONFIG = {
  ANTHROPIC_API_KEY: '${env.ANTHROPIC_API_KEY || ''}',
  DEFAULT_PROVIDER: '${env.DEFAULT_PROVIDER || 'anthropic'}',
} as const;
`;

// Write to src directory (before build)
const envTsPath = resolve(rootDir, 'src/lib/env.ts');
writeFileSync(envTsPath, envTs);

console.log('\n✅ Environment config generated:');
console.log(`   Provider: ${env.DEFAULT_PROVIDER || 'anthropic'}`);
console.log(`   API Key: ${env.ANTHROPIC_API_KEY ? 'sk-ant-***' + env.ANTHROPIC_API_KEY.slice(-6) : 'Not set'}`);
console.log(`   Config file: ${envTsPath}`);
console.log('\n📝 The extension will auto-configure on first load!');
