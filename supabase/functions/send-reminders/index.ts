// Supabase Edge Function: the server half of real Web Push reminders.
// Invoked once a minute by pg_cron (see supabase/push_schema.sql) — a closed
// browser tab runs no JavaScript, so this is the only place that can ever
// decide "it's time to remind someone" for a fully-closed app.
//
// Deploy: supabase functions deploy send-reminders
// Secrets (set via `supabase secrets set` or the dashboard):
//   SUPABASE_URL               - your project URL (usually already set)
//   SUPABASE_SERVICE_ROLE_KEY  - Project Settings -> API -> service_role key
//   VAPID_PUBLIC_KEY           - from `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY          - from the same command; never in client code
//
// This function only ever touches signed-in Sync accounts' own rows (tasks,
// push_subscriptions) via the service_role key, which is exactly why that
// key must never leave Supabase's secret store — see push_schema.sql's
// Vault-based scheduling setup for how the cron job authenticates without
// the key ever appearing in a committed file.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''

webpush.setVapidDetails('mailto:support@auratask.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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

Deno.serve(async () => {
  const { data: subscriptions, error: subError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, user_id, p256dh, auth, timezone')

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
          JSON.stringify({ title: 'Aura Task', body }),
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
