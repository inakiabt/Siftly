/**
 * Lightweight helpers for detecting Codex runtime integration and resolving
 * API credentials without hard dependencies on a specific SDK.
 */
export function isCodexRuntimeAvailable(): boolean {
  return process.env.CODEX_MANAGED_BY_NPM === '1'
}

export function getCodexEnvKey(): string | null {
  const envKey = process.env.CODEX_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  return envKey && envKey.length > 0 ? envKey : null
}

export function getCodexBaseUrl(): string | undefined {
  return process.env.OPENAI_BASE_URL || process.env.CODEX_BASE_URL || undefined
}

export function resolveCodexKey(options: { overrideKey?: string; dbKey?: string | null } = {}): string | null {
  if (options.overrideKey?.trim()) return options.overrideKey.trim()
  if (options.dbKey?.trim()) return options.dbKey.trim()
  const envKey = getCodexEnvKey()
  if (envKey) return envKey
  return null
}

export function getCodexAvailability(options: { dbKey?: string | null } = {}): {
  available: boolean
  source: 'runtime' | 'env' | 'db' | 'proxy' | 'none'
} {
  const runtime = isCodexRuntimeAvailable()
  if (runtime) return { available: true, source: 'runtime' }

  const key = resolveCodexKey({ dbKey: options.dbKey })
  if (key) {
    const envKey = getCodexEnvKey()
    return { available: true, source: envKey ? 'env' : 'db' }
  }

  if (getCodexBaseUrl()) return { available: true, source: 'proxy' }

  return { available: false, source: 'none' }
}
