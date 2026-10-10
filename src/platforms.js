// Publishing adapter. Google/Yelp/TripAdvisor each need their own OAuth app and
// partner approval, so the default adapter records the reply locally. To go live,
// implement `publishReply` for a platform (e.g. Google Business Profile API's
// accounts.locations.reviews.updateReply) and register it below.
const adapters = {};

export async function publishReply(review, reply) {
  const adapter = adapters[review.platform];
  if (adapter) return adapter(review, reply);
  return { published: true, mode: "simulated", at: new Date().toISOString() };
}
