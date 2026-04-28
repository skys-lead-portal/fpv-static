'use client'

import { useState, useRef } from 'react'

export default function Home() {
  const [formData, setFormData] = useState({
    postalCode: '',
    postalDisplay: '',
    propertyType: '',
    unitType: '',
    floorLevel: '',
    name: '',
    mobile: '',
    email: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [consent, setConsent] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const [suggestions, setSuggestions] = useState<Array<{building: string, address: string, postal: string}>>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [addressConfirmed, setAddressConfirmed] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postalWrapRef = useRef<HTMLDivElement>(null)

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.postalCode || formData.postalCode.length !== 6 || !addressConfirmed) { setError('Please search and select your property address from the dropdown.'); return }
    if (!formData.propertyType) { setError('Please select a property type.'); return }
    if (!formData.unitType) { setError('Please select a unit type.'); return }
    if (!formData.floorLevel && formData.propertyType !== 'Landed') { setError('Please select a floor level.'); return }
    if (!formData.name.trim()) { setError('Please enter your name.'); return }
    if (!formData.mobile || formData.mobile.length !== 8) { setError('Please enter a valid 8-digit mobile number.'); return }
    if (!consent) { setError('Please read and agree to the Privacy Policy to continue.'); return }

    setLoading(true)
    try {
      // Fetch valuation first so we can include it in the lead record
      let valuation = null
      if (formData.postalCode && formData.propertyType) {
        try {
          const flatParam = formData.unitType ? `&flat_type=${encodeURIComponent(formData.unitType)}` : ''
          const vRes = await fetch(`/api/valuation?postal=${formData.postalCode}&property_type=${formData.propertyType}${flatParam}`)
          if (vRes.ok) valuation = await vRes.json()
        } catch { /* non-blocking */ }
      }

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, valuation }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      setSubmitted(true)
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  // Colours
  const navy = '#1B2B4B'
  const navyLight = '#2A3F63'
  const gold = '#C9A84C'
  const red = '#C0392B'

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #D1D9E6',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#1a1a2e',
    background: '#fff',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    color: '#4A5568',
    marginBottom: '6px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: '#374151', background: '#fff', lineHeight: 1.6 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: ${navy} !important; box-shadow: 0 0 0 3px rgba(27,43,75,0.08) !important; }
        @media (max-width: 768px) {
          .fpv-grid { grid-template-columns: 1fr !important; }
          .fpv-trust-row { gap: 16px !important; }
          .fpv-hero-content { padding: 48px 24px !important; }
          .fpv-section { padding: 48px 24px !important; }
          .fpv-nav { padding: 0 24px !important; }
        }
      `}</style>

      {/* ── NAV ────────────────────────────────────────────── */}
      <nav className="fpv-nav" style={{ background: '#fff', borderBottom: '1px solid #E8EDF5', padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/favicon.svg" alt="SGHomeValuation" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '17px', fontWeight: 700, color: navy, letterSpacing: '-0.3px' }}>
            SG<span style={{ color: gold }}>Home</span>Valuation
          </span>
        </div>

      </nav>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden', minHeight: '460px', display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-couple.jpg"
          alt="Singapore homeowners"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
        {/* Refined gradient */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(105deg, rgba(27,43,75,0.92) 0%, rgba(27,43,75,0.75) 40%, rgba(27,43,75,0.15) 70%, transparent 100%)` }} />
        <div className="fpv-hero-content" style={{ position: 'relative', zIndex: 2, maxWidth: '1140px', margin: '0 auto', padding: '72px 48px', width: '100%' }}>
          <div style={{ maxWidth: '540px' }}>
            {/* Eyebrow */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 50, padding: '5px 14px', marginBottom: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: gold, display: 'inline-block' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: gold, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Free · No Obligation · Private</span>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(30px, 3.5vw, 46px)', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: '20px', letterSpacing: '-0.5px' }}>
              How Much Is Your Property<br />Really Worth Today?
            </h1>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.85)', marginBottom: '12px', lineHeight: 1.7 }}>
              Many Singapore homeowners may be sitting on{' '}
              <strong style={{ color: '#fff' }}>$300K – $1M+</strong> in untapped property equity.
            </p>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '36px', lineHeight: 1.8 }}>
              Your home may be your largest retirement asset. Explore how selling or restructuring your property could unlock significant liquidity for retirement income, healthcare, and lifestyle flexibility.
            </p>
            <button
              onClick={scrollToForm}
              style={{ background: gold, color: navy, border: 'none', borderRadius: '8px', padding: '16px 40px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.2px', boxShadow: '0 4px 20px rgba(201,168,76,0.4)', transition: 'transform 0.15s, box-shadow 0.15s' }}
            >
              Get My Free Valuation Report
            </button>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '14px' }}>
              Takes 60 seconds &nbsp;·&nbsp; No obligation &nbsp;·&nbsp; Private assessment
            </p>
          </div>
        </div>
      </section>

      {/* ── CONTENT + FORM ─────────────────────────────────── */}
      <section className="fpv-section" style={{ padding: '72px 48px', maxWidth: '1140px', margin: '0 auto' }}>
        {/* Section heading */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: gold, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Property Insights</p>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 2.5vw, 32px)', fontWeight: 800, color: navy, letterSpacing: '-0.4px' }}>
            Many Singapore Homeowners Are Asset Rich But Cash Tight
          </h2>
        </div>

        <div className="fpv-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '56px', alignItems: 'start' }}>

          {/* ── LEFT ── */}
          <div>
            {/* Table */}
            <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #E8EDF5', marginBottom: '40px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr>
                    <th style={{ background: navy, color: '#fff', padding: '14px 20px', textAlign: 'left', fontWeight: 700, fontSize: '13px', letterSpacing: '0.03em' }}>Property Value (Example)</th>
                    <th style={{ background: navy, color: '#fff', padding: '14px 20px', textAlign: 'left', fontWeight: 700, fontSize: '13px', letterSpacing: '0.03em' }}>Potential Cash After Right-Sizing</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['$2.4M Landed', '$800K – $1.2M'],
                    ['$1.6M Condo', '$400K – $600K'],
                    ['$1.2M HDB', '$200K – $400K'],
                  ].map(([prop, cash], i) => (
                    <tr key={prop} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFD' }}>
                      <td style={{ padding: '14px 20px', borderBottom: '1px solid #E8EDF5', color: '#4A5568' }}>{prop}</td>
                      <td style={{ padding: '14px 20px', borderBottom: '1px solid #E8EDF5', fontWeight: 700, color: navy }}>{cash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Checklist */}
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', fontWeight: 700, color: navy, marginBottom: '20px' }}>
              What You Will Discover
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                "Your property's latest market valuation",
                "How much cash you could unlock",
                "Whether selling or restructuring makes sense",
                "Options such as right-sizing or equity loans",
              ].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '15px', color: '#4A5568' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* ── RIGHT: form ── */}
          <div ref={formRef} id="lead-form">
            <div style={{ background: '#fff', borderRadius: '12px', padding: '32px 28px', boxShadow: '0 8px 40px rgba(27,43,75,0.12)', border: '1px solid #E8EDF5' }}>
              {/* Form header accent */}
              <div style={{ height: 4, background: `linear-gradient(90deg, ${navy}, ${gold})`, borderRadius: '4px 4px 0 0', margin: '-32px -28px 24px' }} />

              {submitted ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4', border: '2px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', color: navy, marginBottom: '10px', fontWeight: 800 }}>Request Received!</h3>
                  <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.7 }}>
                    Check your WhatsApp — our team will be in touch to confirm your property valuation.
                  </p>
                  <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '10px' }}>
                    Our consultant will reach out within 1 business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '18px', fontWeight: 800, color: navy, marginBottom: '22px' }}>
                    Get My Free Property Valuation
                  </h3>

                  <div style={{ marginBottom: '16px', position: 'relative' }} ref={postalWrapRef}>
                    <label style={labelStyle}>Property Address <span style={{ color: red }}>*</span></label>
                    {addressConfirmed ? (
                      // Confirmed state — show address chip with clear button
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1.5px solid #16A34A`, borderRadius: '6px', background: '#F0FDF4' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span style={{ fontSize: '13px', color: '#15803D', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formData.postalDisplay}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAddressConfirmed(false)
                            setFormData(f => ({ ...f, postalCode: '', postalDisplay: '' }))
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '16px', padding: '0 2px', lineHeight: 1 }}
                          title="Change address"
                        >✕</button>
                      </div>
                    ) : (
                      // Search state
                      <>
                        <input
                          type="text"
                          placeholder="Type block number, condo name or 6-digit postal"
                          value={formData.postalDisplay || formData.postalCode}
                          autoComplete="off"
                          onChange={e => {
                            const raw = e.target.value
                            const isNumeric = /^\d+$/.test(raw.trim())
                            const val = isNumeric ? raw.replace(/\D/g, '') : raw
                            // Any typing clears confirmation
                            setAddressConfirmed(false)
                            setFormData(f => ({ ...f, postalCode: '', postalDisplay: isNumeric ? val : val }))
                            setShowSuggestions(true)
                            if (suggestTimer.current) clearTimeout(suggestTimer.current)
                            if (val.length >= 2) {
                              setSuggestLoading(true)
                              suggestTimer.current = setTimeout(async () => {
                                try {
                                  const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(val)}&returnGeom=N&getAddrDetails=Y&pageNum=1`)
                                  const data = await res.json()
                                  const results = (data.results || []).slice(0, 8).map((r: {BUILDING?: string, ADDRESS?: string, POSTAL?: string, BLK_NO?: string, ROAD_NAME?: string}) => ({
                                    building: r.BUILDING && r.BUILDING !== 'NIL' ? r.BUILDING : `Blk ${r.BLK_NO} ${r.ROAD_NAME}`,
                                    address: r.ADDRESS || '',
                                    postal: r.POSTAL || ''
                                  })).filter((r: {postal: string}) => r.postal && r.postal.length === 6)
                                  setSuggestions(results)
                                } catch { setSuggestions([]) }
                                setSuggestLoading(false)
                              }, 350)
                            } else {
                              setSuggestions([])
                              setSuggestLoading(false)
                            }
                          }}
                          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                          style={inputStyle}
                        />
                        {showSuggestions && (suggestLoading || suggestions.length > 0) && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1.5px solid #D1D9E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', marginTop: '4px', maxHeight: '260px', overflowY: 'auto' }}>
                            {suggestLoading ? (
                              <div style={{ padding: '12px 16px', fontSize: '13px', color: '#9ca3af' }}>Searching...</div>
                            ) : suggestions.length === 0 ? (
                              <div style={{ padding: '12px 16px', fontSize: '13px', color: '#9ca3af' }}>No results — try a different search</div>
                            ) : suggestions.map((s, i) => (
                              <div key={i}
                                onMouseDown={e => {
                                  e.preventDefault()
                                  setFormData(f => ({ ...f, postalCode: s.postal, postalDisplay: s.address }))
                                  setAddressConfirmed(true)
                                  setShowSuggestions(false)
                                  setSuggestions([])
                                }}
                                style={{ padding: '11px 16px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFD')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                              >
                                <div style={{ fontSize: '13px', fontWeight: 600, color: navy }}>🏠 {s.building}</div>
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{s.address} · {s.postal}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '5px' }}>Start typing — then pick your address from the list to confirm it</p>
                      </>
                    )}
                  </div>

                  {/* Property Type */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Property Type</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      {['HDB', 'Condo', 'Landed'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData(f => ({ ...f, propertyType: type, unitType: '' }))}
                          style={{
                            padding: '10px 8px',
                            borderRadius: '6px',
                            border: formData.propertyType === type ? `2px solid ${navy}` : '1.5px solid #D1D9E6',
                            background: formData.propertyType === type ? navy : '#fff',
                            color: formData.propertyType === type ? '#fff' : '#4A5568',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            fontFamily: 'inherit',
                          }}
                        >
                          {type === 'HDB' ? '🏢 HDB' : type === 'Condo' ? '🏙️ Condo' : '🏡 Landed'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={labelStyle}>
                        {formData.propertyType === 'HDB' ? 'Flat Type' : formData.propertyType === 'Landed' ? 'Property Sub-Type' : 'Unit Size'}
                      </label>
                      <select
                        value={formData.unitType}
                        onChange={e => setFormData(f => ({ ...f, unitType: e.target.value }))}
                        style={inputStyle}
                        required
                      >
                        <option value="">Select</option>
                        {formData.propertyType === 'HDB' ? (
                          <>
                            <option value="2 ROOM">2-Room</option>
                            <option value="3 ROOM">3-Room</option>
                            <option value="4 ROOM">4-Room</option>
                            <option value="5 ROOM">5-Room</option>
                            <option value="EXECUTIVE">Executive</option>
                          </>
                        ) : formData.propertyType === 'Landed' ? (
                          <>
                            <option value="Terrace">Terrace</option>
                            <option value="Semi-Detached">Semi-Detached</option>
                            <option value="Detached">Detached</option>
                            <option value="Corner Terrace">Corner Terrace</option>
                          </>
                        ) : (
                          <>
                            <option value="Studio/1BR">Studio / 1BR</option>
                            <option value="2 Bedroom">2 Bedroom</option>
                            <option value="3 Bedroom">3 Bedroom</option>
                            <option value="4 Bedroom">4 Bedroom</option>
                            <option value="5 Bedroom+">5 Bedroom+</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Floor Level</label>
                      {formData.propertyType === 'Landed' ? (
                        <div style={{ ...inputStyle, background: '#F8FAFD', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>
                          N/A (Landed)
                        </div>
                      ) : (
                        <select value={formData.floorLevel} onChange={e => setFormData(f => ({ ...f, floorLevel: e.target.value }))} style={inputStyle} required={formData.propertyType !== 'Landed'}>
                          <option value="">Select</option>
                          <option value="Low Floor (1-10)">Low (1–10)</option>
                          <option value="Mid Floor (11-20)">Mid (11–20)</option>
                          <option value="High Floor (21+)">High (21+)</option>
                        </select>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={labelStyle}>Full Name</label>
                      <input type="text" placeholder="As per NRIC" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} style={inputStyle} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Mobile</label>
                      <div style={{ display: 'flex' }}>
                        <span style={{ ...inputStyle, width: 'auto', padding: '11px 10px', background: '#F8FAFD', borderRight: 'none', borderRadius: '6px 0 0 6px', fontSize: '13px', color: '#6B7280', flexShrink: 0, fontWeight: 600 }}>+65</span>
                        <input type="tel" placeholder="8 digits" maxLength={8} value={formData.mobile} onChange={e => setFormData(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} style={{ ...inputStyle, borderRadius: '0 6px 6px 0' }} required />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#DC2626', marginBottom: '16px' }}>
                      {error}
                    </div>
                  )}

                  {/* PDPA Consent */}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={e => setConsent(e.target.checked)}
                      style={{ marginTop: 3, width: 15, height: 15, flexShrink: 0, accentColor: navy }}
                    />
                    <span style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                      By submitting this form, I confirm that I have read and understood the{' '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: navy, textDecoration: 'underline' }}>Privacy Policy</a>
                      {' '}and consent to SKYS Branch Pte Ltd collecting, using, disclosing and retaining my personal data to contact me regarding my enquiry and provide financial advisory information relating to products distributed by Manulife Financial Advisers Pte Ltd. I consent to being contacted via phone, SMS, WhatsApp, and email, even if my number is listed on the Do Not Call Registry (DNCR). I understand I may withdraw this consent at any time.
                    </span>
                  </label>

                  <button
                    type="submit" disabled={loading}
                    style={{ width: '100%', padding: '15px', background: loading ? '#9CA3AF' : navy, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.2px', boxShadow: loading ? 'none' : `0 4px 16px rgba(27,43,75,0.3)`, transition: 'all 0.15s' }}
                  >
                    {loading ? 'Submitting...' : 'Get My Free Valuation Report →'}
                  </button>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '10px', textAlign: 'center', lineHeight: 1.6 }}>
                    Your data is protected under PDPA &nbsp;·&nbsp; No spam, ever
                  </p>
                </form>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* ── TRUST BAR ──────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid #E8EDF5', borderBottom: '1px solid #E8EDF5', padding: '44px 48px', background: '#F8FAFD' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '28px' }}>
            Our Consultants Are From Singapore&apos;s Top Agencies
          </p>
          <div className="fpv-trust-row" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {[
              { src: '/logos/era.png', alt: 'ERA Real Estate' },
              { src: '/logos/huttons.svg', alt: 'Huttons' },
              { src: '/logos/propnex.png', alt: 'PropNex' },
              { src: '/logos/orangetee.svg', alt: 'OrangeTee' },
            ].map(({ src, alt }) => (
              <div key={alt} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', border: '1px solid #E8EDF5', borderRadius: '10px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', minWidth: '130px', height: '60px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={alt} style={{ height: '36px', width: 'auto', objectFit: 'contain', maxWidth: '110px' }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer style={{ padding: '32px 48px', textAlign: 'center', background: '#fff' }}>
        <p style={{ fontSize: '11px', color: '#9CA3AF', maxWidth: '760px', margin: '0 auto', lineHeight: 1.8 }}>
          *Valuation estimates are based on recent market transactions and are indicative only. They do not constitute formal property valuation advice.
          This site is operated by licensed property consultants in Singapore and is intended for informational purposes only.
          By submitting your information you agree to being contacted by our consultants regarding your property enquiry.
        </p>
        <p style={{ fontSize: '11px', color: '#D1D5DB', marginTop: '10px' }}>
          © 2026 SGHomeValuation.com &nbsp;·&nbsp; All Rights Reserved
        </p>
      </footer>

    </div>
  )
}
