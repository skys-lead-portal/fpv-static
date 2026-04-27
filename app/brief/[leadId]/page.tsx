import { NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const NAVY = '#1B2B4B'
const GOLD = '#C9A84C'

type Lead = {
  id: string
  full_name: string
  mobile: string
  created_at: string
  metadata: {
    postal_code?: string
    property_type?: string
    unit_type?: string
    floor_level?: string
    valuation?: {
      block?: string
      street?: string
      development?: string
      town?: string
      estimatedLow?: string
      estimatedHigh?: string
      transactionCount?: number
      latestMonth?: string
      isPrivate?: boolean
      propertyType?: string
    }
  }
}

type Transaction = {
  month: string
  block: string
  street_name: string
  storey_range: string
  flat_type: string
  floor_area_sqm: string
  resale_price: number
  lease_commence_date: string
  remaining_lease: string
  flat_model: string
}

type URATransaction = {
  contract_date: string
  price: number
  area: number
  floor_range: string
  property_type: string
  tenure: string
  district: string
  project: string
}

async function getURAComparables(development: string, street: string, propertyType: string): Promise<URATransaction[]> {
  if (!development || development === 'NIL') {
    // Landed: search by street
    const streetEncoded = encodeURIComponent(street.replace(/'/g, ''))
    const landedTypes = 'Terrace,Semi-detached,Detached,Strata+Terrace,Strata+Semi-detached,Strata+Detached'
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ura_transactions?select=contract_date,price,area,floor_range,property_type,tenure,district,project&street=ilike.%25${streetEncoded}%25&property_type=in.(${landedTypes})&order=contract_date.desc&limit=10`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: 'no-store' }
    )
    return res.ok ? await res.json() : []
  }
  // Condo: search by project name keywords
  const keywords = development.toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(' ')
    .filter((w: string) => w.length > 2)
    .slice(0, 3)
    .join('%')
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ura_transactions?select=contract_date,price,area,floor_range,property_type,tenure,district,project&project=ilike.%25${encodeURIComponent(keywords)}%25&order=contract_date.desc&limit=10`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: 'no-store' }
  )
  return res.ok ? await res.json() : []
}

function formatContractDate(d: string): string {
  if (!d || d.length < 4) return d
  const month = d.slice(0, 2)
  const year = d.slice(2, 4)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const m = parseInt(month) - 1
  return `${months[m] || month} 20${year}`
}

async function getLead(leadId: string): Promise<Lead | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}&select=id,full_name,mobile,created_at,metadata`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: 'no-store' }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return rows?.[0] || null
}

async function getComparables(town: string, flatType: string, block: string, streetName: string): Promise<Transaction[]> {
  // Try block-level first
  const blockRes = await fetch(
    `${SUPABASE_URL}/rest/v1/hdb_transactions?block=eq.${encodeURIComponent(block)}&street_name=eq.${encodeURIComponent(streetName)}&flat_type=eq.${encodeURIComponent(flatType)}&order=month.desc&limit=10&select=month,block,street_name,storey_range,flat_type,floor_area_sqm,resale_price,lease_commence_date,remaining_lease,flat_model`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: 'no-store' }
  )
  const blockData: Transaction[] = blockRes.ok ? await blockRes.json() : []
  if (blockData.length >= 5) return blockData

  // Fall back to town level
  const townRes = await fetch(
    `${SUPABASE_URL}/rest/v1/hdb_transactions?town=eq.${encodeURIComponent(town)}&flat_type=eq.${encodeURIComponent(flatType)}&order=month.desc&limit=10&select=month,block,street_name,storey_range,flat_type,floor_area_sqm,resale_price,lease_commence_date,remaining_lease,flat_model`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: 'no-store' }
  )
  return townRes.ok ? await townRes.json() : blockData
}

async function getPriceTrend(town: string, flatType: string): Promise<{ recent: number; older: number; pct: number } | null> {
  // Get avg price last 3 months vs prior 3 months
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/hdb_transactions?town=eq.${encodeURIComponent(town)}&flat_type=eq.${encodeURIComponent(flatType)}&order=month.desc&limit=200&select=month,resale_price`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: 'no-store' }
  )
  if (!res.ok) return null
  const rows: { month: string; resale_price: number }[] = await res.json()
  if (rows.length < 10) return null

  const sorted = rows.sort((a, b) => b.month.localeCompare(a.month))
  const recent = sorted.slice(0, Math.floor(sorted.length / 2))
  const older = sorted.slice(Math.floor(sorted.length / 2))
  const avgRecent = recent.reduce((s, r) => s + Number(r.resale_price), 0) / recent.length
  const avgOlder = older.reduce((s, r) => s + Number(r.resale_price), 0) / older.length
  const pct = ((avgRecent - avgOlder) / avgOlder) * 100
  return { recent: avgRecent, older: avgOlder, pct }
}

function formatPrice(p: number) {
  if (p >= 1_000_000) return `S$${(p / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  return `S$${Math.round(p / 1000)}K`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getFloorPremium(txns: Transaction[]) {
  const bands: Record<string, number[]> = { low: [], mid: [], high: [] }
  for (const t of txns) {
    const range = t.storey_range || ''
    const low = parseInt(range.split(' ')[0]) || 0
    if (low <= 6) bands.low.push(Number(t.resale_price))
    else if (low <= 15) bands.mid.push(Number(t.resale_price))
    else bands.high.push(Number(t.resale_price))
  }
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  return { low: avg(bands.low), mid: avg(bands.mid), high: avg(bands.high) }
}

export default async function BriefPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params
  const lead = await getLead(leadId)

  if (!lead) {
    return (
      <html><body style={{ fontFamily: 'sans-serif', padding: 40, color: '#666' }}>
        <h2>Brief not found</h2>
        <p>Lead ID not found or access denied.</p>
      </body></html>
    )
  }

  const meta = lead.metadata || {}
  const val = meta.valuation || {}
  const town = val.town || ''
  const flatType = meta.unit_type || ''
  const block = val.block || ''
  const street = val.street || ''
  const isPrivate = val.isPrivate || meta.property_type === 'Condo' || meta.property_type === 'Landed'

  const uraComparables: URATransaction[] = isPrivate
    ? await getURAComparables(val.development || '', street, meta.property_type || '')
    : []

  const [comparables, trend] = await Promise.all([
    isPrivate ? Promise.resolve([]) : getComparables(town, flatType, block, street),
    isPrivate ? Promise.resolve(null) : getPriceTrend(town, flatType),
  ])

  const floorPremium = comparables.length >= 5 ? getFloorPremium(comparables) : null
  const leaseYear = comparables[0]?.lease_commence_date ? parseInt(comparables[0].lease_commence_date) : null
  const remainingLease = comparables[0]?.remaining_lease || null
  const remainingYears = remainingLease ? parseInt(remainingLease) : null
  const leaseWarning = remainingYears !== null && remainingYears < 60

  const midpoint = val.estimatedLow && val.estimatedHigh
    ? (() => {
        const lo = parseFloat(val.estimatedLow!.replace(/[^0-9.]/g, '')) * (val.estimatedLow!.includes('M') ? 1_000_000 : 1_000)
        const hi = parseFloat(val.estimatedHigh!.replace(/[^0-9.]/g, '')) * (val.estimatedHigh!.includes('M') ? 1_000_000 : 1_000)
        return formatPrice((lo + hi) / 2)
      })()
    : null

  const psm = comparables.length > 0
    ? (() => {
        const valid = comparables.filter(t => parseFloat(t.floor_area_sqm) > 0)
        if (!valid.length) return null
        const avgPsm = valid.reduce((s, t) => s + Number(t.resale_price) / parseFloat(t.floor_area_sqm), 0) / valid.length
        return `S$${Math.round(avgPsm).toLocaleString()}/sqm`
      })()
    : null

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Agent Brief — {lead.full_name}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #F0F4F8; color: #1a1a2e; font-size: 14px; }
          .page { max-width: 780px; margin: 0 auto; padding: 24px 16px 48px; }
          .header { background: ${NAVY}; color: white; border-radius: 10px 10px 0 0; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
          .header .badge { background: ${GOLD}; color: ${NAVY}; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px; letter-spacing: 0.5px; }
          .card { background: white; border: 1px solid #E2E8F0; border-radius: 0; padding: 20px 24px; border-top: none; }
          .card:last-child { border-radius: 0 0 10px 10px; }
          .section-title { font-size: 11px; font-weight: 800; color: ${GOLD}; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 2px solid #E2E8F0; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
          .stat { background: #F8FAFD; border-radius: 8px; padding: 12px 16px; }
          .stat label { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 4px; }
          .stat value { font-size: 20px; font-weight: 800; color: ${NAVY}; display: block; }
          .stat sub { font-size: 11px; color: #6B7280; display: block; margin-top: 2px; }
          .val-range { background: ${NAVY}; color: white; border-radius: 8px; padding: 16px 20px; text-align: center; }
          .val-range .range { font-size: 26px; font-weight: 800; color: ${GOLD}; }
          .val-range .basis { font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 4px; }
          .warn { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #92400E; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #F8FAFD; font-weight: 700; color: #4A5568; text-align: left; padding: 8px 10px; border-bottom: 2px solid #E2E8F0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
          td { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; color: #374151; }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) td { background: #FAFBFD; }
          .price { font-weight: 700; color: ${NAVY}; }
          .trend-up { color: #10B981; font-weight: 700; }
          .trend-down { color: #EF4444; font-weight: 700; }
          .call-box { background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 8px; padding: 16px; }
          .call-box h4 { color: #166534; font-size: 12px; font-weight: 800; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
          .call-box p { font-size: 13px; color: #374151; line-height: 1.6; }
          .talking-points li { font-size: 12px; color: #374151; margin-bottom: 6px; padding-left: 4px; }
          .talking-points li::before { content: "✓ "; color: #10B981; font-weight: 800; }
          .footer { text-align: center; font-size: 10px; color: #9CA3AF; margin-top: 20px; }
          .floor-band { display: flex; gap: 8px; }
          .floor-band .band { flex: 1; background: #F8FAFD; border-radius: 6px; padding: 10px; text-align: center; border: 1px solid #E2E8F0; }
          .floor-band .band.active { background: ${NAVY}; border-color: ${NAVY}; color: white; }
          .floor-band .band label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 4px; opacity: 0.7; }
          .floor-band .band value { font-size: 14px; font-weight: 800; display: block; }
          @media print {
            body { background: white; }
            .page { padding: 0; max-width: 100%; }
            .header { border-radius: 0; }
            .card:last-child { border-radius: 0; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">

          {/* Header */}
          <div className="header">
            <div>
              <h1>🏠 SKYS — Agent Lead Brief</h1>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Generated {formatDate(lead.created_at)} · Internal use only</div>
            </div>
            <div className="badge">CONFIDENTIAL</div>
          </div>

          {/* Contact */}
          <div className="card">
            <div className="section-title">Contact</div>
            <div className="grid2">
              <div className="stat">
                <label>Lead Name</label>
                <span style={{ fontSize: 18 }}>{lead.full_name}</span>
                <sub>Source: SGHomeValuation.com</sub>
              </div>
              <div className="stat">
                <label>Mobile</label>
                <span style={{ fontSize: 18 }}>{lead.mobile}</span>
                <sub>WhatsApp notification sent ✓</sub>
              </div>
            </div>
          </div>

          {/* Property */}
          <div className="card">
            <div className="section-title">Property Details</div>
            {leaseWarning && (
              <div className="warn">
                ⚠️ <strong>Lease Alert:</strong> Remaining lease is ~{remainingYears} years. CPF usage restrictions may apply for buyers. Smaller buyer pool — factor into pricing strategy.
              </div>
            )}
            <div className="grid2" style={{ marginBottom: 12 }}>
              <div className="stat">
                <label>Address</label>
                <span style={{ fontSize: 14 }}>
                  {val.development && val.development !== 'NIL'
                    ? val.development
                    : block ? `Blk ${block} ${street}` : street || `Postal ${meta.postal_code}`}
                </span>
                <sub>Postal: {meta.postal_code}{town ? ` · ${town}` : ''}</sub>
              </div>
              <div className="stat">
                <label>Unit</label>
                <span style={{ fontSize: 14 }}>{meta.property_type} · {flatType}</span>
                <sub>{meta.floor_level}</sub>
              </div>
            </div>
            {!isPrivate && (
              <div className="grid3">
                <div className="stat">
                  <label>Lease Commenced</label>
                  <span style={{ fontSize: 16 }}>{leaseYear || '—'}</span>
                  <sub>{remainingLease || 'check HDB'}</sub>
                </div>
                <div className="stat">
                  <label>Floor Area</label>
                  <span style={{ fontSize: 16 }}>{comparables[0]?.floor_area_sqm ? `${comparables[0].floor_area_sqm} sqm` : '—'}</span>
                  <sub>{comparables[0]?.flat_model || ''}</sub>
                </div>
                <div className="stat">
                  <label>Avg Price/sqm</label>
                  <span style={{ fontSize: 16 }}>{psm || '—'}</span>
                  <sub>area benchmark</sub>
                </div>
              </div>
            )}
          </div>

          {/* Valuation */}
          <div className="card">
            <div className="section-title">Valuation Estimate</div>
            {val.estimatedLow ? (
              <>
                <div className="val-range" style={{ marginBottom: 14 }}>
                  <div className="range">{val.estimatedLow} – {val.estimatedHigh}</div>
                  <div style={{ fontSize: 14, color: GOLD, fontWeight: 700, marginTop: 4 }}>Midpoint: {midpoint}</div>
                  <div className="basis">{val.transactionCount} comparable transactions · Data to {val.latestMonth}</div>
                </div>
                <div className="grid2">
                  <div className="stat">
                    <label>Market Trend</label>
                    {trend ? (
                      <>
                        <span style={{ fontSize: 16 }} className={trend.pct >= 0 ? 'trend-up' : 'trend-down'}>
                          {trend.pct >= 0 ? '▲' : '▼'} {Math.abs(trend.pct).toFixed(1)}%
                        </span>
                        <sub>recent vs prior period</sub>
                      </>
                    ) : (
                      <span style={{ fontSize: 14 }}>—</span>
                    )}
                  </div>
                  <div className="stat">
                    <label>Data Basis</label>
                    <span style={{ fontSize: 14 }}>{val.transactionCount} txns</span>
                    <sub>{town} · {flatType}</sub>
                  </div>
                </div>
              </>
            ) : (
              <div className="stat">
                <label>Status</label>
                <span style={{ fontSize: 14 }}>
                  {isPrivate ? `${meta.property_type} — ` : ''} No valuation data — check{' '}
                  <a href={`https://sghomevaluation.com/api/valuation?postal=${meta.postal_code}&property_type=${meta.property_type}`}
                     target="_blank" rel="noopener noreferrer" style={{color: GOLD}}>valuation API</a>
                </span>
              </div>
            )}
          </div>

          {/* Floor Premium */}
          {floorPremium && (floorPremium.low || floorPremium.mid || floorPremium.high) && (
            <div className="card">
              <div className="section-title">Floor Level Premium</div>
              <div className="floor-band">
                {[
                  { label: 'Low (01–06)', val: floorPremium.low, key: 'low' },
                  { label: 'Mid (07–15)', val: floorPremium.mid, key: 'mid' },
                  { label: 'High (16+)', val: floorPremium.high, key: 'high' },
                ].map(({ label, val: v, key }) => {
                  const floorStr = (meta.floor_level || '').toLowerCase()
                  const isActive = (key === 'low' && floorStr.includes('low')) ||
                    (key === 'mid' && floorStr.includes('mid')) ||
                    (key === 'high' && floorStr.includes('high'))
                  return v ? (
                    <div key={key} className={`band ${isActive ? 'active' : ''}`}>
                      <label>{label}{isActive ? ' ← Lead' : ''}</label>
                      <span>{formatPrice(v)}</span>
                    </div>
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* Comparables */}
          {comparables.length > 0 && (
            <div className="card">
              <div className="section-title">Recent Comparable Transactions</div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Block</th>
                    <th>Floor</th>
                    <th>Area</th>
                    <th>Model</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((t, i) => (
                    <tr key={i}>
                      <td>{t.month}</td>
                      <td>Blk {t.block}</td>
                      <td>{t.storey_range}</td>
                      <td>{t.floor_area_sqm} sqm</td>
                      <td>{t.flat_model}</td>
                      <td className="price">S${Number(t.resale_price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Call Guide */}
          <div className="card">
            <div className="section-title">Call Guide</div>
            <div className="call-box" style={{ marginBottom: 14 }}>
              <h4>Opening Line</h4>
              <p>
                {val.estimatedLow
                  ? `"Hi ${lead.full_name.split(' ')[0]}, I'm calling from SKYS Financial Advisory. You recently checked your property valuation online — I've prepared a quick market analysis for your ${flatType} in ${town}. Current market range is ${val.estimatedLow}–${val.estimatedHigh} based on ${val.transactionCount} recent transactions. Do you have 5 minutes?"`
                  : `"Hi ${lead.full_name.split(' ')[0]}, I'm calling from SKYS Financial Advisory. You recently requested a property valuation — I'd like to share what we found for your area. Do you have 5 minutes?"`
                }
              </p>
            </div>
            <ul className="talking-points" style={{ paddingLeft: 0, listStyle: 'none' }}>
              {val.estimatedLow && <li>Market is active — {val.transactionCount} transactions in {town} recently</li>}
              {trend && trend.pct > 0 && <li>Prices trending up {trend.pct.toFixed(1)}% — good time to explore options</li>}
              {trend && trend.pct < 0 && <li>Market softening slightly — worth acting sooner rather than later</li>}
              {leaseWarning && <li>Lease under 60 years — buyer pool narrowing, discuss timing strategy</li>}
              {floorPremium?.high && floorPremium?.low && <li>Floor premium: high vs low floor gap is {formatPrice(floorPremium.high - floorPremium.low)} — factor into strategy</li>}
              <li>Ask: Outstanding loan balance? CPF accrued interest aware?</li>
              <li>Ask: Timeline — actively considering selling in next 12 months?</li>
              <li>Ask: Already spoken to another agent?</li>
            </ul>
          </div>

          {/* URA Comparables (Condo/Landed) */}
          {isPrivate && uraComparables.length > 0 && (
            <div className="card">
              <div className="section-title">Recent Comparable Transactions</div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Floor</th>
                    <th>Area</th>
                    <th>Type</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {uraComparables.map((t, i) => (
                    <tr key={i}>
                      <td>{formatContractDate(t.contract_date)}</td>
                      <td style={{ fontSize: 11 }}>{t.project || '—'}</td>
                      <td>{t.floor_range || '—'}</td>
                      <td>{t.area ? `${t.area} sqm` : '—'}</td>
                      <td style={{ fontSize: 11 }}>{t.property_type}</td>
                      <td className="price">S${Number(t.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {uraComparables[0]?.tenure && (
                <p style={{ fontSize: 11, color: '#6B7280', marginTop: 10 }}>
                  Tenure: {uraComparables[0].tenure} · District {uraComparables[0].district}
                </p>
              )}
            </div>
          )}

          <div className="footer">
            <p>SKYS Branch Pte Ltd · Internal use only · Not for distribution</p>
            <p style={{ marginTop: 4 }}>Data sourced from HDB resale transaction records via data.gov.sg · Indicative only · Not a formal bank valuation</p>
          </div>

        </div>
      </body>
    </html>
  )
}
