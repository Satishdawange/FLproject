import type { AuthUser, SessionEntry, BillItem, UserAccount } from '../types'
import { formatBillingPeriod } from '../utils/calculations'


export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  error?: string
  sheetName?: string
  sheets?: string[]
  user?: AuthUser
  users?: UserAccount[]
  entries?: SessionEntry[]
  bills?: BillItem[]
  count?: number
  billId?: string
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
   * Fetches entries from Google Sheets (either all or specific month, strictly excluding bills)
   */
  async fetchEntries(url: string, month?: string): Promise<ApiResponse<SessionEntry[]>> {
    const res = await callGoogleScript<SessionEntry[]>(url, {
      action: 'getEntries',
      month,
    })
    if (res.success && Array.isArray(res.entries)) {
      res.entries = res.entries.filter((e) => {
        const idStr = String(e.id || '').trim().toUpperCase()
        return !idStr.startsWith('BILL-') && !idStr.startsWith('INV-')
      })
    }
    return res
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

  /**
   * Fetches all registered bills from the 'Bills' tab in Google Sheets
   */
  async getBills(url: string): Promise<ApiResponse<BillItem[]>> {
    const res = await callGoogleScript<BillItem[]>(url, {
      action: 'getBills',
    })
    if (res.success && Array.isArray(res.bills)) {
      res.bills = res.bills.map((b) => ({
        ...b,
        selectedPeriod: formatBillingPeriod(b.selectedPeriod),
      }))
    }
    return res
  },

  /**
   * Appends a new bill entry to the 'Bills' tab in Google Sheets
   */
  async addBill(url: string, bill: BillItem): Promise<ApiResponse> {
    const sanitizedBill = {
      ...bill,
      selectedPeriod: formatBillingPeriod(bill.selectedPeriod),
    }
    return callGoogleScript(url, {
      action: 'addBill',
      ...sanitizedBill,
    })
  },

  /**
   * Fetches users from the 'Users' tab in Google Sheets
   */
  async getUsers(url: string): Promise<ApiResponse<UserAccount[]>> {
    return callGoogleScript<UserAccount[]>(url, {
      action: 'getUsers',
    })
  },

  /**
   * Updates status, payment amount, date, and notes for an existing bill
   */
  async updateBill(
    url: string,
    billUpdate: {
      billId: string
      status: string
      paidAmount?: number | string
      paidOn?: string
      notes?: string
      assignedTo?: string
    }
  ): Promise<ApiResponse> {
    return callGoogleScript(url, {
      action: 'updateBill',
      ...billUpdate,
    })
  },
}

