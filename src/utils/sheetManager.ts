import type { SessionEntry, SheetItem } from '../types'

export const DEFAULT_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbzUwC-9ZPjAARznJCkS0FjBW12x01owiHhEN1IGFNkhT6UNb0l3xZcwj8SeAjDqhbvr/exec'

export const DEFAULT_SHEET_NAME = 'FL Time'

/**
 * Creates a stable storage safe key for any URL
 */
export function getUrlStorageKey(url: string): string {
  if (!url) return 'default'
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i)
    hash |= 0
  }
  return `sheet_${Math.abs(hash)}`
}

/**
 * Parses comma-separated or newline-separated sheet entries from environment variable.
 * Supports:
 * - Simple URLs: "https://script.../exec, https://script.../exec2"
 * - Labeled with pipe: "2026 Sheet|https://..., 2027 Sheet|https://..."
 * - Labeled with colon: "2026 Sheet: https://..., 2027 Sheet: https://..."
 */
export function parseSheetUrls(raw: string): Array<{ name?: string; url: string }> {
  if (!raw || typeof raw !== 'string') return []

  const items: Array<{ name?: string; url: string }> = []
  // Split on commas or newlines
  const tokens = raw
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  tokens.forEach((token) => {
    // Format 1: "Label | https://..."
    if (token.includes('|')) {
      const parts = token.split('|')
      const name = parts[0]?.trim()
      const url = parts.slice(1).join('|').trim()
      if (url.startsWith('http')) {
        items.push({ name: name || undefined, url })
        return
      }
    }

    // Format 2: "Label: https://..."
    const colonMatch = token.match(/^([^:]+):\s*(https?:\/\/.+)$/i)
    if (colonMatch) {
      const name = colonMatch[1]?.trim()
      const url = colonMatch[2]?.trim()
      if (url && url.startsWith('http')) {
        items.push({ name: name || undefined, url })
        return
      }
    }

    // Format 3: Plain URL
    if (token.startsWith('http')) {
      items.push({ url: token })
    }
  })

  return items
}

/**
 * Reads sheet URLs defined in Vite/Netlify environment variables
 */
export function getEnvSheetEntries(): Array<{ name?: string; url: string }> {
  const globalEnv = (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> }
    }
  )?.process?.env

  const envValues = [
    import.meta.env.VITE_GOOGLE_SHEETS_URLS,
    import.meta.env.VITE_SHEETS_URLS,
    import.meta.env.VITE_SHEET_URLS,
    import.meta.env.VITE_GOOGLE_SHEET_URL,
    import.meta.env.VITE_SHEET_URL,
    globalEnv?.GOOGLE_SHEETS_URLS,
  ]

  const rawEnv = envValues.find((v) => typeof v === 'string' && v.trim().length > 0)
  if (!rawEnv) return []

  return parseSheetUrls(rawEnv)
}

/**
 * Loads custom sheet URLs saved by the user in browser localStorage
 */
export function getSavedCustomSheetEntries(): Array<{ name?: string; url: string }> {
  try {
    const raw = localStorage.getItem('fl_custom_sheet_urls')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && typeof item.url === 'string' && item.url.startsWith('http'))
      }
    }
  } catch {
    // Ignore JSON parse errors
  }
  return []
}

/**
 * Saves a new custom sheet URL to localStorage
 */
export function addCustomSheetUrl(url: string, name?: string): void {
  if (!url || !url.startsWith('http')) return
  const current = getSavedCustomSheetEntries()
  const exists = current.find((c) => c.url.trim() === url.trim())
  if (!exists) {
    const updated = [...current, { name: name?.trim() || undefined, url: url.trim() }]
    localStorage.setItem('fl_custom_sheet_urls', JSON.stringify(updated))
  }
}

/**
 * Removes a custom sheet URL from localStorage
 */
export function removeCustomSheetUrl(url: string): void {
  const current = getSavedCustomSheetEntries()
  const updated = current.filter((c) => c.url.trim() !== url.trim())
  localStorage.setItem('fl_custom_sheet_urls', JSON.stringify(updated))
}

/**
 * Gets cached spreadsheet names (received from Google Apps Script ping/getEntries)
 */
export function getCachedSheetNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem('fl_sheet_names')
    if (raw) {
      return JSON.parse(raw) || {}
    }
  } catch {
    // Ignore
  }
  return {}
}

/**
 * Updates the friendly or real name of a spreadsheet in localStorage
 */
export function cacheSheetName(url: string, name: string): void {
  if (!url || !name) return
  const names = getCachedSheetNames()
  names[url] = name
  localStorage.setItem('fl_sheet_names', JSON.stringify(names))
}

/**
 * Resolves the complete list of available sheets:
 * 1. URLs from Netlify/Vite environment variables
 * 2. Default URL (always guaranteed)
 * 3. User's custom added sheets
 *
 * Ordered such that the first URL is always ready to load by default.
 */
export function getAvailableSheets(): SheetItem[] {
  const envEntries = getEnvSheetEntries()
  const customEntries = getSavedCustomSheetEntries()
  const sheetNames = getCachedSheetNames()

  const map = new Map<string, SheetItem>()

  // Helper to register sheet item
  const register = (entry: { name?: string; url: string }, isDefault = false) => {
    const cleanUrl = entry.url.trim()
    if (!cleanUrl || map.has(cleanUrl)) return

    const cachedTitle = sheetNames[cleanUrl]
    const fallbackName = cachedTitle || entry.name || (isDefault ? DEFAULT_SHEET_NAME : `Sheet ${map.size + 1}`)

    map.set(cleanUrl, {
      id: getUrlStorageKey(cleanUrl),
      url: cleanUrl,
      name: fallbackName,
      isDefault,
    })
  }

  // 1. If env variables are provided, load them first
  envEntries.forEach((entry, idx) => register(entry, idx === 0))

  // 2. Ensure DEFAULT_SHEET_URL is always available
  if (!map.has(DEFAULT_SHEET_URL)) {
    // If no env entries, default sheet is the first item!
    const isFirst = map.size === 0
    register(
      {
        name: sheetNames[DEFAULT_SHEET_URL] || undefined,
        url: DEFAULT_SHEET_URL,
      },
      isFirst
    )
  }

  // 3. Append custom saved entries
  customEntries.forEach((entry) => register(entry, false))

  return Array.from(map.values())
}

/**
 * Returns the default initial sheet URL (first available URL)
 */
export function getDefaultSheetUrl(): string {
  const sheets = getAvailableSheets()
  return sheets[0]?.url || DEFAULT_SHEET_URL
}

/**
 * Loads session entries cached for a specific Google Sheet URL
 */
export function loadSheetEntriesCache(url: string): SessionEntry[] {
  try {
    const key = `fl_sessions_cache_${getUrlStorageKey(url)}`
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }

    // Fallback to legacy single-sheet cache if matching default URL
    if (url === DEFAULT_SHEET_URL) {
      const legacyRaw = localStorage.getItem('fl_sessions_cache')
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw)
        if (Array.isArray(parsed)) return parsed
      }
    }
  } catch {
    // Ignore
  }
  return []
}

/**
 * Saves session entries cache for a specific Google Sheet URL
 */
export function saveSheetEntriesCache(url: string, entries: SessionEntry[]): void {
  try {
    const key = `fl_sessions_cache_${getUrlStorageKey(url)}`
    localStorage.setItem(key, JSON.stringify(entries))

    // Also update legacy key for backward compatibility if default URL
    if (url === DEFAULT_SHEET_URL) {
      localStorage.setItem('fl_sessions_cache', JSON.stringify(entries))
    }
  } catch {
    // Ignore
  }
}
