import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'

interface SearchableFilterDropdownProps {
  placeholder: string
  options: string[]
  value: string
  onChange: (selected: string) => void
  allOptionLabel: string
  icon?: React.ReactNode
}


export const SearchableFilterDropdown: React.FC<SearchableFilterDropdownProps> = ({
  placeholder,
  options,
  value,
  onChange,
  allOptionLabel,
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter options based on "starts with"
  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return options
    return options.filter((opt) => opt.toLowerCase().startsWith(term))
  }, [options, searchTerm])

  const isFiltered = value && value !== allOptionLabel

  const handleSelect = (selected: string) => {
    onChange(selected)
    setSearchTerm('')
    setIsOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setSearchTerm(text)
    onChange(text) // Dynamic "starts with" filtering as user types
    if (!isOpen) setIsOpen(true)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSearchTerm('')
    onChange(allOptionLabel)
    setIsOpen(false)
  }

  return (
    <div className="searchable-dropdown-container" ref={containerRef}>
      <div
        className={`searchable-dropdown-input-wrap ${isOpen ? 'focused' : ''} ${isFiltered ? 'active' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <span className="dropdown-icon">{icon}</span>
        <input
          type="text"
          className="searchable-input"
          placeholder={placeholder}
          value={isOpen ? searchTerm : isFiltered ? value : ''}
          onChange={handleInputChange}
          onFocus={() => {
            setSearchTerm(isFiltered ? value : '')
            setIsOpen(true)
          }}
        />

        {!isOpen && !isFiltered && (
          <span className="placeholder-preview">{allOptionLabel}</span>
        )}

        {isFiltered && (
          <button
            type="button"
            className="clear-filter-btn"
            onClick={handleClear}
            title="Clear filter"
          >
            <X size={13} />
          </button>
        )}

        <button
          type="button"
          className="dropdown-toggle-btn"
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(!isOpen)
          }}
        >
          <ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} />
        </button>
      </div>

      {isOpen && (
        <div className="searchable-dropdown-menu">
          <div className="dropdown-header-hint">
            <span>Filter by (starts with):</span>
          </div>

          <div className="dropdown-options-list">
            {/* "All" reset option */}
            <div
              className={`dropdown-option-item ${!isFiltered ? 'selected' : ''}`}
              onClick={() => handleSelect(allOptionLabel)}
            >
              <span>{allOptionLabel}</span>
              {!isFiltered && <Check size={14} color="#0f6b61" />}
            </div>

            {/* Filtered options matching "starts with" */}
            {filteredOptions.map((opt) => {
              const isSelected = value.toLowerCase() === opt.toLowerCase()
              return (
                <div
                  key={opt}
                  className={`dropdown-option-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  <span>{opt}</span>
                  {isSelected && <Check size={14} color="#0f6b61" />}
                </div>
              )
            })}

            {filteredOptions.length === 0 && (
              <div className="dropdown-no-results">
                No match starting with "<b>{searchTerm}</b>"
                <small style={{ display: 'block', marginTop: '2px', color: '#8d9990' }}>
                  Press Enter or keep typing to filter records starting with this string.
                </small>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
