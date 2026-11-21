// O resumo do PokeMMO tem várias abas (info, stats, IVs/EVs, golpes).
// Esta parte junta o que foi lido em cada aba num único Pokémon.

export const ATRIBUTOS = ['hp', 'ataque', 'defesa', 'atqEsp', 'defEsp', 'velocidade']

const vazio = v => v === null || v === undefined || v === ''

export function mesclar(alvo, parcial) {
  for (const [chave, valor] of Object.entries(parcial || {})) {
    if (vazio(valor)) continue
    if (Array.isArray(valor)) {
      if (valor.length) alvo[chave] = valor
    } else if (typeof valor === 'object') {
      alvo[chave] = mesclar(alvo[chave] && typeof alvo[chave] === 'object' ? alvo[chave] : {}, valor)
    } else {
      alvo[chave] = valor
    }
  }
  return alvo
}

const mesmoNome = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

export function ivsCompletos(p) {
  return !!p?.ivs && ATRIBUTOS.every(a => Number.isInteger(p.ivs[a]))
}

export function completo(p) {
  return ivsCompletos(p) && !vazio(p.natureza) && Array.isArray(p.movimentos) && p.movimentos.length > 0
}

export class Montagem {
  constructor(finalizarMs) {
    this.finalizarMs = finalizarMs
    this.atual = null
    this.ultimaVez = 0
  }

  // Adiciona o que foi lido numa aba. Se for outro Pokémon, devolve o anterior (pronto para salvar).
  adicionar(parcial, agora = Date.now()) {
    let pronto = null
    if (this.atual && parcial?.nome && this.atual.nome && !mesmoNome(parcial.nome, this.atual.nome)) {
      pronto = this.atual
      this.atual = null
    }
    this.atual = mesclar(this.atual || {}, parcial)
    this.ultimaVez = agora
    return pronto
  }

  completo() {
    return completo(this.atual)
  }

  fechar() {
    const p = this.atual
    this.atual = null
    return p
  }

  // Se ficou tempo sem ver o resumo, fecha o Pokémon atual
  verificarTempo(agora = Date.now()) {
    if (this.atual && agora - this.ultimaVez > this.finalizarMs) return this.fechar()
    return null
  }
}

// Deixa no formato que o site usa (todos os campos presentes, totais calculados)
export function normalizar(p) {
  const bloco = (origem, extras = []) => {
    const o = {}
    for (const a of [...extras, ...ATRIBUTOS]) o[a] = Number.isInteger(origem?.[a]) ? origem[a] : null
    return o
  }
  const total = o => ATRIBUTOS.reduce((s, a) => s + (o[a] || 0), 0)
  const evs = bloco(p.evs)
  const ivs = bloco(p.ivs)
  return {
    numero: p.numero ? String(p.numero).padStart(3, '0') : '???',
    nome: p.nome,
    ...(p.apelido ? { apelido: p.apelido } : {}),
    ...(p.nivel ? { nivel: p.nivel } : {}),
    natureza: p.natureza ?? null,
    tipo1: p.tipo1 ?? null,
    tipo2: p.tipo2 ?? null,
    habilidade: p.habilidade ?? null,
    exp: p.exp ?? null,
    proxNivel: p.proxNivel ?? null,
    stats: bloco(p.stats, ['hpMax', 'felicidade']),
    evs: { ...evs, total: total(evs) },
    ivs: { ...ivs, total: total(ivs) },
    movimentos: (p.movimentos || []).map(m => ({ nome: m.nome, tipo: m.tipo ?? null }))
  }
}

// Identifica o mesmo Pokémon quando ele é visto de novo (espécie + natureza + IVs não mudam)
export function chave(p) {
  return [String(p.nome).toLowerCase(), String(p.natureza).toLowerCase(), ...ATRIBUTOS.map(a => p.ivs?.[a])].join('|')
}
