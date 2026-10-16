// Direct localStorage access that never throws: private browsing, disabled
// storage or a full quota just mean nothing gets saved. Not profile-scoped --
// game code should use storage.ts instead.

export function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeRaw(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage disabled or full -- nothing to do but carry on unsaved.
  }
}

export function removeRaw(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function allKeys(): string[] {
  try {
    return Object.keys(window.localStorage)
  } catch {
    return []
  }
}
