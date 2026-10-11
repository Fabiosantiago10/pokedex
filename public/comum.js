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

// Jogo de onde veio o Pokémon. Ranking e batalhas só comparam Pokémon do mesmo jogo,
// porque cada um tem regras próprias (status base, poder dos ataques, tabela de tipos).
const PLATAFORMAS = {
  PokeMMO:  { nome: 'PokeMMO', icone: '🎮' },
  Pixelmon: { nome: 'Pixelmon (Minecraft)', icone: '⛏️' },
  Nintendo: { nome: 'Jogos oficiais (Nintendo)', icone: '🕹️' }
}

// Pokémon cadastrados antes do campo existir são todos do PokeMMO
function plataformaDe(p) {
  return PLATAFORMAS[p.plataforma] ? p.plataforma : 'PokeMMO'
}

function seloPlataforma(p) {
  const plat = PLATAFORMAS[plataformaDe(p)]
  return `<span class="selo selo-plataforma" title="${plat.nome}">${plat.icone} ${plat.nome.replace(/ (.*)/, '')}</span>`
}

// Preferência de jogo (filtros da Pokédex e da Batalha, e o campo do cadastro)
function plataformaSalva() {
  try {
    const p = localStorage.getItem('plataforma')
    return PLATAFORMAS[p] ? p : 'PokeMMO'
  } catch (e) {
    return 'PokeMMO'
  }
}

function salvarPlataforma(p) {
  try { localStorage.setItem('plataforma', p) } catch (e) {}
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

// Efetividade dos tipos: ataque -> { defesa: multiplicador }. O que não está na tabela vale 1×.
const EFETIVIDADE = {
  Normal:   { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire:     { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water:    { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass:    { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice:      { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison:   { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground:   { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying:   { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic:  { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug:      { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock:     { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost:    { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon:   { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark:     { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel:    { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy:    { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 }
}
const TIPOS = Object.keys(EFETIVIDADE)

// Multiplicador de um ataque de `tipoAtaque` contra um Pokémon com esses tipos (ex: 4, 2, 1, 0.5, 0)
function efetividade(tipoAtaque, tiposDefesa) {
  const linha = EFETIVIDADE[tipoAtaque] || {}
  return tiposDefesa.filter(Boolean).reduce((m, t) => m * (t in linha ? linha[t] : 1), 1)
}

const ABREVIACOES ={ hp: 'HP', ataque: 'Atq', defesa: 'Def', atqEsp: 'AtqEsp', defEsp: 'DefEsp', velocidade: 'Vel' }

// Ex: "Lonely" -> "+Atq −Def"; naturezas neutras -> "neutra"
function efeitoNatureza(natureza) {
  const efeito = NATUREZAS[natureza]
  if (!efeito) return natureza ? 'neutra' : ''
  return `+${ABREVIACOES[efeito[0]]} −${ABREVIACOES[efeito[1]]}`
}

// 'sobe', 'desce' ou '' para o atributo, conforme a natureza
function marcaNatureza(natureza, atributo) {
  const efeito = NATUREZAS[natureza]
  if (!efeito) return ''
  return efeito[0] === atributo ? 'sobe' : efeito[1] === atributo ? 'desce' : ''
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

// Imagem oficial do Pokémon (arte da PokéAPI), pelo número da Pokédex. Shiny tem arte própria.
function urlImagem(p) {
  const numero = parseInt(p.numero, 10)
  if (!numero) return ''
  const pasta = p.shiny ? 'shiny/' : ''
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pasta}${numero}.png`
}

// Sprite animado em pixel art (Black/White), parecido com o do PokeMMO. Só existe até o #649.
const ULTIMO_SPRITE_ANIMADO = 649

function urlSpriteAnimado(p) {
  const numero = parseInt(p.numero, 10)
  if (!numero || numero > ULTIMO_SPRITE_ANIMADO) return ''
  const pasta = p.shiny ? 'shiny/' : ''
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pasta}${numero}.gif`
}

// Se a imagem não carregar, mostra uma Pokébola no lugar
function imagemPokemon(p, classe = '') {
  const url = urlImagem(p)
  if (!url) return `<span class="imagem-vazia ${classe}"></span>`
  return `<img class="${classe}" src="${url}" alt="${escaparHtml(p.nome)}" loading="lazy"
    onerror="this.outerHTML='<span class=&quot;imagem-vazia ${classe}&quot;></span>'">`
}

// Pixel art animado quando existe; senão (ou se falhar), a arte oficial
function spritePokemon(p, classe = '') {
  const animado = urlSpriteAnimado(p)
  const arte = urlImagem(p)
  if (!animado) return imagemPokemon(p, classe)
  return `<img class="${classe} pixel" src="${animado}" alt="${escaparHtml(p.nome)}" loading="lazy"
    onerror="this.onerror=null; this.classList.remove('pixel'); this.src='${arte}'">`
}

// Pokémon num "palco" escuro na cor do tipo (como no Sumário do PokeMMO), com efeito animado:
// raios (Elétrico), chamas (Fogo), folhas (Planta), água com bolhas (Água), neve (Gelo) etc. Ver efeitos.css.
function imagemComEfeito(p, classe = '', extra = '') {
  const tipo = String(p.tipo1 || 'Normal').toLowerCase()
  const cor = coresTipo[p.tipo1] || '#9aa0a6'
  const particulas = '<span class="particula"></span>'.repeat(8)
  return `<span class="efeito palco efeito-${escaparHtml(tipo)} ${extra}" style="--cor-tipo:${cor}">
    <span class="aura"></span>${particulas}${spritePokemon(p, classe)}<span class="frente"></span>
  </span>`
}

// Barra de progresso (ex: IV 28 de 31). Valor no máximo ganha destaque dourado.
function barra(valor, maximo, cor) {
  const pct = Math.max(0, Math.min(100, (valor / maximo) * 100))
  const classe = valor >= maximo ? 'barra-preenchida maximo' : 'barra-preenchida'
  return `<span class="barra"><span class="${classe}" style="width:${pct}%;${cor ? 'background:' + cor : ''}"></span></span>`
}

function contarPerfeitos(ivs) {
  return ATRIBUTOS.filter(a => ivs[a] === 31).length
}

// Sessão de "Meus Pokémon" (nick + PIN). Fica só nesta aba e some ao fechá-la.
function lerSessao() {
  try {
    return JSON.parse(sessionStorage.getItem('sessao') || 'null')
  } catch (e) {
    return null
  }
}

function salvarSessao(nick, pin) {
  try {
    sessionStorage.setItem('sessao', JSON.stringify({ nick, pin }))
  } catch (e) {}
}

function encerrarSessao() {
  try {
    sessionStorage.removeItem('sessao')
  } catch (e) {}
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
  module.exports = { calcularStats, NATUREZAS, PLATAFORMAS, plataformaDe }
}
