#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_BASE_URL = 'http://localhost:8787'
const SESSION_FILE = join(process.cwd(), '.agent-session.json')

type Session = { pairingCode?: string; baseUrl?: string }

function loadSession(): Session {
  if (!existsSync(SESSION_FILE)) return {}
  try { return JSON.parse(readFileSync(SESSION_FILE, 'utf8')) } catch { return {} }
}
function saveSession(s: Session) { writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2)) }
function clearSession() { if (existsSync(SESSION_FILE)) unlinkSync(SESSION_FILE) }

/** Base URL: session file (--base-url of login), AGENT_BASE_URL env, or localhost:8787. */
function baseUrl(): string {
  return loadSession().baseUrl ?? process.env.AGENT_BASE_URL ?? DEFAULT_BASE_URL
}

function headers(): Record<string, string> {
  const s = loadSession()
  return {
    'Content-Type': 'application/json',
    'X-Pairing-Code': s.pairingCode ?? '',
  }
}

async function req(method: string, path: string, body?: any) {
  const res = await fetch(new URL(path, baseUrl()).toString(), { method, headers: headers(), body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let data: any = text
  try { data = JSON.parse(text) } catch {}
  if (!res.ok) { console.error(res.status, data); process.exit(1) }
  console.log(JSON.stringify(data, null, 2))
}

const [cmd, ...args] = process.argv.slice(2)

switch (cmd) {
  case 'login': {
    const pairingIdx = args.indexOf('--pairing-code')
    const baseUrlIdx = args.indexOf('--base-url')
    const s: Session = {}
    if (pairingIdx >= 0) s.pairingCode = args[pairingIdx + 1]
    if (baseUrlIdx >= 0) s.baseUrl = args[baseUrlIdx + 1]
    if (!s.pairingCode) {
      console.log('Usage: agent-cli login --pairing-code <code from the app> [--base-url <url>]')
      console.log('Copy the pairing code from the app header ("Start AI agent pairing" button).')
      console.log('The agent stays usable while the paired browser keeps polling (max 5 minutes idle).')
      process.exit(1)
    }
    saveSession(s)
    console.log('Pairing code saved — testing the connection (GET /agent/screen)…')
    try {
      const res = await fetch(new URL('/agent/screen', baseUrl()).toString(), { headers: headers() })
      if (!res.ok) {
        const text = (await res.text()).trim()
        // 401 means the code was rejected (invalid/unread/expired) — a saved
        // broken code would only confuse later calls, so drop the session file.
        if (res.status === 401) clearSession()
        console.error(`Connection test failed (HTTP ${res.status}): ${text}`)
        process.exit(1)
      }
      const screen = await res.json().catch(() => null)
      console.log('Connection OK — the paired app reported:')
      console.log(JSON.stringify(screen, null, 2))
    } catch {
      console.error(`Connection test failed: the app is not reachable at ${baseUrl()} (is it running? did you need --base-url?)`)
      process.exit(1)
    }
    break
  }
  case 'logout':
    clearSession()
    console.log('Logged out')
    break
  case 'screen':
    await req('GET', '/agent/screen')
    break
  case 'data':
    await req('GET', '/agent/data')
    break
  case 'form':
    await req('GET', '/agent/form')
    break
  case 'screens':
    await req('GET', '/agent/screens')
    break
  case 'navigate':
    await req('POST', '/agent/navigate', { screen: args[0], params: args[1] ? JSON.parse(args[1]) : {} })
    break
  case 'product_list': {
    const qIdx = args.indexOf('--q')
    const pageIdx = args.indexOf('--page')
    const params = new URLSearchParams()
    if (qIdx >= 0 && args[qIdx + 1] !== undefined) params.set('q', args[qIdx + 1])
    if (pageIdx >= 0 && args[pageIdx + 1] !== undefined) params.set('page', args[pageIdx + 1])
    const qs = params.toString()
    await req('GET', `/agent/products${qs ? `?${qs}` : ''}`)
    break
  }
  case 'product_create':
    await req('POST', '/agent/products', JSON.parse(args[0] ?? '{}'))
    break
  case 'product_update':
    await req('PATCH', `/agent/products/${args[0]}`, JSON.parse(args[1] ?? '{}'))
    break
  case 'product_delete':
    await req('DELETE', `/agent/products/${args[0]}`)
    break
  default:
    console.log('Commands: login, logout, screen, data, form, screens, navigate, product_list, product_create, product_update, product_delete')
    console.log('form       — the browser session\'s last new/edit form submission (values + the errors the UI showed)')
    console.log('product_list [--q <name prefix>] [--page <n>] — one page of products (8 per page); like the UI\'s "find by name" filter')
    console.log('product_update sends the FULL product as a complete replacement — omitted description/price are cleared')
}
