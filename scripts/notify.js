// Bangaram notification sender — runs via GitHub Actions cron
// Uses the web-push npm package (handles VAPID/encryption automatically)

const webpush = require('web-push');

const SCHEDULE = {
  '2:0':   'morning',
  '7:30':  'lunch',
  '10:30': 'water',
  '12:30': 'dinner',
  '14:30': 'evening',
  '15:30': 'habits',
  '17:0':  'sleep',
  '17:15': 'winddown',
  '17:30': 'sleepnow',
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

const SYSTEM_PROMPT = `You send short push notifications to a girl from her loving boyfriend.
Rules:
- Maximum 2 sentences. Keep it push-notification length.
- Mix English and Telugu naturally.
- Rotate these terms of endearment strictly — use ONLY these, never anything else, never repeat the same one twice in a row: bangaram, chinnamma, chinni thalli, chinni bangaram. Pick whichever fits the tone.
- Feel personal and real — like he actually typed it right now, not a bot.
- Each message must feel unique. Never start the same way twice.
- Return ONLY the message body. No quotes, no labels, nothing else.`;

async function generateMessage(type) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.CLAUDE_API_KEY,
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
  if (!data.content?.[0]?.text) throw new Error(`Claude error: ${JSON.stringify(data)}`);
  return data.content[0].text.trim();
}

async function generateMealSuggestions() {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages:   [{
        role:    'user',
        content: 'Suggest exactly 3 Indian dinner ideas for tonight. Format:\n• Dish name — one sentence description\n• Dish name — one sentence description\n• Dish name — one sentence description\nMix vegetarian and non-vegetarian. Keep it short. Output nothing else.',
      }],
    }),
  });
  const data = await res.json();
  if (!data.content?.[0]?.text) throw new Error('No meal content from Claude');
  return data.content[0].text.trim();
}

async function getPushSubscription() {
  const res = await fetch(`${process.env.FIREBASE_URL}/tracker/pushSubscription.json`);
  if (!res.ok) throw new Error(`Firebase read failed: ${res.status}`);
  return res.json();
}

async function saveMealToFirebase(date, suggestions) {
  await fetch(`${process.env.FIREBASE_URL}/tracker/todayMeal.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, suggestions }),
  });
}

async function main() {
  // Determine which notification type to send
  let type = process.env.NOTIFICATION_TYPE || '';

  if (!type) {
    const d   = new Date();
    const key = `${d.getUTCHours()}:${d.getUTCMinutes()}`;
    type = SCHEDULE[key];
    if (!type) {
      console.log('No notification scheduled for', key, 'UTC — exiting');
      return;
    }
  }

  if (!TITLES[type]) {
    console.error('Unknown notification type:', type);
    process.exit(1);
  }

  console.log(`Sending "${type}" notification`);

  webpush.setVapidDetails(
    'mailto:noreply@habittracker.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const subscription = await getPushSubscription();
  if (!subscription?.endpoint) {
    console.error('No push subscription found in Firebase');
    process.exit(1);
  }

  const body = await generateMessage(type);
  console.log('Message:', body);

  try {
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: TITLES[type], body })
    );
    console.log('Push sent — status:', result.statusCode);
  } catch (e) {
    console.error('Push failed:', e.statusCode, e.body);
    throw e;
  }

  if (type === 'dinner') {
    try {
      const meals   = await generateMealSuggestions();
      const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await saveMealToFirebase(istDate, meals);
      console.log('Meal suggestions saved');
    } catch (e) {
      console.error('Meal suggestion failed:', e.message);
    }
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
