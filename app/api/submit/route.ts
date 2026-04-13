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
    const { postalCode, unitType, floorLevel, name, mobile, valuation } = body

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
        unit_type: unitType,
        floor_level: floorLevel,
        source: 'fpv',
        ...(valuation ? { valuation } : {}),
      },
    }

    if (supabaseUrl && supabaseKey) {
      try {
        const res = await supabaseFetch(supabaseUrl, supabaseKey, leadRecord)
        if (!res.ok) {
          const errText = await res.text()
          console.error('[Submit] leads table error:', res.status, errText)
        } else {
          console.log('[Submit] Lead saved:', normalizedPhone)
          // Update last_webhook_at so System Status shows source as active
          fetch(`${supabaseUrl}/rest/v1/lead_sources?id=eq.${SOURCE_ID}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ last_webhook_at: new Date().toISOString() }),
          }).catch(() => {})
        }
      } catch (dbErr) {
        console.error('[Submit] DB error:', dbErr)
        // Still continue to send WA — don't block user
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
        const text = `🏠 *New FPV Lead*\n👤 ${name.trim()}\n📱 ${normalizedPhone}\n📍 Postal: ${postalCode}\n🏢 ${unitType} · ${floorLevel}\n🔗 via fpv-static.vercel.app`
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
        })
      } catch (tgErr) {
        console.error('[TG] Notify error:', tgErr)
      }
    }

    // Always return success to user — backend errors are internal
    return NextResponse.json({ success: true })

  } catch (e) {
    console.error('[Submit] Unexpected error:', e)
    // Even on total failure, tell user success — we'll catch errors in logs
    return NextResponse.json({ success: true })
  }
}
