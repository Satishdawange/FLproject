export type UserRole = 'admin' | 'read'

export interface UserAccount {
  username: string
  name?: string
  fullName?: string
  role: UserRole
}

export interface AuthUser {
  username: string
  name?: string
  fullName?: string
  role: UserRole
  credentialHash?: string
  loginTimestamp?: string
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

export type BillPaymentStatus = 'Unpaid' | 'Half Paid' | 'Fully Paid'

export interface PaymentRequest {
  id: string
  billId: string
  client: string
  project: string
  selectedPeriod: string
  totalAmount: number
  customerUsername: string
  customerName?: string
  requestedStatus: 'Fully Paid' | 'Half Paid'
  paidAmount: number
  remainingAmount: number
  paymentDate: string
  remainingPaymentDate?: string
  description: string
  submittedAt: string
  status: 'pending' | 'accepted' | 'rejected'
}

export type NotificationType =
  | 'bill_pending'
  | 'bill_half_pending'
  | 'payment_request'
  | 'request_rejected'
  | 'request_accepted'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  billId: string
  recipientUsername: string // 'admin' or customer username
  createdAt: string
  read?: boolean
  status: 'active' | 'resolved' | 'dismissed'
  paymentRequest?: PaymentRequest
}

export interface BillItem {
  billId: string
  createdOn: string // e.g. "2026-10-04 15:30"
  selectedPeriod: string // e.g. "October 2026" or "2026-10"
  client: string
  project: string
  totalSessions: number
  totalMinutes: number
  discountMinutes: number
  effectiveMinutes: number
  grossAmount: number
  discountMoney: number
  netAmount: number
  status: BillPaymentStatus
  paidAmount?: number
  paidOn?: string
  notes?: string
  assignedTo?: string // Customer account assigned to this bill
  paymentRequest?: PaymentRequest // Pending or latest payment status change request
}

