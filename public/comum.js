// Funções e dados usados pela Pokédex (index.html) e pela página Meus Pokémon (meus.html)

const coresTipo = {
  Normal: "#A8A878", Flying: "#98D8D8", Electric: "#F8D030",
  Fire: "#F08030", Water: "#6890F0", Grass: "#78C850",
  Poison: "#A040A0", Bug: "#A8B820", Rock: "#B8A038",
  Ground: "#E0C068", Psychic: "#F85888", Ice: "#98D8D8",
  Dragon: "#7038F8", Dark: "#705848", Steel: "#B8B8D0",
  Fairy: "#EE99AC", Fighting: "#C03028", Ghost: "#705898"
}

const ATRIBUTOS = ['hp', 'ataque', 'defesa', 'atqEsp', 'defEsp', 'velocidade']
const NOMES_ATRIBUTOS = { hp: 'HP', ataque: 'Ataque', defesa: 'Defesa', atqEsp: 'Atq. Esp', defEsp: 'Def. Esp', velocidade: 'Velocidade' }

// Os dados vêm de vários treinadores, então todo texto é escapado antes de virar HTML
function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

function soma(obj) {
  return ATRIBUTOS.reduce((total, a) => total + (obj[a] || 0), 0)
}

function badgeTipo(tipo) {
  if (!tipo) return ''
  const cor = coresTipo[tipo] || "#888"
  return `<span class="badge" style="background-color:${cor}">${escaparHtml(tipo)}</span>`
}

// Selos de variante (Alfa / Shiny) ao lado do nome
function selosVariante(p) {
  return (p.alfa ? '<span class="selo selo-alfa" title="Pokémon Alfa">🔴 Alfa</span>' : '') +
    (p.shiny ? '<span class="selo selo-shiny" title="Shiny">✨ Shiny</span>' : '')
}

const SIMBOLO_SEXO = { M: '♂', F: '♀' }

// Ex: '♂ Nv 30 · Serious · "Growl01"' — para reconhecer o Pokémon no jogo.
// O apelido é o mais confiável: não muda quando o Pokémon é movido no PC.
function identificacao(p) {
  const partes = [`${SIMBOLO_SEXO[p.sexo] || ''} Nv ${p.nivel}`.trim()]
  if (p.natureza) partes.push(escaparHtml(p.natureza))
  if (p.apelido) partes.push(`<strong>"${escaparHtml(p.apelido)}"</strong>`)
  return partes.join(' · ')
}

// Natureza -> [stat que aumenta 10%, stat que diminui 10%].
// Bashful, Docile, Hardy, Quirky e Serious são neutras.
const NATUREZAS = {
  Adamant: ['ataque', 'atqEsp'], Bold: ['defesa', 'ataque'], Brave: ['ataque', 'velocidade'],
  Calm: ['defEsp', 'ataque'], Careful: ['defEsp', 'atqEsp'], Gentle: ['defEsp', 'defesa'],
  Hasty: ['velocidade', 'defesa'], Impish: ['defesa', 'atqEsp'], Jolly: ['velocidade', 'atqEsp'],
  Lax: ['defesa', 'defEsp'], Lonely: ['ataque', 'defesa'], Mild: ['atqEsp', 'defesa'],
  Modest: ['atqEsp', 'ataque'], Naive: ['velocidade', 'defEsp'], Naughty: ['ataque', 'defEsp'],
  Quiet: ['atqEsp', 'velocidade'], Rash: ['atqEsp', 'defEsp'], Relaxed: ['defesa', 'velocidade'],
  Sassy: ['defEsp', 'velocidade'], Timid: ['velocidade', 'ataque']
}

// Mesma fórmula dos jogos: calcula os stats em qualquer nível
// a partir dos stats base da espécie, IVs, EVs e natureza.
function calcularStats(base, ivs, evs, natureza, nivel) {
  const [sobe, desce] = NATUREZAS[natureza] || []
  const stats = {}
  ATRIBUTOS.forEach(function(a) {
    const valor = Math.floor((2 * base[a] + (ivs[a] || 0) + Math.floor((evs[a] || 0) / 4)) * nivel / 100)
    if (a === 'hp') {
      stats.hp = base.hp === 1 ? 1 : valor + nivel + 10  // Shedinja sempre tem 1 de HP
    } else {
      // Conta com inteiros (x11/10 e x9/10) para não ter erro de arredondamento
      const fator = a === sobe ? 11 : a === desce ? 9 : 10
      stats[a] = Math.floor((valor + 5) * fator / 10)
    }
  })
  return stats
}

// Nick do jogo salvo neste navegador (ao cadastrar ou em "Meus Pokémon")
function nickSalvo() {
  try {
    return (localStorage.getItem('treinador') || '').trim()
  } catch (e) {
    return ''
  }
}

function treinadorAtual() {
  return nickSalvo().toLowerCase()
}

function salvarTreinador(nick) {
  try {
    localStorage.setItem('treinador', nick.trim())
  } catch (e) {}
}

// O servidor (Node) usa a mesma fórmula de stats, para a nota bater com o que aparece na tela
if (typeof module !== 'undefined') {
  module.exports = { calcularStats, NATUREZAS }
}
