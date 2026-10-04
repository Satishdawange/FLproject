import React, { useState } from 'react'
import {
  X,
  Download,
  Lock,
  Save,
  Sparkles,
  AlertCircle,
  Receipt,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { BillItem, BillPaymentStatus } from '../types'
import { formatMinutes, formatRupees, formatBillingPeriod } from '../utils/calculations'
import { generateInvoicePdf } from './InvoiceDetailModal'

interface BillDetailModalProps {
  bill: BillItem
  isCustomerView?: boolean
  onClose: () => void
  onSaveBill?: (updatedBill: BillItem) => Promise<boolean>
  onOpenInvoice?: () => void
}

/**
 * Generates and downloads official Bill Statement PDF
 */
export function generateBillStatementPdf(bill: BillItem) {
  const doc = new jsPDF()

  // Header banner (210mm wide)
  doc.setFillColor(15, 107, 97)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('SATISH SERVICENOW SUPPORT', 14, 13, { maxWidth: 110 })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('WORK CHALLAN BILL STATEMENT', 14, 20, { maxWidth: 110 })

  doc.setFontSize(8.5)
  doc.text(`Bill ID: ${bill.billId}`, 196, 14, { align: 'right' })
  doc.text(`Created: ${bill.createdOn}`, 196, 20, { align: 'right' })

  // Bill Details (2 columns: left x=14 maxWidth 90, right x=112 maxWidth 84)
  doc.setTextColor(30, 40, 35)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('CLIENT NAME:', 14, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(bill.client, 14, 44, { maxWidth: 90 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('BILLING PERIOD:', 112, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(formatBillingPeriod(bill.selectedPeriod), 112, 44, { maxWidth: 84 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PROJECT(S):', 14, 52)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(bill.project, 14, 58, { maxWidth: 90 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(bill.assignedTo ? 'CUSTOMER ACCOUNT:' : 'DATE GENERATED:', 112, 52)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(bill.assignedTo || bill.createdOn, 112, 58, { maxWidth: 84 })

  // Statement Table (Total width: 182mm from 14 to 196)
  autoTable(doc, {
    startY: 68,
    margin: { left: 14, right: 14 },
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
      ['Assigned Customer', bill.assignedTo || 'Unassigned', 'Account'],
    ],
    headStyles: { fillColor: [15, 107, 97], fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 82 },
      2: { cellWidth: 30, halign: 'right' },
    },
  })

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 160

  // Summary box (width 82mm, from 114 to 196mm)
  doc.setFillColor(242, 247, 244)
  doc.roundedRect(114, finalY + 8, 82, 34, 2, 2, 'F')
  doc.setTextColor(15, 107, 97)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text('Total Net Payable:', 118, finalY + 17, { maxWidth: 45 })
  doc.text(`Rs. ${Math.round(bill.netAmount).toLocaleString('en-IN')}`, 192, finalY + 17, { align: 'right' })

  doc.setFontSize(8.5)
  doc.setTextColor(50, 60, 55)
  doc.text(`Status: ${bill.status}`, 118, finalY + 24, { maxWidth: 74 })
  if (bill.paidOn) {
    doc.text(`Paid On: ${bill.paidOn}`, 118, finalY + 31, { maxWidth: 74 })
  }

  doc.save(`bill-statement-${bill.billId}.pdf`)
}

export const BillDetailModal: React.FC<BillDetailModalProps> = ({
  bill,
  isCustomerView = false,
  onClose,
  onSaveBill,
  onOpenInvoice,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10)

  // A bill that was loaded from the sheet as "Fully Paid" is locked and cannot be edited
  const isSettledLocked = bill.status === 'Fully Paid'
  const isEditable = !isSettledLocked && !isCustomerView && Boolean(onSaveBill)

  const [status, setStatus] = useState<BillPaymentStatus>(bill.status)
  const [paidAmount, setPaidAmount] = useState<number>(bill.paidAmount || 0)
  const [paidOn, setPaidOn] = useState<string>(bill.paidOn || '')
  const [notes, setNotes] = useState<string>(bill.notes || '')
  const [saving, setSaving] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; error?: boolean } | null>(null)

  const hasInvoice = status === 'Half Paid' || status === 'Fully Paid'
  const invoiceNo = `INV-${bill.billId.replace('BILL-', '')}`

  // Handle status change
  const handleStatusChange = (newStatus: BillPaymentStatus) => {
    if (!isEditable) return
    setStatus(newStatus)

    if (newStatus === 'Fully Paid') {
      setPaidAmount(bill.netAmount)
      setPaidOn(todayIso)
    } else if (newStatus === 'Half Paid') {
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
    if (!isEditable || !onSaveBill) return

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

  const remainingCalc = Math.max(0, bill.netAmount - (status === 'Fully Paid' ? bill.netAmount : paidAmount))

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal bill-detail-modal"
        style={{ maxWidth: '720px', width: '95%' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span className="badge-pill active" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {bill.billId}
              </span>
              <span className={`status-pill ${status.toLowerCase().replace(' ', '-')}`}>
                {status}
              </span>
              {hasInvoice && (
                <span
                  className="badge-pill"
                  style={{
                    background: '#e0f2fe',
                    color: '#0369a1',
                    borderColor: '#bae6fd',
                    cursor: onOpenInvoice ? 'pointer' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                  onClick={onOpenInvoice}
                  title="Click to view formal invoice document"
                >
                  <Receipt size={11} /> {invoiceNo}
                  {onOpenInvoice && <ExternalLink size={10} />}
                </span>
              )}
              {isSettledLocked && (
                <span className="badge-pill default" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={11} /> Settled &amp; Locked
                </span>
              )}
            </div>
            <h2>Work Challan &amp; Bill Statement</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close statement">
            <X size={18} />
          </button>
        </div>

        {/* MODAL SCROLL BODY */}
        <div className="modal-scroll-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '18px 24px' }}>
          {feedbackMsg && (
            <div className={`alert-box ${feedbackMsg.error ? 'error' : 'success'}`} style={{ marginBottom: '16px' }}>
              {feedbackMsg.error ? <AlertCircle size={15} /> : <Sparkles size={15} />}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* LINKED INVOICE BANNER */}
          {hasInvoice && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 16px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                marginBottom: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Receipt size={20} color="#0f6b61" />
                <div>
                  <strong style={{ fontSize: '13px', color: '#166534', display: 'block' }}>
                    Official Payment Invoice Generated ({invoiceNo})
                  </strong>
                  <span style={{ fontSize: '12px', color: '#3f6212' }}>
                    Recorded on {bill.paidOn || todayIso} • {status === 'Half Paid' ? 'Partial Payment Balance Active' : 'Paid in Full'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {onOpenInvoice && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={onOpenInvoice}
                    style={{ fontSize: '12px', padding: '5px 10px', height: '30px' }}
                  >
                    <ExternalLink size={12} /> Open Invoice View
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => generateInvoicePdf(bill)}
                  style={{
                    fontSize: '12px',
                    padding: '5px 10px',
                    height: '30px',
                    borderColor: '#0f6b61',
                    color: '#0f6b61',
                  }}
                >
                  <Download size={12} /> Invoice PDF
                </button>
              </div>
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
              <span className="kpi-caption">Client &amp; Scope</span>
              <strong style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {bill.client}
              </strong>
              <small>{formatBillingPeriod(bill.selectedPeriod)}</small>
            </div>
          </div>

          {/* READ ONLY BILL DETAILS SECTION */}
          <div className="bill-section-card">
            <h4 style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#1a2a20', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Itemized Challan &amp; Project Specifications
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
                <label>Billing Period Scope</label>
                <input type="text" readOnly value={formatBillingPeriod(bill.selectedPeriod)} className="readonly-input" />
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
              <div className="spec-field">
                <label>Assigned Customer Account</label>
                <input
                  type="text"
                  readOnly
                  value={bill.assignedTo || 'Unassigned'}
                  className="readonly-input"
                  style={{
                    color: bill.assignedTo ? '#0f6b61' : '#6b7280',
                    fontWeight: bill.assignedTo ? 700 : 400,
                  }}
                />
              </div>
              <div className="spec-field">
                <label>Total Logged Sessions</label>
                <input
                  type="text"
                  readOnly
                  value={`${bill.totalSessions} sessions (${formatMinutes(bill.totalMinutes)} gross)`}
                  className="readonly-input"
                />
              </div>
            </div>
          </div>

          {/* PAYMENT & SETTLEMENT SECTION */}
          <div className="bill-section-card payment-action-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '12.5px', color: '#0f6b61', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Payment Status &amp; Settlement Details {isCustomerView && '(Verified by Admin)'}
              </h4>
              {isSettledLocked ? (
                <span style={{ fontSize: '11px', color: '#7a887e', fontWeight: 600 }}>
                  Locked from sheet (Fully Paid)
                </span>
              ) : isCustomerView ? (
                <span style={{ fontSize: '11px', color: '#0f6b61', fontWeight: 600 }}>
                  <ShieldCheck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                  Verified
                </span>
              ) : null}
            </div>

            <div className="bill-specs-grid">
              {/* Payment Status Dropdown */}
              <div className="spec-field">
                <label>Payment Status</label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as BillPaymentStatus)}
                  disabled={!isEditable || saving}
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
                  disabled={!isEditable || status === 'Unpaid' || saving}
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
                    disabled={!isEditable || status !== 'Half Paid' || saving}
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
                disabled={!isEditable || saving}
                placeholder="e.g. Bank transfer, UTR number, partial invoice notes..."
                className="editable-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => generateBillStatementPdf(bill)}
            title="Export complete work challan statement"
          >
            <Download size={14} /> Download Bill Statement (PDF)
          </button>

          {hasInvoice && onOpenInvoice && (
            <button
              type="button"
              className="secondary-btn"
              onClick={onOpenInvoice}
              title="Open dedicated invoice document"
              style={{
                borderColor: status === 'Half Paid' ? '#d97706' : '#0f6b61',
                color: status === 'Half Paid' ? '#b45309' : '#0f6b61',
              }}
            >
              <Receipt size={14} /> View Invoice
            </button>
          )}

          {isEditable && (
            <button
              type="button"
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
