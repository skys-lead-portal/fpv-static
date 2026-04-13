'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface FormData {
  postalCode: string
  unitType: string
  floorLevel: string
  name: string
  mobile: string
}

interface OneMapResult {
  BUILDING: string
  ADDRESS: string
  POSTAL: string
  BLK_NO: string
  ROAD_NAME: string
}

interface ValuationResult {
  block?: string
  street?: string
  development?: string
  town?: string
  estimatedLow?: string
  estimatedHigh?: string
  transactionCount?: number
  latestMonth?: string
  isPrivate?: boolean
  message?: string
  error?: string
}

const UNIT_TYPES = ['1-Room', '2-Room', '3-Room', '4-Room', '5-Room', 'Executive', 'Jumbo', 'Private/Condo']
const FLOOR_LEVELS = ['Low (1–5)', 'Mid (6–15)', 'High (16–25)', 'Top (26+)']

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 15,
  color: '#1a1a1a',
  outline: 'none',
  background: '#fff',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
  cursor: 'pointer',
}

export default function FPVPage() {
  const [formData, setFormData] = useState<FormData>({
    postalCode: '',
    unitType: '',
    floorLevel: '',
    name: '',
    mobile: '',
  })
  const [postalDisplay, setPostalDisplay] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<FormData>>({})

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<OneMapResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Valuation state
  const [valuation, setValuation] = useState<ValuationResult | null>(null)
  const [valuationLoading, setValuationLoading] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchValuation = useCallback(async (postal: string) => {
    if (!/^\d{6}$/.test(postal)) return
    setValuationLoading(true)
    setValuation(null)
    try {
      const res = await fetch(`/api/valuation?postal=${postal}`)
      if (res.ok) {
        const data = await res.json()
        setValuation(data)
      }
    } catch {
      // silent fail
    } finally {
      setValuationLoading(false)
    }
  }, [])

  const handlePostalInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setPostalDisplay(val)
    setValuation(null)

    // If exactly 6 digits → treat as postal directly
    if (/^\d{6}$/.test(val)) {
      setSuggestions([])
      setShowDropdown(false)
      setFormData(prev => ({ ...prev, postalCode: val }))
      fetchValuation(val)
      return
    }

    // Clear postal from formData if input changed
    setFormData(prev => ({ ...prev, postalCode: '' }))

    if (val.length < 3) {
      setSuggestions([])
      setShowDropdown(false)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      return
    }

    // Debounce OneMap search
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(
          `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(val)}&returnGeom=N&getAddrDetails=Y&pageNum=1`
        )
        if (res.ok) {
          const data = await res.json()
          const results: OneMapResult[] = (data.results || []).slice(0, 6)
          setSuggestions(results)
          setShowDropdown(results.length > 0)
        }
      } catch {
        setSuggestions([])
      } finally {
        setSearchLoading(false)
      }
    }, 400)
  }

  const handleSelectSuggestion = (result: OneMapResult) => {
    const postal = result.POSTAL
    const devName = result.BUILDING && result.BUILDING !== 'NIL' ? result.BUILDING : result.ROAD_NAME
    setPostalDisplay(`${devName} · ${postal}`)
    setFormData(prev => ({ ...prev, postalCode: postal }))
    setSuggestions([])
    setShowDropdown(false)
    fetchValuation(postal)
  }

  const validate = () => {
    const e: Partial<FormData> = {}
    if (!formData.postalCode) e.postalCode = 'Please select a property'
    if (!formData.unitType) e.unitType = 'Please select unit type'
    if (!formData.floorLevel) e.floorLevel = 'Please select floor level'
    if (!formData.name.trim()) e.name = 'Please enter your name'
    if (!/^[689]\d{7}$/.test(formData.mobile)) e.mobile = 'Enter a valid 8-digit SG mobile number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      // If no valuation yet, fetch it now before submitting
      let finalValuation = valuation
      if (!finalValuation && formData.postalCode) {
        try {
          const vRes = await fetch(`/api/valuation?postal=${formData.postalCode}`)
          if (vRes.ok) {
            finalValuation = await vRes.json()
            setValuation(finalValuation)
          }
        } catch {
          // non-blocking — submit anyway
        }
      }
      await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, valuation: finalValuation }),
      })
    } catch {
      // still show success
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  // ── Submitted State ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '40px 32px', maxWidth: 520, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#1a1a1a', margin: '0 0 12px' }}>Report On Its Way!</h2>

          {valuation && !valuation.isPrivate && valuation.estimatedLow ? (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', margin: '16px 0', textAlign: 'left' }}>
              <p style={{ margin: '0 0 8px', color: '#374151', fontSize: 14 }}>
                Your free property valuation for <strong style={{ color: '#B22222' }}>{valuation.development}</strong> is ready.
              </p>
              <p style={{ margin: '0 0 4px', color: '#6b7280', fontSize: 13 }}>
                📊 Based on {valuation.transactionCount} recent transactions
                {valuation.latestMonth ? ` (${valuation.latestMonth})` : ''}:
              </p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
                💰 Estimated Market Value: {valuation.estimatedLow} – {valuation.estimatedHigh}
              </p>
            </div>
          ) : valuation?.isPrivate ? (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', margin: '16px 0' }}>
              <p style={{ margin: 0, color: '#374151', fontSize: 14 }}>
                🏙️ Private/Condo property detected. Our consultant will provide a detailed market valuation.
              </p>
            </div>
          ) : null}

          <p style={{ color: '#4b5563', fontSize: 15, margin: '12px 0 6px' }}>
            Check your WhatsApp — your personalised report will arrive shortly.
          </p>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            Our consultant will also be in touch within 1 business day.
          </p>
        </div>
      </div>
    )
  }

  // ── Main Page ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
            🏠 FreePropertyValuation.sg
          </div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Singapore&apos;s Trusted Property Valuation Tool</div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', color: '#fff', padding: '60px 24px 80px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
            🏆 Singapore&apos;s #1 Free Property Valuation Tool
          </p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 5vw, 46px)', lineHeight: 1.2, marginBottom: 16, color: '#fff' }}>
            Know What Your Property Is Worth — <em style={{ color: '#fbbf24' }}>Before You Sell</em>
          </h1>
          <p style={{ fontSize: 16, color: '#cbd5e1', marginBottom: 8 }}>
            Based on actual HDB & private transactions. Get your personalised report in 60 seconds.
          </p>
          <p style={{ fontSize: 13, color: '#64748b' }}>No spam. No obligation. 100% free.</p>
        </div>
      </section>

      {/* Main Content */}
      <div style={{ maxWidth: 1100, margin: '-40px auto 0', padding: '0 16px 60px', display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Form Card */}
        <div style={{ flex: '1 1 380px', minWidth: 320, background: '#fff', borderRadius: 12, padding: '32px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1a1a1a', margin: '0 0 6px' }}>Get Your Free Valuation</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Takes less than 60 seconds</p>

          <form onSubmit={handleSubmit} noValidate>

            {/* Postal Code with Autocomplete */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <label style={labelStyle}>Property (Search by name or postal code) *</label>
              <input
                ref={inputRef}
                type="text"
                value={postalDisplay}
                onChange={handlePostalInputChange}
                placeholder="e.g. Westmere or 609652"
                style={{ ...inputStyle, borderColor: errors.postalCode ? '#ef4444' : '#d1d5db' }}
                autoComplete="off"
              />

              {/* Dropdown */}
              {showDropdown && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: '#fff',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    marginTop: 2,
                    overflow: 'hidden',
                  }}
                >
                  {searchLoading ? (
                    <div style={{ padding: '10px 14px', color: '#6b7280', fontSize: 14 }}>Searching...</div>
                  ) : suggestions.length === 0 ? (
                    <div style={{ padding: '10px 14px', color: '#6b7280', fontSize: 14 }}>No results found</div>
                  ) : suggestions.map((r, i) => {
                    const devName = r.BUILDING && r.BUILDING !== 'NIL' ? r.BUILDING : r.ROAD_NAME
                    return (
                      <div
                        key={i}
                        onMouseDown={() => handleSelectSuggestion(r)}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: i < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f7f9fc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ fontWeight: 600, color: '#2c3e50', fontSize: 14 }}>{devName}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {r.ADDRESS} · {r.POSTAL}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {errors.postalCode && <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>{errors.postalCode}</p>}
            </div>

            {/* Valuation Card */}
            {valuationLoading && (
              <div style={{ padding: '12px 16px', marginBottom: 14, background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 6, color: '#6b7280', fontSize: 14 }}>
                ⏳ Looking up valuation...
              </div>
            )}

            {valuation && !valuationLoading && (
              <div style={{
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                padding: '14px 16px',
                marginBottom: 14,
              }}>
                {valuation.isPrivate ? (
                  <p style={{ margin: 0, color: '#374151', fontSize: 14 }}>
                    🏙️ Private/Condo property detected. Our consultant will provide a detailed market valuation.
                  </p>
                ) : valuation.estimatedLow ? (
                  <>
                    <p style={{ margin: '0 0 4px', fontSize: 15 }}>
                      <span style={{ color: '#B22222', fontWeight: 700 }}>🏡 {valuation.development}</span>
                      {valuation.street && <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 13 }}> · {valuation.block ? `${valuation.block} ` : ''}{valuation.street}</span>}
                    </p>
                    <p style={{ margin: '0 0 6px', color: '#6b7280', fontSize: 12 }}>
                      📊 Based on {valuation.transactionCount} recent transactions
                    </p>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 18, color: '#2c3e50' }}>
                      💰 Estimated: {valuation.estimatedLow} – {valuation.estimatedHigh}
                    </p>
                  </>
                ) : valuation.error ? null : null}
              </div>
            )}

            {/* Unit Type */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Unit Type *</label>
              <select
                value={formData.unitType}
                onChange={e => setFormData(prev => ({ ...prev, unitType: e.target.value }))}
                style={{ ...selectStyle, borderColor: errors.unitType ? '#ef4444' : '#d1d5db' }}
              >
                <option value="">Select unit type</option>
                {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.unitType && <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>{errors.unitType}</p>}
            </div>

            {/* Floor Level */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Floor Level *</label>
              <select
                value={formData.floorLevel}
                onChange={e => setFormData(prev => ({ ...prev, floorLevel: e.target.value }))}
                style={{ ...selectStyle, borderColor: errors.floorLevel ? '#ef4444' : '#d1d5db' }}
              >
                <option value="">Select floor level</option>
                {FLOOR_LEVELS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              {errors.floorLevel && <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>{errors.floorLevel}</p>}
            </div>

            {/* Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Your Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Full name"
                style={{ ...inputStyle, borderColor: errors.name ? '#ef4444' : '#d1d5db' }}
              />
              {errors.name && <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>{errors.name}</p>}
            </div>

            {/* Mobile */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>WhatsApp / Mobile Number *</label>
              <input
                type="tel"
                value={formData.mobile}
                onChange={e => setFormData(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '') }))}
                placeholder="e.g. 91234567"
                maxLength={8}
                style={{ ...inputStyle, borderColor: errors.mobile ? '#ef4444' : '#d1d5db' }}
              />
              {errors.mobile && <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>{errors.mobile}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#9ca3af' : '#B22222',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              {loading ? 'Submitting...' : '🏠 Get My Free Valuation Report →'}
            </button>

            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
              By submitting, you agree to be contacted by a licensed property consultant.
            </p>
          </form>
        </div>

        {/* Right Column */}
        <div style={{ flex: '1 1 340px', minWidth: 280 }}>

          {/* Why Get Valued */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#1a1a1a', marginTop: 0, marginBottom: 16 }}>Why Get Valued Now?</h3>
            {[
              ['💸', 'Sellers who know their property value negotiate 8–12% higher'],
              ['📊', 'Singapore HDB prices up 4.9% in 2024 — many owners are sitting on gains'],
              ['⏱️', 'Get your report in under 60 seconds, based on real transaction data'],
              ['🔒', 'No obligation — just knowledge'],
            ].map(([icon, text], i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, lineHeight: 1.4 }}>{icon}</span>
                <p style={{ margin: 0, fontSize: 14, color: '#4b5563', lineHeight: 1.5 }}>{text}</p>
              </div>
            ))}
          </div>

          {/* Recent Transactions */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#1a1a1a', marginTop: 0, marginBottom: 16 }}>Recent HDB Transactions</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['Town', 'Flat Type', 'Price', 'Month'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Queenstown', '4-Room', 'S$820K', 'Feb 2025'],
                  ['Bishan', '5-Room', 'S$1.05M', 'Feb 2025'],
                  ['Tampines', '4-Room', 'S$680K', 'Jan 2025'],
                  ['Toa Payoh', 'Executive', 'S$930K', 'Jan 2025'],
                  ['Ang Mo Kio', '3-Room', 'S$490K', 'Dec 2024'],
                ].map(([town, flat, price, month], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px', color: '#374151' }}>{town}</td>
                    <td style={{ padding: '8px', color: '#374151' }}>{flat}</td>
                    <td style={{ padding: '8px', color: '#B22222', fontWeight: 600 }}>{price}</td>
                    <td style={{ padding: '8px', color: '#6b7280' }}>{month}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Agency Trust Bar */}
      <section style={{ background: '#1a1a2e', color: '#fff', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
          Trusted by Singapore Property Owners
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap', marginBottom: 16 }}>
          {['CEA Licensed Consultants', 'PropTech Verified', 'Data-Driven Reports', '5,000+ Valuations Done'].map(t => (
            <div key={t} style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>✓ {t}</div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
          All valuations are based on URA and HDB official transaction data.
        </p>
      </section>

      {/* Footer */}
      <footer style={{ background: '#111827', color: '#6b7280', padding: '24px', textAlign: 'center', fontSize: 12 }}>
        <p style={{ margin: '0 0 8px' }}>
          © 2025 FreePropertyValuation.sg — An initiative by licensed Singapore property consultants
        </p>
        <p style={{ margin: 0 }}>
          Transaction data sourced from HDB Resale Flat Prices (data.gov.sg) and URA REALIS.
          Valuations are estimates only and should not be relied upon as formal appraisals.
        </p>
      </footer>

    </div>
  )
}
