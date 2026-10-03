import React, { useState, useMemo } from 'react'
import {
  PieChart,
  TrendingUp,
  Calendar,
  Clock,
  Layers,
  Users,
  IndianRupee,
  FolderKanban,
  Percent,
  RotateCcw,
} from 'lucide-react'
import type { SessionEntry } from '../types'
import { formatMinutes, formatRupees } from '../utils/calculations'

interface AnalyticsViewProps {
  entries: SessionEntry[]
  userRole?: 'admin' | 'read'
  availableClients: string[]
  availableProjects: string[]
}

const PALETTE = [
  '#0f6b61', // Teal
  '#2a8560', // Emerald
  '#2563eb', // Blue
  '#d97706', // Amber
  '#8b5cf6', // Purple
  '#e11d48', // Rose
  '#0284c7', // Sky
  '#4f46e5', // Indigo
  '#16a34a', // Green
  '#ea580c', // Orange
]

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  entries,
  userRole = 'read',
  availableClients,
  availableProjects,
}) => {
  const isAdmin = userRole === 'admin'

  // --- FILTERS STATE ---
  const [periodFilter, setPeriodFilter] = useState<
    'all' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom'
  >('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [trendGrouping, setTrendGrouping] = useState<'daily' | 'weekly'>('daily')
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null)
  const [hoveredDonutIndex, setHoveredDonutIndex] = useState<number | null>(null)
  const [breakdownTab, setBreakdownTab] = useState<'clients' | 'projects'>('clients')

  // --- DATE RANGES LOGIC ---
  const filteredEntries = useMemo(() => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    return entries.filter((e) => {
      // 1. Period Filter
      if (periodFilter === '7days') {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        const dStr = d.toISOString().split('T')[0]
        if (e.date < dStr || e.date > todayStr) return false
      } else if (periodFilter === '30days') {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        const dStr = d.toISOString().split('T')[0]
        if (e.date < dStr || e.date > todayStr) return false
      } else if (periodFilter === 'this_month') {
        const y = today.getFullYear()
        const m = String(today.getMonth() + 1).padStart(2, '0')
        const monthPrefix = `${y}-${m}`
        if (!e.date.startsWith(monthPrefix)) return false
      } else if (periodFilter === 'last_month') {
        const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const y = prevMonthDate.getFullYear()
        const m = String(prevMonthDate.getMonth() + 1).padStart(2, '0')
        const monthPrefix = `${y}-${m}`
        if (!e.date.startsWith(monthPrefix)) return false
      } else if (periodFilter === 'custom') {
        if (customStart && e.date < customStart) return false
        if (customEnd && e.date > customEnd) return false
      }

      // 2. Client Filter
      if (selectedClient !== 'all' && e.client !== selectedClient) {
        return false
      }

      // 3. Project Filter
      if (selectedProject !== 'all' && e.project !== selectedProject) {
        return false
      }

      return true
    })
  }, [entries, periodFilter, customStart, customEnd, selectedClient, selectedProject])

  // --- OVERALL KPI TOTALS ---
  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, e) => {
        const total = Number(e.totalMinutes) || 0
        const disc = Number(e.discountMinutes) || 0
        const eff = Number(e.effectiveMinutes) || 0
        const gross = Number(e.moneyWithoutDiscount) || 0
        const dMoney = Number(e.discountMoney) || 0
        const net = Number(e.moneyWithDiscount) || 0

        acc.totalMinutes += total
        acc.discountMinutes += disc
        acc.effectiveMinutes += eff
        acc.grossMoney += gross
        acc.discountMoney += dMoney
        acc.netMoney += net
        return acc
      },
      {
        totalMinutes: 0,
        discountMinutes: 0,
        effectiveMinutes: 0,
        grossMoney: 0,
        discountMoney: 0,
        netMoney: 0,
      }
    )
  }, [filteredEntries])

  const discountRatio = useMemo(() => {
    if (totals.totalMinutes === 0) return 0
    return ((totals.discountMinutes / totals.totalMinutes) * 100).toFixed(1)
  }, [totals])

  const avgHourlyRate = useMemo(() => {
    if (filteredEntries.length === 0) return 0
    const sumRate = filteredEntries.reduce((acc, e) => acc + (Number(e.rate) || 0), 0)
    return Math.round(sumRate / filteredEntries.length)
  }, [filteredEntries])

  // --- CLIENT DISTRIBUTION ---
  const clientBreakdown = useMemo(() => {
    const map: Record<
      string,
      {
        name: string
        sessions: number
        totalMinutes: number
        discountMinutes: number
        effectiveMinutes: number
        netMoney: number
        projects: Set<string>
      }
    > = {}

    filteredEntries.forEach((e) => {
      const c = e.client || 'Unassigned'
      if (!map[c]) {
        map[c] = {
          name: c,
          sessions: 0,
          totalMinutes: 0,
          discountMinutes: 0,
          effectiveMinutes: 0,
          netMoney: 0,
          projects: new Set(),
        }
      }
      map[c].sessions += 1
      map[c].totalMinutes += Number(e.totalMinutes) || 0
      map[c].discountMinutes += Number(e.discountMinutes) || 0
      map[c].effectiveMinutes += Number(e.effectiveMinutes) || 0
      map[c].netMoney += Number(e.moneyWithDiscount) || 0
      if (e.project) map[c].projects.add(e.project)
    })

    return Object.values(map)
      .map((item, idx) => ({
        ...item,
        color: PALETTE[idx % PALETTE.length],
        percentage:
          totals.effectiveMinutes > 0
            ? Math.round((item.effectiveMinutes / totals.effectiveMinutes) * 100)
            : 0,
      }))
      .sort((a, b) => b.effectiveMinutes - a.effectiveMinutes)
  }, [filteredEntries, totals.effectiveMinutes])

  // --- PROJECT DISTRIBUTION ---
  const projectBreakdown = useMemo(() => {
    const map: Record<
      string,
      {
        name: string
        client: string
        sessions: number
        totalMinutes: number
        effectiveMinutes: number
        netMoney: number
      }
    > = {}

    filteredEntries.forEach((e) => {
      const p = e.project || 'General'
      if (!map[p]) {
        map[p] = {
          name: p,
          client: e.client,
          sessions: 0,
          totalMinutes: 0,
          effectiveMinutes: 0,
          netMoney: 0,
        }
      }
      map[p].sessions += 1
      map[p].totalMinutes += Number(e.totalMinutes) || 0
      map[p].effectiveMinutes += Number(e.effectiveMinutes) || 0
      map[p].netMoney += Number(e.moneyWithDiscount) || 0
    })

    return Object.values(map)
      .map((item, idx) => ({
        ...item,
        color: PALETTE[(idx + 2) % PALETTE.length],
        percentage:
          totals.effectiveMinutes > 0
            ? Math.round((item.effectiveMinutes / totals.effectiveMinutes) * 100)
            : 0,
      }))
      .sort((a, b) => b.effectiveMinutes - a.effectiveMinutes)
  }, [filteredEntries, totals.effectiveMinutes])

  // --- DAY OF WEEK PATTERN ---
  const dayOfWeekDistribution = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayCounts = [0, 0, 0, 0, 0, 0, 0] // minutes per day
    const sessionCounts = [0, 0, 0, 0, 0, 0, 0]

    filteredEntries.forEach((e) => {
      if (!e.date) return
      const d = new Date(e.date)
      const dayIdx = d.getDay()
      dayCounts[dayIdx] += Number(e.effectiveMinutes) || 0
      sessionCounts[dayIdx] += 1
    })

    // Reorder Mon to Sun
    const reorderedIndices = [1, 2, 3, 4, 5, 6, 0]
    const maxMinutes = Math.max(...dayCounts, 1)

    return reorderedIndices.map((idx) => ({
      day: days[idx],
      shortDay: days[idx].substring(0, 3),
      minutes: dayCounts[idx],
      hours: (dayCounts[idx] / 60).toFixed(1),
      sessions: sessionCounts[idx],
      percentage: Math.round((dayCounts[idx] / maxMinutes) * 100),
    }))
  }, [filteredEntries])

  // --- TREND CHART DATA (DAILY OR WEEKLY) ---
  const trendData = useMemo(() => {
    if (filteredEntries.length === 0) return []

    if (trendGrouping === 'daily') {
      const dayMap: Record<
        string,
        {
          key: string
          label: string
          totalMinutes: number
          effectiveMinutes: number
          sessions: number
          netMoney: number
        }
      > = {}

      filteredEntries.forEach((e) => {
        const k = e.date
        if (!dayMap[k]) {
          dayMap[k] = {
            key: k,
            label: k,
            totalMinutes: 0,
            effectiveMinutes: 0,
            sessions: 0,
            netMoney: 0,
          }
        }
        dayMap[k].totalMinutes += Number(e.totalMinutes) || 0
        dayMap[k].effectiveMinutes += Number(e.effectiveMinutes) || 0
        dayMap[k].sessions += 1
        dayMap[k].netMoney += Number(e.moneyWithDiscount) || 0
      })

      return Object.values(dayMap).sort((a, b) => a.key.localeCompare(b.key))
    } else {
      // Weekly grouping
      const weekMap: Record<
        string,
        {
          key: string
          label: string
          totalMinutes: number
          effectiveMinutes: number
          sessions: number
          netMoney: number
        }
      > = {}

      filteredEntries.forEach((e) => {
        if (!e.date) return
        const d = new Date(e.date)
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        const mon = new Date(d.setDate(diff))
        const k = mon.toISOString().split('T')[0]
        const label = `Week of ${mon.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`

        if (!weekMap[k]) {
          weekMap[k] = {
            key: k,
            label,
            totalMinutes: 0,
            effectiveMinutes: 0,
            sessions: 0,
            netMoney: 0,
          }
        }
        weekMap[k].totalMinutes += Number(e.totalMinutes) || 0
        weekMap[k].effectiveMinutes += Number(e.effectiveMinutes) || 0
        weekMap[k].sessions += 1
        weekMap[k].netMoney += Number(e.moneyWithDiscount) || 0
      })

      return Object.values(weekMap).sort((a, b) => a.key.localeCompare(b.key))
    }
  }, [filteredEntries, trendGrouping])

  const maxTrendMinutes = useMemo(() => {
    if (trendData.length === 0) return 60
    return Math.max(...trendData.map((t) => t.effectiveMinutes), 60)
  }, [trendData])

  // --- DONUT SLICES COMPUTATION ---
  const donutSlices = useMemo(() => {
    let cumulativeAngle = 0
    const total = totals.effectiveMinutes || 1

    return clientBreakdown.map((item) => {
      const fraction = item.effectiveMinutes / total
      const angle = fraction * 360
      const startAngle = cumulativeAngle
      cumulativeAngle += angle
      return {
        ...item,
        fraction,
        startAngle,
        angle,
      }
    })
  }, [clientBreakdown, totals.effectiveMinutes])

  const isAnyFilterActive =
    periodFilter !== 'all' || selectedClient !== 'all' || selectedProject !== 'all'

  const resetFilters = () => {
    setPeriodFilter('all')
    setSelectedClient('all')
    setSelectedProject('all')
    setCustomStart('')
    setCustomEnd('')
  }

  return (
    <div className="analytics-container">
      {/* ANALYTICS HEADER & FILTER CONTROLS */}
      <div className="analytics-header-card">
        <div className="analytics-title-row">
          <div>
            <div className="analytics-badge">
              <TrendingUp size={14} /> Analytics &amp; Visual Intelligence
            </div>
            <h2>Performance &amp; Time Analytics</h2>
            <p>
              Interactive breakdowns, workload distribution, and real-time visualization of work
              sessions.
            </p>
          </div>

          {isAnyFilterActive && (
            <button className="secondary-btn" onClick={resetFilters} title="Reset all filters">
              <RotateCcw size={14} /> Reset Filters
            </button>
          )}
        </div>

        {/* MULTI-FILTER CONTROL BAR */}
        <div className="analytics-filter-bar">
          {/* Period Filter */}
          <div className="analytics-filter-item">
            <label>
              <Calendar size={13} /> Timeframe:
            </label>
            <select
              value={periodFilter}
              onChange={(e) =>
                setPeriodFilter(
                  e.target.value as 'all' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom'
                )
              }
              className="analytics-select"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Custom Date Range if selected */}
          {periodFilter === 'custom' && (
            <div className="analytics-filter-item custom-range-inputs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="analytics-select"
              />
              <span>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="analytics-select"
              />
            </div>
          )}

          {/* Client Filter */}
          <div className="analytics-filter-item">
            <label>
              <Users size={13} /> Client:
            </label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="analytics-select"
            >
              <option value="all">All Clients ({availableClients.length})</option>
              {availableClients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Project Filter */}
          <div className="analytics-filter-item">
            <label>
              <FolderKanban size={13} /> Project:
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="analytics-select"
            >
              <option value="all">All Projects ({availableProjects.length})</option>
              {availableProjects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Active Filter Indicators */}
          <div className="analytics-filter-summary">
            <span>
              Showing <b>{filteredEntries.length}</b> of {entries.length} sessions
            </span>
          </div>
        </div>
      </div>

      {/* QUICK KPI TILES */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card highlight">
          <div className="kpi-top">
            <span>Billable Work Hours</span>
            <Clock size={16} color="#d5efe5" />
          </div>
          <strong>{(totals.effectiveMinutes / 60).toFixed(1)} hrs</strong>
          <small>{formatMinutes(totals.effectiveMinutes)} net effective time</small>
        </div>

        <div className="analytics-kpi-card">
          <div className="kpi-top">
            <span>Time Discount Saved</span>
            <Percent size={16} color="#c76735" />
          </div>
          <strong style={{ color: '#c76735' }}>{formatMinutes(totals.discountMinutes)}</strong>
          <small>{discountRatio}% deduction on gross duration</small>
        </div>

        {isAdmin ? (
          <div className="analytics-kpi-card">
            <div className="kpi-top">
              <span>Total Revenue (Net)</span>
              <IndianRupee size={16} color="#0f6b61" />
            </div>
            <strong style={{ color: '#0f6b61' }}>{formatRupees(totals.netMoney)}</strong>
            <small>
              Gross: {formatRupees(totals.grossMoney)} (-{formatRupees(totals.discountMoney)} disc.)
            </small>
          </div>
        ) : (
          <div className="analytics-kpi-card">
            <div className="kpi-top">
              <span>Avg Rate / Hour</span>
              <IndianRupee size={16} color="#0f6b61" />
            </div>
            <strong style={{ color: '#0f6b61' }}>₹{avgHourlyRate}/hr</strong>
            <small>Standard service billing rate</small>
          </div>
        )}

        <div className="analytics-kpi-card">
          <div className="kpi-top">
            <span>Client &amp; Project Reach</span>
            <Layers size={16} color="#2563eb" />
          </div>
          <strong>{clientBreakdown.length} Clients</strong>
          <small>
            {projectBreakdown.length} projects across {filteredEntries.length} sessions
          </small>
        </div>
      </div>

      {/* MAIN CHARTS GRID */}
      <div className="analytics-charts-grid">
        {/* CHART 1: WORKLOAD TREND OVER TIME (BAR CHART) */}
        <div className="chart-card full-width">
          <div className="chart-header">
            <div>
              <h3>Workload &amp; Hours Trend</h3>
              <p>Effective billable hours logged over time</p>
            </div>
            <div className="chart-toggle-group">
              <button
                className={`chart-toggle-btn ${trendGrouping === 'daily' ? 'active' : ''}`}
                onClick={() => setTrendGrouping('daily')}
              >
                Daily Trend
              </button>
              <button
                className={`chart-toggle-btn ${trendGrouping === 'weekly' ? 'active' : ''}`}
                onClick={() => setTrendGrouping('weekly')}
              >
                Weekly Trend
              </button>
            </div>
          </div>

          {trendData.length === 0 ? (
            <div className="empty-chart-state">
              <Clock size={28} color="#9aa79e" />
              <p>No work session records found matching the active filters.</p>
            </div>
          ) : (
            <div className="bar-chart-container">
              <div className="bar-chart-svg-wrap">
                <svg
                  viewBox={`0 0 ${Math.max(trendData.length * 48, 520)} 220`}
                  className="interactive-bar-svg"
                  preserveAspectRatio="none"
                >
                  {/* Grid Lines */}
                  <line x1="0" y1="40" x2="100%" y2="40" stroke="#edf2ee" strokeDasharray="3 3" />
                  <line x1="0" y1="90" x2="100%" y2="90" stroke="#edf2ee" strokeDasharray="3 3" />
                  <line x1="0" y1="140" x2="100%" y2="140" stroke="#edf2ee" strokeDasharray="3 3" />
                  <line x1="0" y1="180" x2="100%" y2="180" stroke="#d5dfd7" />

                  {trendData.map((item, idx) => {
                    const barWidth = 26
                    const totalWidth = Math.max(trendData.length * 48, 520)
                    const slotWidth = totalWidth / trendData.length
                    const x = idx * slotWidth + (slotWidth - barWidth) / 2
                    const height = (item.effectiveMinutes / maxTrendMinutes) * 140
                    const y = 180 - height
                    const isHovered = hoveredBarIndex === idx

                    return (
                      <g
                        key={item.key}
                        onMouseEnter={() => setHoveredBarIndex(idx)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Background hover pillar */}
                        <rect
                          x={idx * slotWidth}
                          y="10"
                          width={slotWidth}
                          height="180"
                          fill={isHovered ? 'rgba(15, 107, 97, 0.04)' : 'transparent'}
                        />

                        {/* Bar */}
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={Math.max(height, 2)}
                          rx="4"
                          fill={isHovered ? '#0a4d46' : '#0f6b61'}
                          style={{ transition: 'all 0.2s ease' }}
                        />

                        {/* Value on top of bar if space permits */}
                        {height > 20 && (
                          <text
                            x={x + barWidth / 2}
                            y={y - 6}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="700"
                            fill="#0f6b61"
                          >
                            {(item.effectiveMinutes / 60).toFixed(1)}h
                          </text>
                        )}

                        {/* X-axis label */}
                        <text
                          x={x + barWidth / 2}
                          y="200"
                          textAnchor="middle"
                          fontSize="9"
                          fill="#68776d"
                        >
                          {trendGrouping === 'daily'
                            ? item.label.slice(5) // MM-DD
                            : `W${idx + 1}`}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Hover Tooltip Info Banner */}
              {hoveredBarIndex !== null && trendData[hoveredBarIndex] && (
                <div className="bar-hover-card">
                  <div>
                    <strong>{trendData[hoveredBarIndex].label}</strong>
                    <span>
                      {formatMinutes(trendData[hoveredBarIndex].effectiveMinutes)} effective work time
                    </span>
                  </div>
                  <div className="bar-hover-meta">
                    <span>
                      <b>{trendData[hoveredBarIndex].sessions}</b> session(s)
                    </span>
                    {isAdmin && (
                      <span className="bar-revenue-badge">
                        Net: {formatRupees(trendData[hoveredBarIndex].netMoney)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CHART 2: CLIENT DISTRIBUTION (DONUT CHART) */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3>Client Workload Share</h3>
              <p>Percentage of billable hours per client</p>
            </div>
            <PieChart size={18} color="#0f6b61" />
          </div>

          {clientBreakdown.length === 0 ? (
            <div className="empty-chart-state">
              <Users size={28} color="#9aa79e" />
              <p>No client data in selected timeframe.</p>
            </div>
          ) : (
            <div className="donut-chart-layout">
              {/* SVG Donut Visual */}
              <div className="donut-svg-container">
                <svg viewBox="0 0 160 160" className="donut-svg">
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    fill="none"
                    stroke="#edf2ee"
                    strokeWidth="24"
                  />
                  {donutSlices.map((slice, idx) => {
                    const radius = 60
                    const circumference = 2 * Math.PI * radius
                    const strokeDasharray = `${(slice.fraction * circumference).toFixed(2)} ${circumference.toFixed(2)}`
                    const strokeDashoffset = -(
                      (slice.startAngle / 360) *
                      circumference
                    ).toFixed(2)
                    const isHovered = hoveredDonutIndex === idx

                    return (
                      <circle
                        key={slice.name}
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="none"
                        stroke={slice.color}
                        strokeWidth={isHovered ? '28' : '24'}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        transform="rotate(-90 80 80)"
                        style={{
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={() => setHoveredDonutIndex(idx)}
                        onMouseLeave={() => setHoveredDonutIndex(null)}
                      />
                    )
                  })}
                </svg>
                {/* Center Badge */}
                <div className="donut-center-info">
                  <strong>{clientBreakdown.length}</strong>
                  <small>Clients</small>
                </div>
              </div>

              {/* Client Legend & Hours List */}
              <div className="donut-legend-list">
                {clientBreakdown.map((c, idx) => (
                  <div
                    key={c.name}
                    className={`donut-legend-item ${hoveredDonutIndex === idx ? 'hovered' : ''}`}
                    onMouseEnter={() => setHoveredDonutIndex(idx)}
                    onMouseLeave={() => setHoveredDonutIndex(null)}
                  >
                    <span
                      className="legend-color-dot"
                      style={{ background: c.color }}
                    />
                    <div className="legend-label-col">
                      <strong title={c.name}>{c.name}</strong>
                      <small>
                        {formatMinutes(c.effectiveMinutes)} ({(c.effectiveMinutes / 60).toFixed(1)} hrs)
                      </small>
                    </div>
                    <span className="legend-pct-pill">{c.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CHART 3: PROJECT WORKLOAD ALLOCATION (HORIZONTAL BARS) */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3>Project Workload Ranking</h3>
              <p>Top projects by logged billable hours</p>
            </div>
            <FolderKanban size={18} color="#0f6b61" />
          </div>

          {projectBreakdown.length === 0 ? (
            <div className="empty-chart-state">
              <FolderKanban size={28} color="#9aa79e" />
              <p>No project data available.</p>
            </div>
          ) : (
            <div className="project-bars-list">
              {projectBreakdown.map((p) => {
                const maxProjectMinutes = projectBreakdown[0]?.effectiveMinutes || 1
                const barPct = Math.round((p.effectiveMinutes / maxProjectMinutes) * 100)

                return (
                  <div key={p.name} className="project-bar-card">
                    <div className="project-bar-meta">
                      <div className="project-name-group">
                        <strong>{p.name}</strong>
                        <span className="project-client-badge">{p.client}</span>
                      </div>
                      <div className="project-hours-badge">
                        <span>{(p.effectiveMinutes / 60).toFixed(1)} hrs</span>
                        <small>({p.sessions} sessions)</small>
                      </div>
                    </div>

                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${barPct}%`,
                          background: p.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* CHART 4: DAY-OF-WEEK WORKLOAD (PEAK DAYS) */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3>Weekly Workload Rhythm</h3>
              <p>Hours distribution across days of the week</p>
            </div>
            <Calendar size={18} color="#0f6b61" />
          </div>

          <div className="day-rhythm-grid">
            {dayOfWeekDistribution.map((d) => (
              <div key={d.day} className="day-rhythm-col">
                <span className="day-hours-label">{d.hours}h</span>
                <div className="day-bar-track">
                  <div
                    className="day-bar-fill"
                    style={{
                      height: `${Math.max(d.percentage, 4)}%`,
                      background: d.percentage > 70 ? '#0f6b61' : '#4d988e',
                    }}
                  />
                </div>
                <strong className="day-name-label">{d.shortDay}</strong>
                <small className="day-sessions-count">{d.sessions} sess.</small>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 5: TIME DISCOUNT RATIO / EFFICIENCY GAUGE */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3>Billing Duration Efficiency</h3>
              <p>Gross duration vs applied time discounts</p>
            </div>
            <Percent size={18} color="#0f6b61" />
          </div>

          <div className="efficiency-metric-box">
            <div className="efficiency-ratio-display">
              <div className="ratio-number">
                <strong>{(100 - Number(discountRatio)).toFixed(1)}%</strong>
                <span>Effective Billable Ratio</span>
              </div>
              <div className="ratio-discount-badge">
                <span>{discountRatio}% Discounted</span>
              </div>
            </div>

            <div className="stacked-progress-bar">
              <div
                className="stacked-slice effective"
                style={{ width: `${100 - Number(discountRatio)}%` }}
                title={`Billable Work: ${formatMinutes(totals.effectiveMinutes)}`}
              />
              <div
                className="stacked-slice discount"
                style={{ width: `${discountRatio}%` }}
                title={`Discounted Time: ${formatMinutes(totals.discountMinutes)}`}
              />
            </div>

            <div className="stacked-legend">
              <div className="legend-item">
                <span className="dot teal" />
                <span>
                  Billable Work: <b>{formatMinutes(totals.effectiveMinutes)}</b>
                </span>
              </div>
              <div className="legend-item">
                <span className="dot orange" />
                <span>
                  Discounted: <b>{formatMinutes(totals.discountMinutes)}</b>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED DATA BREAKDOWN TABS & TABLES */}
      <div className="analytics-table-card">
        <div className="analytics-table-header">
          <div>
            <h3>In-Depth Dimension Breakdowns</h3>
            <p>Tabular view of all computed metrics and aggregates</p>
          </div>

          <div className="table-tab-buttons">
            <button
              className={`table-tab-btn ${breakdownTab === 'clients' ? 'active' : ''}`}
              onClick={() => setBreakdownTab('clients')}
            >
              <Users size={14} /> Client Summary ({clientBreakdown.length})
            </button>
            <button
              className={`table-tab-btn ${breakdownTab === 'projects' ? 'active' : ''}`}
              onClick={() => setBreakdownTab('projects')}
            >
              <FolderKanban size={14} /> Project Summary ({projectBreakdown.length})
            </button>
          </div>
        </div>

        <div className="table-wrap">
          {breakdownTab === 'clients' ? (
            <table>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Projects Worked</th>
                  <th>Sessions Count</th>
                  <th>Gross Work Time</th>
                  <th>Time Discount</th>
                  <th>Effective Billable</th>
                  <th>Workload Share</th>
                  {isAdmin && <th>Net Revenue (INR)</th>}
                </tr>
              </thead>
              <tbody>
                {clientBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '24px' }}>
                      No client records available.
                    </td>
                  </tr>
                ) : (
                  clientBreakdown.map((c) => (
                    <tr key={c.name}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: c.color,
                              flexShrink: 0,
                            }}
                          />
                          <strong>{c.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="client-projects-tags">
                          {Array.from(c.projects).join(', ') || '—'}
                        </span>
                      </td>
                      <td>{c.sessions}</td>
                      <td>{formatMinutes(c.totalMinutes)}</td>
                      <td>
                        {c.discountMinutes > 0 ? (
                          <span style={{ color: '#b2572b', fontWeight: 600 }}>
                            -{formatMinutes(c.discountMinutes)}
                          </span>
                        ) : (
                          '0m'
                        )}
                      </td>
                      <td>
                        <strong style={{ color: '#0f6b61' }}>
                          {formatMinutes(c.effectiveMinutes)} ({(c.effectiveMinutes / 60).toFixed(1)}h)
                        </strong>
                      </td>
                      <td>
                        <span className="badge-pill active">{c.percentage}%</span>
                      </td>
                      {isAdmin && (
                        <td>
                          <strong style={{ color: '#0f6b61' }}>{formatRupees(c.netMoney)}</strong>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Associated Client</th>
                  <th>Sessions Count</th>
                  <th>Total Time</th>
                  <th>Effective Billable</th>
                  <th>Workload Share</th>
                  {isAdmin && <th>Net Revenue (INR)</th>}
                </tr>
              </thead>
              <tbody>
                {projectBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '24px' }}>
                      No project records available.
                    </td>
                  </tr>
                ) : (
                  projectBreakdown.map((p) => (
                    <tr key={p.name}>
                      <td>
                        <strong style={{ color: '#1f2e25' }}>{p.name}</strong>
                      </td>
                      <td>{p.client}</td>
                      <td>{p.sessions}</td>
                      <td>{formatMinutes(p.totalMinutes)}</td>
                      <td>
                        <strong style={{ color: '#0f6b61' }}>
                          {formatMinutes(p.effectiveMinutes)} ({(p.effectiveMinutes / 60).toFixed(1)}h)
                        </strong>
                      </td>
                      <td>
                        <span className="badge-pill default">{p.percentage}%</span>
                      </td>
                      {isAdmin && (
                        <td>
                          <strong style={{ color: '#0f6b61' }}>{formatRupees(p.netMoney)}</strong>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
