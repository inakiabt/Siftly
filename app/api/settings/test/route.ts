import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { resolveAnthropicClient, getCliAuthStatus } from '@/lib/claude-cli-auth'
import { getCodexAvailability, resolveCodexKey, getCodexBaseUrl } from '@/lib/codex-support'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { provider?: string } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const provider = body.provider ?? 'anthropic'

  if (provider === 'anthropic') {
    const setting = await prisma.setting.findUnique({ where: { key: 'anthropicApiKey' } })
    const dbKey = setting?.value?.trim()

    let client
    try {
      client = resolveAnthropicClient({ dbKey })
    } catch {
      // Check if CLI auth is available but expired
      const cliStatus = getCliAuthStatus()
      if (cliStatus.available && cliStatus.expired) {
        return NextResponse.json({ working: false, error: 'Claude CLI session expired — run `claude` to refresh' })
      }
      return NextResponse.json({ working: false, error: 'No API key found. Add one in Settings or log in with Claude CLI.' })
    }

    try {
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'hi' }],
      })
      return NextResponse.json({ working: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const friendly = msg.includes('401') || msg.includes('invalid_api_key')
        ? 'Invalid API key'
        : msg.includes('403')
        ? 'Key does not have permission'
        : msg.slice(0, 120)
      return NextResponse.json({ working: false, error: friendly })
    }
  }

  if (provider === 'codex') {
    const setting = await prisma.setting.findUnique({ where: { key: 'codexApiKey' } })
    const dbKey = setting?.value?.trim()
    const availability = getCodexAvailability({ dbKey })

    if (!availability.available) {
      return NextResponse.json({
        working: false,
        error: 'No Codex access detected. Add a Codex API key or run inside Codex.',
      })
    }

    // If we have a key, we could run a live check, but avoid network calls when not needed.
    const key = resolveCodexKey({ dbKey })
    if (key || availability.source === 'runtime') {
      return NextResponse.json({ working: true, mode: availability.source })
    }

    // Proxy-only mode (custom base URL without explicit key)
    if (getCodexBaseUrl()) {
      return NextResponse.json({ working: true, mode: 'proxy' })
    }

    return NextResponse.json({ working: false, error: 'Codex is configured but no credentials were found.' })
  }

  return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
}
