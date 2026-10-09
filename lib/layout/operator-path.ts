/** The operator dashboards (/admin, /superadmin) bring their own dark shell and
 * deliberately show none of the betting-site chrome or player-facing overlays.
 *
 * Shared rather than re-written per component because the root layout can only
 * ADD UI — a pathname check is the one lever for stripping it — and there is
 * now more than one thing that needs stripping. components/layout/site-chrome.tsx
 * strips header/footer/nav/betslip for its own children; the win-celebration
 * modal is mounted as a SIBLING of SiteChrome (app/layout.tsx), so it never saw
 * that suppression and had to opt out separately. Two copies of the same
 * expression is exactly how one of them ends up out of date, so both call this.
 *
 * Note both dashboards live under plain URL prefixes — /admin's `(dashboard)`
 * route group contributes no path segment — so prefix matching is complete.
 */
export function isOperatorPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/superadmin");
}
