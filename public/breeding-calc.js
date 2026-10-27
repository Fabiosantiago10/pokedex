// Planejador de breeding (PokeMMO): contas sem tela, para a página breeding.html.
// Regra observada nos cruzamentos do usuário: cada IV do filhote sai igual ao da mãe, ao do pai
// ou à média dos dois (arredondada para baixo). Power Item num pai trava aquele IV no valor dele;
// Everstone passa a natureza. Cada pai segura um item só. Os dois pais são consumidos.

const POWER_ITEMS = {
  hp: 'Power Weight', ataque: 'Power Bracer', defesa: 'Power Belt',
  atqEsp: 'Power Lens', defEsp: 'Power Band', velocidade: 'Power Anklet'
}

// Peso de cada stat para o objetivo do Pokémon (o que importa mais pesa mais)
const PESOS_FOCO = {
  fisico: { hp: 2, ataque: 3, defesa: 1.5, atqEsp: 0, defEsp: 1.5, velocidade: 2.5 },
  especial: { hp: 2, ataque: 0, defesa: 1, atqEsp: 3, defEsp: 1.5, velocidade: 2.5 },
  todos: { hp: 1, ataque: 1, defesa: 1, atqEsp: 1, defEsp: 1, velocidade: 1 }
}
const NATUREZAS_IDEAIS = { fisico: ['Adamant', 'Jolly'], especial: ['Modest', 'Timid'], todos: [] }
// Natureza ideal garantida vale como uns 10 pontos de IV no stat mais importante
const BONUS_NATUREZA = 30

function focoDaEspecie(dados) {
  if (!dados || !dados.base) return 'todos'
  return dados.base.ataque >= dados.base.atqEsp ? 'fisico' : 'especial'
}

// Podem cruzar? Mesmo grupo de ovo e sexo oposto, ou um deles é Ditto.
// Sexo não cadastrado não impede: vira um aviso.
function podemCruzar(a, dadosA, b, dadosB) {
  if (a.id === b.id) return { ok: false }
  const gruposA = (dadosA && dadosA.gruposOvo) || []
  const gruposB = (dadosB && dadosB.gruposOvo) || []
  if (gruposA.includes('no-eggs') || gruposB.includes('no-eggs')) return { ok: false }
  const dittoA = gruposA.includes('ditto')
  const dittoB = gruposB.includes('ditto')
  if (dittoA && dittoB) return { ok: false }
  if (!dittoA && !dittoB) {
    if (!gruposA.some(g => gruposB.includes(g))) return { ok: false }
    if (a.sexo && b.sexo && a.sexo === b.sexo) return { ok: false }
  }
  const aviso = !dittoA && !dittoB && (!a.sexo || !b.sexo)
    ? 'Sexo não cadastrado: confira no jogo se um é macho e o outro fêmea.'
    : ''
  return { ok: true, aviso }
}

// Quem é a "mãe": a fêmea, ou quem não é Ditto. O filhote nasce como o começo da linha dela.
// null quando não dá para saber (sexo não cadastrado nos dois).
function maeDoCasal(a, dadosA, b, dadosB) {
  if ((dadosA.gruposOvo || []).includes('ditto')) return 'b'
  if ((dadosB.gruposOvo || []).includes('ditto')) return 'a'
  if (a.sexo === 'F' || b.sexo === 'M') return 'a'
  if (b.sexo === 'F' || a.sexo === 'M') return 'b'
  return null
}

// Os 3 resultados possíveis de um IV (com repetição: cada um tem 1/3 de chance)
function resultadosDoIv(ivA, ivB, travadoEm) {
  if (travadoEm !== undefined) return [travadoEm]
  return [ivA, ivB, Math.floor((ivA + ivB) / 2)]
}

// Opções de item de um pai: nada, Power Item só num IV 31 (que o outro não tem), Everstone com natureza ideal
function opcoesDeItem(p, outro, foco) {
  const opcoes = [{ tipo: 'nada' }]
  ATRIBUTOS.forEach(function(a) {
    if (p.ivs[a] === 31 && outro.ivs[a] !== 31 && PESOS_FOCO[foco][a] > 0) opcoes.push({ tipo: 'power', stat: a })
  })
  if (NATUREZAS_IDEAIS[foco].includes(p.natureza)) opcoes.push({ tipo: 'everstone' })
  return opcoes
}

function avaliarCasal(a, b, itemA, itemB, foco) {
  const pesos = PESOS_FOCO[foco]
  const porStat = {}
  let esperado = 0
  let pontos = 0
  let pior = 0
  let melhor = 0
  ATRIBUTOS.forEach(function(s) {
    const travado = itemA.tipo === 'power' && itemA.stat === s ? a.ivs[s]
      : itemB.tipo === 'power' && itemB.stat === s ? b.ivs[s] : undefined
    const valores = resultadosDoIv(a.ivs[s], b.ivs[s], travado)
    const media = valores.reduce((t, v) => t + v, 0) / valores.length
    porStat[s] = { valores: [...new Set(valores)].sort((x, y) => x - y), travado: travado !== undefined }
    esperado += media
    pontos += media * pesos[s]
    pior += Math.min(...valores)
    melhor += Math.max(...valores)
  })
  const natureza = itemA.tipo === 'everstone' ? a.natureza : itemB.tipo === 'everstone' ? b.natureza : null
  if (natureza) pontos += BONUS_NATUREZA
  return { porStat, esperado, pontos, pior, melhor, natureza }
}

// Melhor combinação de itens para o casal
function planejarCasal(a, b, foco) {
  let melhorPlano = null
  for (const itemA of opcoesDeItem(a, b, foco)) {
    for (const itemB of opcoesDeItem(b, a, foco)) {
      if (itemA.tipo === 'everstone' && itemB.tipo === 'everstone') continue
      const avaliacao = avaliarCasal(a, b, itemA, itemB, foco)
      // Empate: prefere usar menos itens (custam dinheiro)
      const itens = (itemA.tipo !== 'nada') + (itemB.tipo !== 'nada')
      if (!melhorPlano || avaliacao.pontos > melhorPlano.pontos + 0.001 ||
          (Math.abs(avaliacao.pontos - melhorPlano.pontos) <= 0.001 && itens < melhorPlano.itens)) {
        melhorPlano = { ...avaliacao, itemA, itemB, itens }
      }
    }
  }
  return melhorPlano
}

// Pontos de um Pokémon com o mesmo peso (para comparar o filhote com os pais)
function pontosDoPokemon(p, foco) {
  return ATRIBUTOS.reduce((t, s) => t + p.ivs[s] * PESOS_FOCO[foco][s], 0)
}

if (typeof module !== 'undefined') {
  module.exports = { POWER_ITEMS, PESOS_FOCO, focoDaEspecie, podemCruzar, maeDoCasal, resultadosDoIv, planejarCasal, pontosDoPokemon }
}
