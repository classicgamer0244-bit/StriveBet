/**
 * Guards the /api/cron/* routes, which trigger settlement, simulation ticks and
 * deposit sweeps — i.e. they move real money and must never be world-callable.
 *
 * Fails CLOSED in production: an unset CRON_SECRET there is treated as
 * misconfiguration and every request is rejected, rather than silently leaving
 * the routes open to anyone who guesses the path. Outside production it stays
 * open so local development and tests need no setup.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
