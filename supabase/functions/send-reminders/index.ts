// Supabase Edge Function: the server half of real Web Push reminders.
// Invoked once a minute by pg_cron (see supabase/push_schema.sql) — a closed
// browser tab runs no JavaScript, so this is the only place that can ever
// decide "it's time to remind someone" for a fully-closed app.
//
// Deploy: supabase functions deploy send-reminders --no-verify-jwt
//
// Secrets live in Supabase Vault, not as function env vars — this function
// reads them itself via its own service_role client at request time, through
// the public.get_vault_secret() RPC (see push_schema.sql). The vault schema
// is not exposed over PostgREST (a deliberate Supabase security boundary,
// same as never exposing the raw service_role key), so a direct
// `.schema('vault')` query 500s — a SECURITY DEFINER function scoped to
// service_role is the sanctioned way through it.
//   vapid_public_key     - from `npx web-push generate-vapid-keys`
//   vapid_private_key    - from the same command; never in client code
//   cron_shared_secret   - a random string only this project's database and
//                          this function ever see
//
// --no-verify-jwt is deliberate, not an oversight: this endpoint is called
// by pg_cron/pg_net, which has no Supabase user session to hand it a JWT.
// In its place, every request must present the same cron_shared_secret in
// an X-Cron-Secret header (see push_schema.sql's cron.schedule call) —
// checked below before anything else runs. Anyone who doesn't know that
// secret gets a 401 with no further work done.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function getSecret(name: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('get_vault_secret', { secret_name: name })
  if (error || !data) throw new Error(`Missing vault secret: ${name}`)
  return data as string
}

// --- recurrence + due-date logic, ported from src/utils/recurrence.js -------
// Kept as a plain port (not shared source) because the client bundles for
// the browser and this function bundles for Deno; duplicating ~15 lines of
// pure logic is far simpler than wiring up a shared build step for it.

function isDueOn(task: any, dateISO: string): boolean {
  if (!task.date || task.date > dateISO) return false
  if (!task.recurrence || task.recurrence === 'none') return task.date === dateISO
  const d = new Date(`${dateISO}T00:00:00`)
  if (task.recurrence === 'daily') return true
  if (task.recurrence === 'weekly') {
    return new Date(`${task.date}T00:00:00`).getDay() === d.getDay()
  }
  if (task.recurrence === 'monthly') {
    return new Date(`${task.date}T00:00:00`).getDate() === d.getDate()
  }
  if (task.recurrence === 'custom') {
    const days: number[] = task.recurrence_days ?? []
    return days.includes(d.getDay())
  }
  return task.date === dateISO
}

function isAlreadyDone(task: any, todayISO: string): boolean {
  return task.recurrence && task.recurrence !== 'none'
    ? (task.completed_dates ?? []).includes(todayISO)
    : task.done
}

// "Now" expressed as this task owner's own local wall-clock time, since a
// reminder set for "9:00" means 9am wherever the person actually is, not
// 9am UTC. Intl does the DST-aware offset math so this doesn't have to.
function localParts(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const dateISO = `${get('year')}-${get('month')}-${get('day')}`
  const minutesOfDay = Number(get('hour')) * 60 + Number(get('minute'))
  return { dateISO, minutesOfDay }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Quiet hours (Premium): a window during which reminders go silent instead
// of firing. The window can wrap past midnight (e.g. 22:00–07:00), which is
// exactly the common case, so this can't just be a plain min<=x<max compare.
function isWithinQuietHours(minutesOfDay: number, quietStart: string | null, quietEnd: string | null): boolean {
  if (!quietStart || !quietEnd) return false
  const start = timeToMinutes(quietStart)
  const end = timeToMinutes(quietEnd)
  if (start === end) return false
  return start < end ? minutesOfDay >= start && minutesOfDay < end : minutesOfDay >= start || minutesOfDay < end
}

Deno.serve(async (req: Request) => {
  const expectedSecret = await getSecret('cron_shared_secret')
  if (req.headers.get('x-cron-secret') !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const [vapidPublicKey, vapidPrivateKey] = await Promise.all([
    getSecret('vapid_public_key'),
    getSecret('vapid_private_key'),
  ])
  webpush.setVapidDetails('mailto:support@auratask.app', vapidPublicKey, vapidPrivateKey)

  const { data: subscriptions, error: subError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, user_id, p256dh, auth, timezone, quiet_start, quiet_end')

  if (subError) {
    console.error('Failed to load push_subscriptions', subError)
    return new Response('Database error', { status: 500 })
  }
  if (!subscriptions || subscriptions.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })
  }

  const userIds = [...new Set(subscriptions.map((s) => s.user_id))]
  const { data: tasks, error: tasksError } = await supabaseAdmin
    .from('tasks')
    .select('id, user_id, title, date, time, done, recurrence, recurrence_days, completed_dates, reminder_lead_minutes')
    .in('user_id', userIds)
    .not('time', 'eq', '')

  if (tasksError) {
    console.error('Failed to load tasks', tasksError)
    return new Response('Database error', { status: 500 })
  }

  const tasksByUser = new Map<string, any[]>()
  for (const task of tasks ?? []) {
    if (!tasksByUser.has(task.user_id)) tasksByUser.set(task.user_id, [])
    tasksByUser.get(task.user_id)!.push(task)
  }

  let sent = 0

  for (const sub of subscriptions) {
    const userTasks = tasksByUser.get(sub.user_id) ?? []
    if (userTasks.length === 0) continue

    const { dateISO, minutesOfDay } = localParts(sub.timezone || 'UTC')

    if (isWithinQuietHours(minutesOfDay, sub.quiet_start, sub.quiet_end)) continue

    // Resolved once per subscription (not per task) — Premium unlocks
    // action buttons ("Mark done" / "Snooze 10m") on the notification
    // itself, decided here since the client has no say over what a push
    // payload contains once it leaves the server.
    let isPremium = false
    try {
      const { data: userResp } = await supabaseAdmin.auth.admin.getUserById(sub.user_id)
      const email = userResp?.user?.email
      if (email) {
        const { data: premiumData } = await supabaseAdmin.rpc('check_premium_status', { check_email: email })
        isPremium = Boolean(premiumData)
      }
    } catch (err) {
      console.error('Premium lookup failed, defaulting to free', err)
    }

    for (const task of userTasks) {
      if (!isDueOn(task, dateISO) || isAlreadyDone(task, dateISO)) continue

      const targetMinutes = timeToMinutes(task.time) - (task.reminder_lead_minutes ?? 0)
      // The cron fires once a minute, so "due" means the target fell inside
      // the minute that just ran — not a range, to avoid re-firing all
      // through the day for a task whose time already passed.
      if (targetMinutes !== minutesOfDay) continue

      const { error: logError } = await supabaseAdmin
        .from('reminder_log')
        .insert({ task_id: task.id, occurrence_date: dateISO })

      // A unique-violation here means another invocation already sent this
      // exact reminder — expected under retries, not a real failure.
      if (logError) {
        if (logError.code !== '23505') console.error('Failed to write reminder_log', logError)
        continue
      }

      const body = task.reminder_lead_minutes
        ? `${task.title || 'Task'} — in ${task.reminder_lead_minutes} min`
        : task.title || 'You have a task due now'

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: 'Aura Task', body, taskId: task.id, premium: isPremium }),
        )
        sent += 1
      } catch (err: any) {
        // 404/410 means the browser has unsubscribed (uninstalled, cleared
        // data, etc.) — the endpoint is dead for good, so stop trying it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        } else {
          console.error('Push send failed', sub.endpoint, err)
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
