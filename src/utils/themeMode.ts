export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

let schemeWatching = false
const lightScheme = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-color-scheme: light)')
  : null

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference
  return lightScheme?.matches ? 'light' : 'dark'
}

/**
 * Writes the *resolved* mode to `data-theme` and the stored choice to
 * `data-theme-preference`. Nothing else may read the device scheme: every
 * `:root[data-theme="light"]` and `[data-theme="dark"][data-accent=…]` rule in
 * the stylesheets depends on this attribute being light or dark, never system.
 * The stored preference comes from localStorage, so anything unrecognised falls back to device.
 */
export function applyTheme(preference: ThemePreference | string) {
  const choice: ThemePreference = preference === 'light' || preference === 'dark' ? preference : 'system'
  document.documentElement.dataset.theme = resolveTheme(choice)
  document.documentElement.dataset.themePreference = choice
  if (!lightScheme || schemeWatching) return
  schemeWatching = true
  lightScheme.addEventListener('change', () => {
    if ((document.documentElement.dataset.themePreference ?? 'system') === 'system') applyTheme('system')
  })
}
