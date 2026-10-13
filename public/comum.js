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
  PokeMMO:  { nome: 'PokeMMO', curto: 'PokeMMO', icone: '🎮' },
  Pixelmon: { nome: 'Pixelmon (Minecraft)', curto: 'Pixelmon', icone: '⛏️' },
  // O id continua 'Nintendo' (cadastros antigos); na tela aparece como Emulador
  Nintendo: { nome: 'Emulador', curto: 'Emulador', icone: '🕹️' }
}

// Pokémon cadastrados antes do campo existir são todos do PokeMMO
function plataformaDe(p) {
  return PLATAFORMAS[p.plataforma] ? p.plataforma : 'PokeMMO'
}

function seloPlataforma(p) {
  const plat = PLATAFORMAS[plataformaDe(p)]
  return `<span class="selo selo-plataforma" title="${plat.nome}">${plat.icone} ${nomeDoJogo(p)}</span>`
}

// Jogos oficiais: o jogo diz a geração (as regras de batalha) e até qual número da Pokédex existe nele.
// Let's Go e Legends Arceus ficam de fora: não usam EVs.
const JOGOS_NINTENDO = {
  ruby: { nome: 'Ruby', geracao: 3 }, sapphire: { nome: 'Sapphire', geracao: 3 }, emerald: { nome: 'Emerald', geracao: 3 },
  firered: { nome: 'FireRed', geracao: 3 }, leafgreen: { nome: 'LeafGreen', geracao: 3 },
  diamond: { nome: 'Diamond', geracao: 4 }, pearl: { nome: 'Pearl', geracao: 4 }, platinum: { nome: 'Platinum', geracao: 4 },
  heartgold: { nome: 'HeartGold', geracao: 4 }, soulsilver: { nome: 'SoulSilver', geracao: 4 },
  black: { nome: 'Black', geracao: 5 }, white: { nome: 'White', geracao: 5 }, black2: { nome: 'Black 2', geracao: 5 }, white2: { nome: 'White 2', geracao: 5 },
  x: { nome: 'X', geracao: 6 }, y: { nome: 'Y', geracao: 6 }, omegaruby: { nome: 'Omega Ruby', geracao: 6 }, alphasapphire: { nome: 'Alpha Sapphire', geracao: 6 },
  sun: { nome: 'Sun', geracao: 7 }, moon: { nome: 'Moon', geracao: 7 }, ultrasun: { nome: 'Ultra Sun', geracao: 7 }, ultramoon: { nome: 'Ultra Moon', geracao: 7 },
  sword: { nome: 'Sword', geracao: 8 }, shield: { nome: 'Shield', geracao: 8 }, brilliantdiamond: { nome: 'Brilliant Diamond', geracao: 8 }, shiningpearl: { nome: 'Shining Pearl', geracao: 8 },
  scarlet: { nome: 'Scarlet', geracao: 9 }, violet: { nome: 'Violet', geracao: 9 }
}

// Último número da Pokédex que existe em cada geração
const ULTIMO_NUMERO_GERACAO = { 1: 151, 2: 251, 3: 386, 4: 493, 5: 649, 6: 721, 7: 809, 8: 905, 9: 1025 }

// Geração em que a espécie apareceu (ex: #019 Rattata = 1ª, #501 Oshawott = 5ª)
function geracaoDaEspecie(numero) {
  const n = parseInt(numero, 10)
  for (let g = 1; g <= 9; g++) if (n <= ULTIMO_NUMERO_GERACAO[g]) return g
  return null
}

// Emulador: em quais gerações de jogo este Pokémon pode estar?
// 1) pelo número: a partir da geração em que a espécie apareceu (e da 3ª, quando os IVs/EVs ficaram como hoje);
// 2) pelos stats: nas espécies que tiveram status base mudados, só ficam as gerações em que os stats batem.
function geracoesPossiveis(p, dados) {
  const inicio = Math.max(3, geracaoDaEspecie(p.numero) || 3)
  let geracoes = [3, 4, 5, 6, 7, 8, 9].filter(g => g >= inicio)
  const temStats = p.stats && ATRIBUTOS.every(a => p.stats[a] > 0) && p.nivel >= 1
  if (dados && (dados.basesAntigas || []).length && temStats) {
    geracoes = geracoes.filter(g => statsQueNaoBatem({ ...p, plataforma: 'Nintendo' }, baseNaGeracao(dados, g)).length === 0)
  }
  return geracoes
}

// Status base da espécie num jogo de certa geração. Sem geração (PokeMMO, Pixelmon), usa os atuais:
// o PokeMMO usa os status base novos (ex: Pidgeot com Velocidade 101), conferido com Pokémon da base.
function baseNaGeracao(dados, geracao) {
  if (!dados || !dados.base) return null
  const base = { ...dados.base }
  if (!geracao) return base
  // Do mais novo para o mais antigo: o valor antigo mais próximo da geração escolhida fica por último
  ;[...(dados.basesAntigas || [])]
    .sort((a, b) => b.ate - a.ate)
    .filter(antigo => antigo.ate >= geracao)
    .forEach(antigo => Object.assign(base, antigo.stats))
  return base
}

function baseDoPokemon(p, dados) {
  return baseNaGeracao(dados, plataformaDe(p) === 'Nintendo' ? Number(p.geracaoJogo) || null : null)
}

// Nome do jogo para mostrar: "FireRed", "PokeMMO", "Pixelmon"...
function nomeDoJogo(p) {
  const jogo = plataformaDe(p) === 'Nintendo' && JOGOS_NINTENDO[p.jogoNintendo]
  return jogo ? jogo.nome : PLATAFORMAS[plataformaDe(p)].curto
}

// x1 entre jogos: só Pokémon que existem no PokeMMO (#001 a #649, até a 5ª geração),
// do PokeMMO ou de um jogo oficial até a 5ª geração
const ULTIMO_NUMERO_X1 = 649

function podeX1EntreJogos(p) {
  const numero = parseInt(p.numero, 10)
  if (!(numero >= 1 && numero <= ULTIMO_NUMERO_X1)) return false
  const plataforma = plataformaDe(p)
  const geracao = Number(p.geracaoJogo)
  return plataforma === 'PokeMMO' || (plataforma === 'Nintendo' && geracao >= 3 && geracao <= 5)
}

// Stats que não batem com a fórmula. No PokeMMO os IVs aparecem no jogo, então a conta tem que ser exata;
// nos outros jogos os IVs podem ser estimativa, então basta existir algum IV (0 a 31) que feche a conta.
// Quando não batem, o jogo pode ter status base diferentes: aí a batalha entre jogos não é justa.
function statsQueNaoBatem(p, base) {
  if (!base) return []
  return ATRIBUTOS.filter(function(a) {
    if (plataformaDe(p) === 'PokeMMO') {
      return calcularStats(base, p.ivs, p.evs, p.natureza, p.nivel)[a] !== p.stats[a]
    }
    for (let iv = 0; iv <= 31; iv++) {
      if (calcularStats(base, { [a]: iv }, { [a]: (p.evs && p.evs[a]) || 0 }, p.natureza, p.nivel)[a] === p.stats[a]) return false
    }
    return true
  })
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
  module.exports = { calcularStats, NATUREZAS, PLATAFORMAS, plataformaDe, JOGOS_NINTENDO, ULTIMO_NUMERO_GERACAO, podeX1EntreJogos, statsQueNaoBatem, baseNaGeracao, baseDoPokemon, geracoesPossiveis }
}
