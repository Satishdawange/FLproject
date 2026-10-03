import type { AuthUser, SessionEntry } from '../types'


export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  error?: string
  sheetName?: string
  sheets?: string[]
  user?: AuthUser
  entries?: SessionEntry[]
  count?: number
  data?: T
}

/**
 * Sends a POST request to Google Apps Script Web App.
 * Uses text/plain to avoid CORS preflight issues with Google Apps Script.
 */
async function callGoogleScript<T>(url: string, payload: Record<string, unknown>): Promise<ApiResponse<T>> {
  if (!url || !url.startsWith('http')) {
    throw new Error('Please configure a valid Google Apps Script Web App URL.')
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Google Sheets responded with HTTP status ${response.status}`)
    }

    const data = await response.json()
    return data as ApiResponse<T>
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: errorMsg,
    }
  }
}

export const googleSheetsApi = {
  /**
   * Tests connection to Google Apps Script Web App
   */
  async testConnection(url: string) {
    return callGoogleScript(url, { action: 'ping' })
  },

  /**
   * Authenticates user against credentials in the sheet's Users tab
   */
  async login(url: string, username: string, password: string): Promise<ApiResponse<AuthUser>> {
    return callGoogleScript<AuthUser>(url, {
      action: 'login',
      username,
      password,
    })
  },

  /**
   * Fetches entries from Google Sheets (either all or specific month)
   */
  async fetchEntries(url: string, month?: string): Promise<ApiResponse<SessionEntry[]>> {
    return callGoogleScript<SessionEntry[]>(url, {
      action: 'getEntries',
      month,
    })
  },

  /**
   * Appends a new session entry to Google Sheets (auto creates month tab if needed)
   */
  async addEntry(url: string, entry: SessionEntry): Promise<ApiResponse> {
    return callGoogleScript(url, {
      action: 'addEntry',
      ...entry,
    })
  },
}
