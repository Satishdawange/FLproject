import React, { useState } from 'react'
import {
  X,
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Volume2,
  Smartphone,
  Check,
  Receipt,
  ArrowRight,
} from 'lucide-react'
import type { AppNotification, AuthUser } from '../types'
import { formatRupees } from '../utils/calculations'
import { notificationService } from '../utils/notificationService'

interface NotificationDrawerProps {
  isOpen: boolean
  onClose: () => void
  notifications: AppNotification[]
  currentUser?: AuthUser | null
  isAdmin: boolean
  onAcceptRequest: (notif: AppNotification) => Promise<void>
  onRejectRequest: (notif: AppNotification) => Promise<void>
  onOpenBill: (billId: string) => void
  onDismissNotification?: (id: string) => void
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  isAdmin,
  onAcceptRequest,
  onRejectRequest,
  onOpenBill,
  onDismissNotification,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission>(() =>
    notificationService.getPermission()
  )

  if (!isOpen) return null

  const handleEnableBrowserNotifications = async () => {
    const granted = await notificationService.requestPermission()
    setBrowserPerm(notificationService.getPermission())
    if (granted) {
      notificationService.sendNotification('Alerts Enabled!', {
        body: 'You will now receive instant payment and bill status updates on this device.',
      })
    }
  }

  const handleTestSound = () => {
    notificationService.playChime()
  }

  const handleAccept = async (notif: AppNotification) => {
    setProcessingId(notif.id)
    try {
      await onAcceptRequest(notif)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (notif: AppNotification) => {
    setProcessingId(notif.id)
    try {
      await onRejectRequest(notif)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="notif-drawer-overlay" onClick={onClose}>
      <aside
        className="notif-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Notification Center"
      >
        {/* DRAWER HEADER */}
        <div className="notif-drawer-header">
          <div className="notif-header-title">
            <div className="notif-bell-icon-wrap">
              <Bell size={18} color="#0f6b61" />
              {notifications.length > 0 && (
                <span className="notif-badge-pill">{notifications.length}</span>
              )}
            </div>
            <div>
              <h3>Notification Center</h3>
              <p>
                {isAdmin
                  ? 'Payment status change requests from customers'
                  : 'Pending bill payments and status updates'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn notif-close-btn"
            onClick={onClose}
            title="Close notifications"
          >
            <X size={18} />
          </button>
        </div>

        {/* DEVICE NOTIFICATIONS & SOUND BAR */}
        <div className="notif-device-bar">
          <div className="device-bar-left">
            <Smartphone size={14} color="#0f6b61" />
            <span>Mobile &amp; Browser Alerts:</span>
            {browserPerm === 'granted' ? (
              <span className="perm-pill granted">Active</span>
            ) : (
              <button
                type="button"
                className="perm-action-btn"
                onClick={handleEnableBrowserNotifications}
              >
                Enable Direct Alerts
              </button>
            )}
          </div>
          <button
            type="button"
            className="chime-test-btn"
            onClick={handleTestSound}
            title="Test audio chime"
          >
            <Volume2 size={13} /> Chime
          </button>
        </div>

        {/* NOTIFICATIONS LIST */}
        <div className="notif-drawer-body">
          {notifications.length === 0 ? (
            <div className="notif-empty-state">
              <div className="empty-bell-icon">
                <CheckCircle2 size={38} color="#10b981" />
              </div>
              <h4>All Caught Up!</h4>
              <p>
                {isAdmin
                  ? 'There are currently no pending customer payment requests requiring your approval.'
                  : 'All your bills are settled or up to date. No pending payment actions required!'}
              </p>
            </div>
          ) : (
            <div className="notif-items-list">
              {notifications.map((notif) => {
                const req = notif.paymentRequest
                const isProcessing = processingId === notif.id

                // ADMIN VIEW: Customer Payment Requests
                if (isAdmin && notif.type === 'payment_request') {
                  return (
                    <div key={notif.id} className="notif-card admin-request-card">
                      <div className="notif-card-header">
                        <span className="notif-type-tag request-tag">
                          <Clock size={12} /> Payment Approval Request
                        </span>
                        <span className="notif-time-badge">{notif.createdAt?.slice(0, 16)}</span>
                      </div>

                      <div className="notif-bill-meta">
                        <button
                          type="button"
                          className="bill-link-btn"
                          onClick={() => {
                            onOpenBill(notif.billId)
                            onClose()
                          }}
                          title="Open bill details"
                        >
                          <Receipt size={13} /> {notif.billId} <ExternalLink size={11} />
                        </button>
                        <span className="notif-customer-name">
                          Requested by: <b>{req?.customerName || req?.customerUsername || 'Customer'}</b>
                        </span>
                      </div>

                      <div className="notif-request-details-grid">
                        <div className="req-metric-box">
                          <label>Requested Status</label>
                          <strong className={req?.requestedStatus === 'Fully Paid' ? 'full-status' : 'half-status'}>
                            {req?.requestedStatus || 'Fully Paid'}
                          </strong>
                        </div>
                        <div className="req-metric-box">
                          <label>Amount Paid by Customer</label>
                          <strong style={{ color: '#0f6b61' }}>
                            {formatRupees(req?.paidAmount || notif.paymentRequest?.totalAmount || 0)}
                          </strong>
                        </div>
                        <div className="req-metric-box">
                          <label>Total Bill Amount</label>
                          <span>{formatRupees(notif.paymentRequest?.totalAmount || 0)}</span>
                        </div>
                        <div className="req-metric-box">
                          <label>Payment Date</label>
                          <span>{req?.paymentDate || 'Today'}</span>
                        </div>
                      </div>

                      {req?.requestedStatus === 'Half Paid' && (
                        <div className="half-paid-notice-bar">
                          <span>
                            Remaining Balance Due: <b>{formatRupees(req.remainingAmount)}</b>
                          </span>
                          {req.remainingPaymentDate && (
                            <span>Expected By: <b>{req.remainingPaymentDate}</b></span>
                          )}
                        </div>
                      )}

                      {req?.description && (
                        <div className="notif-user-description">
                          <span className="desc-label">Customer Transaction Note:</span>
                          <p className="desc-text">"{req.description}"</p>
                        </div>
                      )}

                      {/* ACCEPT / REJECT BUTTONS */}
                      <div className="notif-action-row">
                        <button
                          type="button"
                          className="notif-accept-btn"
                          onClick={() => handleAccept(notif)}
                          disabled={isProcessing}
                        >
                          <Check size={14} />
                          {isProcessing ? 'Updating...' : `Accept (${req?.requestedStatus || 'Fully Paid'})`}
                        </button>
                        <button
                          type="button"
                          className="notif-reject-btn"
                          onClick={() => handleReject(notif)}
                          disabled={isProcessing}
                        >
                          <X size={14} />
                          {isProcessing ? 'Processing...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  )
                }

                // CUSTOMER VIEW: Pending Bill Payments or Status Updates
                const isHalfPending = notif.type === 'bill_half_pending'
                const isRejected = notif.type === 'request_rejected'
                const isAccepted = notif.type === 'request_accepted'
                const isPendingVerification = req?.status === 'pending'

                return (
                  <div
                    key={notif.id}
                    className={`notif-card customer-notif-card ${
                      isRejected ? 'rejected-card' : isAccepted ? 'accepted-card' : isHalfPending ? 'half-card' : 'pending-card'
                    }`}
                  >
                    <div className="notif-card-header">
                      <span
                        className={`notif-type-tag ${
                          isRejected
                            ? 'rejected-tag'
                            : isAccepted
                            ? 'accepted-tag'
                            : isHalfPending
                            ? 'half-tag'
                            : 'unpaid-tag'
                        }`}
                      >
                        {isRejected ? (
                          <>
                            <XCircle size={12} /> Payment Request Rejected
                          </>
                        ) : isAccepted ? (
                          <>
                            <CheckCircle2 size={12} /> Payment Verified &amp; Approved
                          </>
                        ) : isHalfPending ? (
                          <>
                            <AlertTriangle size={12} /> Partial Balance Pending
                          </>
                        ) : (
                          <>
                            <Clock size={12} /> Pending Bill Payment
                          </>
                        )}
                      </span>
                      <span className="notif-time-badge">{notif.createdAt?.slice(0, 16)}</span>
                    </div>

                    <div className="notif-bill-meta">
                      <button
                        type="button"
                        className="bill-link-btn"
                        onClick={() => {
                          onOpenBill(notif.billId)
                          onClose()
                        }}
                        title="Click to view bill statement and submit payment update"
                      >
                        <Receipt size={13} /> {notif.billId} <ExternalLink size={11} />
                      </button>
                      {notif.paymentRequest?.selectedPeriod && (
                        <span className="notif-period-badge">
                          {notif.paymentRequest.selectedPeriod}
                        </span>
                      )}
                    </div>

                    <div className="customer-alert-content">
                      <div className="amount-highlight-box">
                        <span className="amount-label">
                          {isHalfPending ? 'Remaining Due:' : 'Total Amount Due:'}
                        </span>
                        <strong className="amount-val">
                          {formatRupees(
                            isHalfPending
                              ? (req?.remainingAmount ?? (notif.paymentRequest?.totalAmount || 0))
                              : (notif.paymentRequest?.totalAmount || 0)
                          )}
                        </strong>
                      </div>

                      {isPendingVerification ? (
                        <div className="in-review-pill">
                          <Clock size={12} />
                          <span>
                            Request in review: Requested <b>{req?.requestedStatus}</b> (
                            {formatRupees(req?.paidAmount || 0)}) on {req?.paymentDate}. Awaiting admin approval.
                          </span>
                        </div>
                      ) : isRejected ? (
                        <p className="notif-msg-text warning-text">
                          Your previous payment status update was rejected by admin. Please inspect your bill details, verify your payment, and submit an updated request.
                        </p>
                      ) : (
                        <p className="notif-msg-text">
                          This bill is currently <b>{isHalfPending ? 'Half Paid' : 'Unpaid'}</b>. You can mark it as fully paid or half paid and request admin verification.
                        </p>
                      )}
                    </div>

                    <div className="customer-card-actions">
                      <button
                        type="button"
                        className="open-bill-action-btn"
                        onClick={() => {
                          onOpenBill(notif.billId)
                          onClose()
                        }}
                      >
                        <span>Open Bill &amp; Update Status</span>
                        <ArrowRight size={13} />
                      </button>
                      {onDismissNotification && (isAccepted || isRejected) && (
                        <button
                          type="button"
                          className="dismiss-notif-btn"
                          onClick={() => onDismissNotification(notif.id)}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
