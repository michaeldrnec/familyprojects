import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// package.json's "version" is the site's single source of truth for its
// version number (see CLAUDE.md); it's baked into the bundle at build time.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

// Emits /sw.js from src/service-worker.js with the list of every file in
// this build, so the whole site can be cached for offline play.
function serviceWorker(): Plugin {
  return {
    name: 'familyprojects-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const publicDir = new URL('./public', import.meta.url).pathname
      const built = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map'))
      const fromPublic = listFiles(publicDir).map((f) => relative(publicDir, f).split('\\').join('/'))
      const urls = ['/', ...[...built, ...fromPublic].sort().map((f) => `/${f}`)]
      const hash = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 10)
      const template = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf-8')
      const source = template
        .replace("'__CACHE_NAME__'", JSON.stringify(`familyprojects-${version}-${hash}`))
        .replace('__PRECACHE__', JSON.stringify(urls, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})
