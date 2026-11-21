// Monta um time com builds usando só os Pokémon da base.
// Uso: npm run time -- "Elite 4 de Sinnoh"
import fs from 'node:fs/promises'
import path from 'node:path'
import { config, exigir } from './config.js'
import { carregarBase } from './base.js'
import { sugerirTime } from './claude.js'

exigir('anthropicKey')
const objetivo = process.argv.slice(2).join(' ') || 'time equilibrado para zerar a região e a Elite 4'
const base = await carregarBase()
if (!base.length) {
  console.log('A base está vazia. Cadastre alguns Pokémon primeiro.')
  process.exit(0)
}
console.log(`Montando time com ${base.length} Pokémon da base para: ${objetivo}\n`)
const texto = await sugerirTime(base, objetivo)
console.log(texto)
await fs.mkdir(config.pastaDados, { recursive: true })
const arquivo = path.join(config.pastaDados, 'time-sugerido.md')
await fs.writeFile(arquivo, `# Time sugerido — ${objetivo}\n\n${texto}\n`)
console.log(`\nSalvo em ${arquivo}`)
