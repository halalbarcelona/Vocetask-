// Supabase Edge Function: verifies a Stripe webhook and marks the matching
// app account premium. This is the only place that ever writes to the
// premium_status table — it uses the service_role key, which bypasses RLS,
// so the browser's public anon key can never write premium status itself.
//
// Deploy: supabase functions deploy stripe-webhook
// Secrets (set via `supabase secrets set` or the dashboard):
//   STRIPE_WEBHOOK_SECRET   - from the Stripe webhook endpoint's settings
//   SUPABASE_URL            - your project URL (usually already set by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY - Project Settings -> API -> service_role key
// Stripe dashboard: point the webhook at this function's URL, subscribed to
// the "checkout.session.completed" event only.

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const stripe = new Stripe('', { apiVersion: '2023-10-16' })
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? '', STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Signature verification failed', err)
    return new Response('Invalid signature', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const email = session.client_reference_id

    if (!email) {
      console.error('checkout.session.completed with no client_reference_id')
      return new Response('Missing client_reference_id', { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('premium_status')
      .upsert({ email, is_premium: true, updated_at: new Date().toISOString() })

    if (error) {
      console.error('Failed to upsert premium_status', error)
      return new Response('Database error', { status: 500 })
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
