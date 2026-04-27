import { NextRequest, NextResponse } from 'next/server'

const SOURCE_ID = '5e434bf3-db09-4b18-98ee-4aa33dcb1ffe'
const FPV_TEMPLATE_SID = 'HXb52435f7e88a4b00d0f674a7da3f6f14'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('65') && digits.length === 10) return `+${digits}`
  if (digits.length === 8 && /^[689]/.test(digits)) return `+65${digits}`
  return `+${digits}`
}

async function supabaseFetch(url: string, key: string, body: Record<string, unknown>) {
  return fetch(`${url}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { postalCode, propertyType, unitType, floorLevel, name, mobile, valuation } = body

    // ── Validate ─────────────────────────────────────────────────────────────
    if (!postalCode || !unitType || !floorLevel || !name || !mobile) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const normalizedPhone = normalizePhone(mobile.trim())

    // ── Save to leads table ───────────────────────────────────────────────────
    const leadRecord = {
      full_name: name.trim(),
      mobile: normalizedPhone,
      source_id: SOURCE_ID,
      status: 'new',
      product_interest: 'Property Valuation',
      lead_score: 'warm',
      lead_score_reason: 'FPV form submission',
      metadata: {
        postal_code: postalCode,
        property_type: propertyType || 'Unknown',
        unit_type: unitType,
        floor_level: floorLevel,
        source: 'fpv',
        ...(valuation ? { valuation } : {}),
      },
    }

    let leadId: string | null = null
    if (supabaseUrl && supabaseKey) {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(leadRecord),
        })
        if (!res.ok) {
          const errText = await res.text()
          console.error('[Submit] leads table error:', res.status, errText)
        } else {
          const rows = await res.json()
          leadId = rows?.[0]?.id || null
          console.log('[Submit] Lead saved:', normalizedPhone, 'id:', leadId)
          fetch(`${supabaseUrl}/rest/v1/lead_sources?id=eq.${SOURCE_ID}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ last_webhook_at: new Date().toISOString() }),
          }).catch(() => {})
        }
      } catch (dbErr) {
        console.error('[Submit] DB error:', dbErr)
      }
    } else {
      console.error('[Submit] Missing Supabase env vars')
    }

    // ── Send WhatsApp ─────────────────────────────────────────────────────────
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromRaw = process.env.TWILIO_WHATSAPP_FROM

    if (accountSid && authToken && fromRaw) {
      try {
        const from = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`
        const to = `whatsapp:${normalizedPhone}`
        const devName = (valuation as Record<string,string>)?.development?.trim() || postalCode
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
          console.log('[WA] Sent to', normalizedPhone, '| SID:', twilioData.sid)
        }
      } catch (waErr) {
        console.error('[WA] Unexpected error:', waErr)
        // Non-blocking — user still gets success
      }
    }

    // ── Telegram notification ─────────────────────────────────────────────
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_FPV_GROUP_ID
    if (botToken && chatId) {
      try {
        const val = valuation as Record<string, string> | null
        const valLine = val?.estimatedLow && !val?.isPrivate
          ? `\n💰 Est\. Value: *${val.estimatedLow} – ${val.estimatedHigh}* \(${val.transactionCount} txns\)`
          : val?.isPrivate ? `\n💰 Private property \(${propertyType}\) \— consultant to advise`
          : ''
        const briefLink = leadId ? `\n📋 [Agent Brief](https://sghomevaluation\.com/brief/${leadId})` : ''
        const devName = val?.development || postalCode
        const text = `🏠 *New FPV Lead*\n👤 ${name.trim()}\n📱 ${normalizedPhone}\n📍 ${devName}\n🏢 ${propertyType || ''} ${unitType} · ${floorLevel}${valLine}${briefLink}`
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2', disable_web_page_preview: false }),
        })
      } catch (tgErr) {
        console.error('[TG] Notify error:', tgErr)
      }
    }

    return NextResponse.json({ success: true, leadId })

  } catch (e) {
    console.error('[Submit] Unexpected error:', e)
    // Even on total failure, tell user success — we'll catch errors in logs
    return NextResponse.json({ success: true })
  }
}
