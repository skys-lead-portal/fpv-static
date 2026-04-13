import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Twilio sends button responses as POST with URL-encoded form data
// ButtonPayload will be one of: "sounds_good" | "have_question"

function validateTwilioSignature(req: NextRequest, body: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false

  const url = process.env.FPV_WEBHOOK_URL // e.g. https://fpv-static.vercel.app/api/whatsapp-webhook
  if (!url) {
    console.warn('[Webhook] FPV_WEBHOOK_URL not set — skipping signature validation')
    return true // allow in dev
  }

  const signature = req.headers.get('x-twilio-signature') || ''
  const params: Record<string, string> = {}
  new URLSearchParams(body).forEach((v, k) => { params[k] = v })

  // Twilio signature: HMAC-SHA1 of url + sorted params
  const sortedKeys = Object.keys(params).sort()
  let sigStr = url
  for (const key of sortedKeys) sigStr += key + params[key]

  const expected = crypto.createHmac('sha1', authToken).update(sigStr).digest('base64')
  return expected === signature
}

async function notifySkysOps(message: string) {
  // Post to SKYS Ops Telegram group
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.SKYS_OPS_CHAT_ID || '-5230812753'
  if (!botToken) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  }).catch(e => console.error('[Webhook] Telegram notify failed:', e))
}

async function updateLeadInSupabase(phone: string, buttonId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return

  // Normalize phone for lookup (strip whatsapp: prefix and country code variants)
  const normalized = phone.replace('whatsapp:', '').replace(/^\+65/, '')

  // Update the most recent FPV lead with this phone number
  const patchRes = await fetch(
    `${supabaseUrl}/rest/v1/mortgage_leads?phone=ilike.*${normalized}*&source=eq.fpv&order=created_at.desc&limit=1`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ wa_button_response: buttonId, wa_response_at: new Date().toISOString() }),
    }
  )

  if (!patchRes.ok) {
    const err = await patchRes.text()
    console.error('[Webhook] Supabase patch error:', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Validate Twilio signature
    if (!validateTwilioSignature(req, rawBody)) {
      console.warn('[Webhook] Invalid Twilio signature — rejecting')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const params = new URLSearchParams(rawBody)
    const from = params.get('From') || ''           // e.g. whatsapp:+6591234567
    const buttonPayload = params.get('ButtonPayload') || params.get('Body') || ''
    const profileName = params.get('ProfileName') || 'Lead'

    console.log('[Webhook] Received from:', from, '| button:', buttonPayload)

    // Normalize phone for display
    const phoneDisplay = from.replace('whatsapp:', '')

    if (buttonPayload === 'sounds_good') {
      // Lead confirmed interest
      await Promise.all([
        updateLeadInSupabase(from, 'sounds_good'),
        notifySkysOps(
          `✅ <b>FPV Lead Confirmed Interest</b>\n\n` +
          `👤 ${profileName}\n` +
          `📱 ${phoneDisplay}\n\n` +
          `They tapped <b>"Sounds Good"</b> on the property valuation message.\n` +
          `<i>Follow up within 1 business day.</i>`
        ),
      ])
    } else if (buttonPayload === 'have_question') {
      // Lead has a question — flag for agent follow-up
      await Promise.all([
        updateLeadInSupabase(from, 'have_question'),
        notifySkysOps(
          `❓ <b>FPV Lead Has a Question</b>\n\n` +
          `👤 ${profileName}\n` +
          `📱 ${phoneDisplay}\n\n` +
          `They tapped <b>"I Have a Question"</b> on the property valuation message.\n` +
          `<i>Reach out now to answer their query.</i>`
        ),
      ])
    } else {
      // Free-text reply or unknown button
      console.log('[Webhook] Non-button reply from', from, ':', buttonPayload)
      await notifySkysOps(
        `💬 <b>FPV Lead Replied</b>\n\n` +
        `👤 ${profileName}\n` +
        `📱 ${phoneDisplay}\n\n` +
        `Message: ${buttonPayload || '(empty)'}`
      )
    }

    // Twilio expects 200 + empty TwiML (or plain 200)
    return new NextResponse('<Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (e) {
    console.error('[Webhook] Unexpected error:', e)
    return new NextResponse('<Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
