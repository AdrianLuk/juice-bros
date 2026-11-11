/**
 * Mic Drop's paths. Free of Next.js imports so a test can load it directly.
 * The tool is unlisted (spec #666): nothing on the Tools page links here.
 */

export const MIC_DROP_ROOT = "/tools/mic-drop";

/** A Poll's Guest Link. The token is all a Guest needs. */
export function guestLinkPath(token: string): string {
  return `${MIC_DROP_ROOT}/vote/${token}`;
}
