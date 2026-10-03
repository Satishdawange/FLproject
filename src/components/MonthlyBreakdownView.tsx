import React from 'react'
import { CalendarRange, Users, Clock, IndianRupee, Layers } from 'lucide-react'
import type { MonthlySummary } from '../types'

import { formatMinutes, formatRupees } from '../utils/calculations'

interface MonthlyBreakdownViewProps {
  monthlySummaries: MonthlySummary[]
  userRole?: 'admin' | 'read'
}

export const MonthlyBreakdownView: React.FC<MonthlyBreakdownViewProps> = ({
  monthlySummaries,
  userRole = 'read',
}) => {
  const isAdmin = userRole === 'admin'

  if (monthlySummaries.length === 0) {
    return (
      <div className="empty-state">
        <CalendarRange size={36} color="#859288" />
        <strong>No monthly records available</strong>
        <span>Log work sessions to view automated monthly aggregations.</span>
      </div>
    )
  }

  return (
    <div className="monthly-view-wrap">
      <div className="view-sub-header">
        <div>
          <h3>Monthly Aggregations &amp; Workload Summary</h3>
          <p>
            Aggregated monthly metrics matching your automated Google Sheet month tabs.
          </p>
        </div>
      </div>

      <div className="monthly-grid">
        {monthlySummaries.map((month) => {
          return (
            <div key={month.monthKey} className="month-card">
              <div className="month-card-header">
                <div>
                  <span className="month-badge">{month.monthKey}</span>
                  <h4 style={{ margin: '6px 0 2px', fontSize: '18px', color: '#1f2e26' }}>
                    {month.monthName}
                  </h4>
                  <small style={{ color: '#748077', fontSize: '12px' }}>
                    {month.daysCount} active working days &bull; {month.totalSessions} work sessions
                  </small>
                </div>
                {isAdmin ? (
                  <div className="month-header-final">
                    <small>Net Revenue</small>
                    <strong>{formatRupees(month.finalMoney)}</strong>
                  </div>
                ) : (
                  <div className="month-header-final">
                    <small>Total Duration</small>
                    <strong style={{ color: '#0f6b61' }}>{formatMinutes(month.totalMinutes)}</strong>
                  </div>
                )}
              </div>

              <div className="month-stats-grid">
                <div className="month-stat-box">
                  <div className="stat-label">
                    <Clock size={13} />
                    <span>Total Time</span>
                  </div>
                  <strong>{formatMinutes(month.totalMinutes)}</strong>
                  <small>{(month.totalMinutes / 60).toFixed(1)} hrs</small>
                </div>

                <div className="month-stat-box highlight">
                  <div className="stat-label">
                    <Clock size={13} />
                    <span>Effective Time</span>
                  </div>
                  <strong>{formatMinutes(month.effectiveMinutes)}</strong>
                  <small>{(month.effectiveMinutes / 60).toFixed(1)} billable hrs</small>
                </div>

                {isAdmin ? (
                  <>
                    <div className="month-stat-box">
                      <div className="stat-label">
                        <IndianRupee size={13} />
                        <span>Gross (No Disc.)</span>
                      </div>
                      <strong>{formatRupees(month.moneyWithoutDiscount)}</strong>
                      <small>Before reductions</small>
                    </div>

                    <div className="month-stat-box discount">
                      <div className="stat-label">
                        <Layers size={13} />
                        <span>Total Discount</span>
                      </div>
                      <strong style={{ color: '#b2572b' }}>-{formatRupees(month.discountMoney)}</strong>
                      <small>-{formatMinutes(month.discountMinutes)} deducted</small>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="month-stat-box discount">
                      <div className="stat-label">
                        <Layers size={13} />
                        <span>Time Discount</span>
                      </div>
                      <strong style={{ color: '#b2572b' }}>
                        {month.discountMinutes > 0 ? `-${formatMinutes(month.discountMinutes)}` : '0m'}
                      </strong>
                      <small>Deducted from gross</small>
                    </div>

                    <div className="month-stat-box">
                      <div className="stat-label">
                        <CalendarRange size={13} />
                        <span>Working Days</span>
                      </div>
                      <strong>{month.daysCount} days</strong>
                      <small>{month.totalSessions} sessions logged</small>
                    </div>
                  </>
                )}
              </div>

              <div className="month-clients-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#57635b' }}>
                  <Users size={14} />
                  <span>Clients:</span>
                </div>
                <div className="client-tags-row">
                  {(month.uniqueClients || []).map((client) => (
                    <span key={client} className="client-chip">
                      {client}
                    </span>
                  ))}
                </div>

              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
