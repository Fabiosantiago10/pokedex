// Comparação local (sem custo) com os Pokémon da mesma espécie que já estão na base.
import { ATRIBUTOS, chave } from './juntar.js'

const NOMES = { hp: 'HP', ataque: 'Ataque', defesa: 'Defesa', atqEsp: 'Atq. Esp', defEsp: 'Def. Esp', velocidade: 'Velocidade' }

export function comparar(pokemon, base) {
  const minhaChave = chave(pokemon)
  const mesmos = base.filter(p => String(p.nome).toLowerCase() === String(pokemon.nome).toLowerCase() && chave(p) !== minhaChave)
  const total = pokemon.ivs.total
  const melhores = mesmos.filter(p => (p.ivs?.total ?? 0) > total).length
  const media = mesmos.length ? Math.round(mesmos.reduce((s, p) => s + (p.ivs?.total ?? 0), 0) / mesmos.length) : null
  const ivs31 = ATRIBUTOS.filter(a => pokemon.ivs[a] === 31).map(a => NOMES[a])
  const ivsBaixos = ATRIBUTOS.filter(a => pokemon.ivs[a] !== null && pokemon.ivs[a] < 15).map(a => `${NOMES[a]} ${pokemon.ivs[a]}`)

  let texto
  if (!mesmos.length) texto = `Primeiro ${pokemon.nome} da base (IVs ${total}/186).`
  else texto = `${melhores + 1}º de ${mesmos.length + 1} ${pokemon.nome} na base (IVs ${total}/186; média dos outros ${media}).`

  return {
    texto,
    posicao: melhores + 1,
    totalEspecie: mesmos.length + 1,
    mediaOutros: media,
    ivsTotal: total,
    ivs31,
    ivsBaixos,
    outros: mesmos.map(p => ({ natureza: p.natureza, ivs: p.ivs, nota: p.avaliacao?.nota ?? null }))
  }
}
