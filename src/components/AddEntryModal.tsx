import React, { useState, useMemo } from 'react'
import { X, Check, Clock, IndianRupee, Sparkles, Tag, FolderGit2 } from 'lucide-react'

import type { SessionEntry } from '../types'
import { calculateSessionMetrics, formatMinutes, formatRupees } from '../utils/calculations'

interface AddEntryModalProps {
  onClose: () => void
  onSave: (entry: Omit<SessionEntry, 'id'>) => Promise<void> | void
  existingClients: string[]
  existingProjects: string[]
  saving: boolean
}

export const AddEntryModal: React.FC<AddEntryModalProps> = ({
  onClose,
  onSave,
  existingClients,
  existingProjects,
  saving,
}) => {
  const today = new Date().toISOString().slice(0, 10)

  // Seed default clients with Jahnavi M
  const clientOptions = useMemo(() => {
    const set = new Set<string>()
    set.add('Jahnavi M')
    ;(existingClients || []).forEach((c) => c && set.add(c))
    return Array.from(set)
  }, [existingClients])

  // Seed default projects with Dolby and Equinix
  const projectOptions = useMemo(() => {
    const set = new Set<string>()
    set.add('Dolby')
    set.add('Equinix')
    ;(existingProjects || []).forEach((p) => p && set.add(p))
    return Array.from(set)
  }, [existingProjects])


  // Form State
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('12:00')
  const [discountMinutes, setDiscountMinutes] = useState(0)
  const [rate, setRate] = useState<number>(900)

  // Client Selection State
  const [selectedClientOption, setSelectedClientOption] = useState<string>('Jahnavi M')
  const [customClientName, setCustomClientName] = useState<string>('')

  // Project Selection State
  const [selectedProjectOption, setSelectedProjectOption] = useState<string>('Dolby')
  const [customProjectName, setCustomProjectName] = useState<string>('')

  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Live metrics calculation
  const metrics = calculateSessionMetrics(startTime, endTime, discountMinutes, rate)

  // Compute resolved client and project
  const resolvedClient =
    selectedClientOption === '__custom__'
      ? customClientName.trim()
      : selectedClientOption.trim()

  const resolvedProject =
    selectedProjectOption === '__custom__'
      ? customProjectName.trim()
      : selectedProjectOption.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!resolvedClient) {
      setFormError('Please select or enter a Client Name.')
      return
    }
    if (!resolvedProject) {
      setFormError('Please select or enter a Project Name.')
      return
    }
    if (!description.trim()) {
      setFormError('Please enter a Description of work.')
      return
    }
    if (metrics.totalMinutes <= 0) {
      setFormError('End time must be after Start time.')
      return
    }

    setFormError(null)

    await onSave({
      date,
      startTime,
      endTime,
      totalMinutes: metrics.totalMinutes,
      discountMinutes: metrics.discountMinutes,
      effectiveMinutes: metrics.effectiveMinutes,
      rate: metrics.rate,
      client: resolvedClient,
      project: resolvedProject,
      description: description.trim(),
      moneyWithoutDiscount: metrics.moneyWithoutDiscount,
      moneyWithDiscount: metrics.moneyWithDiscount,
      discountMoney: metrics.discountMoney,
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal modal-add-entry"
        style={{ maxWidth: '640px', width: '95%' }}
        onMouseDown={(e) => e.stopPropagation()}
      >

        <div className="modal-header">
          <div>
            <p className="eyebrow" style={{ color: '#0f6b61' }}>Time Entry &amp; Billing</p>
            <h2>Log Work Session</h2>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="alert-box error" style={{ margin: '16px 24px 0' }}>
              <span>{formError}</span>
            </div>
          )}

          <div className="form-grid">
            {/* Date */}
            <label>
              Date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            {/* Rate */}
            <label>
              Hourly Rate (₹)
              <div className="input-with-icon-plain">
                <IndianRupee size={15} />
                <input
                  type="number"
                  min="0"
                  step="50"
                  required
                  placeholder="e.g. 1500"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 0)}
                />
              </div>
            </label>

            {/* Client Name Dropdown + Custom String Input */}
            <label>
              Client Name
              <div className="input-with-icon-plain">
                <Tag size={15} />
                <select
                  value={selectedClientOption}
                  onChange={(e) => setSelectedClientOption(e.target.value)}
                  style={{
                    paddingLeft: '32px',
                    width: '100%',
                    border: '1px solid #dbe3db',
                    borderRadius: '7px',
                    fontSize: '12px',
                    height: '37px',
                    backgroundColor: '#fcfdfc',
                  }}
                >
                  {clientOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter New Client Name...</option>
                </select>
              </div>
              {selectedClientOption === '__custom__' && (
                <div style={{ marginTop: '6px' }}>
                  <input
                    type="text"
                    placeholder="Type client name here..."
                    required
                    value={customClientName}
                    onChange={(e) => setCustomClientName(e.target.value)}
                    autoFocus
                    style={{
                      border: '1px solid #0f6b61',
                      backgroundColor: '#f6fbf8',
                    }}
                  />
                  <small style={{ color: '#0f6b61', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                    New client will be saved with this entry.
                  </small>
                </div>
              )}
            </label>

            {/* Project Name Dropdown + Custom String Input */}
            <label>
              Project Name
              <div className="input-with-icon-plain">
                <FolderGit2 size={15} />
                <select
                  value={selectedProjectOption}
                  onChange={(e) => setSelectedProjectOption(e.target.value)}
                  style={{
                    paddingLeft: '32px',
                    width: '100%',
                    border: '1px solid #dbe3db',
                    borderRadius: '7px',
                    fontSize: '12px',
                    height: '37px',
                    backgroundColor: '#fcfdfc',
                  }}
                >
                  {projectOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter New Project Name...</option>
                </select>
              </div>
              {selectedProjectOption === '__custom__' && (
                <div style={{ marginTop: '6px' }}>
                  <input
                    type="text"
                    placeholder="Type project name here..."
                    required
                    value={customProjectName}
                    onChange={(e) => setCustomProjectName(e.target.value)}
                    autoFocus
                    style={{
                      border: '1px solid #0f6b61',
                      backgroundColor: '#f6fbf8',
                    }}
                  />
                  <small style={{ color: '#0f6b61', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                    New project will be saved with this entry.
                  </small>
                </div>
              )}
            </label>

            {/* Start Time */}
            <label>
              Start Time
              <div className="input-with-icon-plain">
                <Clock size={15} />
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </label>

            {/* End Time */}
            <label>
              End Time
              <div className="input-with-icon-plain">
                <Clock size={15} />
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </label>

            {/* Discount in Time */}
            <label className="full-width">
              Discount in Time (Minutes deducted)
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  max={metrics.totalMinutes || 999}
                  step="5"
                  placeholder="0"
                  value={discountMinutes}
                  onChange={(e) => setDiscountMinutes(Number(e.target.value) || 0)}
                  style={{ width: '120px' }}
                />
                <span style={{ fontSize: '12px', color: '#69746c' }}>
                  ({formatMinutes(discountMinutes)} deducted as break / courtesy discount)
                </span>
              </div>
            </label>

            {/* Live Calculation Panel */}
            <div className="full-width calculation-preview-card">
              <div className="calc-header">
                <Sparkles size={15} />
                <span>Live Calculated Session Breakdown</span>
              </div>
              <div className="calc-grid">
                <div className="calc-item">
                  <small>Total Time</small>
                  <strong>{formatMinutes(metrics.totalMinutes)}</strong>
                  <span>{(metrics.totalMinutes / 60).toFixed(2)} hrs</span>
                </div>
                <div className="calc-item">
                  <small>Effective Time</small>
                  <strong style={{ color: '#0f6b61' }}>{formatMinutes(metrics.effectiveMinutes)}</strong>
                  <span>{(metrics.effectiveMinutes / 60).toFixed(2)} hrs</span>
                </div>
                <div className="calc-item">
                  <small>Gross Money (No Disc.)</small>
                  <strong>{formatRupees(metrics.moneyWithoutDiscount)}</strong>
                  <span>Rate: ₹{rate}/hr</span>
                </div>
                <div className="calc-item">
                  <small>Time Discount (₹)</small>
                  <strong style={{ color: '#b2572b' }}>-{formatRupees(metrics.discountMoney)}</strong>
                  <span>-{formatMinutes(metrics.discountMinutes)}</span>
                </div>
                <div className="calc-item highlight">
                  <small>Net Final Money</small>
                  <strong>{formatRupees(metrics.moneyWithDiscount)}</strong>
                  <span>Billable Amount</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <label className="full-width">
              Description of Work
              <textarea
                rows={3}
                required
                placeholder="What did you accomplish in this session?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>

          <div className="modal-footer">
            <span className="muted">
              Auto-creates monthly tab in Google Sheet if needed.
            </span>
            <button
              type="button"
              className="secondary-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-btn"
              disabled={saving}
              style={{ gap: '6px' }}
            >
              <Check size={16} />
              {saving ? 'Saving to Sheet...' : 'Save & Append to Sheet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
