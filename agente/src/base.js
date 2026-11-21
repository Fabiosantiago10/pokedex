// Onde a base fica: pokemons.json no GitHub (o Render atualiza o site sozinho a cada commit)
// e uma cópia em agente/dados/pokemons.json no PC.
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.js'
import { chave, mesclar } from './juntar.js'

const arquivoLocal = () => path.join(config.pastaDados, 'pokemons.json')

async function lerLocal() {
  try {
    return JSON.parse(await fs.readFile(arquivoLocal(), 'utf8'))
  } catch {
    return []
  }
}

async function gravarLocal(lista) {
  await fs.mkdir(config.pastaDados, { recursive: true })
  await fs.writeFile(arquivoLocal(), JSON.stringify(lista, null, 2) + '\n')
}

function urlGithub() {
  return `https://api.github.com/repos/${config.githubRepo}/contents/${config.githubArquivo}`
}

const cabecalhos = () => ({
  Authorization: `Bearer ${config.githubToken}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'pokedex-agente'
})

async function lerGithub() {
  const r = await fetch(`${urlGithub()}?ref=${encodeURIComponent(config.githubBranch)}`, { headers: cabecalhos() })
  if (r.status === 404) return { lista: [], sha: undefined }
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} ao ler ${config.githubArquivo}`)
  const dados = await r.json()
  return { lista: JSON.parse(Buffer.from(dados.content, 'base64').toString('utf8')), sha: dados.sha }
}

async function gravarGithub(lista, sha, mensagem) {
  const r = await fetch(urlGithub(), {
    method: 'PUT',
    headers: { ...cabecalhos(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: mensagem,
      content: Buffer.from(JSON.stringify(lista, null, 2) + '\n').toString('base64'),
      branch: config.githubBranch,
      ...(sha ? { sha } : {})
    })
  })
  return r
}

export async function carregarBase() {
  if (config.soLocal) return lerLocal()
  const { lista } = await lerGithub()
  await gravarLocal(lista)
  return lista
}

// Insere ou atualiza (mesma espécie + natureza + IVs = mesmo Pokémon)
export function inserirOuAtualizar(lista, pokemon) {
  const i = lista.findIndex(p => chave(p) === chave(pokemon))
  if (i === -1) {
    lista.push(pokemon)
    return 'novo'
  }
  const { capturadoEm, avaliacao, ...novos } = pokemon
  lista[i] = mesclar(lista[i], novos)
  if (avaliacao && !lista[i].avaliacao) lista[i].avaliacao = avaliacao
  lista[i].atualizadoEm = new Date().toISOString()
  return 'atualizado'
}

export async function salvarPokemon(pokemon) {
  if (config.soLocal) {
    const lista = await lerLocal()
    const acao = inserirOuAtualizar(lista, pokemon)
    await gravarLocal(lista)
    return acao
  }
  // Tenta de novo se o arquivo mudou no meio do caminho (ex.: você editou pelo site/GitHub)
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const { lista, sha } = await lerGithub()
    const acao = inserirOuAtualizar(lista, pokemon)
    const r = await gravarGithub(lista, sha, `Pokédex: ${acao === 'novo' ? 'adiciona' : 'atualiza'} ${pokemon.nome} (IVs ${pokemon.ivs.total})`)
    if (r.ok) {
      await gravarLocal(lista)
      return acao
    }
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub respondeu ${r.status} ao salvar: ${await r.text()}`)
  }
  throw new Error('Não consegui salvar no GitHub depois de 3 tentativas')
}
