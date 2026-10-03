import React, { useState } from 'react'
import {
  X,
  Check,
  Copy,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  Users,
  ExternalLink,
} from 'lucide-react'
import type { SheetConfig, SheetItem } from '../types'
import { GOOGLE_APPS_SCRIPT_CODE } from '../utils/googleSheetsScript'
import { googleSheetsApi } from '../services/googleSheetsApi'

interface GoogleSheetsModalProps {
  config: SheetConfig
  availableSheets: SheetItem[]
  activeSheetUrl: string
  onSwitchSheet: (url: string) => void
  onAddCustomSheet: (url: string, name?: string) => void
  onRemoveCustomSheet: (url: string) => void
  onSaveConfig: (newConfig: SheetConfig) => void
  onClose: () => void
  onSyncNow?: () => void
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  config,
  availableSheets,
  activeSheetUrl,
  onSwitchSheet,
  onAddCustomSheet,
  onRemoveCustomSheet,
  onSaveConfig,
  onClose,
  onSyncNow,
}) => {
  const [activeTab, setActiveTab] = useState<'sheets' | 'netlify' | 'code' | 'schema'>('sheets')
  const [newSheetUrl, setNewSheetUrl] = useState('')
  const [newSheetName, setNewSheetName] = useState('')
  const [testingUrl, setTestingUrl] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ url: string; success: boolean; message: string } | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedEnv, setCopiedEnv] = useState(false)

  // Example Netlify env string
  const exampleNetlifyEnv = availableSheets.map((s) => s.url).join(', ')

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2500)
    } catch {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2500)
    }
  }

  const handleCopyEnv = async () => {
    try {
      await navigator.clipboard.writeText(exampleNetlifyEnv)
      setCopiedEnv(true)
      setTimeout(() => setCopiedEnv(false), 2500)
    } catch {
      setCopiedEnv(true)
      setTimeout(() => setCopiedEnv(false), 2500)
    }
  }

  const handleTestSpecificUrl = async (urlToTest: string) => {
    if (!urlToTest.trim()) return
    setTestingUrl(urlToTest)
    setTestResult(null)

    try {
      const res = await googleSheetsApi.testConnection(urlToTest.trim())
      if (res.success) {
        const title = res.sheetName || 'Google Sheet'
        setTestResult({
          url: urlToTest,
          success: true,
          message: `Connected successfully! Spreadsheet Title: "${title}"`,
        })
      } else {
        setTestResult({
          url: urlToTest,
          success: false,
          message: res.error || res.message || 'Unable to connect to Apps Script Web App.',
        })
      }
    } catch (err) {
      setTestResult({
        url: urlToTest,
        success: false,
        message: `Connection error: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setTestingUrl(null)
    }
  }

  const handleAddNewSheet = () => {
    if (!newSheetUrl.trim() || !newSheetUrl.trim().startsWith('http')) {
      alert('Please enter a valid Google Apps Script Web App URL starting with https://')
      return
    }

    onAddCustomSheet(newSheetUrl.trim(), newSheetName.trim() || undefined)
    onSaveConfig({
      webAppUrl: newSheetUrl.trim(),
      sheetName: newSheetName.trim() || undefined,
      isConnected: true,
      lastSyncedAt: new Date().toISOString(),
    })
    setNewSheetUrl('')
    setNewSheetName('')
    onSwitchSheet(newSheetUrl.trim())
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal sheets-modal"
        style={{ maxWidth: '820px', width: '94%' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow" style={{ color: '#0f6b61' }}>
              Multi-Sheet &amp; Netlify Deployment
            </p>
            <h2>Google Sheets Management</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="sheet-modal-tabs">
          <button
            className={`sheet-tab-btn ${activeTab === 'sheets' ? 'active' : ''}`}
            onClick={() => setActiveTab('sheets')}
          >
            Available Sheets ({availableSheets.length})
          </button>
          <button
            className={`sheet-tab-btn ${activeTab === 'netlify' ? 'active' : ''}`}
            onClick={() => setActiveTab('netlify')}
          >
            Netlify Deployment Setup
          </button>
          <button
            className={`sheet-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            Google Apps Script Code
          </button>
          <button
            className={`sheet-tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
            onClick={() => setActiveTab('schema')}
          >
            Architecture &amp; Roles
          </button>
        </div>

        <div
          className="sheet-modal-body"
          style={{ maxHeight: '65vh', overflowY: 'auto', padding: '20px 24px' }}
        >
          {/* TAB 1: SHEETS LIST & MANAGEMENT */}
          {activeTab === 'sheets' && (
            <div>
              <div className="integration-status-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`status-dot-large ${config.isConnected ? 'online' : 'offline'}`} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong>Active Sheet: {availableSheets.find((s) => s.url === activeSheetUrl)?.name || 'Default Sheet'}</strong>
                      <span className="badge-pill active">Currently In Use</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#68726b', wordBreak: 'break-all' }}>
                      {activeSheetUrl}
                    </p>
                  </div>
                  {onSyncNow && (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={onSyncNow}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      <RefreshCw size={13} /> Sync Now
                    </button>
                  )}
                </div>
              </div>

              {testResult && (
                <div
                  className={`alert-box ${testResult.success ? 'success' : 'error'}`}
                  style={{ marginTop: '14px' }}
                >
                  {testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* LIST OF CONFIGURED SHEETS */}
              <div style={{ marginTop: '22px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#334037', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileSpreadsheet size={15} color="#0f6b61" /> All Configured Sheets in Workspace:
                </h4>

                <div className="sheets-list-container">
                  {availableSheets.map((sheet, idx) => {
                    const isActive = sheet.url === activeSheetUrl
                    return (
                      <div
                        key={sheet.url}
                        className={`sheet-row-card ${isActive ? 'is-active' : ''}`}
                      >
                        <div className="sheet-row-main">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong>{sheet.name || `Sheet ${idx + 1}`}</strong>
                            {sheet.isDefault && <span className="badge-pill default">Default</span>}
                            {isActive && <span className="badge-pill active">Active</span>}
                          </div>
                          <span className="sheet-row-url" title={sheet.url}>
                            {sheet.url}
                          </span>
                        </div>

                        <div className="sheet-row-actions">
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => handleTestSpecificUrl(sheet.url)}
                            disabled={testingUrl === sheet.url}
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            title="Test connection to this Apps Script"
                          >
                            {testingUrl === sheet.url ? (
                              <RefreshCw size={12} className="spin-icon" />
                            ) : (
                              'Test'
                            )}
                          </button>

                          {!isActive ? (
                            <button
                              type="button"
                              className="primary-btn"
                              onClick={() => {
                                onSwitchSheet(sheet.url)
                              }}
                              style={{ padding: '4px 12px', fontSize: '11px' }}
                            >
                              <CheckCircle2 size={13} /> Select
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#0f6b61', fontWeight: 700, padding: '4px 8px' }}>
                              ✓ In Use
                            </span>
                          )}

                          {!sheet.isDefault && (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => onRemoveCustomSheet(sheet.url)}
                              title="Remove custom sheet"
                              style={{ width: '28px', height: '28px', color: '#c94a4a' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ADD NEW SHEET INLINE FORM */}
              <div className="add-sheet-box" style={{ marginTop: '22px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#334037', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={15} color="#0f6b61" /> Add Another Google Sheet Web App URL:
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Sheet Name (e.g. 2027 Billing)"
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #d4ded3', borderRadius: '7px', fontSize: '12px' }}
                  />
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={newSheetUrl}
                    onChange={(e) => setNewSheetUrl(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #d4ded3', borderRadius: '7px', fontSize: '12px' }}
                  />
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={handleAddNewSheet}
                    style={{ padding: '8px 16px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={14} /> Add Sheet
                  </button>
                </div>
                <small style={{ display: 'block', marginTop: '6px', color: '#7a857e', fontSize: '11px' }}>
                  Once added, this sheet will be available in the header dropdown and can be selected any time.
                </small>
              </div>
            </div>
          )}

          {/* TAB 2: NETLIFY DEPLOYMENT & VARIABLES */}
          {activeTab === 'netlify' && (
            <div>
              <div className="integration-status-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Globe size={24} color="#0f6b61" />
                  <div>
                    <strong>Netlify Environment Variables Configuration</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#68726b' }}>
                      When you deploy this project to Netlify, provide your Google Sheets URLs in Netlify's environment variables.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <div className="netlify-instruction-card">
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#1f2e24' }}>
                    1. Netlify Environment Variable Key &amp; Value:
                  </h4>
                  <p style={{ fontSize: '12px', color: '#526156', margin: '0 0 10px' }}>
                    In Netlify Dashboard, navigate to <b>Site configuration</b> &gt; <b>Environment variables</b> &gt; <b>Add a variable</b>:
                  </p>

                  <div className="env-var-spec-box">
                    <div className="env-var-row">
                      <span className="env-label">Variable Key:</span>
                      <code className="env-code">VITE_GOOGLE_SHEETS_URLS</code>
                      <small>(or <code>GOOGLE_SHEETS_URLS</code>)</small>
                    </div>

                    <div className="env-var-row" style={{ marginTop: '10px' }}>
                      <span className="env-label">Variable Value:</span>
                      <span style={{ fontSize: '12px', color: '#68726b' }}>
                        Provide multiple Web App URLs separated by a comma.
                      </span>
                    </div>

                    <div style={{ position: 'relative', marginTop: '8px' }}>
                      <textarea
                        readOnly
                        value={exampleNetlifyEnv}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #c9d8cc',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          background: '#f8fbf9',
                          color: '#28362d',
                          resize: 'vertical',
                        }}
                      />
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={handleCopyEnv}
                        style={{ position: 'absolute', right: '8px', bottom: '12px', padding: '4px 10px', fontSize: '11px' }}
                      >
                        {copiedEnv ? <Check size={13} /> : <Copy size={13} />}
                        {copiedEnv ? 'Copied' : 'Copy Value'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="netlify-instruction-card" style={{ marginTop: '16px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#1f2e24' }}>
                    2. Supported Formats in Netlify Variables:
                  </h4>
                  <ul className="info-bullets">
                    <li>
                      <b>Plain Comma-Separated URLs:</b>
                      <pre>https://script.google.com/.../exec, https://script.google.com/.../exec2</pre>
                      The app will display each sheet and automatically retrieve their spreadsheet titles.
                    </li>
                    <li>
                      <b>Custom Labeled Sheets (with pipe <code>|</code>):</b>
                      <pre>2026 Primary|https://script.google.com/.../exec, 2027 Future|https://script.google.com/.../exec2</pre>
                    </li>
                    <li>
                      <b>Automatic First URL Loading:</b>
                      The application will always load the first URL by default on startup, while all available sheets appear in the header dropdown.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CODE.GS */}
          {activeTab === 'code' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <strong style={{ fontSize: '13px', color: '#26332c' }}>Code.gs (Apps Script Source)</strong>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#68726b' }}>
                    Paste this into your Google Sheet's Apps Script editor (Extensions &gt; Apps Script).
                  </p>
                </div>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleCopyCode}
                  style={{ gap: '6px', padding: '8px 14px', fontSize: '12px' }}
                >
                  {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                  {copiedCode ? 'Code Copied!' : 'Copy Script Code'}
                </button>
              </div>

              {/* Step-by-step Redeployment Guide */}
              <div
                style={{
                  background: '#fef7e0',
                  border: '1px solid #f9d984',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '14px',
                  fontSize: '12px',
                  color: '#634400',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={15} color="#b45309" />
                  IMPORTANT: Updating Live Deployment (Must Deploy 'New version')
                </div>
                <p style={{ margin: '0 0 6px', lineHeight: '1.4' }}>
                  In Google Apps Script, clicking <b>Save</b> alone does <b>NOT</b> update the live Web App URL. You must deploy a <b>New Version</b>:
                </p>
                <ol style={{ margin: '0 0 10px', paddingLeft: '20px', lineHeight: '1.6' }}>
                  <li>In Google Sheets, open <b>Extensions &gt; Apps Script</b>.</li>
                  <li>Replace all code in <code>Code.gs</code> with the code below and click <b>Save (💾)</b>.</li>
                  <li>Click <b>Deploy</b> &gt; <b>Manage deployments</b>.</li>
                  <li>Click the <b>Edit (pencil icon)</b> next to your active Web App deployment.</li>
                  <li>Under <b>Version</b> dropdown, select <b>New version</b>.</li>
                  <li>Click <b>Deploy</b>, then click <b>Done</b>. (Your Web App URL remains the exact same!).</li>
                </ol>
                {activeSheetUrl && (
                  <div style={{ borderTop: '1px dashed #e6c86e', paddingTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#7a5a06' }}>
                      After deploying, test your live endpoint directly:
                    </span>
                    <a
                      href={`${activeSheetUrl}${activeSheetUrl.includes('?') ? '&' : '?'}action=getEntries`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: '#0f6b61',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        fontSize: '12px',
                      }}
                    >
                      <ExternalLink size={13} />
                      Verify Live Entries JSON in Browser
                    </a>
                  </div>
                )}
              </div>

              <div className="code-viewer-container">
                <pre className="code-block">
                  <code>{GOOGLE_APPS_SCRIPT_CODE}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: SCHEMA */}
          {activeTab === 'schema' && (
            <div>
              <div className="schema-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Users size={18} color="#0f6b61" />
                  <strong>1. Tab: Users (Credentials &amp; Roles)</strong>
                </div>
                <p style={{ fontSize: '12px', color: '#57655d', margin: '0 0 10px' }}>
                  Created automatically when you run <code>initSheet()</code> or log in with credentials:
                </p>
                <div className="schema-table-wrap">
                  <table className="schema-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Password</th>
                        <th>Role</th>
                        <th>Full Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>admin</code></td>
                        <td><code>admin123</code></td>
                        <td><span className="badge-pill active">admin</span></td>
                        <td>Full Access (Read, Filter, Add Entries)</td>
                      </tr>
                      <tr>
                        <td><code>viewer</code></td>
                        <td><code>view123</code></td>
                        <td><span className="badge-pill read">read</span></td>
                        <td>Read-Only (Inspect, Filter, Export Challan)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="schema-card" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileSpreadsheet size={18} color="#0f6b61" />
                  <strong>2. Monthly Tabs (e.g. 2026-10, 2026-11)</strong>
                </div>
                <p style={{ fontSize: '12px', color: '#57655d', margin: '0 0 10px' }}>
                  Whenever a session is logged, a monthly tab (<code>YYYY-MM</code>) is automatically created with styled headers:
                </p>
                <div className="schema-pills-row">
                  <span className="col-pill">Session ID</span>
                  <span className="col-pill">Date</span>
                  <span className="col-pill">Client</span>
                  <span className="col-pill">Project</span>
                  <span className="col-pill">Description</span>
                  <span className="col-pill">Start Time</span>
                  <span className="col-pill">End Time</span>
                  <span className="col-pill">Total (mins)</span>
                  <span className="col-pill">Discount (mins)</span>
                  <span className="col-pill">Effective (mins)</span>
                  <span className="col-pill">Rate (₹/hr)</span>
                  <span className="col-pill">Gross (₹)</span>
                  <span className="col-pill">Discount (₹)</span>
                  <span className="col-pill">Net Payable (₹)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span className="muted">
            All operations in the workspace automatically apply to the selected Active Sheet.
          </span>
          <button className="primary-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
