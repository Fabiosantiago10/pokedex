// Motor de batalha (geração 5): fórmula de dano e simulação. Usado pela Batalha e pelas Dicas.
const SIMULACOES = 3000

function tiposDe(p) {
  return [p.tipo1, p.tipo2].filter(Boolean)
}

// ---------- Fórmula de dano ----------
function danoBase(nivel, poder, ataque, defesa) {
  return Math.floor(Math.floor(Math.floor(2 * nivel / 5 + 2) * poder * ataque / Math.max(defesa, 1)) / 50) + 2
}

// Mesma ordem do jogo: crítico, variação (85–100%), STAB, efetividade
function aplicarModificadores(base, critico, variacao, stab, efet) {
  if (efet === 0) return 0
  let dano = base
  if (critico) dano *= 2
  dano = Math.floor(dano * variacao / 100)
  if (stab) dano = Math.floor(dano * 1.5)
  dano = Math.floor(dano * efet)
  return Math.max(dano, 1)
}

function textoEfetividade(efet) {
  if (efet === 0) return '<span class="efet nulo">Não afeta</span>'
  if (efet >= 2) return `<span class="efet super">Super efetivo ${efet}×</span>`
  if (efet < 1) return `<span class="efet pouco">Pouco efetivo ${efet}×</span>`
  return '<span class="efet normal">Normal</span>'
}

// Dano de cada ataque cadastrado do atacante contra o defensor
function analisarGolpes(atacante, dadosAtacante, defensor, statsAtacante = atacante.stats) {
  return atacante.movimentos.map(function(m) {
    const oficial = dadosAtacante && dadosAtacante.ataques.find(a => a.nome.toLowerCase() === m.nome.toLowerCase())
    if (!oficial || !(oficial.poder > 0) || oficial.categoria === 'Status') {
      const variavel = oficial && oficial.poder === null && oficial.categoria !== 'Status'
      return { nome: m.nome, tipo: m.tipo, semDano: true, motivo: variavel ? 'poder variável (não simulado)' : 'não causa dano' }
    }
    const fisico = oficial.categoria === 'Físico'
    const ataque = fisico ? statsAtacante.ataque : statsAtacante.atqEsp
    const defesa = fisico ? defensor.stats.defesa : defensor.stats.defEsp
    const stab = tiposDe(atacante).includes(oficial.tipo)
    const efet = efetividade(oficial.tipo, tiposDe(defensor))
    const base = danoBase(atacante.nivel, oficial.poder, ataque, defesa)
    const min = aplicarModificadores(base, false, 85, stab, efet)
    const max = aplicarModificadores(base, false, 100, stab, efet)
    const precisao = oficial.precisao ?? 100
    return {
      nome: oficial.nome, tipo: oficial.tipo, categoria: oficial.categoria, poder: oficial.poder,
      precisao, stab, efet, base, min, max, statUsado: fisico ? 'ataque' : 'atqEsp',
      media: (min + max) / 2 * precisao / 100
    }
  })
}

function melhorGolpe(golpes) {
  return golpes.filter(g => !g.semDano && g.max > 0).sort((a, b) => b.media - a.media)[0] || null
}

// ---------- Simulação de várias batalhas ----------
function rolarDano(golpe) {
  if (!golpe) return 0
  if (Math.random() * 100 >= golpe.precisao) return 0  // errou
  const critico = Math.random() < 1 / 16
  const variacao = 85 + Math.floor(Math.random() * 16)
  return aplicarModificadores(golpe.base, critico, variacao, golpe.stab, golpe.efet)
}

function simular(a, golpeA, b, golpeB) {
  const resultado = { a: 0, b: 0, empate: 0, turnos: 0 }
  if (!golpeA && !golpeB) {
    resultado.empate = SIMULACOES
    return resultado
  }
  for (let i = 0; i < SIMULACOES; i++) {
    let hpA = a.stats.hp
    let hpB = b.stats.hp
    let turno = 0
    let vencedor = null
    while (!vencedor && turno < 100) {
      turno++
      const aPrimeiro = a.stats.velocidade > b.stats.velocidade ||
        (a.stats.velocidade === b.stats.velocidade && Math.random() < 0.5)
      const ordem = aPrimeiro ? ['a', 'b'] : ['b', 'a']
      for (const lado of ordem) {
        if (lado === 'a') {
          hpB -= rolarDano(golpeA)
          if (hpB <= 0) { vencedor = 'a'; break }
        } else {
          hpA -= rolarDano(golpeB)
          if (hpA <= 0) { vencedor = 'b'; break }
        }
      }
    }
    resultado[vencedor || 'empate']++
    resultado.turnos += turno
  }
  resultado.turnos = resultado.turnos / SIMULACOES
  return resultado
}

// ---------- Texto ----------
// Ex: 30% ou "100%+" quando o golpe tira mais que o HP inteiro
function porcentagemHp(dano, hp) {
  return dano >= hp ? '100%+' : Math.round(dano / hp * 100) + '%'
}
