/**
 * Inspect Mode policy helper.
 *
 * Determines whether a long-press on a surface should show the inspect popup
 * rather than fall through to the surface's default onLongPress behavior.
 *
 * Rules:
 * - Inspect Mode must be enabled in settings.
 * - Help popups must be enabled in settings.
 * - The surface must supply inspect metadata (title + body).
 * If any condition fails, the existing onLongPress handler runs as normal.
 */
export function shouldUseInspectMode(opts: {
  inspectModeEnabled: boolean;
  helpPopupsEnabled: boolean;
  hasInspectInfo: boolean;
}): boolean {
  return opts.inspectModeEnabled && opts.helpPopupsEnabled && opts.hasInspectInfo;
}
