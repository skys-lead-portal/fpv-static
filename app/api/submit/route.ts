import { NextRequest, NextResponse } from 'next/server'

const SOURCE_ID = '5e434bf3-db09-4b18-98ee-4aa33dcb1ffe'
// Approved Meta template: skys_property_valuation_v1
// {{1}} = lead name, {{2}} = development name (or postal code fallback)
const FPV_TEMPLATE_SID = 'HXb52435f7e88a4b00d0f674a7da3f6f14'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('65') && digits.length === 10) return `+${digits}`
  if (digits.length === 8 && /^[689]/.test(digits)) return `+65${digits}`
  return `+${digits}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { postalCode, unitType, floorLevel, name, mobile, valuation } = body

    // Validate required fields
    if (!postalCode || !unitType || !floorLevel || !name || !mobile) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Submit] Missing Supabase env vars')
      return NextResponse.json({ success: true })
    }

    // ── Save lead to Supabase ──────────────────────────────────────────────
    const record: Record<string, unknown> = {
      name: name.trim(),
      phone: mobile.trim(),
      postal_code: postalCode,
      unit_type: unitType,
      floor_level: floorLevel,
      source: 'fpv',
      source_id: SOURCE_ID,
    }

    if (valuation) {
      record.valuation_json = JSON.stringify(valuation)
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/mortgage_leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(record),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[Submit] Supabase error:', res.status, errText)
    }

    // ── Send WhatsApp via approved template ────────────────────────────────
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromRaw = process.env.TWILIO_WHATSAPP_FROM

    if (accountSid && authToken && fromRaw) {
      try {
        const normalizedPhone = normalizePhone(mobile.trim())
        const from = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`
        const to = `whatsapp:${normalizedPhone}`

        // {{1}} = lead name, {{2}} = development name or postal code
        const devName = valuation?.development?.trim() || postalCode
        const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: from,
              To: to,
              ContentSid: FPV_TEMPLATE_SID,
              ContentVariables: JSON.stringify({ '1': name.trim(), '2': devName }),
            }),
          }
        )

        const twilioData = await twilioRes.json()
        if (!twilioRes.ok) {
          console.error('[WA] Twilio error:', twilioData.code, twilioData.message)
        } else {
          console.log('[WA] Sent FPV template to', normalizedPhone, '| SID:', twilioData.sid)
        }
      } catch (waErr) {
        console.error('[WA] Unexpected error:', waErr)
        // Non-blocking — lead is already saved
      }
    } else {
      console.warn('[WA] Missing Twilio env vars — skipping WhatsApp send')
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[Submit] Unexpected error:', e)
    return NextResponse.json({ success: true }) // graceful degradation
  }
}
