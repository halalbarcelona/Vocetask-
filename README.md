# Review Agent

An AI agent that handles your business reviews: it reads each new review, drafts a reply in your voice, flags the risky ones for a human, and (optionally) auto-replies to happy customers.

## Run it

```bash
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY for real AI replies
export $(grep -v '^#' .env | xargs)
npm start              # http://localhost:3000
npm test
```

No API key? It runs in **demo mode** with rule-based replies so you can try the flow.

## How it works

1. A review arrives (UI form, or `POST /api/reviews` with `{platform, author, rating, text}`; set `INGEST_TOKEN` to require a bearer token).
2. Claude returns structured JSON: sentiment, topics, urgency, whether a human is needed, and a draft reply (`src/agent.js`).
3. Routing (`decideStatus`):
   - **Needs you**: legal/health/refund/discrimination, model failure, or refusal. Never auto-published.
   - **Ready to approve**: a draft waits for one click.
   - **Autopilot** (toggle): only 4-5★ positive, low-risk reviews publish themselves.
4. Approving publishes through `src/platforms.js`.

## Going live

Publishing is **simulated** by default. Google, Yelp and TripAdvisor each need their own API access/OAuth. Add an adapter in `src/platforms.js` (e.g. Google Business Profile `reviews.updateReply`) and a poller or webhook to feed `POST /api/reviews`.

Review text is passed to the model as untrusted data, and a keyword safety net escalates sensitive reviews even if the model misses them.
