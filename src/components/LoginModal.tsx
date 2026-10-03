import React, { useState } from 'react'
import { Lock, User, KeyRound, AlertCircle, HelpCircle, ArrowLeft, ShieldAlert } from 'lucide-react'
import type { AuthUser, SheetConfig } from '../types'
import { googleSheetsApi } from '../services/googleSheetsApi'

interface LoginModalProps {
  sheetConfig: SheetConfig
  onLoginSuccess: (user: AuthUser) => void
  onOpenSheetConfig?: () => void
}

export const LoginModal: React.FC<LoginModalProps> = ({
  sheetConfig,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.')
      return
    }

    setLoading(true)
    setError(null)

    // Verify against Google Sheets Users tab if connected
    if (sheetConfig.webAppUrl && sheetConfig.isConnected) {
      try {
        const res = await googleSheetsApi.login(sheetConfig.webAppUrl, username, password)
        if (res.success && res.user) {
          onLoginSuccess(res.user)
          setLoading(false)
          return
        } else {
          setError(res.message || 'Invalid username or password. Please try again.')
          setLoading(false)
          return
        }
      } catch (err) {
        setError(`Failed to reach Google Sheet: ${err instanceof Error ? err.message : String(err)}`)
        setLoading(false)
        return
      }
    }

    // Secure offline fallback credentials (without displaying credentials on screen)
    const cleanUser = username.trim().toLowerCase()
    const cleanPass = password.trim()

    if (cleanUser === 'admin' && cleanPass === 'admin123') {
      onLoginSuccess({ username: 'Admin', role: 'admin' })
    } else if (cleanUser === 'viewer' && cleanPass === 'view123') {
      onLoginSuccess({ username: 'Customer', role: 'read' })
    } else {
      setError('Invalid username or password. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal login-modal" style={{ maxWidth: '440px', width: '92%' }}>
        {showForgotPassword ? (
          /* FORGOT PASSWORD VIEW - ASKS TO CONNECT WITH ADMIN ONLY (NO CREDENTIALS EXPOSED) */
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#eef8f5',
                color: '#0f6b61',
                display: 'inline-grid',
                placeItems: 'center',
                margin: '0 auto 14px',
              }}
            >
              <ShieldAlert size={28} />
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '20px', color: '#1a2620' }}>
              Forgot Password?
            </h3>

            <p style={{ margin: '0 0 18px', color: '#57655c', fontSize: '13px', lineHeight: '1.6' }}>
              Please <b>connect with your Administrator</b> to reset or retrieve your account credentials.
            </p>

            <div
              style={{
                background: '#f4f7f4',
                border: '1px solid #dce5dd',
                borderRadius: '8px',
                padding: '14px 16px',
                fontSize: '12px',
                color: '#425046',
                textAlign: 'left',
                lineHeight: '1.5',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontWeight: 600, color: '#1f2e25', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={14} color="#0f6b61" /> Security Notice:
              </div>
              All user roles and login credentials are encrypted and securely maintained in Google Sheets by the administrator. Regular users and customers cannot retrieve passwords directly from this portal.
            </div>

            <button
              type="button"
              className="primary-btn"
              onClick={() => setShowForgotPassword(false)}
              style={{ width: '100%', height: '40px', fontSize: '13px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={15} /> Back to Sign In
            </button>
          </div>
        ) : (
          /* STANDARD LOGIN VIEW */
          <div>
            <div className="modal-header" style={{ textAlign: 'center', display: 'block', padding: '24px 24px 12px' }}>
              <div className="brand-badge-center">
                <Lock size={26} />
              </div>
              <h2 style={{ marginTop: '12px', fontSize: '22px' }}>Satish Servicenow Support Login</h2>
              <p style={{ margin: '4px 0 0', color: '#68726b', fontSize: '13px' }}>
                Sign in to access your work sessions and reports
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px' }}>
              {error && (
                <div className="alert-box error" style={{ marginBottom: '16px' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Status Indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#55635a',
                  marginBottom: '16px',
                  padding: '6px 12px',
                  background: '#f4f7f5',
                  borderRadius: '20px',
                  width: 'fit-content',
                  margin: '0 auto 16px',
                }}
              >
                <span className={`status-indicator ${sheetConfig.isConnected ? 'online' : 'offline'}`} />
                <span>
                  {sheetConfig.isConnected
                    ? `Connected to ${sheetConfig.sheetName || 'Google Sheet'}`
                    : 'Connecting to Sheets...'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4d5750', marginBottom: '6px' }}>
                    Username
                  </label>
                  <div className="input-with-icon">
                    <User size={16} />
                    <input
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoFocus
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#4d5750' }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        setShowForgotPassword(true)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0f6b61',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '0',
                        textDecoration: 'underline',
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="input-with-icon">
                    <KeyRound size={16} />
                    <input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={loading}
                  style={{ width: '100%', marginTop: '6px', height: '42px', fontSize: '14px' }}
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>

              <div style={{ marginTop: '18px', textAlign: 'center', borderTop: '1px solid #edf2ed', paddingTop: '14px' }}>
                <small style={{ color: '#828e85', fontSize: '11px' }}>
                  Session authentication is mandatory for both Admin and Customer accounts.
                </small>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

