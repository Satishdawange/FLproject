import React, { useState, useMemo, useRef, useEffect } from 'react'
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
  Receipt,
  UserCheck,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { BillItem, BillPaymentStatus, UserRole, AuthUser } from '../types'
import { formatMinutes, formatRupees, formatBillingPeriod } from '../utils/calculations'
import { BillDetailModal, generateBillStatementPdf } from './BillDetailModal'
import { InvoiceDetailModal, generateInvoicePdf } from './InvoiceDetailModal'

interface BillsViewProps {
  bills: BillItem[]
  userRole?: UserRole
  currentUser?: AuthUser | null
  viewMode?: 'all' | 'my-bills' | 'my-invoices'
  sheetName?: string
  onUpdateBill?: (updatedBill: BillItem) => Promise<boolean>
  onOpenCreateChallan?: () => void
  onRefreshBills: () => void
  isSyncing?: boolean
}

export const BillsView: React.FC<BillsViewProps> = ({
  bills,
  userRole = 'admin',
  currentUser = null,
  viewMode = 'all',
  sheetName = 'Google Sheet',
  onUpdateBill,
  onOpenCreateChallan,
  onRefreshBills,
  isSyncing = false,
}) => {
  const isAdmin = userRole === 'admin'
  const isCustomer = !isAdmin
  const isMyInvoicesMode = viewMode === 'my-invoices'
  const isMyBillsMode = viewMode === 'my-bills'

  const [statusFilter, setStatusFilter] = useState<'All' | BillPaymentStatus>('All')
  const [selectedClient, setSelectedClient] = useState<string>('All clients')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBillForModal, setSelectedBillForModal] = useState<BillItem | null>(null)
  const [selectedBillForInvoiceModal, setSelectedBillForInvoiceModal] = useState<BillItem | null>(null)

  // Export Menu Popover State
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleOutsideClick)
      return () => document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [showExportMenu])

  // Helper: check if a bill is assigned to current logged in customer
  const isAssignedToCurrentUser = (b: BillItem): boolean => {
    if (!currentUser || !b.assignedTo) return false
    const assigned = b.assignedTo.trim().toLowerCase()
    const u = (currentUser.username || '').trim().toLowerCase()
    const n = (currentUser.name || '').trim().toLowerCase()
    const fn = (currentUser.fullName || '').trim().toLowerCase()
    return Boolean(assigned === u || (n && assigned === n) || (fn && assigned === fn))
  }

  // Base bills scoped by viewMode
  const baseBills = useMemo(() => {
    if (isMyInvoicesMode) {
      // Invoices section: only assigned bills that are Half Paid or Fully Paid
      return bills.filter(
        (b) => isAssignedToCurrentUser(b) && (b.status === 'Half Paid' || b.status === 'Fully Paid')
      )
    }
    if (isMyBillsMode) {
      // My Bills section: all bills assigned to this customer
      return bills.filter(isAssignedToCurrentUser)
    }
    // Admin / All view
    return bills
  }, [bills, isMyInvoicesMode, isMyBillsMode, currentUser])

  // Extract unique clients from base bills
  const availableClients = useMemo(() => {
    const set = new Set<string>()
    baseBills.forEach((b) => b.client && set.add(b.client))
    return Array.from(set).sort()
  }, [baseBills])

  // Filtered bills based on toolbar filters
  const filteredBills = useMemo(() => {
    return baseBills.filter((b) => {
      // Status filter
      if (statusFilter !== 'All' && b.status !== statusFilter) {
        return false
      }

      // Client filter
      if (selectedClient !== 'All clients' && b.client.toLowerCase() !== selectedClient.toLowerCase()) {
        return false
      }

      // Search query across Bill ID, client, project, notes, period, assignedTo
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const text = `${b.billId} ${b.client} ${b.project} ${b.selectedPeriod} ${formatBillingPeriod(b.selectedPeriod)} ${b.notes || ''} ${b.assignedTo || ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }

      return true
    })
  }, [baseBills, statusFilter, selectedClient, searchQuery])

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

  // PDF Export of Filtered Bills List (completely avoids text/column overflow)
  const handleExportFilteredBillsPdf = () => {
    const doc = new jsPDF('landscape')
    const today = new Date().toLocaleDateString('en-IN')

    const title = isMyInvoicesMode
      ? 'SATISH SERVICENOW SUPPORT - MY OFFICIAL INVOICES REGISTER'
      : isMyBillsMode
      ? 'SATISH SERVICENOW SUPPORT - MY BILLS & STATEMENTS REGISTER'
      : 'SATISH SERVICENOW SUPPORT - BILLS & RECEIVABLES REGISTER'

    // Header styling (297mm wide landscape, usable 269mm from 14 to 283)
    doc.setFillColor(15, 107, 97)
    doc.rect(0, 0, 297, 24, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 14, 15, { maxWidth: 175 })

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    const userLabel = currentUser ? `Account: ${currentUser.fullName || currentUser.username} | ` : ''
    doc.text(`${userLabel}Generated: ${today}`, 283, 15, { align: 'right', maxWidth: 90 })

    // Active Filters and Financial Metrics (auto-wrapped within 269mm)
    doc.setTextColor(50, 60, 55)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')

    const filterText = `Filters Applied: Status: ${statusFilter} | Client: ${selectedClient} | Search: "${searchQuery || 'None'}" | Count: ${filteredBills.length} records | Sheet: ${sheetName}`
    const filterLines = doc.splitTextToSize(filterText, 269)
    doc.text(filterLines, 14, 30)

    let currentMetaY = 30 + filterLines.length * 3.8

    const metricsText = `Total Billed: Rs. ${billMetrics.totalBilled.toLocaleString('en-IN')} | Total Settled/Paid: Rs. ${billMetrics.totalPaid.toLocaleString('en-IN')} | Outstanding Balance: Rs. ${billMetrics.outstanding.toLocaleString('en-IN')}`
    const metricLines = doc.splitTextToSize(metricsText, 269)
    doc.text(metricLines, 14, currentMetaY)
    currentMetaY += metricLines.length * 3.8

    const tableRows = filteredBills.map((b) => {
      const remaining = Math.max(0, b.netAmount - (b.paidAmount || (b.status === 'Fully Paid' ? b.netAmount : 0)))
      const row = [
        isMyInvoicesMode ? `INV-${b.billId.replace('BILL-', '')}` : b.billId,
        b.createdOn,
        formatBillingPeriod(b.selectedPeriod),
        b.client,
        b.project,
      ]
      if (!isCustomer) {
        row.push(b.assignedTo || '—')
      }
      row.push(
        `${formatMinutes(b.effectiveMinutes)} (${b.totalSessions} sessions)`,
        `Rs. ${b.netAmount.toLocaleString('en-IN')}`,
        b.status,
        b.paidAmount ? `Rs. ${b.paidAmount.toLocaleString('en-IN')}` : '—',
        remaining > 0 ? `Rs. ${remaining.toLocaleString('en-IN')}` : 'Rs. 0 (Settled)'
      )
      return row
    })

    const headers = [
      isMyInvoicesMode ? 'Invoice ID' : 'Bill ID',
      'Created On',
      'Period',
      'Client',
      'Project',
    ]
    if (!isCustomer) {
      headers.push('Assigned To')
    }
    headers.push(
      'Time (Sessions)',
      'Net Billed',
      'Status',
      'Paid Amount',
      'Outstanding Due'
    )

    const tableStartY = Math.max(currentMetaY + 3, 42)

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: 14, right: 14 },
      head: [headers],
      body: tableRows.length > 0 ? tableRows : [['—', '—', 'No records match active filters', '—', '—', '—', '—', '—', '—', '—']],
      headStyles: { fillColor: [15, 107, 97], fontSize: 7.5, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: isCustomer
        ? {
            0: { cellWidth: 25 },
            1: { cellWidth: 22 },
            2: { cellWidth: 26 },
            3: { cellWidth: 30 },
            4: { cellWidth: 30 },
            5: { cellWidth: 28 },
            6: { cellWidth: 26, halign: 'right' },
            7: { cellWidth: 24 },
            8: { cellWidth: 26, halign: 'right' },
            9: { cellWidth: 32, halign: 'right' },
          }
        : {
            0: { cellWidth: 24 },
            1: { cellWidth: 22 },
            2: { cellWidth: 24 },
            3: { cellWidth: 26 },
            4: { cellWidth: 26 },
            5: { cellWidth: 22 },
            6: { cellWidth: 26 },
            7: { cellWidth: 24, halign: 'right' },
            8: { cellWidth: 22 },
            9: { cellWidth: 24, halign: 'right' },
            10: { cellWidth: 29, halign: 'right' },
          },
    })

    const safeName = isMyInvoicesMode ? 'my-invoices' : isMyBillsMode ? 'my-bills' : 'bills-register'
    doc.save(`${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // Excel Export of Filtered Bills List
  const handleExportBillsExcel = () => {
    const workbook = XLSX.utils.book_new()
    const rows = filteredBills.map((b) => {
      const remaining = Math.max(0, b.netAmount - (b.paidAmount || (b.status === 'Fully Paid' ? b.netAmount : 0)))
      const rowObj: Record<string, unknown> = {
        'Bill ID': b.billId,
        'Created On': b.createdOn,
        'Selected Period': formatBillingPeriod(b.selectedPeriod),
        Client: b.client,
        Project: b.project,
        'Assigned To': b.assignedTo || 'Unassigned',
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
      return rowObj
    })

    const sheetTitle = isMyInvoicesMode ? 'My Invoices' : isMyBillsMode ? 'My Bills' : 'Bills Register'
    const worksheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle)
    const filePrefix = isMyInvoicesMode ? 'my-invoices' : isMyBillsMode ? 'my-bills' : 'bills-register'
    XLSX.writeFile(workbook, `${filePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Access guard: if non-admin attempts to view global 'all' register
  if (!isAdmin && viewMode === 'all') {
    return (
      <div className="empty-state">
        <Receipt size={36} color="#859288" />
        <strong>Global Register Restricted</strong>
        <span>
          The global billing ledger is visible to administrators only. You can view your assigned records in{' '}
          <b>My Bills</b> and <b>My Invoices</b>.
        </span>
      </div>
    )
  }

  return (
    <div className="bills-view-container">
      {/* Policy Notice / Header Banner */}
      {isMyInvoicesMode ? (
        <div className="bills-policy-banner" style={{ borderLeftColor: '#0f6b61' }}>
          <div className="policy-badge">
            <CheckCircle2 size={14} color="#0f6b61" />
            <span>My Invoices &amp; Receipts</span>
          </div>
          <p>
            Official invoices and payment receipts for your account{' '}
            <strong style={{ color: '#0f6b61' }}>
              {currentUser?.fullName || currentUser?.name || currentUser?.username}
            </strong>
            . Invoices are generated for bills that are marked as <b>Half Paid</b> or <b>Fully Paid</b>. You can download and inspect your PDF invoices anytime.
          </p>
        </div>
      ) : isMyBillsMode ? (
        <div className="bills-policy-banner" style={{ borderLeftColor: '#0f6b61' }}>
          <div className="policy-badge">
            <UserCheck size={14} color="#0f6b61" />
            <span>My Assigned Bills &amp; Statements</span>
          </div>
          <p>
            Work challans and billing statements assigned specifically to your portal user account{' '}
            <strong style={{ color: '#0f6b61' }}>
              {currentUser?.fullName || currentUser?.name || currentUser?.username}
            </strong>
            . View itemized work sessions, applied time discounts, and download statements as PDF.
          </p>
        </div>
      ) : (
        <div className="bills-policy-banner">
          <div className="policy-badge">
            <Sparkles size={14} color="#0f6b61" />
            <span>Payment Settlement Policy</span>
          </div>
          <p>
            By default, all work earnings prior to <b>October 2026</b> (up to September 30, 2026) are counted as{' '}
            <strong style={{ color: '#166534' }}>Settled / Paid</strong> in the workspace and dashboard. Starting from{' '}
            <b>October 2026 onwards</b>, payment settlements, partial recoveries, and customer assignments are dynamically tracked via this{' '}
            <b>Bills</b> tab in Google Sheets.
          </p>
        </div>
      )}

      {/* KPI Tiles */}
      <div className="summary-grid bills-kpi-grid">
        <div className="summary-card highlight">
          <div className="card-top">
            <span className="card-label">
              {isMyInvoicesMode ? 'Invoiced Net Total' : isMyBillsMode ? 'My Billed Net Total' : 'Total Billed Net'}
            </span>
            <FileText size={16} color="#d4f0e4" />
          </div>
          <strong>{formatRupees(billMetrics.totalBilled)}</strong>
          <small style={{ color: '#c7e8dc' }}>
            Across {filteredBills.length} {isMyInvoicesMode ? 'invoices' : 'recorded bills'}
          </small>
        </div>

        <div className="summary-card">
          <div className="card-top">
            <span className="card-label">
              {isMyInvoicesMode ? 'Amount Paid & Receipted' : 'Collected / Settled'}
            </span>
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
            <span className="card-label">
              {isMyInvoicesMode ? 'Remaining Balance Due' : 'Pending Receivables'}
            </span>
            <span className="card-icon orange">
              <Clock size={16} />
            </span>
          </div>
          <strong style={{ color: billMetrics.outstanding > 0 ? '#b45309' : '#0f6b61' }}>
            {formatRupees(billMetrics.outstanding)}
          </strong>
          <small style={{ color: '#88948c' }}>
            {isMyInvoicesMode
              ? `${billMetrics.halfPaidCount} partial invoices with balance`
              : `${billMetrics.unpaidCount} unpaid • ${billMetrics.halfPaidCount} partial balance`}
          </small>
        </div>

        <div className="summary-card">
          <div className="card-top">
            <span className="card-label">
              {isMyInvoicesMode ? 'Available Invoices' : isMyBillsMode ? 'My Bills Count' : 'Bills Register'}
            </span>
            <span className="card-icon blue">
              <Layers size={16} />
            </span>
          </div>
          <strong>{filteredBills.length} {isMyInvoicesMode ? 'Invoices' : 'Bills'}</strong>
          <small style={{ color: '#88948c' }}>
            In connected tab: <b>Bills</b>
          </small>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="toolbar bills-toolbar">
        <div className="view-tabs">
          {isMyInvoicesMode ? (
            <>
              <button
                className={`view-tab-btn ${statusFilter === 'All' ? 'selected' : ''}`}
                onClick={() => setStatusFilter('All')}
              >
                All Invoices ({baseBills.length})
              </button>
              <button
                className={`view-tab-btn ${statusFilter === 'Fully Paid' ? 'selected' : ''}`}
                onClick={() => setStatusFilter('Fully Paid')}
              >
                Fully Paid ({baseBills.filter((b) => b.status === 'Fully Paid').length})
              </button>
              <button
                className={`view-tab-btn ${statusFilter === 'Half Paid' ? 'selected' : ''}`}
                onClick={() => setStatusFilter('Half Paid')}
              >
                Half Paid ({baseBills.filter((b) => b.status === 'Half Paid').length})
              </button>
            </>
          ) : (
            <>
              <button
                className={`view-tab-btn ${statusFilter === 'All' ? 'selected' : ''}`}
                onClick={() => setStatusFilter('All')}
              >
                All Bills ({baseBills.length})
              </button>
              <button
                className={`view-tab-btn ${statusFilter === 'Unpaid' ? 'selected' : ''}`}
                onClick={() => setStatusFilter('Unpaid')}
              >
                Unpaid ({baseBills.filter((b) => b.status === 'Unpaid').length})
              </button>
              <button
                className={`view-tab-btn ${statusFilter === 'Half Paid' ? 'selected' : ''}`}
                onClick={() => setStatusFilter('Half Paid')}
              >
                Half Paid ({baseBills.filter((b) => b.status === 'Half Paid').length})
              </button>
              <button
                className={`view-tab-btn ${statusFilter === 'Fully Paid' ? 'selected' : ''}`}
                onClick={() => setStatusFilter('Fully Paid')}
              >
                Fully Paid ({baseBills.filter((b) => b.status === 'Fully Paid').length})
              </button>
            </>
          )}
        </div>

        <div className="toolbar-actions">
          {/* Client filter */}
          {availableClients.length > 1 && (
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
          )}

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
          <div
            className="export-menu"
            ref={exportMenuRef}
            onMouseEnter={() => setShowExportMenu(true)}
            onMouseLeave={() => setShowExportMenu(false)}
          >
            <button
              type="button"
              className="secondary-btn"
              title="Click or hover to export register"
              onClick={() => setShowExportMenu((prev) => !prev)}
            >
              <Download size={14} /> Export Register
            </button>
            <div className={`export-options ${showExportMenu ? 'show' : ''}`}>
              <button
                type="button"
                onClick={() => {
                  handleExportBillsExcel()
                  setShowExportMenu(false)
                }}
              >
                <Upload size={13} /> Excel Spreadsheet (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExportFilteredBillsPdf()
                  setShowExportMenu(false)
                }}
              >
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

          {/* Create New Challan / Bill Trigger (Admin Only) */}
          {isAdmin && onOpenCreateChallan && (
            <button
              className="primary-btn"
              onClick={onOpenCreateChallan}
              title="Create a new Challan & sync to Bills tab"
            >
              <Plus size={15} /> <span className="btn-text-responsive">Create Challan</span>
            </button>
          )}
        </div>
      </div>

      {/* Bills / Invoices Table */}
      <div className="ledger-section" style={{ marginTop: '16px' }}>
        <div className="table-wrap ledger-table-wrap">
          <table>
            <thead>
              <tr>
                {isMyInvoicesMode ? (
                  <>
                    <th>Invoice ID</th>
                    <th>Ref Bill ID</th>
                    <th>Payment Date</th>
                    <th>Period Scope</th>
                    <th>Client / Project</th>
                    {isAdmin && <th>Assigned To</th>}
                    <th>Duration</th>
                    <th style={{ textAlign: 'right' }}>Invoiced Amount</th>
                    <th>Status</th>
                    <th>Paid Amount</th>
                    <th>Balance Due</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </>
                ) : (
                  <>
                    <th>Bill ID</th>
                    <th>Created On</th>
                    <th>Period Scope</th>
                    <th>Client / Project</th>
                    {isAdmin && <th>Assigned To</th>}
                    <th>Sessions &amp; Duration</th>
                    <th style={{ textAlign: 'right' }}>Net Bill Amount</th>
                    <th>Status</th>
                    <th>Paid Amount</th>
                    <th>Paid Date</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => {
                const isFullyPaid = bill.status === 'Fully Paid'
                const isHalfPaid = bill.status === 'Half Paid'
                const isUnpaid = bill.status === 'Unpaid'
                const canDownloadInvoice = isFullyPaid || isHalfPaid
                const remaining = Math.max(0, bill.netAmount - (bill.paidAmount || (isFullyPaid ? bill.netAmount : 0)))

                if (isMyInvoicesMode) {
                  return (
                    <tr
                      key={bill.billId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedBillForInvoiceModal(bill)}
                    >
                      <td>
                        <span
                          className="bill-id-badge"
                          style={{ background: '#ecfdf5', color: '#0f6b61', borderColor: '#a7f3d0' }}
                        >
                          INV-{bill.billId.replace('BILL-', '')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', color: '#4b5563', fontFamily: 'monospace', fontWeight: 600 }}>
                          {bill.billId}
                        </span>
                      </td>
                      <td>
                        <small style={{ color: '#445148', fontWeight: 500 }}>{bill.paidOn || bill.createdOn}</small>
                      </td>
                      <td>
                        <strong>{formatBillingPeriod(bill.selectedPeriod)}</strong>
                      </td>
                      <td>
                        <strong>{bill.client}</strong>
                        <small>{bill.project}</small>
                      </td>
                      {isAdmin && (
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: bill.assignedTo ? '#0f6b61' : '#88948c',
                              background: bill.assignedTo ? '#f0fdf4' : '#f5f7f5',
                              padding: '3px 7px',
                              borderRadius: '4px',
                              display: 'inline-block',
                            }}
                          >
                            {bill.assignedTo || 'Unassigned'}
                          </span>
                        </td>
                      )}
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
                        <strong style={{ color: isFullyPaid ? '#166534' : '#b45309' }}>
                          {formatRupees(bill.paidAmount || (isFullyPaid ? bill.netAmount : 0))}
                        </strong>
                      </td>
                      <td>
                        {remaining > 0 ? (
                          <span style={{ color: '#c2410c', fontWeight: 600 }}>
                            {formatRupees(remaining)}
                          </span>
                        ) : (
                          <span style={{ color: '#166534', fontSize: '11px', fontWeight: 600 }}>Settled</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {/* Invoice PDF download */}
                          <button
                            className="table-action-btn"
                            title={isHalfPaid ? 'Download Partial Payment Invoice (PDF)' : 'Download Paid in Full Invoice (PDF)'}
                            onClick={() => generateInvoicePdf(bill)}
                            style={{
                              borderColor: isHalfPaid ? '#d97706' : '#0f6b61',
                              color: isHalfPaid ? '#b45309' : '#0f6b61',
                            }}
                          >
                            <Download size={13} />
                            <span>Invoice</span>
                          </button>

                          {/* View Invoice Modal */}
                          <button
                            className="table-action-btn"
                            title="View Official Invoice Details"
                            onClick={() => setSelectedBillForInvoiceModal(bill)}
                          >
                            <Receipt size={13} />
                            <span>View</span>
                          </button>

                          {/* View Reference Bill Statement */}
                          <button
                            className="table-action-btn"
                            title="View Reference Bill Statement"
                            onClick={() => setSelectedBillForModal(bill)}
                          >
                            <FileText size={13} />
                            <span>Ref Bill</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                // Regular Bill / My Bills row:
                return (
                  <tr
                    key={bill.billId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedBillForModal(bill)}
                  >
                    <td>
                      <span className="bill-id-badge">
                        {bill.billId}
                      </span>
                    </td>
                    <td>
                      <small style={{ color: '#445148', fontWeight: 500 }}>{bill.createdOn}</small>
                    </td>
                    <td>
                      <strong>{formatBillingPeriod(bill.selectedPeriod)}</strong>
                    </td>
                    <td>
                      <strong>{bill.client}</strong>
                      <small>{bill.project}</small>
                    </td>
                    {isAdmin && (
                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: bill.assignedTo ? '#0f6b61' : '#88948c',
                            background: bill.assignedTo ? '#f0fdf4' : '#f5f7f5',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            display: 'inline-block',
                          }}
                        >
                          {bill.assignedTo || 'Unassigned'}
                        </span>
                      </td>
                    )}
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
                        {/* Direct Bill Statement PDF download */}
                        <button
                          className="table-action-btn"
                          title="Download Bill Statement PDF"
                          onClick={() => generateBillStatementPdf(bill)}
                          style={{
                            borderColor: '#0f6b61',
                            color: '#0f6b61',
                          }}
                        >
                          <Download size={13} />
                          <span>Bill</span>
                        </button>

                        {/* Inspection / Statement Form Button */}
                        <button
                          className="table-action-btn"
                          title={isAdmin ? 'Open Bill Inspection Form & Update Status' : 'View Bill Statement Details'}
                          onClick={() => setSelectedBillForModal(bill)}
                        >
                          <FileText size={13} />
                          <span>{isAdmin ? 'Form' : 'View'}</span>
                        </button>

                        {/* Direct Invoice access if paid / half paid */}
                        {canDownloadInvoice && (
                          <button
                            className="table-action-btn"
                            title="View Official Payment Invoice"
                            onClick={() => setSelectedBillForInvoiceModal(bill)}
                            style={{
                              borderColor: isHalfPaid ? '#d97706' : '#0f6b61',
                              color: isHalfPaid ? '#b45309' : '#0f6b61',
                            }}
                          >
                            <Receipt size={13} />
                            <span>Invoice</span>
                          </button>
                        )}
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
              <strong>
                {isMyInvoicesMode
                  ? 'No Invoices Available Yet'
                  : isMyBillsMode
                  ? 'No Bills Assigned'
                  : 'No Bills Found'}
              </strong>
              <span>
                {isMyInvoicesMode
                  ? 'Invoices become available once payment is recorded by the admin as Half Paid or Fully Paid. Any pending bills can be reviewed under "My Bills".'
                  : isMyBillsMode
                  ? `There are currently no bills assigned to your user account (${currentUser?.fullName || currentUser?.username}). Contact your administrator if you need a statement.`
                  : bills.length === 0
                  ? 'No bills have been generated yet. Open "Create Challan" and click "Sync & Download PDF" to record your first bill in Google Sheets.'
                  : 'No bills match your current filter criteria.'}
              </span>
              {isAdmin && bills.length === 0 && onOpenCreateChallan && (
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
            Showing {filteredBills.length} of {baseBills.length} {isMyInvoicesMode ? 'invoices' : 'bills'} in sheet tab &quot;Bills&quot;
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
          isCustomerView={isCustomer}
          onClose={() => setSelectedBillForModal(null)}
          onOpenInvoice={
            selectedBillForModal.status === 'Half Paid' || selectedBillForModal.status === 'Fully Paid'
              ? () => {
                  const b = selectedBillForModal
                  setSelectedBillForModal(null)
                  setSelectedBillForInvoiceModal(b)
                }
              : undefined
          }
          onSaveBill={
            isAdmin && onUpdateBill
              ? async (updated) => {
                  const ok = await onUpdateBill(updated)
                  if (ok) {
                    setSelectedBillForModal(updated)
                  }
                  return ok
                }
              : undefined
          }
        />
      )}

      {/* Invoice Detail Modal */}
      {selectedBillForInvoiceModal && (
        <InvoiceDetailModal
          bill={selectedBillForInvoiceModal}
          onClose={() => setSelectedBillForInvoiceModal(null)}
          onOpenBillStatement={() => {
            const b = selectedBillForInvoiceModal
            setSelectedBillForInvoiceModal(null)
            setSelectedBillForModal(b)
          }}
        />
      )}
    </div>
  )
}
