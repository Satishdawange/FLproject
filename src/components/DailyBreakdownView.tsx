import React, { useState } from 'react'
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import type { DailySummary } from '../types'
import { formatMinutes, formatRupees } from '../utils/calculations'

interface DailyBreakdownViewProps {
  dailySummaries: DailySummary[]
  onOpenSessionModal?: () => void
  userRole?: 'admin' | 'read'
}

export const DailyBreakdownView: React.FC<DailyBreakdownViewProps> = ({
  dailySummaries,
  userRole = 'read',
}) => {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})

  const isAdmin = userRole === 'admin'

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }))
  }

  const expandAll = () => {
    const next: Record<string, boolean> = {}
    dailySummaries.forEach((d) => (next[d.date] = true))
    setExpandedDates(next)
  }

  const collapseAll = () => {
    setExpandedDates({})
  }

  if (dailySummaries.length === 0) {
    return (
      <div className="empty-state">
        <Calendar size={36} color="#859288" />
        <strong>No daily records found</strong>
        <span>Log work sessions or adjust your filters to see day-by-day aggregations.</span>
      </div>
    )
  }

  return (
    <div className="daily-view-wrap">
      <div className="view-sub-header">
        <div>
          <h3>Daily Aggregations &amp; Multi-Session Summaries</h3>
          <p>
            Summary of all sessions on each day with session timings, time discounts, and billable duration.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary-btn" onClick={expandAll} style={{ fontSize: '11px', padding: '6px 10px' }}>
            Expand All
          </button>
          <button className="secondary-btn" onClick={collapseAll} style={{ fontSize: '11px', padding: '6px 10px' }}>
            Collapse All
          </button>
        </div>
      </div>

      <div className="daily-cards-list">
        {dailySummaries.map((day) => {
          const isExpanded = expandedDates[day.date] ?? true
          const dateObj = new Date(`${day.date}T12:00:00`)
          const formattedDate = dateObj.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
          const isMultiSession = day.sessionsCount > 1

          return (
            <div key={day.date} className="day-card">
              <div className="day-card-header" onClick={() => toggleDate(day.date)}>
                <div className="day-card-title">
                  <div className="calendar-tag">
                    <span className="cal-day">{dateObj.getDate()}</span>
                    <span className="cal-month">{dateObj.toLocaleDateString('en-IN', { month: 'short' })}</span>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong>{formattedDate}</strong>
                      {isMultiSession ? (
                        <span className="multi-badge">
                          {day.sessionsCount} sessions
                        </span>
                      ) : (
                        <span className="single-badge">1 session</span>
                      )}
                    </div>
                    <small style={{ color: '#77827a', fontSize: '11px' }}>
                      {Array.from(new Set((day.sessions || []).map((s) => s.client))).filter(Boolean).join(', ') || 'General Work'}
                    </small>
                  </div>
                </div>

                <div className="day-card-quick-metrics">
                  <div className="quick-metric">
                    <small>Effective Time</small>
                    <strong style={{ color: '#0f6b61' }}>{formatMinutes(day.effectiveMinutes)}</strong>
                  </div>
                  {isAdmin ? (
                    <div className="quick-metric">
                      <small>Net Earnings</small>
                      <strong style={{ color: '#0f6b61' }}>{formatRupees(day.finalMoney)}</strong>
                    </div>
                  ) : (
                    <div className="quick-metric">
                      <small>Total Time</small>
                      <strong>{formatMinutes(day.totalMinutes)}</strong>
                    </div>
                  )}
                  <button className="icon-btn" style={{ marginLeft: '6px' }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Day Metrics Row */}
              <div className="day-metrics-bar">
                <div className="day-stat">
                  <span>Total Time:</span>
                  <b>{formatMinutes(day.totalMinutes)}</b>
                </div>
                <div className="day-stat">
                  <span>Effective Time:</span>
                  <b style={{ color: '#0f6b61' }}>{formatMinutes(day.effectiveMinutes)}</b>
                </div>
                <div className="day-stat">
                  <span>Time Discount:</span>
                  <b style={{ color: '#b2572b' }}>
                    {day.discountMinutes > 0 ? `-${formatMinutes(day.discountMinutes)}` : '0m'}
                  </b>
                </div>
                <div className="day-stat">
                  <span>Sessions:</span>
                  <b>{day.sessionsCount} logged</b>
                </div>

                {isAdmin && (
                  <>
                    <div className="day-stat">
                      <span>Gross Money:</span>
                      <b>{formatRupees(day.moneyWithoutDiscount)}</b>
                    </div>
                    <div className="day-stat">
                      <span>Discount (INR):</span>
                      <b style={{ color: '#b2572b' }}>
                        {day.discountMoney > 0 ? `-${formatRupees(day.discountMoney)}` : '₹0'}
                      </b>
                    </div>
                    <div className="day-stat highlight">
                      <span>Total Final Money:</span>
                      <b>{formatRupees(day.finalMoney)}</b>
                    </div>
                  </>
                )}
              </div>

              {/* Individual Sessions Breakdown for the day */}
              {isExpanded && (
                <div className="day-sessions-table-wrap">
                  <table className="sub-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Client / Project</th>
                        <th>Description</th>
                        <th>Total</th>
                        <th>Discount</th>
                        <th>Effective</th>
                        {isAdmin && <th>Rate</th>}
                        {isAdmin && <th style={{ textAlign: 'right' }}>Gross</th>}
                        {isAdmin && <th style={{ textAlign: 'right' }}>Net Final</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {day.sessions.map((session) => (
                        <tr key={session.id}>
                          <td>
                            <span className="timing-pill">
                              {session.startTime} - {session.endTime}
                            </span>
                          </td>
                          <td>
                            <strong>{session.client}</strong>
                            <small>{session.project}</small>
                          </td>
                          <td style={{ maxWidth: '240px', fontSize: '11px', color: '#525d55' }}>
                            {session.description}
                          </td>
                          <td>{formatMinutes(session.totalMinutes)}</td>
                          <td>
                            {session.discountMinutes > 0 ? (
                              <span className="discount-pill">
                                -{session.discountMinutes}m {isAdmin && `(${formatRupees(session.discountMoney)})`}
                              </span>
                            ) : (
                              <span style={{ color: '#97a399' }}>—</span>
                            )}
                          </td>
                          <td>
                            <strong style={{ color: '#0f6b61' }}>
                              {formatMinutes(session.effectiveMinutes)}
                            </strong>
                          </td>
                          {isAdmin && <td>₹{session.rate}/hr</td>}
                          {isAdmin && (
                            <td style={{ textAlign: 'right', color: '#626f65' }}>
                              {formatRupees(session.moneyWithoutDiscount)}
                            </td>
                          )}
                          {isAdmin && (
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f6b61' }}>
                              {formatRupees(session.moneyWithDiscount)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
