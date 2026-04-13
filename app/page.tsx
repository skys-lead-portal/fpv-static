'use client'

import { useState, useRef } from 'react'

export default function Home() {
  const [formData, setFormData] = useState({
    postalCode: '',
    postalDisplay: '',
    unitType: '',
    floorLevel: '',
    name: '',
    mobile: '',
    email: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLDivElement>(null)
  const [suggestions, setSuggestions] = useState<Array<{building: string, address: string, postal: string}>>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postalWrapRef = useRef<HTMLDivElement>(null)

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.postalCode || formData.postalCode.length !== 6) { setError('Please select your property from the dropdown suggestions.'); return }
    if (!formData.unitType) { setError('Please select a unit type.'); return }
    if (!formData.floorLevel) { setError('Please select a floor level.'); return }
    if (!formData.name.trim()) { setError('Please enter your name.'); return }
    if (!formData.mobile || formData.mobile.length !== 8) { setError('Please enter a valid 8-digit mobile number.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, propertyType: 'Auto-detect' }),
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#374151',
    background: '#fff',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '5px',
  }

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#374151', background: '#fff', lineHeight: 1.6 }}>
      <style>{`
        @media (max-width: 768px) {
          .fpv-grid { grid-template-columns: 1fr !important; }
          .fpv-trust { gap: 20px !important; }
          .fpv-hero-btn { width: 100%; box-sizing: border-box; }
          .fpv-nav-contact { font-size: 13px !important; }
        }
      `}</style>

      {/* ── NAV ────────────────────────────────────────────── */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '22px' }}>🏠</span>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 700, color: '#2c3e50' }}>
            <span style={{ color: '#B22222' }}>Free</span>PropertyValuation.sg
          </span>
        </div>
        <div style={{ fontSize: '14px', color: '#4a4a4a' }}>
          <a href="mailto:hello@skysleads.com" style={{ color: '#B22222', textDecoration: 'none', fontWeight: 600 }}>📞 Contact Us</a>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden', minHeight: '420px', display: 'flex', alignItems: 'center' }}>
        {/* Full-width background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-couple.jpg"
          alt="Singapore homeowners"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
        {/* Gradient overlay — left side darker for text legibility */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(240,244,248,0.97) 0%, rgba(240,244,248,0.88) 45%, rgba(240,244,248,0.3) 70%, rgba(240,244,248,0) 100%)' }} />
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '1140px', margin: '0 auto', padding: '56px 40px', width: '100%' }}>
          <div style={{ maxWidth: '520px' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 700, color: '#2c3e50', lineHeight: 1.25, marginBottom: '20px' }}>
              How Much Is Your Property<br />Really Worth Today?
            </h1>
            <p style={{ fontSize: '16px', color: '#4a4a4a', marginBottom: '12px' }}>
              Many Singapore homeowners may be sitting on{' '}
              <strong style={{ color: '#2c3e50' }}>$300K – $1M+</strong> in untapped property equity.
            </p>
            <p style={{ fontSize: '14px', color: '#4a4a4a', marginBottom: '32px', lineHeight: 1.7 }}>
              Your home may be your largest retirement asset. Explore how selling or restructuring your property could unlock significant liquidity for retirement income, healthcare, and lifestyle flexibility.
            </p>
            <button
              onClick={scrollToForm}
              style={{ background: '#B22222', color: '#fff', border: 'none', borderRadius: '5px', padding: '16px 36px', fontSize: '17px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px' }}
            >
              Get My Free Property Valuation
            </button>
            <p style={{ fontSize: '12px', color: '#555', marginTop: '12px' }}>
              Takes 60 seconds &nbsp;·&nbsp; No obligation &nbsp;·&nbsp; Private assessment
            </p>
          </div>
        </div>
      </section>

      {/* ── CONTENT + FORM ─────────────────────────────────── */}
      <section style={{ padding: '60px 40px', maxWidth: '1140px', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 700, color: '#2c3e50', marginBottom: '32px', textAlign: 'center' }}>
          Many Singapore Homeowners Are Asset Rich But Cash Tight
        </h2>

        <div className="fpv-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '48px', alignItems: 'start' }}>

          {/* ── LEFT: table + checklist ── */}
          <div>
            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '36px', fontSize: '14px' }}>
              <thead>
                <tr>
                  <th style={{ background: '#6b8cae', color: '#fff', padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Property Value (Example)</th>
                  <th style={{ background: '#6b8cae', color: '#fff', padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Potential Cash After<br/>Right-Sizing</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['$2.4M Landed', '$800K – $1.2M'],
                  ['$1.6M Condo', '$400K – $600K'],
                  ['$1.2M HDB', '$200K – $400K'],
                ].map(([prop, cash], i) => (
                  <tr key={prop} style={{ background: i % 2 === 0 ? '#fff' : '#f7f9fc' }}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#4a4a4a' }}>{prop}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#2c3e50' }}>{cash}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Checklist */}
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#2c3e50', marginBottom: '16px' }}>
              What You Will Discover
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                "Your property's latest market valuation",
                "How much cash you could unlock",
                "Whether selling or restructuring makes sense",
                "Options such as right-sizing or equity loans.",
              ].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '15px', color: '#4a4a4a' }}>
                  <span style={{ color: '#2e7d32', fontSize: '16px', fontWeight: 700, marginTop: '1px', flexShrink: 0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* ── RIGHT: form ── */}
          <div ref={formRef} id="lead-form">
            <div style={{ background: '#f0f4f8', borderRadius: '8px', padding: '28px 24px', boxShadow: '0 2px 16px rgba(0,0,0,0.10)', border: '1px solid #dde3ea' }}>
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                  <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: '#2c3e50', marginBottom: '10px' }}>Request Received!</h3>
                  <p style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: 1.7 }}>
                    Check your WhatsApp — our team will be in touch to confirm your property valuation.
                  </p>
                  <p style={{ fontSize: '13px', color: '#888', marginTop: '12px' }}>
                    Our consultant will reach out within 1 business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 700, color: '#2c3e50', marginBottom: '20px' }}>
                    Get My Free Property Valuation
                  </h3>

                  <div style={{ marginBottom: '14px', position: 'relative' }} ref={postalWrapRef}>
                    <label style={labelStyle}>Property Search</label>
                    <input
                      type="text" placeholder="Search by condo name, block or postal code"
                      value={formData.postalDisplay || formData.postalCode}
                      autoComplete="off"
                      onChange={e => {
                        const raw = e.target.value
                        const isNumeric = /^\d+$/.test(raw)
                        const val = isNumeric ? raw.replace(/\D/g, '') : raw
                        setFormData(f => ({ ...f, postalCode: isNumeric ? val : '', postalDisplay: isNumeric ? '' : val }))
                        setShowSuggestions(true)
                        if (suggestTimer.current) clearTimeout(suggestTimer.current)
                        // Auto-accept 6-digit postal without needing dropdown
                        if (isNumeric && val.length === 6) {
                          setSuggestions([])
                          setShowSuggestions(false)
                          setFormData(f => ({ ...f, postalCode: val, postalDisplay: val }))
                        } else if (val.length >= 3) {
                          setSuggestLoading(true)
                          suggestTimer.current = setTimeout(async () => {
                            try {
                              const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(val)}&returnGeom=N&getAddrDetails=Y&pageNum=1`)
                              const data = await res.json()
                              const results = (data.results || []).slice(0, 6).map((r: {BUILDING?: string, ADDRESS?: string, POSTAL?: string, BLK_NO?: string, ROAD_NAME?: string}) => ({
                                building: r.BUILDING && r.BUILDING !== 'NIL' ? r.BUILDING : `Blk ${r.BLK_NO} ${r.ROAD_NAME}`,
                                address: r.ADDRESS || '',
                                postal: r.POSTAL || ''
                              })).filter((r: {postal: string}) => r.postal && r.postal.length === 6)
                              setSuggestions(results)
                            } catch { setSuggestions([]) }
                            setSuggestLoading(false)
                          }, 400)
                        } else {
                          setSuggestions([])
                          setSuggestLoading(false)
                        }
                      }}
                      onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      style={inputStyle} required
                    />
                    {showSuggestions && (suggestLoading || suggestions.length > 0) && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '2px', maxHeight: '240px', overflowY: 'auto' }}>
                        {suggestLoading ? (
                          <div style={{ padding: '10px 14px', fontSize: '13px', color: '#9ca3af' }}>Searching...</div>
                        ) : suggestions.length === 0 ? (
                          <div style={{ padding: '10px 14px', fontSize: '13px', color: '#9ca3af' }}>No results found</div>
                        ) : suggestions.map((s, i) => (
                          <div key={i}
                            onMouseDown={e => {
                              e.preventDefault()
                              setFormData(f => ({ ...f, postalCode: s.postal, postalDisplay: s.address }))
                              setShowSuggestions(false)
                              setSuggestions([])
                            }}
                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f7f9fc')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                          >
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#2c3e50' }}>🏡 {s.building}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{s.address} · {s.postal}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div>
                      <label style={labelStyle}>Unit Type</label>
                      <select value={formData.unitType} onChange={e => setFormData(f => ({ ...f, unitType: e.target.value }))} style={inputStyle} required>
                        <option value="">Select</option>
                        <option value="Studio/1BR">Studio / 1BR</option>
                        <option value="2 Bedroom">2 Bedroom</option>
                        <option value="3 Bedroom">3 Bedroom</option>
                        <option value="4 Bedroom">4 Bedroom</option>
                        <option value="5 Bedroom+">5 Bedroom+</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Floor Level</label>
                      <select value={formData.floorLevel} onChange={e => setFormData(f => ({ ...f, floorLevel: e.target.value }))} style={inputStyle} required>
                        <option value="">Select</option>
                        <option value="Low Floor (1-10)">Low (1–10)</option>
                        <option value="Mid Floor (11-20)">Mid (11–20)</option>
                        <option value="High Floor (21+)">High (21+)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div>
                      <label style={labelStyle}>Name</label>
                      <input type="text" placeholder="Full name" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} style={inputStyle} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Phone</label>
                      <div style={{ display: 'flex' }}>
                        <span style={{ ...inputStyle, width: 'auto', padding: '10px 8px', background: '#f0f0f0', borderRight: 'none', borderRadius: '4px 0 0 4px', fontSize: '13px', color: '#888', flexShrink: 0 }}>+65</span>
                        <input type="tel" placeholder="8 digits" maxLength={8} value={formData.mobile} onChange={e => setFormData(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} style={{ ...inputStyle, borderRadius: '0 4px 4px 0' }} required />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '10px 12px', fontSize: '13px', color: '#dc2626', marginBottom: '14px' }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit" disabled={loading}
                    style={{ width: '100%', padding: '14px', background: loading ? '#999' : '#B22222', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px' }}
                  >
                    {loading ? 'Preparing your report...' : 'Get My Free Property Valuation'}
                  </button>
                  <p style={{ fontSize: '12px', color: '#888', marginTop: '10px', textAlign: 'center', lineHeight: 1.5 }}>
                    Based on recent transactions &amp; market data<br />Takes 60 seconds
                  </p>
                </form>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* ── TRUST BAR ──────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '40px 40px', background: '#fafafa' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: '#4a4a4a', marginBottom: '28px', fontWeight: 600 }}>
            Access Realtors From Singapore&apos;s Top Agencies
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
            {[
              { src: '/logos/era.png', alt: 'ERA Real Estate' },
              { src: '/logos/huttons.svg', alt: 'Huttons' },
              { src: '/logos/propnex.png', alt: 'PropNex' },
              { src: '/logos/orangetee.svg', alt: 'OrangeTee' },
            ].map(({ src, alt }) => (
              <div key={alt} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 20px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minWidth: '120px', height: '56px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={alt} style={{ height: '36px', width: 'auto', objectFit: 'contain', maxWidth: '110px' }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer style={{ padding: '24px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', color: '#9ca3af', maxWidth: '800px', margin: '0 auto', lineHeight: 1.7 }}>
          *Valuation estimates are based on recent market transactions and are indicative only. They do not constitute formal property valuation advice.
          This site is operated by licensed property consultants in Singapore and is intended for informational purposes only.
          By submitting your information you agree to being contacted by our consultants regarding your property enquiry.
        </p>
        <p style={{ fontSize: '11px', color: '#c4c9d4', marginTop: '8px', textAlign: 'center' }}>
          © 2026 FreePropertyValuation.sg
        </p>
      </footer>

    </div>
  )
}
