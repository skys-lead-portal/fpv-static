import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// FreePropertyValuation source_id in lead_sources table
const FPV_SOURCE_ID = '5e434bf3-db09-4b18-98ee-4aa33dcb1ffe'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function normalizeMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('65') && digits.length === 10) return '+' + digits
  if (digits.length === 8) return '+65' + digits
  return '+65' + digits.slice(-8)
}

// OneMap: postal code → development name + address
async function lookupPostal(postal: string): Promise<{ name: string; address: string } | null> {
  try {
    const res = await fetch(
      `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postal}&returnGeom=N&getAddrDetails=Y`
    )
    const data = await res.json()
    const results = data.results || []
    if (!results.length) return null
    const r = results[0]
    const building = r.BUILDING && r.BUILDING !== 'NIL' ? r.BUILDING : r.ADDRESS
    return { name: building, address: r.ADDRESS }
  } catch { return null }
}

// Mock transactions for when URA key not yet registered
function getMockTransactions(projectName: string) {
  const basePrice = 1200000 + Math.random() * 400000
  return Array.from({ length: 10 }, (_, i) => ({
    project: projectName.toUpperCase(),
    street: 'SAMPLE STREET',
    area: String(80 + Math.floor(Math.random() * 40)),
    floorRange: ['01-05', '06-10', '11-15', '16-20'][i % 4],
    noOfUnits: '1',
    contractDate: `${String(12 - i).padStart(2, '0')}${new Date().getFullYear()}`,
    typeOfSale: i % 3 === 0 ? 'New Sale' : 'Resale',
    price: String(Math.floor(basePrice - i * 15000 + Math.random() * 30000)),
    propertyType: 'Condominium',
    district: '15',
    _isMock: true,
  }))
}

async function fetchURATransactions(projectName: string): Promise<any[]> {
  const accessKey = process.env.URA_ACCESS_KEY
  if (!accessKey || accessKey.startsWith('PLACEHOLDER') || accessKey === 'PENDING_REGISTRATION') {
    return getMockTransactions(projectName)
  }
  try {
    const tokenRes = await fetch(
      `https://eservice.ura.gov.sg/uraDataService/insertNewToken.action?service=PMI_Resi_Transaction`,
      { headers: { AccessKey: accessKey } }
    )
    const tokenData = await tokenRes.json()
    const token = tokenData.Result
    const txRes = await fetch(
      `https://eservice.ura.gov.sg/uraDataService/invokeUraDS?service=PMI_Resi_Transaction&batch=1`,
      { headers: { AccessKey: accessKey, Token: token } }
    )
    const txData = await txRes.json()
    const allTx = txData.Result || []
    const projectUpper = projectName.toUpperCase()
    const filtered = allTx.filter((tx: any) =>
      tx.project?.toUpperCase().includes(projectUpper) ||
      projectUpper.includes(tx.project?.toUpperCase() || '')
    )
    return filtered.slice(0, 15)
  } catch (e) {
    console.error('URA API error:', e)
    return getMockTransactions(projectName)
  }
}

function calculateMetrics(transactions: any[], floorLevel: string) {
  if (!transactions.length) return null
  const prices = transactions.map((t: any) => parseInt(t.price)).filter((p: number) => !isNaN(p) && p > 0)
  if (!prices.length) return null
  const sorted = [...prices].sort((a, b) => a - b)
  const avg = prices.reduce((s: number, p: number) => s + p, 0) / prices.length
  const floorMultiplier = floorLevel.toLowerCase().includes('high') ? 1.08
    : floorLevel.toLowerCase().includes('mid') ? 1.03 : 1.0
  const estimatedValue = Math.round(avg * floorMultiplier)
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    estimatedValue,
    valueLow: Math.round(estimatedValue * 0.95),
    valueHigh: Math.round(estimatedValue * 1.05),
    count: prices.length,
  }
}

function fmtPrice(n: number): string {
  if (n >= 1000000) return `S$${(n / 1000000).toFixed(2)}M`
  return `S$${(n / 1000).toFixed(0)}K`
}

function fmtDate(contractDate: string): string {
  if (!contractDate || contractDate.length < 6) return contractDate
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(contractDate.slice(0, 2)) - 1]} ${contractDate.slice(2)}`
}

async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID!
  const token = process.env.TWILIO_AUTH_TOKEN!
  const from = process.env.TWILIO_WHATSAPP_FROM!
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      },
      body: new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: message }).toString(),
    })
    return res.ok
  } catch { return false }
}

async function sendTelegram(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_FPV_GROUP_ID
  if (!botToken || !chatId) return
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
  }).catch(() => {})
}

function buildReportMessage(
  name: string, development: string, unitType: string, floorLevel: string,
  transactions: any[], metrics: ReturnType<typeof calculateMetrics>, isMock: boolean
): string {
  const recentTx = transactions.slice(0, 8)
  const header = `🏠 *Property Valuation Report*\n*${development.toUpperCase()}*\n_${unitType} · ${floorLevel}_\n\n`
  const valuationSection = metrics
    ? `💰 *Estimated Market Value*\n${fmtPrice(metrics.valueLow)} – ${fmtPrice(metrics.valueHigh)}\n_(Based on ${metrics.count} recent transactions)_\n\n`
    : ''
  const txSection = recentTx.length > 0
    ? `📊 *Recent Transactions*\n` +
      recentTx.map((t: any) => `• ${fmtDate(t.contractDate)} | ${t.floorRange} | ${fmtPrice(parseInt(t.price))} | ${t.area}sqm`).join('\n') + '\n\n'
    : ''
  const disclaimer = isMock
    ? `⚠️ _Note: Using indicative data. Full URA data available shortly._\n\n`
    : `_Source: URA Official Transaction Data_\n\n`
  const cta = `📞 *Want a detailed analysis?*\nOur consultant will call you shortly to walk you through your options.\n\n_SKYS Branch Pte Ltd | Licensed Financial Advisory_`
  return header + valuationSection + txSection + disclaimer + cta
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, mobile, email, postalCode, unitType, floorLevel } = body

    if (!name?.trim() || !mobile?.trim() || !postalCode?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const normalizedMobile = normalizeMobile(mobile)
    const db = getSupabase()
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = req.headers.get('user-agent') || ''

    // 1. OneMap: postal code → development name
    const location = await lookupPostal(postalCode.trim())
    const developmentName = location?.name || `Property at ${postalCode}`

    // 2. URA transactions
    const transactions = await fetchURATransactions(developmentName)
    const isMock = transactions.some((t: any) => t._isMock)

    // 3. Metrics
    const metrics = calculateMetrics(transactions, floorLevel)

    // 4a. Insert into main leads table (shows in admin portal, gets AI scored, assignable)
    const { data: lead, error: leadError } = await db.from('leads').insert({
      source_id: FPV_SOURCE_ID,
      full_name: name.trim(),
      mobile: normalizedMobile,
      email: email?.trim() || null,
      status: 'new',
      product_interest: 'Property',
      lead_score: 'warm',
      lead_score_reason: 'Free Property Valuation request',
      metadata: {
        postal_code: postalCode.trim(),
        unit_type: unitType,
        floor_level: floorLevel,
        development_name: developmentName,
        estimated_value_low: metrics?.valueLow,
        estimated_value_high: metrics?.valueHigh,
        ura_transaction_count: transactions.length,
        is_mock_data: isMock,
        ip_address: ip,
        user_agent: userAgent,
        source: 'fpv-static.vercel.app',
      },
    }).select('id').single()

    if (leadError) console.error('Lead insert error:', leadError)

    // 4b. Also save to fpv_leads for detailed URA data storage
    await db.from('fpv_leads').insert({
      name: name.trim(),
      mobile: normalizedMobile,
      email: email?.trim() || null,
      postal_code: postalCode.trim(),
      unit_type: unitType,
      floor_level: floorLevel,
      development_name: developmentName,
      ura_transactions: transactions,
      metadata: { ip_address: ip, user_agent: userAgent, isMock, lead_id: lead?.id },
    }).then(({ error }) => { if (error) console.error('fpv_leads insert error:', error) })

    // 5. WhatsApp report
    const reportMsg = buildReportMessage(name.trim(), developmentName, unitType, floorLevel, transactions, metrics, isMock)
    const waSent = await sendWhatsApp(normalizedMobile, reportMsg)

    // 6. Update lead with WA status
    if (lead?.id) {
      await db.from('leads').update({
        metadata: {
          postal_code: postalCode.trim(),
          unit_type: unitType,
          floor_level: floorLevel,
          development_name: developmentName,
          estimated_value_low: metrics?.valueLow,
          estimated_value_high: metrics?.valueHigh,
          ura_transaction_count: transactions.length,
          is_mock_data: isMock,
          ip_address: ip,
          user_agent: userAgent,
          source: 'fpv-static.vercel.app',
          wa_report_sent: waSent,
        }
      }).eq('id', lead.id)
    }

    // 7. Telegram alert
    const metricsText = metrics ? `\n💰 Est. value: ${fmtPrice(metrics.valueLow)}–${fmtPrice(metrics.valueHigh)}` : ''
    await sendTelegram(
      `🏠 *New FPV Lead*\n` +
      `👤 ${name.trim()}\n` +
      `📱 ${normalizedMobile}\n` +
      `🏢 ${developmentName}\n` +
      `🏠 ${unitType} · ${floorLevel}${metricsText}\n` +
      `📊 ${transactions.length} tx found${isMock ? ' _(mock)_' : ''}\n` +
      `📲 WA report ${waSent ? '✅ sent' : '❌ failed'}\n` +
      `📍 Postal: ${postalCode}\n` +
      `🔗 skysleads.com/admin/leads`
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('FPV submit error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
