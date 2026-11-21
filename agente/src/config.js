import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const num = (v, padrao) => (v === undefined || v === '' ? padrao : Number(v))

export const config = {
  raiz,
  pastaDados: path.join(raiz, 'dados'),
  pastaCapturas: path.join(raiz, 'dados', 'capturas'),
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  githubToken: process.env.GITHUB_TOKEN,
  githubRepo: process.env.GITHUB_REPO || 'Fabiosantiago10/pokedex',
  githubBranch: process.env.GITHUB_BRANCH || 'main',
  githubArquivo: process.env.GITHUB_ARQUIVO || 'pokemons.json',
  modeloClassificar: process.env.MODELO_CLASSIFICAR || 'claude-haiku-5-5',
  modeloLer: process.env.MODELO_LER || 'claude-sonnet-5-5',
  monitor: process.env.MONITOR || undefined,
  intervaloMs: num(process.env.INTERVALO_MS, 1500),
  telaParadaMs: num(process.env.TELA_PARADA_MS, 1200),
  finalizarMs: num(process.env.FINALIZAR_MS, 25000),
  soLocal: String(process.env.SO_LOCAL).toLowerCase() === 'true'
}

export function exigir(...chaves) {
  const faltando = chaves.filter(c => !config[c])
  if (faltando.length) {
    const nomes = { anthropicKey: 'ANTHROPIC_API_KEY', githubToken: 'GITHUB_TOKEN' }
    console.error(`Faltando no .env: ${faltando.map(c => nomes[c] || c).join(', ')}`)
    process.exit(1)
  }
}
