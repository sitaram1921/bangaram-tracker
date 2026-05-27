// ═══════════════════════════════════════════════════════════
// Bangaram Notification Worker
// Runs on a schedule, generates AI messages, sends push
//
// Environment variables (set in Cloudflare Dashboard):
//   CLAUDE_API_KEY  — your Anthropic API key
//   FIREBASE_URL    — https://tracker-bea1e-default-rtdb.firebaseio.com
// ═══════════════════════════════════════════════════════════

const VAPID_PUBLIC_KEY = 'BObYcACVvIRhikD91Vx2um0TiDQm3yQ_nogKP4XtMJ0hNfHMVkNR18hAqxLQeFYFAEhTUh8IQl6-aS3ScpEwjIc';
// VAPID_PRIVATE_KEY is loaded from env (wrangler secret put VAPID_PRIVATE_KEY)

// ── BYTE HELPERS ──────────────────────────────────────────────

function b64url(str) {
  const pad = '='.repeat((4 - str.length % 4) % 4);
  return Uint8Array.from(atob((str + pad).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

function toB64url(bytes) {
  return btoa(Array.from(bytes, c => String.fromCharCode(c)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function concat(...arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let i = 0;
  for (const a of arrays) { out.set(a, i); i += a.length; }
  return out;
}

// ── HKDF ─────────────────────────────────────────────────────

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

// ── WEB PUSH PAYLOAD ENCRYPTION (RFC 8291) ───────────────────

async function encryptPayload(subscription, plaintext) {
  const p256dh = b64url(subscription.keys.p256dh);
  const auth   = b64url(subscription.keys.auth);

  // Ephemeral sender key pair
  const senderKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey));

  // ECDH shared secret with receiver's key
  const receiverKey = await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, senderKeys.privateKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK via HKDF with auth secret
  const prkInfo = concat(new TextEncoder().encode('WebPush: info\0'), p256dh, senderPublic);
  const prk = await hkdf(auth, sharedSecret, prkInfo, 32);

  // Content encryption key + nonce
  const cek   = await hkdf(salt, prk, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, prk, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  // Encrypt plaintext + padding delimiter 0x02
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    concat(new TextEncoder().encode(plaintext), new Uint8Array([2]))
  ));

  // Build aes128gcm content: salt || rs(4) || keyid_len(1) || keyid(65) || ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  return concat(salt, rs, new Uint8Array([senderPublic.length]), senderPublic, ciphertext);
}

// ── VAPID JWT ─────────────────────────────────────────────────

async function createVapidJWT(audience, vapidPrivateKey) {
  const pub = b64url(VAPID_PUBLIC_KEY);
  const x   = toB64url(pub.slice(1, 33));
  const y   = toB64url(pub.slice(33, 65));

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: vapidPrivateKey, x, y },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const enc     = s => toB64url(new TextEncoder().encode(s));
  const header  = enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = enc(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: 'mailto:noreply@habittracker.app',
  }));

  const signing = `${header}.${payload}`;
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signing)
  ));

  return `${signing}.${toB64url(sig)}`;
}

// ── SEND PUSH ─────────────────────────────────────────────────

async function sendPush(subscription, title, body, vapidPrivateKey) {
  const { endpoint } = subscription;
  const audience  = new URL(endpoint).origin;
  const jwt       = await createVapidJWT(audience, vapidPrivateKey);
  const encrypted = await encryptPayload(subscription, JSON.stringify({ title, body }));

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization':    `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      'Content-Type':     'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL':              '86400',
    },
    body: encrypted,
  });

  console.log(`Push → ${res.status} ${res.statusText}`);
  return res.status;
}

// ── CLAUDE API ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You send short push notifications to a girl from her loving boyfriend.
Rules:
- Maximum 2 sentences. Keep it push-notification length.
- Mix English and Telugu naturally.
- Rotate these terms of endearment strictly — use ONLY these, never anything else, never repeat the same one twice in a row: bangaram, chinnamma, chinni thalli, chinni bangaram. Pick whichever fits the tone.
- Feel personal and real — like he actually typed it right now, not a bot.
- Each message must feel unique. Never start the same way twice.
- Return ONLY the message body. No quotes, no labels, nothing else.`;

const USER_PROMPTS = {
  morning:  'Write a warm good morning greeting to start her day with love and energy.',
  lunch:    'Write a sweet lunchtime nudge — remind her to eat well and drink water.',
  water:    'Write a playful, loving reminder to drink water right now.',
  evening:  'Write a warm evening check-in asking how her day went.',
  habits:   'Write a gentle loving reminder to open the habit tracker and log today.',
  sleep:    'Write a sweet goodnight message telling her to rest now.',
  surprise: 'Write a spontaneous "thinking of you" message that feels totally unexpected and heartfelt.',
  dinner:   'Write a sweet nudge that dinner time is 2 hours away — she should start thinking about what to cook or order tonight.',
  winddown: 'It is 10:45 PM. Write a gentle loving message — time to wind down, put the phone down, get ready for bed. The feeling should be like "inka padukovala time avthundi". Keep it tender.',
  sleepnow: 'It is 11 PM. She still has not slept. Write a firm but loving "go to sleep RIGHT NOW" message. The feeling should be like "inka chaalu thalli, padukovali inka". Playfully insistent, not harsh.',
};

const TITLES = {
  morning:  '☀️ Good Morning!',
  lunch:    '🍽️ Lunch Time!',
  water:    '💧 Hey!',
  evening:  '🌆 Evening Check-in',
  habits:   '📋 Quick Reminder',
  sleep:    '🌙 Goodnight',
  surprise: '💕',
  dinner:   '🍛 Dinner in 2 hours!',
  winddown: '😴 Hey!',
  sleepnow: '🌙 Inka Chaalu!',
};

async function generateMessage(type, claudeApiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         claudeApiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: USER_PROMPTS[type] }],
    }),
  });

  const data = await res.json();
  if (!data.content?.[0]?.text) throw new Error('Claude returned no content');
  return data.content[0].text.trim();
}

async function generateMealSuggestions(claudeApiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         claudeApiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: 'Suggest exactly 3 Indian dinner ideas for tonight. Format:\n• Dish name — one sentence description\n• Dish name — one sentence description\n• Dish name — one sentence description\nMix vegetarian and non-vegetarian. Keep it short. Output nothing else.',
      }],
    }),
  });
  const data = await res.json();
  if (!data.content?.[0]?.text) throw new Error('No meal content from Claude');
  return data.content[0].text.trim();
}

// ── FIREBASE READ / WRITE ──────────────────────────────────────

async function getPushSubscription(firebaseUrl) {
  const res = await fetch(`${firebaseUrl}/tracker/pushSubscription.json`);
  if (!res.ok) throw new Error(`Firebase read failed: ${res.status}`);
  return res.json();
}

async function saveMealToFirebase(firebaseUrl, date, suggestions) {
  await fetch(`${firebaseUrl}/tracker/todayMeal.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, suggestions }),
  });
}

// ── SCHEDULE MAP (UTC → message type, IST = UTC+5:30) ─────────
// Adjust these if she's in a different timezone

const SCHEDULE = {
  '2:0':   'morning',   // 7:30 AM IST
  '7:30':  'lunch',     // 1:00 PM IST
  '10:30': 'water',     // 4:00 PM IST
  '12:30': 'dinner',    // 6:00 PM IST — 2 hrs before dinner
  '14:30': 'evening',   // 8:00 PM IST
  '15:30': 'habits',    // 9:00 PM IST
  '17:0':  'sleep',     // 10:30 PM IST
  '17:15': 'winddown',  // 10:45 PM IST — wind down
  '17:30': 'sleepnow',  // 11:00 PM IST — go to sleep now
};

// ── SHARED SEND LOGIC ─────────────────────────────────────────

async function runNotification(type, env) {
  const subscription = await getPushSubscription(env.FIREBASE_URL);
  if (!subscription?.endpoint) throw new Error('No push subscription in Firebase');

  const body   = await generateMessage(type, env.CLAUDE_API_KEY);
  const status = await sendPush(subscription, TITLES[type], body, env.VAPID_PRIVATE_KEY);
  console.log(`Push → ${status}  body: ${body}`);

  if (type === 'dinner') {
    try {
      const meals   = await generateMealSuggestions(env.CLAUDE_API_KEY);
      const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await saveMealToFirebase(env.FIREBASE_URL, istDate, meals);
    } catch (e) {
      console.error('Meal suggestion failed:', e.message);
    }
  }

  return { status, body };
}

// ── CRON HANDLER ──────────────────────────────────────────────

export default {
  async scheduled(event, env, ctx) {
    const d    = new Date(event.scheduledTime);
    const key  = `${d.getUTCHours()}:${d.getUTCMinutes()}`;
    const type = SCHEDULE[key];

    if (!type) { console.log('No message scheduled for', key, '(UTC)'); return; }
    console.log(`Running "${type}" notification at ${key} UTC`);

    try {
      await runNotification(type, env);
    } catch (e) {
      console.error('Notification failed:', e.message);
    }
  },

  // ── HTTP HANDLER (for manual testing) ────────────────────────
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // GET /check — verify secrets and subscription are in place
    if (url.pathname === '/check') {
      try {
        const sub = await getPushSubscription(env.FIREBASE_URL);
        return json({
          hasSubscription: !!sub?.endpoint,
          endpoint:        sub?.endpoint ? sub.endpoint.slice(0, 60) + '…' : null,
          hasClaudeKey:    !!env.CLAUDE_API_KEY,
          hasVapidKey:     !!env.VAPID_PRIVATE_KEY,
          scheduleCount:   Object.keys(SCHEDULE).length,
        });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // GET /test?type=surprise — send a real push right now
    if (url.pathname === '/test') {
      const type = url.searchParams.get('type') || 'surprise';
      if (!TITLES[type]) {
        return json({ error: `Unknown type. Valid: ${Object.keys(TITLES).join(', ')}` }, 400);
      }
      try {
        const result = await runNotification(type, env);
        return json({ ok: true, ...result });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    const types = Object.keys(TITLES).join(', ');
    return new Response(
      `Bangaram Notifications Worker\n\nGET /check          — verify secrets & subscription\nGET /test?type=…    — send push now  (types: ${types})\n`,
      { headers: { 'Content-Type': 'text/plain' } }
    );
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
