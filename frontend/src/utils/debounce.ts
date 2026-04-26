/**
 * Tiny debounce utility.
 *
 * WHY:
 * Search endpoints should not be called on every keystroke. Debouncing keeps
 * the UI responsive and protects the backend from unnecessary requests.
 */

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void | Promise<void>,
  delayMs: number,
) {
  let timeout: number | undefined;

  return (...args: Args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      void fn(...args);
    }, delayMs);
  };
}
