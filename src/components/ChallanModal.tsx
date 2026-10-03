import React, { useState, useMemo } from 'react'
import { X, Download, Printer, Calendar, User, Sparkles } from 'lucide-react'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SessionEntry } from '../types'
import { formatMinutes, formatRupees, getMonthLabel } from '../utils/calculations'

interface ChallanModalProps {
  entries: SessionEntry[]
  initialClient?: string
  onClose: () => void
}

export const ChallanModal: React.FC<ChallanModalProps> = ({
  entries,
  initialClient = 'All clients',
  onClose,
}) => {
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

  // By default, the most recent month is selected!
  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || currentMonthKey)

  // Client selection (defaults to initialClient if valid, else 'All clients')
  const [selectedClient, setSelectedClient] = useState<string>(
    initialClient !== 'All clients' && availableClients.includes(initialClient)
      ? initialClient
      : 'All clients'
  )

  // Filter entries dynamically based on selectedMonth and selectedClient
  const challanEntries = useMemo(() => {
    if (!Array.isArray(entries)) return []
    return entries.filter((e) => {
      if (!e) return false
      const matchesMonth =
        selectedMonth === 'all' ? true : String(e.date || '').startsWith(selectedMonth)
      const matchesClient =
        selectedClient === 'All clients' ? true : String(e.client || '').trim().toLowerCase() === selectedClient.trim().toLowerCase()
      return matchesMonth && matchesClient
    })
  }, [entries, selectedMonth, selectedClient])

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

    // Header styling
    doc.setFillColor(15, 107, 97) // #0f6b61
    doc.rect(0, 0, 210, 26, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('SATISH SERVICENOW SUPPORT - WORK CHALLAN', 14, 17)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${today}`, 196, 17, { align: 'right' })

    // Bill to & period section
    doc.setTextColor(30, 40, 35)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('BILL TO:', 14, 38)
    doc.setFont('helvetica', 'normal')
    doc.text(selectedClient === 'All clients' ? 'All Clients Summary' : selectedClient, 14, 44)

    doc.setFont('helvetica', 'bold')
    doc.text('BILLING MONTH / SCOPE:', 130, 38)
    doc.setFont('helvetica', 'normal')
    doc.text(periodLabel, 130, 44)

    // Table
    const tableData = challanEntries.map((e) => [
      e.date,
      e.project,
      e.description,
      `${e.startTime} - ${e.endTime}`,
      formatMinutes(e.totalMinutes),
      e.discountMinutes ? `-${formatMinutes(e.discountMinutes)}` : '0m',
      formatMinutes(e.effectiveMinutes),
      `Rs. ${e.rate}/hr`,
      `Rs. ${Math.round(e.moneyWithDiscount).toLocaleString('en-IN')}`,
    ])

    autoTable(doc, {
      startY: 52,
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
        cellPadding: 2.5,
      },
      columnStyles: {
        2: { cellWidth: 40 }, // description
        8: { halign: 'right' },
      },
    })

    // Summary block below table
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 180

    doc.setFillColor(242, 247, 244)
    doc.roundedRect(120, finalY + 8, 76, 44, 2, 2, 'F')

    doc.setTextColor(50, 60, 55)
    doc.setFontSize(8.5)
    doc.text(`Gross Total:`, 124, finalY + 16)
    doc.text(`Rs. ${Math.round(totals.grossMoney).toLocaleString('en-IN')}`, 192, finalY + 16, { align: 'right' })

    doc.setTextColor(178, 87, 43)
    doc.text(`Time Discount (${formatMinutes(totals.discountMinutes)}):`, 124, finalY + 23)
    doc.text(`-Rs. ${Math.round(totals.discountMoney).toLocaleString('en-IN')}`, 192, finalY + 23, { align: 'right' })

    doc.setDrawColor(200, 215, 205)
    doc.line(124, finalY + 27, 192, finalY + 27)

    doc.setTextColor(15, 107, 97)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`Net Amount Payable:`, 124, finalY + 36)
    doc.text(`Rs. ${Math.round(totals.netMoney).toLocaleString('en-IN')}`, 192, finalY + 36, { align: 'right' })

    const safeClient = (selectedClient === 'All clients' ? 'all-clients' : selectedClient).toLowerCase().replace(/[^a-z0-9]/g, '-')
    const safeMonth = selectedMonth.replace(/[^a-z0-9]/g, '-')
    doc.save(`satish-servicenow-challan-${safeClient}-${safeMonth}.pdf`)
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
          </div>

          <div className="challan-preview">
            <div className="challan-top">
              <span className="brand-mark">₹</span>
              <strong>SATISH SERVICENOW SUPPORT CHALLAN</strong>
              <small>Date: {today}</small>
            </div>

            <div className="challan-title">
              <div>
                <small>Bill To Client</small>
                <strong style={{ fontSize: '16px', color: '#16281e' }}>
                  {selectedClient}
                </strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <small>Billing Scope</small>
                <strong style={{ fontSize: '15px', color: '#0f6b61' }}>
                  {periodLabel}
                </strong>
              </div>
            </div>

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


        <div className="modal-footer">
          <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={13} color="#0f6b61" />
            Dynamically filtered for {periodLabel}
          </span>
          <button className="secondary-btn" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </button>
          <button
            className="primary-btn"
            onClick={handleDownloadPdf}
            disabled={challanEntries.length === 0}
            style={{ gap: '6px' }}
          >
            <Download size={15} /> Download PDF Challan
          </button>
        </div>
      </div>
    </div>
  )
}
