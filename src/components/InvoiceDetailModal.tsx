import React from 'react'
import {
  X,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  User,
  ExternalLink,
  ShieldCheck,
  Building,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { BillItem } from '../types'
import { formatMinutes, formatRupees, formatBillingPeriod } from '../utils/calculations'

interface InvoiceDetailModalProps {
  bill: BillItem
  onClose: () => void
  onOpenBillStatement?: () => void
}

/**
 * Generates and downloads official Payment Invoice PDF with Reference Bill Number
 */
export function generateInvoicePdf(bill: BillItem) {
  const doc = new jsPDF()
  const isHalfPaid = bill.status === 'Half Paid'
  const actualPaid = isHalfPaid ? Number(bill.paidAmount || 0) : bill.netAmount
  const remainingBalance = Math.max(0, bill.netAmount - actualPaid)
  const todayIso = new Date().toISOString().slice(0, 10)
  const paidOn = bill.paidOn || todayIso
  const invoiceNo = `INV-${bill.billId.replace('BILL-', '')}`
  const refBillNo = bill.billId

  // Header Color: Amber for Half Paid, Emerald for Fully Paid
  const headerColor: [number, number, number] = isHalfPaid ? [217, 119, 6] : [15, 107, 97]

  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2])
  doc.rect(0, 0, 210, 32, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(
    isHalfPaid ? 'PARTIAL PAYMENT INVOICE' : 'OFFICIAL PAYMENT INVOICE',
    14,
    15,
    { maxWidth: 110 }
  )

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(
    isHalfPaid ? '(HALF PAID - BALANCE DUE)' : '(PAID IN FULL - SETTLED)',
    14,
    22,
    { maxWidth: 110 }
  )
  doc.text('Satish Servicenow Support', 14, 28, { maxWidth: 110 })

  doc.text(`Invoice No: ${invoiceNo}`, 196, 13, { align: 'right' })
  doc.text(`Ref Bill No: ${refBillNo}`, 196, 19, { align: 'right' })
  doc.text(`Payment Date: ${paidOn}`, 196, 25, { align: 'right' })

  // Prominent Status Banner
  if (isHalfPaid) {
    doc.setFillColor(254, 243, 199)
    doc.roundedRect(14, 37, 182, 17, 2, 2, 'F')

    doc.setTextColor(180, 83, 9)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('[PARTIAL PAYMENT RECEIVED]', 18, 44, { maxWidth: 85 })

    doc.setTextColor(194, 65, 12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`REMAINING DUE: Rs. ${Math.round(remainingBalance).toLocaleString('en-IN')}`, 192, 44, { align: 'right' })

    doc.setTextColor(120, 60, 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Received: Rs. ${Math.round(actualPaid).toLocaleString('en-IN')} of Rs. ${Math.round(bill.netAmount).toLocaleString('en-IN')}`, 18, 50, { maxWidth: 105 })
    doc.text(`Recorded: ${paidOn}`, 192, 50, { align: 'right' })
  } else {
    doc.setFillColor(220, 252, 231)
    doc.roundedRect(14, 37, 182, 17, 2, 2, 'F')

    doc.setTextColor(22, 101, 52)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('[PAYMENT SETTLED IN FULL]', 18, 44, { maxWidth: 85 })

    doc.text('OUTSTANDING: Rs. 0', 192, 44, { align: 'right' })

    doc.setTextColor(30, 80, 45)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Full Paid: Rs. ${Math.round(actualPaid).toLocaleString('en-IN')}`, 18, 50, { maxWidth: 105 })
    doc.text(`Settled On: ${paidOn}`, 192, 50, { align: 'right' })
  }

  // Parties info
  doc.setTextColor(30, 40, 35)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('ISSUED BY:', 14, 61)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('Satish Servicenow Support', 14, 67, { maxWidth: 85 })
  doc.text('ServiceNow Consulting & Support', 14, 72, { maxWidth: 85 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('INVOICED TO:', 108, 61)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(bill.client, 108, 67, { maxWidth: 88 })
  if (bill.assignedTo) {
    doc.text(`Account: ${bill.assignedTo}`, 108, 72, { maxWidth: 88 })
  }
  doc.text(`Scope: ${formatBillingPeriod(bill.selectedPeriod)}`, 108, bill.assignedTo ? 77 : 72, { maxWidth: 88 })
  doc.text(`Project: ${bill.project}`, 108, bill.assignedTo ? 82 : 77, { maxWidth: 88 })

  const autoTableStartY = bill.assignedTo ? 88 : 84

  // Invoice Breakdown Table with explicit margins and widths
  autoTable(doc, {
    startY: autoTableStartY,
    margin: { left: 14, right: 14 },
    head: [['Description / Scope', 'Duration & Sessions', 'Gross', 'Discount', 'Net Invoiced (INR)']],
    body: [
      [
        `ServiceNow Support Services - ${formatBillingPeriod(bill.selectedPeriod)}\nProject: ${bill.project}\nReference Bill ID: ${refBillNo}`,
        `${formatMinutes(bill.effectiveMinutes)} billable time\n(${bill.totalSessions} sessions logged)`,
        `Rs. ${Math.round(bill.grossAmount).toLocaleString('en-IN')}`,
        `-Rs. ${Math.round(bill.discountMoney).toLocaleString('en-IN')}`,
        `Rs. ${Math.round(bill.netAmount).toLocaleString('en-IN')}`,
      ],
    ],
    headStyles: { fillColor: headerColor, fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3.5, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 42 },
      2: { cellWidth: 26 },
      3: { cellWidth: 26 },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
  })

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 140

  // Payment Summary Card (width: 86mm, from 110 to 196mm)
  doc.setFillColor(246, 249, 246)
  doc.roundedRect(110, finalY + 8, 86, 44, 2, 2, 'F')

  doc.setTextColor(50, 60, 55)
  doc.setFontSize(8.5)
  doc.text('Total Invoiced Amount:', 114, finalY + 16, { maxWidth: 45 })
  doc.text(`Rs. ${Math.round(bill.netAmount).toLocaleString('en-IN')}`, 192, finalY + 16, { align: 'right' })

  doc.setTextColor(isHalfPaid ? 180 : 15, isHalfPaid ? 83 : 107, isHalfPaid ? 9 : 97)
  doc.setFont('helvetica', 'bold')
  doc.text('Amount Received / Paid:', 114, finalY + 23, { maxWidth: 45 })
  doc.text(`Rs. ${Math.round(actualPaid).toLocaleString('en-IN')}`, 192, finalY + 23, { align: 'right' })

  doc.setDrawColor(200, 215, 205)
  doc.line(114, finalY + 27, 192, finalY + 27)

  doc.setFontSize(9.5)
  if (isHalfPaid) {
    doc.setTextColor(194, 65, 12)
    doc.text('Remaining Balance Due:', 114, finalY + 34, { maxWidth: 45 })
    doc.text(`Rs. ${Math.round(remainingBalance).toLocaleString('en-IN')}`, 192, finalY + 34, { align: 'right' })
    doc.setFontSize(7.5)
    doc.text(`Status: PARTIAL PAYMENT (HALF PAID)`, 114, finalY + 41, { maxWidth: 78 })
  } else {
    doc.setTextColor(15, 107, 97)
    doc.text('Outstanding Balance:', 114, finalY + 34, { maxWidth: 45 })
    doc.text('Rs. 0.00', 192, finalY + 34, { align: 'right' })
    doc.setFontSize(7.5)
    doc.text(`Status: PAID IN FULL`, 114, finalY + 41, { maxWidth: 78 })
  }

  doc.save(`invoice-${isHalfPaid ? 'half-paid-' : 'paid-'}${invoiceNo}.pdf`)
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  bill,
  onClose,
  onOpenBillStatement,
}) => {
  const isHalfPaid = bill.status === 'Half Paid'
  const invoiceNo = `INV-${bill.billId.replace('BILL-', '')}`
  const refBillNo = bill.billId
  const actualPaid = isHalfPaid ? Number(bill.paidAmount || 0) : bill.netAmount
  const remainingBalance = Math.max(0, bill.netAmount - actualPaid)
  const paidOn = bill.paidOn || new Date().toISOString().slice(0, 10)

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal invoice-modal-container"
        style={{ maxWidth: '740px', width: '96%' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* INVOICE HEADER BAR */}
        <div className={`invoice-modal-header ${isHalfPaid ? 'partial' : 'settled'}`}>
          <div className="invoice-header-left">
            <div className="invoice-tagline">
              <Receipt size={14} />
              <span>OFFICIAL TAX &amp; PAYMENT RECEIPT</span>
            </div>
            <h2>{isHalfPaid ? 'Partial Payment Invoice' : 'Official Payment Invoice'}</h2>
            <div className="invoice-meta-chips">
              <span className="invoice-chip primary">
                <strong>Invoice:</strong> {invoiceNo}
              </span>
              <span
                className="invoice-chip ref-bill"
                onClick={onOpenBillStatement}
                title="Click to view underlying work challan bill"
              >
                <strong>Ref Bill:</strong> {refBillNo}
                {onOpenBillStatement && <ExternalLink size={11} style={{ marginLeft: '4px' }} />}
              </span>
            </div>
          </div>

          <div className="invoice-header-right">
            {/* OFFICIAL STAMP BADGE */}
            <div className={`invoice-stamp-badge ${isHalfPaid ? 'partial' : 'settled'}`}>
              <div className="stamp-icon">
                {isHalfPaid ? <AlertTriangle size={18} /> : <ShieldCheck size={20} />}
              </div>
              <div className="stamp-text">
                <strong>{isHalfPaid ? 'PARTIALLY PAID' : 'PAID IN FULL'}</strong>
                <small>{isHalfPaid ? 'REMAINING BALANCE DUE' : 'OFFICIALLY SETTLED'}</small>
              </div>
            </div>

            <button className="icon-btn invoice-close-btn" onClick={onClose} title="Close invoice">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* INVOICE MODAL BODY */}
        <div className="invoice-modal-body">
          {/* PARTIES CARDS (FROM / TO) */}
          <div className="invoice-parties-grid">
            <div className="invoice-party-box">
              <span className="party-title">
                <Building size={12} /> Billed By (Consultant):
              </span>
              <strong className="party-name">Satish Servicenow Support</strong>
              <span className="party-desc">ServiceNow Technical &amp; Architecture Support</span>
              <span className="party-sub">Professional Services</span>
            </div>

            <div className="invoice-party-box client-box">
              <span className="party-title">
                <User size={12} /> Invoiced To (Client):
              </span>
              <strong className="party-name">{bill.client}</strong>
              {bill.assignedTo && (
                <span className="party-assigned">
                  Customer Account: <b>{bill.assignedTo}</b>
                </span>
              )}
              <span className="party-scope">
                Scope Period: <b>{formatBillingPeriod(bill.selectedPeriod)}</b>
              </span>
              <span className="party-project">
                Project: <b>{bill.project}</b>
              </span>
            </div>
          </div>

          {/* DATES & METADATA BAR */}
          <div className="invoice-meta-bar">
            <div className="meta-item">
              <span className="meta-label">Invoice Issued:</span>
              <span className="meta-val">{bill.createdOn}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Payment Recorded Date:</span>
              <span className="meta-val highlight">{paidOn}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Work Sessions:</span>
              <span className="meta-val">{bill.totalSessions} sessions logged</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Billable Work Time:</span>
              <span className="meta-val">{formatMinutes(bill.effectiveMinutes)}</span>
            </div>
          </div>

          {/* INVOICE LINE ITEMS TABLE */}
          <div className="invoice-line-items">
            <table>
              <thead>
                <tr>
                  <th>Description of Service</th>
                  <th style={{ textAlign: 'center' }}>Time / Sessions</th>
                  <th style={{ textAlign: 'right' }}>Gross Amount</th>
                  <th style={{ textAlign: 'right' }}>Time Discount</th>
                  <th style={{ textAlign: 'right' }}>Net Due</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>ServiceNow Support Services</strong>
                    <small>
                      Scope: {formatBillingPeriod(bill.selectedPeriod)} • Projects: {bill.project}
                    </small>
                    <small style={{ color: '#0f6b61', fontWeight: 600 }}>
                      Underlying Challan ID: {refBillNo}
                    </small>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <b>{formatMinutes(bill.effectiveMinutes)}</b>
                    <small>({bill.totalSessions} sessions)</small>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatRupees(bill.grossAmount)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#b45309' }}>
                    -{formatRupees(bill.discountMoney)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f6b61' }}>
                    {formatRupees(bill.netAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* RECONCILIATION SUMMARY BOX */}
          <div className="invoice-reconciliation-card">
            <div className="reconciliation-left">
              <h4>Payment Verification &amp; Transaction Details</h4>
              <p>
                This invoice serves as the official financial receipt for services rendered. Generated
                dynamically from the verified Google Sheets billing register.
              </p>
              {bill.notes && (
                <div className="invoice-notes-box">
                  <strong>Payment Notes / Remarks:</strong>
                  <span>{bill.notes}</span>
                </div>
              )}
            </div>

            <div className="reconciliation-right">
              <div className="recon-row">
                <span>Total Invoiced (Net):</span>
                <strong>{formatRupees(bill.netAmount)}</strong>
              </div>
              <div className="recon-row credit">
                <span>Amount Paid / Credited:</span>
                <strong style={{ color: isHalfPaid ? '#b45309' : '#166534' }}>
                  {formatRupees(actualPaid)}
                </strong>
              </div>
              <div className="recon-divider" />
              <div className={`recon-row balance ${isHalfPaid ? 'due' : 'settled'}`}>
                <span>{isHalfPaid ? 'Balance Due:' : 'Remaining Balance:'}</span>
                <strong>
                  {isHalfPaid ? formatRupees(remainingBalance) : '₹0.00 (Settled)'}
                </strong>
              </div>
              <div className="recon-status-badge">
                {isHalfPaid ? (
                  <span className="badge-partial">
                    <AlertTriangle size={12} /> Partial Payment Received
                  </span>
                ) : (
                  <span className="badge-settled">
                    <CheckCircle2 size={12} /> Paid in Full
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* INVOICE MODAL FOOTER */}
        <div className="modal-footer invoice-modal-footer">
          {onOpenBillStatement && (
            <button
              type="button"
              className="secondary-btn"
              onClick={onOpenBillStatement}
              title="Open full itemized work challan statement"
            >
              <FileText size={14} /> View Reference Bill Statement
            </button>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="primary-btn"
              onClick={() => generateInvoicePdf(bill)}
              style={{
                background: isHalfPaid ? '#d97706' : '#0f6b61',
                borderColor: isHalfPaid ? '#b45309' : '#0a524a',
              }}
              title="Download official PDF invoice"
            >
              <Download size={14} /> Download Invoice (PDF)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
