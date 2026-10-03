import React, { useState } from 'react'
import { CalendarRange, ChevronDown, ChevronUp } from 'lucide-react'
import type { WeeklySummary } from '../types'
import { formatMinutes, formatRupees } from '../utils/calculations'

interface WeeklyBreakdownViewProps {
  weeklySummaries: WeeklySummary[]
  userRole?: 'admin' | 'read'
}

export const WeeklyBreakdownView: React.FC<WeeklyBreakdownViewProps> = ({
  weeklySummaries,
  userRole = 'read',
}) => {
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({})

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekKey]: !prev[weekKey],
    }))
  }

  const expandAll = () => {
    const next: Record<string, boolean> = {}
    weeklySummaries.forEach((w) => (next[w.weekKey] = true))
    setExpandedWeeks(next)
  }

  const collapseAll = () => {
    setExpandedWeeks({})
  }

  const isAdmin = userRole === 'admin'

  if (weeklySummaries.length === 0) {
    return (
      <div className="empty-state">
        <CalendarRange size={36} color="#859288" />
        <strong>No weekly records found</strong>
        <span>Adjust your date filters or log work sessions to view weekly aggregations.</span>
      </div>
    )
  }

  return (
    <div className="weekly-view-wrap">
      <div className="view-sub-header">
        <div>
          <h3>Weekly Aggregations &amp; Workload Breakdown</h3>
          <p>
            Week-by-week workload summaries from Monday to Sunday with billable time and session logs.
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
        {weeklySummaries.map((week) => {
          const isExpanded = expandedWeeks[week.weekKey] ?? true

          return (
            <div key={week.weekKey} className="day-card">
              <div className="day-card-header" onClick={() => toggleWeek(week.weekKey)}>
                <div className="day-card-title">
                  <div className="calendar-tag" style={{ minWidth: '58px' }}>
                    <span className="cal-day" style={{ fontSize: '13px' }}>Week</span>
                    <span className="cal-month" style={{ fontSize: '10px' }}>{week.daysCount}d work</span>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '14px' }}>{week.weekLabel}</strong>
                      <span className="multi-badge">{week.totalSessions} sessions</span>
                    </div>
                    <small style={{ color: '#77827a', fontSize: '11px' }}>
                      {week.uniqueClients.join(', ') || 'General Work'} &bull; {week.daysCount} active working days
                    </small>
                  </div>
                </div>

                <div className="day-card-quick-metrics">
                  <div className="quick-metric">
                    <small>Effective Time</small>
                    <strong style={{ color: '#0f6b61' }}>{formatMinutes(week.effectiveMinutes)}</strong>
                  </div>
                  {isAdmin ? (
                    <div className="quick-metric">
                      <small>Net Earnings</small>
                      <strong style={{ color: '#0f6b61' }}>{formatRupees(week.finalMoney)}</strong>
                    </div>
                  ) : (
                    <div className="quick-metric">
                      <small>Total Time</small>
                      <strong>{formatMinutes(week.totalMinutes)}</strong>
                    </div>
                  )}
                  <button className="icon-btn" style={{ marginLeft: '6px' }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Week Metrics Row */}
              <div className="day-metrics-bar">
                <div className="day-stat">
                  <span>Total Time:</span>
                  <b>{formatMinutes(week.totalMinutes)}</b>
                </div>
                <div className="day-stat">
                  <span>Effective Time:</span>
                  <b style={{ color: '#0f6b61' }}>{formatMinutes(week.effectiveMinutes)}</b>
                </div>
                <div className="day-stat">
                  <span>Time Discount:</span>
                  <b style={{ color: '#b2572b' }}>
                    {week.discountMinutes > 0 ? `-${formatMinutes(week.discountMinutes)}` : '0m'}
                  </b>
                </div>
                <div className="day-stat">
                  <span>Working Days:</span>
                  <b>{week.daysCount} days</b>
                </div>

                {isAdmin && (
                  <>
                    <div className="day-stat">
                      <span>Gross Money:</span>
                      <b>{formatRupees(week.moneyWithoutDiscount)}</b>
                    </div>
                    <div className="day-stat">
                      <span>Discount (INR):</span>
                      <b style={{ color: '#b2572b' }}>
                        {week.discountMoney > 0 ? `-${formatRupees(week.discountMoney)}` : '₹0'}
                      </b>
                    </div>
                    <div className="day-stat highlight">
                      <span>Total Net Money:</span>
                      <b>{formatRupees(week.finalMoney)}</b>
                    </div>
                  </>
                )}
              </div>

              {/* Sessions Table for this week */}
              {isExpanded && (
                <div className="day-sessions-table-wrap">
                  <table className="sub-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Timing</th>
                        <th>Client / Project</th>
                        <th>Description</th>
                        <th>Total</th>
                        <th>Discount</th>
                        <th>Effective</th>
                        <th>Rate</th>
                        {isAdmin && <th style={{ textAlign: 'right' }}>Gross</th>}
                        {isAdmin && <th style={{ textAlign: 'right' }}>Net Final</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {week.sessions.map((session) => (
                        <tr key={session.id}>
                          <td>
                            <strong>{session.date}</strong>
                          </td>
                          <td>
                            <span className="timing-pill">
                              {session.startTime} - {session.endTime}
                            </span>
                          </td>
                          <td>
                            <strong>{session.client}</strong>
                            <small>{session.project}</small>
                          </td>
                          <td style={{ maxWidth: '220px', fontSize: '11px', color: '#525d55' }}>
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
                          <td>₹{session.rate}/hr</td>
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
