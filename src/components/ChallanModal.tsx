import React, { useState, useMemo } from 'react'
import { X, Download, Printer, Calendar, User, Briefcase, UserCheck, Sparkles, RefreshCw } from 'lucide-react'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SessionEntry, BillItem, UserAccount } from '../types'
import { formatMinutes, formatRupees, getMonthLabel, formatBillingPeriod } from '../utils/calculations'

interface ChallanModalProps {
  entries: SessionEntry[]
  initialClient?: string
  availableUsers?: UserAccount[]
  onClose: () => void
  onSyncBill?: (bill: BillItem) => Promise<boolean | void>
}

export const ChallanModal: React.FC<ChallanModalProps> = ({
  entries,
  initialClient = 'All clients',
  availableUsers = [],
  onClose,
  onSyncBill,
}) => {
  const [syncing, setSyncing] = useState(false)
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null)
  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  // Extract all available months from entries (or current month if none)
  const currentMonthKey = useMemo(() => new Date().toISOString().slice(0, 7), [])

  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>()
    // Ensure current month is always available
    monthSet.add(currentMonthKey)
    entries.forEach((e) => {
      if (e.date && e.date.length >= 7) {
        monthSet.add(e.date.slice(0, 7))
      }
    })
    // Sort descending so the most recent month is first
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a))
  }, [entries, currentMonthKey])

  // Extract all unique clients from entries
  const availableClients = useMemo(() => {
    const set = new Set<string>()
    entries.forEach((e) => e.client && set.add(e.client))
    if (!set.has('Jahnavi M')) {
      set.add('Jahnavi M')
    }
    return Array.from(set).sort()
  }, [entries])

  // Extract all unique projects from entries
  const availableProjects = useMemo(() => {
    const set = new Set<string>()
    entries.forEach((e) => e.project && set.add(e.project))
    return Array.from(set).sort()
  }, [entries])

  // By default, the most recent month is selected!
  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || currentMonthKey)

  // Client selection (defaults to initialClient if valid, else 'All clients')
  const [selectedClient, setSelectedClient] = useState<string>(
    initialClient !== 'All clients' && availableClients.includes(initialClient)
      ? initialClient
      : 'All clients'
  )

  // Project selection (defaults to 'All projects')
  const [selectedProject, setSelectedProject] = useState<string>('All projects')

  // Assigned customer (from available users from Google Sheet Users tab)
  const [assignedTo, setAssignedTo] = useState<string>('')

  // Filter entries dynamically based on selectedMonth, selectedClient, and selectedProject
  const challanEntries = useMemo(() => {
    if (!Array.isArray(entries)) return []
    return entries.filter((e) => {
      if (!e) return false
      const matchesMonth =
        selectedMonth === 'all' ? true : String(e.date || '').startsWith(selectedMonth)
      const matchesClient =
        selectedClient === 'All clients' ? true : String(e.client || '').trim().toLowerCase() === selectedClient.trim().toLowerCase()
      const matchesProject =
        selectedProject === 'All projects' ? true : String(e.project || '').trim().toLowerCase() === selectedProject.trim().toLowerCase()
      return matchesMonth && matchesClient && matchesProject
    })
  }, [entries, selectedMonth, selectedClient, selectedProject])

  // Compute live totals for the dynamic challan
  const totals = useMemo(() => {
    return challanEntries.reduce(
      (acc, entry) => {
        acc.totalMinutes += Number(entry.totalMinutes) || 0
        acc.discountMinutes += Number(entry.discountMinutes) || 0
        acc.effectiveMinutes += Number(entry.effectiveMinutes) || 0
        acc.grossMoney += Number(entry.moneyWithoutDiscount) || 0
        acc.discountMoney += Number(entry.discountMoney) || 0
        acc.netMoney += Number(entry.moneyWithDiscount) || 0
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
  }, [challanEntries])

  // Label for the selected period
  const periodLabel = useMemo(() => {
    if (selectedMonth === 'all') return 'All Months'
    return getMonthLabel(selectedMonth)
  }, [selectedMonth])

  // PDF Export
  const handleDownloadPdf = () => {
    const doc = new jsPDF()

    // Header styling (210mm wide)
    doc.setFillColor(15, 107, 97) // #0f6b61
    doc.rect(0, 0, 210, 26, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('SATISH SERVICENOW SUPPORT - WORK CHALLAN', 14, 16, { maxWidth: 125 })

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${today}`, 196, 16, { align: 'right' })

    // Bill to & period section (Left x=14 maxWidth 88, Right x=110 maxWidth 86)
    doc.setTextColor(30, 40, 35)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('BILL TO:', 14, 37)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(selectedClient === 'All clients' ? 'All Clients Summary' : selectedClient, 14, 43, { maxWidth: 88 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('PROJECT SCOPE:', 14, 51)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(selectedProject === 'All projects' ? 'All Projects' : selectedProject, 14, 57, { maxWidth: 88 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('BILLING MONTH / SCOPE:', 110, 37)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(periodLabel, 110, 43, { maxWidth: 86 })

    if (assignedTo) {
      const assignedObj = availableUsers.find((u) => u.username === assignedTo)
      const assignedLabel = assignedObj ? `${assignedObj.fullName || assignedObj.name} (${assignedObj.username})` : assignedTo
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('ASSIGNED CUSTOMER:', 110, 51)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.text(assignedLabel, 110, 57, { maxWidth: 86 })
    }

    const startTableY = 66
    const tableData = challanEntries.map((e) => [
      e.date,
      e.project,
      e.description || '—',
      `${e.startTime || '—'} - ${e.endTime || '—'}`,
      formatMinutes(e.totalMinutes),
      formatMinutes(e.discountMinutes),
      formatMinutes(e.effectiveMinutes),
      `Rs. ${e.rate || 0}/hr`,
      `Rs. ${Math.round(e.moneyWithDiscount).toLocaleString('en-IN')}`,
    ])

    // Table with precise column dimensions summing to 182mm (14 to 196)
    autoTable(doc, {
      startY: startTableY,
      margin: { left: 14, right: 14 },
      head: [
        [
          'Date',
          'Project',
          'Description',
          'Timing',
          'Total',
          'Disc.',
          'Effective',
          'Rate',
          'Net (INR)',
        ],
      ],
      body: tableData.length > 0 ? tableData : [['—', '—', 'No sessions in this period', '—', '—', '—', '—', '—', '—']],
      headStyles: {
        fillColor: [15, 107, 97],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 24 },
        2: { cellWidth: 40 },
        3: { cellWidth: 22 },
        4: { cellWidth: 16 },
        5: { cellWidth: 15 },
        6: { cellWidth: 16 },
        7: { cellWidth: 14 },
        8: { cellWidth: 15, halign: 'right' },
      },
    })

    // Summary block below table (width 82mm, from 114 to 196mm)
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 180

    doc.setFillColor(242, 247, 244)
    doc.roundedRect(114, finalY + 8, 82, 44, 2, 2, 'F')

    doc.setTextColor(50, 60, 55)
    doc.setFontSize(8.5)
    doc.text(`Gross Total:`, 118, finalY + 16, { maxWidth: 42 })
    doc.text(`Rs. ${Math.round(totals.grossMoney).toLocaleString('en-IN')}`, 192, finalY + 16, { align: 'right' })

    doc.setTextColor(178, 87, 43)
    doc.text(`Time Discount (${formatMinutes(totals.discountMinutes)}):`, 118, finalY + 23, { maxWidth: 42 })
    doc.text(`-Rs. ${Math.round(totals.discountMoney).toLocaleString('en-IN')}`, 192, finalY + 23, { align: 'right' })

    doc.setDrawColor(200, 215, 205)
    doc.line(118, finalY + 27, 192, finalY + 27)

    doc.setTextColor(15, 107, 97)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.text(`Net Amount Payable:`, 118, finalY + 36, { maxWidth: 42 })
    doc.text(`Rs. ${Math.round(totals.netMoney).toLocaleString('en-IN')}`, 192, finalY + 36, { align: 'right' })

    const safeClient = (selectedClient === 'All clients' ? 'all-clients' : selectedClient).toLowerCase().replace(/[^a-z0-9]/g, '-')
    const safeMonth = selectedMonth.replace(/[^a-z0-9]/g, '-')
    doc.save(`satish-servicenow-challan-${safeClient}-${safeMonth}.pdf`)
  }

  const createBillObject = (): BillItem => {
    const rawMonth = selectedMonth === 'all' ? new Date().toISOString().slice(0, 7) : selectedMonth
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const billId = `BILL-${rawMonth.replace('-', '')}-${randomSuffix}`
    const now = new Date()
    const createdOn =
      now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' +
      now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

    const uniqueProjects =
      selectedProject !== 'All projects'
        ? selectedProject
        : Array.from(new Set(challanEntries.map((e) => e.project).filter(Boolean))).join(', ') ||
          'ServiceNow Support'

    return {
      billId,
      createdOn,
      selectedPeriod: formatBillingPeriod(periodLabel),
      client: selectedClient === 'All clients' ? 'All Clients' : selectedClient,
      project: uniqueProjects,
      totalSessions: challanEntries.length,
      totalMinutes: totals.totalMinutes,
      discountMinutes: totals.discountMinutes,
      effectiveMinutes: totals.effectiveMinutes,
      grossAmount: Math.round(totals.grossMoney),
      discountMoney: Math.round(totals.discountMoney),
      netAmount: Math.round(totals.netMoney),
      status: 'Unpaid',
      paidAmount: 0,
      paidOn: '',
      notes: `Generated via Challan for ${periodLabel}`,
      assignedTo: assignedTo || '',
    }
  }

  const handleSyncAndDownloadPdf = async () => {
    if (challanEntries.length === 0) return
    setSyncing(true)
    setSyncSuccessMsg(null)
    try {
      const bill = createBillObject()
      if (onSyncBill) {
        await onSyncBill(bill)
      }
      setSyncSuccessMsg(`Bill ${bill.billId} recorded in Bills tab!`)
    } catch (err) {
      console.error('Failed to sync bill:', err)
    } finally {
      setSyncing(false)
      handleDownloadPdf()
    }
  }

  const handleSyncAndPrint = async () => {
    if (challanEntries.length === 0) return
    setSyncing(true)
    setSyncSuccessMsg(null)
    try {
      const bill = createBillObject()
      if (onSyncBill) {
        await onSyncBill(bill)
      }
      setSyncSuccessMsg(`Bill ${bill.billId} recorded in Bills tab!`)
    } catch (err) {
      console.error('Failed to sync bill:', err)
    } finally {
      setSyncing(false)
      window.print()
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal challan-modal"
        style={{ maxWidth: '720px', width: '95%' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow" style={{ color: '#0f6b61' }}>Dynamic Statement Generator</p>
            <h2>Work Challan &amp; Billing Statement</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Challan Modal Body */}
        <div className="challan-modal-body">
          {/* Dynamic Controls Bar */}
          <div className="challan-controls-bar">
            <div className="challan-control-group">
              <label>
                <Calendar size={14} color="#0f6b61" />
                <span>Select Month:</span>
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="challan-select"
              >
                {availableMonths.map((m, idx) => (
                  <option key={m} value={m}>
                    {getMonthLabel(m)} {idx === 0 ? '(Recent Month)' : ''}
                  </option>
                ))}
                <option value="all">All Months</option>
              </select>
            </div>

            <div className="challan-control-group">
              <label>
                <User size={14} color="#0f6b61" />
                <span>Select Client:</span>
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="challan-select"
              >
                <option value="All clients">All Clients</option>
                {availableClients.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="challan-control-group">
              <label>
                <Briefcase size={14} color="#0f6b61" />
                <span>Select Project:</span>
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="challan-select"
              >
                <option value="All projects">All Projects</option>
                {availableProjects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="challan-control-group">
              <label>
                <UserCheck size={14} color="#0f6b61" />
                <span>Assign To (Customer):</span>
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="challan-select"
              >
                <option value="">Unassigned (None)</option>
                {availableUsers.map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.fullName || u.name || u.username} ({u.username})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="challan-preview">
            <div className="challan-top">
              <span className="brand-mark">₹</span>
              <strong>SATISH SERVICENOW SUPPORT CHALLAN</strong>
              <small>Date: {today}</small>
            </div>

            <div className="challan-title">
              <div>
                <small>Bill To Client &amp; Scope</small>
                <strong style={{ fontSize: '16px', color: '#16281e' }}>
                  {selectedClient}
                </strong>
                <div style={{ fontSize: '12px', color: '#4b5d50', marginTop: '3px' }}>
                  Project: <b>{selectedProject}</b>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <small>Billing Scope Period</small>
                <strong style={{ fontSize: '15px', color: '#0f6b61' }}>
                  {periodLabel}
                </strong>
                <div style={{ fontSize: '12px', color: '#6d7e72', marginTop: '3px' }}>
                  <b>{challanEntries.length}</b> work sessions
                </div>
              </div>
            </div>

            {assignedTo && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: '#166534', fontWeight: 600 }}>Assigned Customer Portal User:</span>
                <span style={{ color: '#0f6b61', fontWeight: 700 }}>
                  {availableUsers.find((u) => u.username === assignedTo)?.fullName || assignedTo} ({assignedTo})
                </span>
              </div>
            )}

            <div className="challan-total">
              <small>Total Payable (Net After Time Discount)</small>
              <strong>{formatRupees(totals.netMoney)}</strong>
              <span>
                {formatMinutes(totals.effectiveMinutes)} effective work time across {challanEntries.length} sessions
              </span>
            </div>

            <div className="challan-lines">
              <span>
                <span>Total Work Duration:</span>
                <b>{formatMinutes(totals.totalMinutes)}</b>
              </span>
              <span>
                <span>Total Discount Deducted in Time:</span>
                <b style={{ color: '#b2572b' }}>
                  {totals.discountMinutes > 0 ? `-${formatMinutes(totals.discountMinutes)}` : '0m'}
                </b>
              </span>
              <span>
                <span>Total Effective Billable Time:</span>
                <b>{formatMinutes(totals.effectiveMinutes)}</b>
              </span>
              <span>
                <span>Gross Money (Without Discount):</span>
                <b>{formatRupees(totals.grossMoney)}</b>
              </span>
              <span>
                <span>Discount in Money:</span>
                <b style={{ color: '#b2572b' }}>
                  {totals.discountMoney > 0 ? `-${formatRupees(totals.discountMoney)}` : '₹0'}
                </b>
              </span>
              <span style={{ borderBottom: 'none', paddingTop: '10px' }}>
                <span style={{ fontWeight: 700, color: '#1a3328' }}>Final Net Amount:</span>
                <b style={{ fontSize: '17px', color: '#0f6b61' }}>{formatRupees(totals.netMoney)}</b>
              </span>
            </div>

            {/* Table preview within challan */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', borderTop: '1px solid #e1e9e2' }}>
              <table className="sub-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Description</th>
                    <th>Time</th>
                    <th>Disc.</th>
                    <th>Effective</th>
                    <th style={{ textAlign: 'right' }}>Net (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {challanEntries.map((e) => (
                    <tr key={e.id}>
                      <td>{e.date}</td>
                      <td><b>{e.project}</b></td>
                      <td style={{ maxWidth: '180px', fontSize: '11px', color: '#57665c' }}>
                        {e.description}
                      </td>
                      <td>{formatMinutes(e.totalMinutes)}</td>
                      <td>
                        {e.discountMinutes > 0 ? (
                          <span className="discount-pill">-{e.discountMinutes}m</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td><b>{formatMinutes(e.effectiveMinutes)}</b></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f6b61' }}>
                        {formatRupees(e.moneyWithDiscount)}
                      </td>
                    </tr>
                  ))}
                  {challanEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: '#828e85' }}>
                        No work sessions found for <b>{selectedClient}</b> in <b>{periodLabel}</b>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>


        <div className="modal-footer" style={{ gap: '8px', flexWrap: 'wrap' }}>
          {syncSuccessMsg && (
            <span style={{ color: '#0f6b61', fontSize: '11px', fontWeight: 700, width: '100%', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ✓ {syncSuccessMsg}
            </span>
          )}
          <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: 'auto' }}>
            <Sparkles size={13} color="#0f6b61" />
            Dynamically filtered for {periodLabel}
          </span>
          <button className="secondary-btn" onClick={() => window.print()} title="Print without syncing to sheet">
            <Printer size={15} /> Print
          </button>
          <button
            className="secondary-btn"
            onClick={handleSyncAndPrint}
            disabled={syncing || challanEntries.length === 0}
            title="Record bill in Bills tab and open print preview"
          >
            <RefreshCw size={14} className={syncing ? 'spin-icon' : ''} />
            {syncing ? 'Syncing...' : 'Sync & Print'}
          </button>
          <button
            className="primary-btn"
            onClick={handleSyncAndDownloadPdf}
            disabled={syncing || challanEntries.length === 0}
            style={{ gap: '6px' }}
            title="Record bill in Bills tab and download PDF"
          >
            <Download size={15} />
            {syncing ? 'Syncing...' : 'Sync & Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
