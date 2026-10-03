import type { DailySummary, MonthlySummary, WeeklySummary, SessionEntry } from '../types'


/**
 * Calculates duration in minutes between start time and end time (HH:mm format).
 * Handles overnight sessions where end time is past midnight.
 */
export function calculateMinutesBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const [startHour, startMin] = start.split(':').map(Number)
  const [endHour, endMin] = end.split(':').map(Number)
  if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) return 0

  const startTotal = startHour * 60 + startMin
  let endTotal = endHour * 60 + endMin

  if (endTotal < startTotal) {
    // Overnight work
    endTotal += 24 * 60
  }

  return Math.max(0, endTotal - startTotal)
}

/**
 * Formats minutes into human-readable "Xh Ym"
 */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const hrs = Math.floor(m / 60)
  const mins = m % 60
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${String(mins).padStart(2, '0')}m`
}

/**
 * Formats minutes into decimal hours string, e.g., "2.50 hrs"
 */
export function formatDecimalHours(minutes: number): string {
  const hrs = Math.max(0, minutes) / 60
  return `${hrs.toFixed(2)} hrs`
}

/**
 * Formats rupee amounts using Indian numbering system (e.g. ₹1,25,000)
 */
export function formatRupees(amount: number): string {
  const rounded = Math.round(amount || 0)
  return `₹${rounded.toLocaleString('en-IN')}`
}

/**
 * Calculates all session-level metrics given times, discount and hourly rate
 */
export function calculateSessionMetrics(
  startTime: string,
  endTime: string,
  discountMinutes: number,
  rate: number
) {
  const totalMinutes = calculateMinutesBetween(startTime, endTime)
  const safeDiscount = Math.min(totalMinutes, Math.max(0, Number(discountMinutes) || 0))
  const effectiveMinutes = Math.max(0, totalMinutes - safeDiscount)
  const safeRate = Math.max(0, Number(rate) || 0)

  const moneyWithoutDiscount = (totalMinutes / 60) * safeRate
  const moneyWithDiscount = (effectiveMinutes / 60) * safeRate
  const discountMoney = Math.max(0, moneyWithoutDiscount - moneyWithDiscount)

  return {
    totalMinutes,
    discountMinutes: safeDiscount,
    effectiveMinutes,
    rate: safeRate,
    moneyWithoutDiscount,
    moneyWithDiscount,
    discountMoney,
  }
}

/**
 * Aggregates sessions grouped by day
 */
export function groupSessionsByDay(entries: SessionEntry[]): DailySummary[] {
  if (!Array.isArray(entries)) return []
  const dayMap = new Map<string, SessionEntry[]>()

  entries.forEach((entry) => {
    if (!entry || !entry.date) return
    const list = dayMap.get(entry.date) || []
    list.push(entry)
    dayMap.set(entry.date, list)
  })

  const summaries: DailySummary[] = []

  dayMap.forEach((daySessions, date) => {
    let totalMinutes = 0
    let discountMinutes = 0
    let effectiveMinutes = 0
    let moneyWithoutDiscount = 0
    let discountMoney = 0
    let finalMoney = 0

    daySessions.forEach((s) => {
      totalMinutes += Number(s.totalMinutes) || 0
      discountMinutes += Number(s.discountMinutes) || 0
      effectiveMinutes += Number(s.effectiveMinutes) || 0
      moneyWithoutDiscount += Number(s.moneyWithoutDiscount) || 0
      discountMoney += Number(s.discountMoney) || 0
      finalMoney += Number(s.moneyWithDiscount) || 0
    })

    summaries.push({
      date,
      sessionsCount: daySessions.length,
      totalMinutes,
      discountMinutes,
      effectiveMinutes,
      moneyWithoutDiscount,
      discountMoney,
      finalMoney,
      sessions: daySessions.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || ''))),
    })
  })

  return summaries.sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Aggregates sessions grouped by month (YYYY-MM)
 */
export function groupSessionsByMonth(entries: SessionEntry[]): MonthlySummary[] {
  if (!Array.isArray(entries)) return []
  const monthMap = new Map<string, SessionEntry[]>()

  entries.forEach((entry) => {
    if (!entry || !entry.date) return
    const monthKey = String(entry.date).slice(0, 7) // YYYY-MM
    const list = monthMap.get(monthKey) || []
    list.push(entry)
    monthMap.set(monthKey, list)
  })


  const summaries: MonthlySummary[] = []

  monthMap.forEach((monthSessions, monthKey) => {
    let totalMinutes = 0
    let discountMinutes = 0
    let effectiveMinutes = 0
    let moneyWithoutDiscount = 0
    let discountMoney = 0
    let finalMoney = 0
    const clients = new Set<string>()
    const days = new Set<string>()

    monthSessions.forEach((s) => {
      totalMinutes += s.totalMinutes
      discountMinutes += s.discountMinutes
      effectiveMinutes += s.effectiveMinutes
      moneyWithoutDiscount += s.moneyWithoutDiscount
      discountMoney += s.discountMoney
      finalMoney += s.moneyWithDiscount
      if (s.client) clients.add(s.client)
      days.add(s.date)
    })

    summaries.push({
      monthKey,
      monthName: getMonthLabel(monthKey),
      totalSessions: monthSessions.length,
      totalMinutes,
      discountMinutes,
      effectiveMinutes,
      moneyWithoutDiscount,
      discountMoney,
      finalMoney,
      uniqueClients: Array.from(clients),
      daysCount: days.size,
    })
  })

  return summaries.sort((a, b) => b.monthKey.localeCompare(a.monthKey))
}

/**
 * Returns formatted month name from "YYYY-MM" like "October 2026"
 */
export function getMonthLabel(monthKey: string): string {
  try {
    const [year, month] = monthKey.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } catch {
    return monthKey
  }
}

/**
 * Aggregates sessions grouped by weekly intervals (Monday to Sunday)
 */
export function groupSessionsByWeek(entries: SessionEntry[]): WeeklySummary[] {
  if (!Array.isArray(entries)) return []
  const weekMap = new Map<
    string,
    {
      startDate: string
      endDate: string
      weekLabel: string
      sessions: SessionEntry[]
    }
  >()

  entries.forEach((entry) => {
    if (!entry || !entry.date) return
    const d = new Date(`${entry.date}T12:00:00`)
    if (isNaN(d.getTime())) return

    // Get Monday of the week
    const day = (d.getDay() + 6) % 7 // 0 = Mon, 6 = Sun
    const mon = new Date(d)
    mon.setDate(d.getDate() - day)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)

    const monStr = mon.toISOString().slice(0, 10)
    const sunStr = sun.toISOString().slice(0, 10)
    const weekKey = `${monStr}_to_${sunStr}`

    const monLabel = mon.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const sunLabel = sun.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const weekLabel = `${monLabel} – ${sunLabel}`

    const item = weekMap.get(weekKey) || {
      startDate: monStr,
      endDate: sunStr,
      weekLabel,
      sessions: [],
    }
    item.sessions.push(entry)
    weekMap.set(weekKey, item)
  })

  const summaries: WeeklySummary[] = []

  weekMap.forEach((val, weekKey) => {
    let totalMinutes = 0
    let discountMinutes = 0
    let effectiveMinutes = 0
    let moneyWithoutDiscount = 0
    let discountMoney = 0
    let finalMoney = 0
    const clients = new Set<string>()
    const days = new Set<string>()

    val.sessions.forEach((s) => {
      totalMinutes += Number(s.totalMinutes) || 0
      discountMinutes += Number(s.discountMinutes) || 0
      effectiveMinutes += Number(s.effectiveMinutes) || 0
      moneyWithoutDiscount += Number(s.moneyWithoutDiscount) || 0
      discountMoney += Number(s.discountMoney) || 0
      finalMoney += Number(s.moneyWithDiscount) || 0
      if (s.client) clients.add(s.client)
      if (s.date) days.add(s.date)
    })

    summaries.push({
      weekKey,
      weekLabel: val.weekLabel,
      startDate: val.startDate,
      endDate: val.endDate,
      totalSessions: val.sessions.length,
      totalMinutes,
      discountMinutes,
      effectiveMinutes,
      moneyWithoutDiscount,
      discountMoney,
      finalMoney,
      daysCount: days.size,
      uniqueClients: Array.from(clients),
      sessions: val.sessions.sort((a, b) => b.date.localeCompare(a.date) || String(b.startTime || '').localeCompare(String(a.startTime || ''))),
    })
  })

  return summaries.sort((a, b) => b.startDate.localeCompare(a.startDate))
}
