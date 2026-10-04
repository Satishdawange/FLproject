import React, { useState, useMemo } from 'react'
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Upload,
  Layers,
  Sparkles,
  RefreshCw,
  Plus,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { BillItem, BillPaymentStatus, UserRole } from '../types'
import { formatMinutes, formatRupees } from '../utils/calculations'
import { BillDetailModal } from './BillDetailModal'

interface BillsViewProps {
  bills: BillItem[]
  userRole?: UserRole
  sheetName?: string
  onUpdateBill: (updatedBill: BillItem) => Promise<boolean>
  onOpenCreateChallan: () => void
  onRefreshBills: () => void
  isSyncing?: boolean
}

export const BillsView: React.FC<BillsViewProps> = ({
  bills,
  userRole = 'admin',
  sheetName = 'Google Sheet',
  onUpdateBill,
  onOpenCreateChallan,
  onRefreshBills,
  isSyncing = false,
}) => {
  const isAdmin = userRole === 'admin'
  const [statusFilter, setStatusFilter] = useState<'All' | BillPaymentStatus>('All')
  const [selectedClient, setSelectedClient] = useState<string>('All clients')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBillForModal, setSelectedBillForModal] = useState<BillItem | null>(null)

  // Extract unique clients
  const availableClients = useMemo(() => {
    const set = new Set<string>()
    bills.forEach((b) => b.client && set.add(b.client))
    return Array.from(set).sort()
  }, [bills])

  // Filtered bills
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // Status filter
      if (statusFilter !== 'All' && b.status !== statusFilter) {
        return false
      }

      // Client filter
      if (selectedClient !== 'All clients' && b.client.toLowerCase() !== selectedClient.toLowerCase()) {
        return false
      }

      // Search query across Bill ID, client, project, notes, period
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const text = `${b.billId} ${b.client} ${b.project} ${b.selectedPeriod} ${b.notes || ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }

      return true
    })
  }, [bills, statusFilter, selectedClient, searchQuery])

  // Financial aggregates for bills
  const billMetrics = useMemo(() => {
    let totalBilled = 0
    let totalPaid = 0
    let fullyPaidCount = 0
    let halfPaidCount = 0
    let unpaidCount = 0

    filteredBills.forEach((b) => {
      const net = Number(b.netAmount) || 0
      totalBilled += net

      if (b.status === 'Fully Paid') {
        totalPaid += b.paidAmount || net
        fullyPaidCount += 1
      } else if (b.status === 'Half Paid') {
        totalPaid += Number(b.paidAmount) || 0
        halfPaidCount += 1
      } else {
        unpaidCount += 1
      }
    })

    const outstanding = Math.max(0, totalBilled - totalPaid)

    return {
      totalBilled,
      totalPaid,
      outstanding,
      fullyPaidCount,
      halfPaidCount,
      unpaidCount,
      count: filteredBills.length,
    }
  }, [filteredBills])

  // PDF Export of Filtered Bills List
  const handleExportFilteredBillsPdf = () => {
    const doc = new jsPDF('landscape')
    const today = new Date().toLocaleDateString('en-IN')

    // Header banner
    doc.setFillColor(15, 107, 97)
    doc.rect(0, 0, 297, 24, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('SATISH SERVICENOW SUPPORT - BILLS & RECEIVABLES REGISTER', 14, 16)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${today} | Sheet: ${sheetName}`, 283, 16, { align: 'right' })

    // Active Filters Info
    doc.setTextColor(50, 60, 55)
    doc.setFontSize(8.5)
    doc.text(
      `Filters Applied: Status: ${statusFilter} | Client: ${selectedClient} | Search: "${searchQuery || 'None'}" | Count: ${filteredBills.length}`,
      14,
      32
    )

    doc.text(
      `Total Billed: Rs. ${billMetrics.totalBilled.toLocaleString('en-IN')} | Total Collected: Rs. ${billMetrics.totalPaid.toLocaleString('en-IN')} | Outstanding Balance: Rs. ${billMetrics.outstanding.toLocaleString('en-IN')}`,
      14,
      38
    )

    const tableRows = filteredBills.map((b) => {
      const remaining = Math.max(0, b.netAmount - (b.paidAmount || (b.status === 'Fully Paid' ? b.netAmount : 0)))
      return [
        b.billId,
        b.createdOn,
        b.selectedPeriod,
        b.client,
        b.project,
        `${formatMinutes(b.effectiveMinutes)} (${b.totalSessions} sessions)`,
        `Rs. ${b.netAmount.toLocaleString('en-IN')}`,
        b.status,
        b.paidAmount ? `Rs. ${b.paidAmount.toLocaleString('en-IN')}` : '—',
        b.paidOn || '—',
        remaining > 0 ? `Rs. ${remaining.toLocaleString('en-IN')}` : '₹0 (Settled)',
      ]
    })

    autoTable(doc, {
      startY: 44,
      head: [
        [
          'Bill ID',
          'Created On',
          'Period',
          'Client',
          'Project',
          'Time (Sessions)',
          'Net Billed',
          'Status',
          'Paid Amount',
          'Paid On',
          'Outstanding Due',
        ],
      ],
      body: tableRows.length > 0 ? tableRows : [['—', '—', 'No bills match active filters', '—', '—', '—', '—', '—', '—', '—', '—']],
      headStyles: { fillColor: [15, 107, 97], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        6: { halign: 'right' },
        8: { halign: 'right' },
        10: { halign: 'right' },
      },
    })

    doc.save(`bills-register-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // Excel Export of Filtered Bills List
  const handleExportBillsExcel = () => {
    const workbook = XLSX.utils.book_new()
    const rows = filteredBills.map((b) => {
      const remaining = Math.max(0, b.netAmount - (b.paidAmount || (b.status === 'Fully Paid' ? b.netAmount : 0)))
      return {
        'Bill ID': b.billId,
        'Created On': b.createdOn,
        'Selected Period': b.selectedPeriod,
        Client: b.client,
        Project: b.project,
        'Total Sessions': b.totalSessions,
        'Total Minutes': b.totalMinutes,
        'Discount Minutes': b.discountMinutes,
        'Effective Minutes': b.effectiveMinutes,
        'Gross Amount (INR)': b.grossAmount,
        'Discount Money (INR)': b.discountMoney,
        'Net Amount (INR)': b.netAmount,
        Status: b.status,
        'Paid Amount (INR)': b.paidAmount || 0,
        'Paid On': b.paidOn || '',
        'Outstanding Balance (INR)': remaining,
        Notes: b.notes || '',
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bills Register')
    XLSX.writeFile(workbook, `bills-register-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (!isAdmin) {
    return (
      <div className="empty-state">
        <strong>Access Restricted</strong>
        <span>Bills and invoices are accessible exclusively to Administrator accounts.</span>
      </div>
    )
  }

  return (
    <div className="bills-view-container">
      {/* Policy Notice: September 2026 Cutoff Rule */}
      <div className="bills-policy-banner">
        <div className="policy-badge">
          <Sparkles size={14} color="#0f6b61" />
          <span>Payment Settlement Policy</span>
        </div>
        <p>
          By default, all work earnings prior to <b>October 2026</b> (up to September 30, 2026) are counted as{' '}
          <strong style={{ color: '#166534' }}>Settled / Paid</strong> in the workspace and dashboard. Starting from{' '}
          <b>October 2026 onwards</b>, payment settlements, partial recoveries, and outstanding dues are dynamically tracked via this{' '}
          <b>Bills</b> tab in Google Sheets.
        </p>
      </div>

      {/* KPI Tiles */}
      <div className="summary-grid bills-kpi-grid">
        <div className="summary-card highlight">
          <div className="card-top">
            <span className="card-label">Total Billed Net</span>
            <FileText size={16} color="#d4f0e4" />
          </div>
          <strong>{formatRupees(billMetrics.totalBilled)}</strong>
          <small style={{ color: '#c7e8dc' }}>
            Across {filteredBills.length} recorded challan bills
          </small>
        </div>

        <div className="summary-card">
          <div className="card-top">
            <span className="card-label">Collected / Settled</span>
            <span className="card-icon green">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <strong style={{ color: '#166534' }}>{formatRupees(billMetrics.totalPaid)}</strong>
          <small style={{ color: '#88948c' }}>
            {billMetrics.fullyPaidCount} fully paid • {billMetrics.halfPaidCount} half paid
          </small>
        </div>

        <div className="summary-card">
          <div className="card-top">
            <span className="card-label">Pending Receivables</span>
            <span className="card-icon orange">
              <Clock size={16} />
            </span>
          </div>
          <strong style={{ color: billMetrics.outstanding > 0 ? '#b45309' : '#0f6b61' }}>
            {formatRupees(billMetrics.outstanding)}
          </strong>
          <small style={{ color: '#88948c' }}>
            {billMetrics.unpaidCount} unpaid • {billMetrics.halfPaidCount} partial balance
          </small>
        </div>

        <div className="summary-card">
          <div className="card-top">
            <span className="card-label">Bills Register</span>
            <span className="card-icon blue">
              <Layers size={16} />
            </span>
          </div>
          <strong>{filteredBills.length} Bills</strong>
          <small style={{ color: '#88948c' }}>
            In connected tab: <b>Bills</b>
          </small>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="toolbar bills-toolbar">
        <div className="view-tabs">
          <button
            className={`view-tab-btn ${statusFilter === 'All' ? 'selected' : ''}`}
            onClick={() => setStatusFilter('All')}
          >
            All Bills ({bills.length})
          </button>
          <button
            className={`view-tab-btn ${statusFilter === 'Unpaid' ? 'selected' : ''}`}
            onClick={() => setStatusFilter('Unpaid')}
          >
            Unpaid ({bills.filter((b) => b.status === 'Unpaid').length})
          </button>
          <button
            className={`view-tab-btn ${statusFilter === 'Half Paid' ? 'selected' : ''}`}
            onClick={() => setStatusFilter('Half Paid')}
          >
            Half Paid ({bills.filter((b) => b.status === 'Half Paid').length})
          </button>
          <button
            className={`view-tab-btn ${statusFilter === 'Fully Paid' ? 'selected' : ''}`}
            onClick={() => setStatusFilter('Fully Paid')}
          >
            Fully Paid ({bills.filter((b) => b.status === 'Fully Paid').length})
          </button>
        </div>

        <div className="toolbar-actions">
          {/* Client filter */}
          <select
            className="client-select"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="All clients">All Clients ({availableClients.length})</option>
            {availableClients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Search box */}
          <div className="search-box">
            <Search size={14} />
            <input
              placeholder="Search Bill ID, client, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Export Menu */}
          <div className="export-menu">
            <button className="secondary-btn" title="Export filtered bills register">
              <Download size={14} /> Export Register
            </button>
            <div className="export-options">
              <button onClick={handleExportBillsExcel}>
                <Upload size={13} /> Excel Spreadsheet (.xlsx)
              </button>
              <button onClick={handleExportFilteredBillsPdf}>
                <FileText size={13} /> PDF Report (.pdf)
              </button>
            </div>
          </div>

          {/* Refresh Bills from Google Sheets */}
          <button
            className="secondary-btn"
            onClick={onRefreshBills}
            disabled={isSyncing}
            title="Reload bills from Google Sheet"
          >
            <RefreshCw size={14} className={isSyncing ? 'spin-icon' : ''} />
            <span className="btn-text-responsive">{isSyncing ? 'Syncing...' : 'Sync Bills'}</span>
          </button>

          {/* Create New Challan / Bill Trigger */}
          <button
            className="primary-btn"
            onClick={onOpenCreateChallan}
            title="Create a new Challan & sync to Bills tab"
          >
            <Plus size={15} /> <span className="btn-text-responsive">Create Challan</span>
          </button>
        </div>
      </div>

      {/* Bills Table */}
      <div className="ledger-section" style={{ marginTop: '16px' }}>
        <div className="table-wrap ledger-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bill ID</th>
                <th>Created On</th>
                <th>Period Scope</th>
                <th>Client / Project</th>
                <th>Sessions &amp; Duration</th>
                <th style={{ textAlign: 'right' }}>Net Bill Amount</th>
                <th>Status</th>
                <th>Paid Amount</th>
                <th>Paid Date</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => {
                const isFullyPaid = bill.status === 'Fully Paid'
                const isHalfPaid = bill.status === 'Half Paid'
                const isUnpaid = bill.status === 'Unpaid'

                return (
                  <tr
                    key={bill.billId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedBillForModal(bill)}
                  >
                    <td>
                      <span className="bill-id-badge">{bill.billId}</span>
                    </td>
                    <td>
                      <small style={{ color: '#445148', fontWeight: 500 }}>{bill.createdOn}</small>
                    </td>
                    <td>
                      <strong>{bill.selectedPeriod}</strong>
                    </td>
                    <td>
                      <strong>{bill.client}</strong>
                      <small>{bill.project}</small>
                    </td>
                    <td>
                      <span>{formatMinutes(bill.effectiveMinutes)}</span>
                      <small style={{ color: '#88948c' }}>{bill.totalSessions} sessions</small>
                    </td>
                    <td className="amount-cell" style={{ textAlign: 'right' }}>
                      {formatRupees(bill.netAmount)}
                    </td>
                    <td>
                      <span
                        className={`bill-status-pill ${
                          isFullyPaid ? 'fully-paid' : isHalfPaid ? 'half-paid' : 'unpaid'
                        }`}
                      >
                        {isFullyPaid && <CheckCircle2 size={12} />}
                        {isHalfPaid && <AlertTriangle size={12} />}
                        {isUnpaid && <Clock size={12} />}
                        {bill.status}
                      </span>
                    </td>
                    <td>
                      {isFullyPaid ? (
                        <span style={{ color: '#166534', fontWeight: 600 }}>
                          {formatRupees(bill.paidAmount || bill.netAmount)}
                        </span>
                      ) : isHalfPaid ? (
                        <div>
                          <strong style={{ color: '#b45309' }}>{formatRupees(bill.paidAmount || 0)}</strong>
                          <small style={{ color: '#88948c' }}>
                            (Due: {formatRupees(Math.max(0, bill.netAmount - (bill.paidAmount || 0)))})
                          </small>
                        </div>
                      ) : (
                        <span style={{ color: '#97a399' }}>—</span>
                      )}
                    </td>
                    <td>
                      <small style={{ color: '#445148' }}>{bill.paidOn || '—'}</small>
                    </td>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          className="table-action-btn"
                          title="Open Bill Inspection Form & Update Status"
                          onClick={() => setSelectedBillForModal(bill)}
                        >
                          <FileText size={13} />
                          <span>Form</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filteredBills.length === 0 && (
            <div className="empty-state">
              <FileText size={36} color="#859288" />
              <strong>No Bills Found</strong>
              <span>
                {bills.length === 0
                  ? 'No bills have been generated yet. Open "Generate Challan" and click "Sync & Download PDF" to record your first bill in Google Sheets.'
                  : 'No bills match your current filter criteria.'}
              </span>
              {bills.length === 0 && (
                <button
                  className="primary-btn"
                  style={{ marginTop: '14px' }}
                  onClick={onOpenCreateChallan}
                >
                  <Plus size={15} /> Create First Challan Bill
                </button>
              )}
            </div>
          )}
        </div>

        <div className="table-footer">
          <span>
            Showing {filteredBills.length} of {bills.length} bills in sheet tab &quot;Bills&quot;
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#2e8b57',
              }}
            />
            {sheetName}
          </span>
        </div>
      </div>

      {/* Bill Detail Form Modal */}
      {selectedBillForModal && (
        <BillDetailModal
          bill={selectedBillForModal}
          onClose={() => setSelectedBillForModal(null)}
          onSaveBill={async (updated) => {
            const ok = await onUpdateBill(updated)
            if (ok) {
              // Update local modal view state as well
              setSelectedBillForModal(updated)
            }
            return ok
          }}
        />
      )}
    </div>
  )
}
