// Do Pokémon lido na tela até a base: compara, avalia, salva e avisa.
import { avaliarPokemon } from './claude.js'
import { carregarBase, salvarPokemon } from './base.js'
import { comparar } from './comparar.js'
import { chave, ivsCompletos, normalizar } from './juntar.js'
import { notificar } from './notificar.js'

const NOMES = { hp: 'HP', ataque: 'Atk', defesa: 'Def', atqEsp: 'SpA', defEsp: 'SpD', velocidade: 'Spe' }

export function textoBuild(a) {
  const evs = Object.entries(a.evsSugeridos || {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${NOMES[k] || k}`).join(' / ')
  return `${a.naturezaIdeal}${evs ? ` · ${evs}` : ''}${a.golpesSugeridos?.length ? ` · ${a.golpesSugeridos.join(', ')}` : ''}${a.item ? ` · ${a.item}` : ''}`
}

export async function processarPokemon(bruto, { salvar = true } = {}) {
  if (!bruto?.nome) return null
  if (!ivsCompletos(bruto)) {
    notificar('Faltam os IVs', `Vi o resumo do ${bruto.nome}, mas não os IVs. Abra a aba de IVs dele para eu avaliar.`)
    return null
  }

  const pokemon = normalizar(bruto)
  const base = await carregarBase()
  const jaExiste = base.find(p => chave(p) === chave(pokemon))

  // Mesmo Pokémon visto de novo: só atualiza (nível, EVs, golpes), sem gastar uma nova avaliação
  if (jaExiste?.avaliacao) {
    if (salvar) await salvarPokemon(pokemon)
    console.log(`${pokemon.nome} já está na base; dados atualizados.`)
    return { pokemon: { ...jaExiste, ...pokemon, avaliacao: jaExiste.avaliacao }, acao: 'atualizado' }
  }

  const comparacao = comparar(pokemon, base)
  const avaliacao = await avaliarPokemon(pokemon, comparacao)
  pokemon.avaliacao = { ...avaliacao, comparacao: comparacao.texto, avaliadoEm: new Date().toISOString() }
  pokemon.capturadoEm = new Date().toISOString()

  const acao = salvar ? await salvarPokemon(pokemon) : 'não salvo (teste)'
  notificar(
    `${pokemon.nome} ${pokemon.natureza} — nota ${avaliacao.nota}/10`,
    `${comparacao.texto} ${avaliacao.valeTreinar ? 'Vale treinar.' : 'Não vale treinar.'} Build: ${textoBuild(avaliacao)}`
  )
  if (avaliacao.melhorar?.length) console.log(`  Melhorar: ${avaliacao.melhorar.join('; ')}`)
  return { pokemon, acao }
}
