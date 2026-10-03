export type UserRole = 'admin' | 'read'

export interface AuthUser {
  username: string
  role: UserRole
}

export interface SessionEntry {
  id: string | number
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  totalMinutes: number // duration in minutes
  discountMinutes: number // discount in minutes
  effectiveMinutes: number // totalMinutes - discountMinutes
  rate: number // rate per hour in ₹
  client: string
  project: string
  description: string
  moneyWithoutDiscount: number // (totalMinutes / 60) * rate
  moneyWithDiscount: number // (effectiveMinutes / 60) * rate
  discountMoney: number // moneyWithoutDiscount - moneyWithDiscount
  createdAt?: string
}

export interface DailySummary {
  date: string
  sessionsCount: number
  totalMinutes: number
  discountMinutes: number
  effectiveMinutes: number
  moneyWithoutDiscount: number
  discountMoney: number
  finalMoney: number
  sessions: SessionEntry[]
}

export interface WeeklySummary {
  weekKey: string // e.g. "2026-09-28_to_2026-10-04"
  weekLabel: string // e.g. "28 Sep – 04 Oct 2026"
  startDate: string
  endDate: string
  totalSessions: number
  totalMinutes: number
  discountMinutes: number
  effectiveMinutes: number
  moneyWithoutDiscount: number
  discountMoney: number
  finalMoney: number
  daysCount: number
  uniqueClients: string[]
  sessions: SessionEntry[]
}

export interface MonthlySummary {
  monthKey: string // YYYY-MM
  monthName: string // e.g. October 2026
  totalSessions: number
  totalMinutes: number
  discountMinutes: number
  effectiveMinutes: number
  moneyWithoutDiscount: number
  discountMoney: number
  finalMoney: number
  uniqueClients: string[]
  daysCount: number
}

export interface SheetItem {
  id: string
  name: string
  url: string
  isConnected?: boolean
  lastSyncedAt?: string
  isDefault?: boolean
}

export interface SheetConfig {
  webAppUrl: string
  sheetName?: string
  isConnected: boolean
  lastSyncedAt?: string
}
