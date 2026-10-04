import React, { useState } from 'react'
import {
  X,
  FileText,
  Download,
  Lock,
  Save,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { BillItem, BillPaymentStatus } from '../types'
import { formatMinutes, formatRupees } from '../utils/calculations'

interface BillDetailModalProps {
  bill: BillItem
  onClose: () => void
  onSaveBill: (updatedBill: BillItem) => Promise<boolean>
}

export const BillDetailModal: React.FC<BillDetailModalProps> = ({
  bill,
  onClose,
  onSaveBill,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10)

  // A bill that was loaded from the sheet as "Fully Paid" is locked and cannot be edited
  const isSettledLocked = bill.status === 'Fully Paid'

  const [status, setStatus] = useState<BillPaymentStatus>(bill.status)
  const [paidAmount, setPaidAmount] = useState<number>(bill.paidAmount || 0)
  const [paidOn, setPaidOn] = useState<string>(bill.paidOn || '')
  const [notes, setNotes] = useState<string>(bill.notes || '')
  const [saving, setSaving] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; error?: boolean } | null>(null)

  // Handle status change
  const handleStatusChange = (newStatus: BillPaymentStatus) => {
    if (isSettledLocked) return
    setStatus(newStatus)

    if (newStatus === 'Fully Paid') {
      // Auto-set paid amount to full net amount
      setPaidAmount(bill.netAmount)
      // Recent fully paid date overrides previous half-paid date
      setPaidOn(todayIso)
    } else if (newStatus === 'Half Paid') {
      // If paid amount was full or 0, default to half
      if (paidAmount === 0 || paidAmount >= bill.netAmount) {
        setPaidAmount(Math.round(bill.netAmount / 2))
      }
      if (!paidOn) {
        setPaidOn(todayIso)
      }
    } else if (newStatus === 'Unpaid') {
      setPaidAmount(0)
      setPaidOn('')
    }
  }

  // Handle Save to Google Sheets
  const handleSave = async () => {
    if (isSettledLocked) return

    if (status === 'Half Paid') {
      if (!paidAmount || paidAmount <= 0) {
        setFeedbackMsg({ text: 'Please specify how much was paid for Half Paid status.', error: true })
        return
      }
      if (paidAmount >= bill.netAmount) {
        setFeedbackMsg({ text: 'Paid amount equals or exceeds full amount. Please select Fully Paid instead.', error: true })
        return
      }
      if (!paidOn) {
        setFeedbackMsg({ text: 'Please select the payment date for Half Paid status.', error: true })
        return
      }
    }

    if (status === 'Fully Paid' && !paidOn) {
      setPaidOn(todayIso)
    }

    setSaving(true)
    setFeedbackMsg(null)

    const updated: BillItem = {
      ...bill,
      status,
      paidAmount: status === 'Fully Paid' ? bill.netAmount : status === 'Half Paid' ? Number(paidAmount) : 0,
      paidOn: status === 'Unpaid' ? '' : paidOn || todayIso,
      notes,
    }

    const success = await onSaveBill(updated)
    setSaving(false)

    if (success) {
      setFeedbackMsg({ text: 'Bill payment status updated & synced to Google Sheet!' })
    } else {
      setFeedbackMsg({ text: 'Failed to update sheet. Please verify your connection.', error: true })
    }
  }

  // Generate & Download PDF Bill Statement
  const handleExportStatementPdf = () => {
    const doc = new jsPDF()

    // Header banner
    doc.setFillColor(15, 107, 97)
    doc.rect(0, 0, 210, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('SATISH SERVICENOW SUPPORT - BILL STATEMENT', 14, 18)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Bill ID: ${bill.billId}`, 196, 18, { align: 'right' })

    // Bill Details
    doc.setTextColor(30, 40, 35)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('CLIENT NAME:', 14, 40)
    doc.setFont('helvetica', 'normal')
    doc.text(bill.client, 14, 46)

    doc.setFont('helvetica', 'bold')
    doc.text('BILLING PERIOD:', 120, 40)
    doc.setFont('helvetica', 'normal')
    doc.text(bill.selectedPeriod, 120, 46)

    doc.setFont('helvetica', 'bold')
    doc.text('PROJECT(S):', 14, 54)
    doc.setFont('helvetica', 'normal')
    doc.text(bill.project, 14, 60)

    doc.setFont('helvetica', 'bold')
    doc.text('DATE GENERATED:', 120, 54)
    doc.setFont('helvetica', 'normal')
    doc.text(bill.createdOn, 120, 60)

    // Statement Table
    autoTable(doc, {
      startY: 68,
      head: [['Dimension / Item', 'Details / Values', 'Metric']],
      body: [
        ['Total Work Sessions', `${bill.totalSessions} sessions logged`, 'Volume'],
        ['Total Work Duration', formatMinutes(bill.totalMinutes), 'Time'],
        ['Time Discounts Deducted', bill.discountMinutes > 0 ? `-${formatMinutes(bill.discountMinutes)}` : '0m', 'Deduction'],
        ['Effective Billable Time', formatMinutes(bill.effectiveMinutes), 'Effective'],
        ['Gross Amount (Pre-Discount)', `Rs. ${Math.round(bill.grossAmount).toLocaleString('en-IN')}`, 'Financial'],
        ['Discount Amount Deducted', `-Rs. ${Math.round(bill.discountMoney).toLocaleString('en-IN')}`, 'Financial'],
        ['Net Amount Payable', `Rs. ${Math.round(bill.netAmount).toLocaleString('en-IN')}`, 'Final Due'],
        ['Current Payment Status', bill.status, 'Status'],
        ['Paid Amount to Date', `Rs. ${Math.round(bill.paidAmount || 0).toLocaleString('en-IN')}`, 'Collections'],
        ['Payment Date', bill.paidOn || 'Pending', 'Date'],
      ],
      headStyles: { fillColor: [15, 107, 97], fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 3.5 },
    })

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 160

    doc.setFillColor(242, 247, 244)
    doc.roundedRect(120, finalY + 8, 76, 32, 2, 2, 'F')
    doc.setTextColor(15, 107, 97)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Total Net Payable:', 124, finalY + 18)
    doc.text(`Rs. ${Math.round(bill.netAmount).toLocaleString('en-IN')}`, 192, finalY + 18, { align: 'right' })

    doc.setFontSize(9)
    doc.setTextColor(50, 60, 55)
    doc.text(`Status: ${bill.status}`, 124, finalY + 26)
    if (bill.paidOn) {
      doc.text(`Paid On: ${bill.paidOn}`, 124, finalY + 34)
    }

    doc.save(`bill-${bill.billId}.pdf`)
  }

  // Generate & Download Official Payment Invoice PDF (for Half Paid / Fully Paid)
  const handleExportInvoicePdf = () => {
    if (status !== 'Half Paid' && status !== 'Fully Paid') return

    const doc = new jsPDF()
    const isHalfPaid = status === 'Half Paid'
    const actualPaid = isHalfPaid ? paidAmount : bill.netAmount
    const remainingBalance = Math.max(0, bill.netAmount - actualPaid)

    // Header color: Amber for Half Paid, Emerald for Fully Paid
    const headerColor: [number, number, number] = isHalfPaid ? [217, 119, 6] : [15, 107, 97]

    doc.setFillColor(headerColor[0], headerColor[1], headerColor[2])
    doc.rect(0, 0, 210, 30, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(
      isHalfPaid ? 'PARTIAL PAYMENT INVOICE (HALF PAID)' : 'OFFICIAL PAYMENT INVOICE (PAID IN FULL)',
      14,
      18
    )

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Invoice No: INV-${bill.billId.replace('BILL-', '')}`, 196, 14, { align: 'right' })
    doc.text(`Date: ${paidOn || todayIso}`, 196, 22, { align: 'right' })

    // Prominent Status Banner (Multi-line layout with clean ASCII formatting)
    if (isHalfPaid) {
      doc.setFillColor(254, 243, 199) // Light amber
      doc.roundedRect(14, 35, 182, 16, 2, 2, 'F')
      
      // Top line
      doc.setTextColor(180, 83, 9)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.text('[PARTIAL PAYMENT RECEIVED]', 18, 42)

      doc.setTextColor(194, 65, 12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.text(`REMAINING BALANCE DUE: Rs. ${Math.round(remainingBalance).toLocaleString('en-IN')}`, 192, 42, { align: 'right' })

      // Bottom line
      doc.setTextColor(120, 60, 10)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`Amount Received: Rs. ${Math.round(actualPaid).toLocaleString('en-IN')} of Rs. ${Math.round(bill.netAmount).toLocaleString('en-IN')}`, 18, 47.5)
      doc.text(`Payment Recorded: ${paidOn || todayIso}`, 192, 47.5, { align: 'right' })
    } else {
      doc.setFillColor(220, 252, 231) // Light green
      doc.roundedRect(14, 35, 182, 16, 2, 2, 'F')

      // Top line
      doc.setTextColor(22, 101, 52)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.text('[PAYMENT SETTLED IN FULL]', 18, 42)

      doc.text('OUTSTANDING BALANCE: Rs. 0', 192, 42, { align: 'right' })

      // Bottom line
      doc.setTextColor(30, 80, 45)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`Full Amount Paid: Rs. ${Math.round(actualPaid).toLocaleString('en-IN')}`, 18, 47.5)
      doc.text(`Settled On: ${paidOn || todayIso}`, 192, 47.5, { align: 'right' })
    }

    // Bill To details
    doc.setTextColor(30, 40, 35)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('BILLED TO:', 14, 60)
    doc.setFont('helvetica', 'normal')
    doc.text(bill.client, 14, 66)

    doc.setFont('helvetica', 'bold')
    doc.text('SERVICE SCOPE:', 120, 60)
    doc.setFont('helvetica', 'normal')
    doc.text(bill.selectedPeriod, 120, 66)

    doc.setFont('helvetica', 'bold')
    doc.text('PROJECT:', 14, 76)
    doc.setFont('helvetica', 'normal')
    doc.text(bill.project, 14, 82)

    doc.setFont('helvetica', 'bold')
    doc.text('PAYMENT DATE:', 120, 76)
    doc.setFont('helvetica', 'normal')
    doc.text(paidOn || todayIso, 120, 82)

    // Invoice Breakdown Table
    autoTable(doc, {
      startY: 92,
      head: [['Description', 'Scope / Hours', 'Gross', 'Discount', 'Net Amount (INR)']],
      body: [
        [
          `ServiceNow Support Services - ${bill.selectedPeriod}\nProjects: ${bill.project}\nTotal sessions: ${bill.totalSessions}`,
          `${formatMinutes(bill.effectiveMinutes)} billable time\n(${formatMinutes(bill.totalMinutes)} gross)`,
          `Rs. ${Math.round(bill.grossAmount).toLocaleString('en-IN')}`,
          `-Rs. ${Math.round(bill.discountMoney).toLocaleString('en-IN')}`,
          `Rs. ${Math.round(bill.netAmount).toLocaleString('en-IN')}`,
        ],
      ],
      headStyles: { fillColor: headerColor, fontSize: 8.5, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 4 },
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
    })

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 140

    // Payment Summary Card
    doc.setFillColor(245, 248, 245)
    doc.roundedRect(110, finalY + 8, 86, 46, 2, 2, 'F')

    doc.setTextColor(50, 60, 55)
    doc.setFontSize(9)
    doc.text('Total Invoiced Amount:', 115, finalY + 16)
    doc.text(`Rs. ${Math.round(bill.netAmount).toLocaleString('en-IN')}`, 192, finalY + 16, { align: 'right' })

    doc.setTextColor(isHalfPaid ? 180 : 15, isHalfPaid ? 83 : 107, isHalfPaid ? 9 : 97)
    doc.setFont('helvetica', 'bold')
    doc.text('Amount Received / Paid:', 115, finalY + 24)
    doc.text(`Rs. ${Math.round(actualPaid).toLocaleString('en-IN')}`, 192, finalY + 24, { align: 'right' })

    doc.setDrawColor(200, 215, 205)
    doc.line(115, finalY + 28, 192, finalY + 28)

    doc.setFontSize(10.5)
    if (isHalfPaid) {
      doc.setTextColor(194, 65, 12)
      doc.text('Balance Due:', 115, finalY + 36)
      doc.text(`Rs. ${Math.round(remainingBalance).toLocaleString('en-IN')}`, 192, finalY + 36, { align: 'right' })
      doc.setFontSize(8)
      doc.text(`Status: PARTIAL PAYMENT (HALF PAID)`, 115, finalY + 44)
    } else {
      doc.setTextColor(15, 107, 97)
      doc.text('Balance Remaining:', 115, finalY + 36)
      doc.text('Rs. 0.00', 192, finalY + 36, { align: 'right' })
      doc.setFontSize(8)
      doc.text(`Status: PAID IN FULL`, 115, finalY + 44)
    }

    doc.save(`invoice-${isHalfPaid ? 'half-paid-' : 'paid-'}${bill.billId}.pdf`)
  }

  const remainingCalc = Math.max(0, bill.netAmount - (status === 'Fully Paid' ? bill.netAmount : paidAmount))

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal bill-detail-modal"
        style={{ maxWidth: '680px', width: '95%' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge-pill active" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                {bill.billId}
              </span>
              <span className={`status-pill ${status.toLowerCase().replace(' ', '-')}`}>
                {status}
              </span>
              {isSettledLocked && (
                <span className="badge-pill default" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={11} /> Settled &amp; Locked
                </span>
              )}
            </div>
            <h2>Bill &amp; Payment Statement Form</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-scroll-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '18px 24px' }}>
          {feedbackMsg && (
            <div className={`alert-box ${feedbackMsg.error ? 'error' : 'success'}`} style={{ marginBottom: '16px' }}>
              {feedbackMsg.error ? <AlertCircle size={15} /> : <Sparkles size={15} />}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* READ ONLY METRIC TILES */}
          <div className="bill-kpi-summary">
            <div className="bill-kpi-tile">
              <span className="kpi-caption">Net Payable Amount</span>
              <strong style={{ color: '#0f6b61', fontSize: '20px' }}>
                {formatRupees(bill.netAmount)}
              </strong>
              <small>Gross: {formatRupees(bill.grossAmount)} (-{formatRupees(bill.discountMoney)})</small>
            </div>

            <div className="bill-kpi-tile">
              <span className="kpi-caption">Billable Work Time</span>
              <strong>{formatMinutes(bill.effectiveMinutes)}</strong>
              <small>Across {bill.totalSessions} sessions ({formatMinutes(bill.totalMinutes)} total)</small>
            </div>

            <div className="bill-kpi-tile">
              <span className="kpi-caption">Client &amp; Period</span>
              <strong style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {bill.client}
              </strong>
              <small>{bill.selectedPeriod}</small>
            </div>
          </div>

          {/* READ ONLY BILL DETAILS SECTION */}
          <div className="bill-section-card">
            <h4 style={{ margin: '0 0 12px', fontSize: '13px', color: '#1a2a20', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Challan &amp; Project Specifications (Read-Only)
            </h4>

            <div className="bill-specs-grid">
              <div className="spec-field">
                <label>Bill Reference ID</label>
                <input type="text" readOnly value={bill.billId} className="readonly-input" />
              </div>
              <div className="spec-field">
                <label>Created Date &amp; Time</label>
                <input type="text" readOnly value={bill.createdOn} className="readonly-input" />
              </div>
              <div className="spec-field">
                <label>Billed Client</label>
                <input type="text" readOnly value={bill.client} className="readonly-input" />
              </div>
              <div className="spec-field">
                <label>Service Projects</label>
                <input type="text" readOnly value={bill.project} className="readonly-input" />
              </div>
              <div className="spec-field">
                <label>Billing Period</label>
                <input type="text" readOnly value={bill.selectedPeriod} className="readonly-input" />
              </div>
              <div className="spec-field">
                <label>Discount Deducted</label>
                <input
                  type="text"
                  readOnly
                  value={`${formatMinutes(bill.discountMinutes)} (${formatRupees(bill.discountMoney)})`}
                  className="readonly-input"
                />
              </div>
            </div>
          </div>

          {/* PAYMENT & SETTLEMENT EDITABLE SECTION */}
          <div className="bill-section-card payment-action-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', color: '#0f6b61', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Payment Status &amp; Settlement Details
              </h4>
              {isSettledLocked && (
                <span style={{ fontSize: '11px', color: '#7a887e', fontWeight: 600 }}>
                  Locked from sheet (Fully Paid)
                </span>
              )}
            </div>

            <div className="bill-specs-grid">
              {/* Payment Status Dropdown */}
              <div className="spec-field">
                <label>Payment Status</label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as BillPaymentStatus)}
                  disabled={isSettledLocked || saving}
                  className="editable-select"
                  style={{ fontWeight: 700 }}
                >
                  <option value="Unpaid">Unpaid (Pending Collection)</option>
                  <option value="Half Paid">Half Paid (Partial Settlement)</option>
                  <option value="Fully Paid">Fully Paid (Settled in Full)</option>
                </select>
              </div>

              {/* Paid On Date Input */}
              <div className="spec-field">
                <label>
                  Payment Received Date {status === 'Fully Paid' && '(Latest Settled Date)'}
                </label>
                <input
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  disabled={isSettledLocked || status === 'Unpaid' || saving}
                  className="editable-input"
                />
              </div>

              {/* Paid Amount Input */}
              <div className="spec-field">
                <label>Paid Amount (INR)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={status === 'Fully Paid' ? bill.netAmount : paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                    disabled={isSettledLocked || status !== 'Half Paid' || saving}
                    className="editable-input"
                    placeholder="Enter received amount"
                  />
                </div>
              </div>

              {/* Remaining Balance Due */}
              <div className="spec-field">
                <label>Remaining Balance Due (INR)</label>
                <input
                  type="text"
                  readOnly
                  value={formatRupees(remainingCalc)}
                  className="readonly-input balance-due-input"
                  style={{
                    color: remainingCalc > 0 ? '#b2432a' : '#0f6b61',
                    fontWeight: 800,
                  }}
                />
              </div>
            </div>

            {/* Optional Notes */}
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4a5b50', marginBottom: '4px' }}>
                Payment Notes / Transaction Remarks:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSettledLocked || saving}
                placeholder="e.g. Bank transfer, UTR number, partial invoice notes..."
                className="editable-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <button className="secondary-btn" onClick={handleExportStatementPdf} title="Export complete bill statement">
            <Download size={14} /> Export Bill Statement (PDF)
          </button>

          {(status === 'Half Paid' || status === 'Fully Paid') && (
            <button
              className="secondary-btn"
              onClick={handleExportInvoicePdf}
              title={status === 'Half Paid' ? 'Download Partial Payment Invoice' : 'Download Paid in Full Receipt'}
              style={{
                borderColor: status === 'Half Paid' ? '#d97706' : '#0f6b61',
                color: status === 'Half Paid' ? '#b45309' : '#0f6b61',
              }}
            >
              <FileText size={14} />
              {status === 'Half Paid' ? 'Partial Invoice (PDF)' : 'Payment Invoice (PDF)'}
            </button>
          )}

          {!isSettledLocked && (
            <button
              className="primary-btn"
              onClick={handleSave}
              disabled={saving}
              style={{ marginLeft: 'auto' }}
            >
              <Save size={15} />
              {saving ? 'Saving to Sheet...' : 'Save & Sync to Sheet'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
