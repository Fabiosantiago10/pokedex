// Busca dados oficiais na PokéAPI (https://pokeapi.co) e guarda em cache local.
// Depois da primeira consulta de um Pokémon ou ataque, a resposta sai do cache
// e não depende mais da internet.
const fs = require('fs')
const path = require('path')

const API = 'https://pokeapi.co/api/v2'
const PASTA_CACHE = path.join(__dirname, 'data', 'cache')
const ARQUIVO_CACHE = path.join(PASTA_CACHE, 'pokeapi.json')

let cache = { especies: null, pokemons: {}, ataques: {} }
if (fs.existsSync(ARQUIVO_CACHE)) {
  cache = JSON.parse(fs.readFileSync(ARQUIVO_CACHE, 'utf8'))
}

function salvarCache() {
  fs.mkdirSync(PASTA_CACHE, { recursive: true })
  const temp = ARQUIVO_CACHE + '.tmp'
  fs.writeFileSync(temp, JSON.stringify(cache))
  fs.renameSync(temp, ARQUIVO_CACHE)
}

async function buscarJson(url) {
  const resposta = await fetch(url)
  if (resposta.status === 404) return null
  if (!resposta.ok) throw new Error(`PokéAPI respondeu ${resposta.status} para ${url}`)
  return resposta.json()
}

// "thunder-shock" -> "Thunder Shock"
function formatarNome(slug) {
  return slug.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

// "thunder shock" / "Thunder Shock" -> "thunder-shock"
function paraSlug(nome) {
  return String(nome).trim().toLowerCase().replace(/[.'’:]/g, '').replace(/\s+/g, '-')
}

function nomeEmIngles(dados, slug) {
  const en = (dados.names || []).find(n => n.language.name === 'en')
  return en ? en.name : formatarNome(slug)
}

// Lista de todas as espécies, para o autocompletar do nome
async function listarEspecies() {
  if (!cache.especies) {
    const dados = await buscarJson(`${API}/pokemon-species?limit=2000`)
    cache.especies = dados.results.map(r => formatarNome(r.name))
    salvarCache()
  }
  return cache.especies
}

const CATEGORIAS = { physical: 'Físico', special: 'Especial', status: 'Status' }

// Nome, tipo, poder, precisão e categoria (Físico/Especial/Status) de um ataque
async function detalheAtaque(slug) {
  // Entradas antigas do cache não têm poder/precisão/categoria: busca de novo
  if (!cache.ataques[slug] || !('categoria' in cache.ataques[slug])) {
    const dados = await buscarJson(`${API}/move/${slug}`)
    if (!dados) return null
    cache.ataques[slug] = {
      nome: nomeEmIngles(dados, slug),
      tipo: formatarNome(dados.type.name),
      poder: dados.power,          // null para ataques de status ou de poder variável
      precisao: dados.accuracy,    // null para ataques que nunca erram
      categoria: CATEGORIAS[dados.damage_class && dados.damage_class.name] || 'Status'
    }
  }
  return cache.ataques[slug]
}

// Executa as tarefas com no máximo `limite` requisições ao mesmo tempo, para não sobrecarregar a PokéAPI
async function emParalelo(itens, limite, tarefa) {
  const resultados = new Array(itens.length)
  let proximo = 0
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++
      resultados[i] = await tarefa(itens[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador))
  return resultados
}

// Resume como o Pokémon aprende o ataque, juntando todos os jogos
function metodosDeAprendizado(detalhes) {
  const metodos = new Set()
  let menorNivel = null
  detalhes.forEach(function(d) {
    const metodo = d.move_learn_method.name
    if (metodo === 'level-up') {
      const nivel = Math.max(d.level_learned_at, 1)
      if (menorNivel === null || nivel < menorNivel) menorNivel = nivel
    } else if (metodo === 'machine') {
      metodos.add('TM')
    } else if (metodo === 'egg') {
      metodos.add('Ovo')
    } else if (metodo === 'tutor') {
      metodos.add('Tutor')
    }
  })
  const lista = [...metodos]
  if (menorNivel !== null) lista.unshift('Nível ' + menorNivel)
  return lista
}

// Nome do stat na PokéAPI -> nome usado na Pokédex
const NOMES_STATS = {
  'hp': 'hp', 'attack': 'ataque', 'defense': 'defesa',
  'special-attack': 'atqEsp', 'special-defense': 'defEsp', 'speed': 'velocidade'
}

async function dadosDoPokemon(nome) {
  const slug = paraSlug(nome)
  // Entradas antigas do cache não têm os stats base, os EVs que rende ou o poder dos ataques: busca de novo
  const salvo = cache.pokemons[slug]
  if (salvo && salvo.base && salvo.rendeEvs && salvo.basesAntigas && salvo.evolucoes && salvo.gruposOvo && (salvo.ataques.length === 0 || 'categoria' in salvo.ataques[0])) return salvo

  // A espécie diz qual é a forma padrão (ex: "deoxys" -> "deoxys-normal")
  const especie = await buscarJson(`${API}/pokemon-species/${slug}`)
  if (!especie) return null
  const padrao = especie.varieties.find(v => v.is_default) || especie.varieties[0]
  const pokemon = await buscarJson(padrao.pokemon.url)

  // Para quem ela evolui e em que nível (ex: Rattata -> Raticate no Nv 20). Nível null = pedra, troca etc.
  const cadeia = especie.evolution_chain ? await buscarJson(especie.evolution_chain.url) : null
  const acharNo = no => (no.species.name === especie.name ? no : no.evolves_to.map(acharNo).find(Boolean))
  const noDaEspecie = cadeia && acharNo(cadeia.chain)
  const evolucoes = (noDaEspecie ? noDaEspecie.evolves_to : []).map(function(filho) {
    const porNivel = filho.evolution_details.find(e => e.trigger && e.trigger.name === 'level-up' && e.min_level)
    return { nome: formatarNome(filho.species.name), nivel: porNivel ? porNivel.min_level : null }
  })

  const aprendidos = pokemon.moves
    .map(m => ({ slug: m.move.name, metodos: metodosDeAprendizado(m.version_group_details) }))
    .filter(m => m.metodos.length > 0)

  const ataques = await emParalelo(aprendidos, 10, async function(m) {
    const detalhe = await detalheAtaque(m.slug)
    return detalhe && { ...detalhe, metodos: m.metodos }
  })

  const resultado = {
    numero: String(especie.id).padStart(3, '0'),
    nome: nomeEmIngles(especie, slug),
    tipos: pokemon.types.sort((a, b) => a.slot - b.slot).map(t => formatarNome(t.type.name)),
    habilidades: pokemon.abilities.map(h => formatarNome(h.ability.name)),
    // Stats base da espécie, usados para calcular os stats em qualquer nível
    base: Object.fromEntries(pokemon.stats.map(s => [NOMES_STATS[s.stat.name], s.base_stat])),
    // EVs que ele dá a quem o derrota (ex: Pidgey -> 1 de Velocidade)
    rendeEvs: Object.fromEntries(pokemon.stats.map(s => [NOMES_STATS[s.stat.name], s.effort])),
    // Status base que mudaram com o tempo. Ex: Pidgeot tinha Velocidade 91 até a 5ª geração -> { ate: 5, stats: { velocidade: 91 } }
    evolucoes,
    // Breeding: grupos de ovo (ex: field, water1) e a espécie que nasce do ovo (o começo da linha)
    gruposOvo: (especie.egg_groups || []).map(g => g.name),
    nasceComo: cadeia ? formatarNome(cadeia.chain.species.name) : nomeEmIngles(especie, slug),
    basesAntigas: (pokemon.past_stats || []).map(function(antigo) {
      const stats = {}
      antigo.stats.forEach(s => { if (NOMES_STATS[s.stat.name]) stats[NOMES_STATS[s.stat.name]] = s.base_stat })
      return { ate: Number(antigo.generation.url.match(/\/(\d+)\/?$/)[1]), stats }
    }).filter(a => Object.keys(a.stats).length > 0),
    ataques: ataques.filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome))
  }

  cache.pokemons[slug] = resultado
  salvarCache()
  return resultado
}

// A espécie "para" é uma evolução (direta ou não) da espécie "de"? Ex: Charmander -> Charizard = sim.
// Usa a cadeia de evolução da PokéAPI; null quando não dá para consultar.
async function evoluiPara(de, para) {
  const slugDe = paraSlug(de)
  const slugPara = paraSlug(para)
  if (!cache.cadeias) cache.cadeias = {}
  if (!(slugDe in cache.cadeias)) {
    const especie = await buscarJson(`${API}/pokemon-species/${slugDe}`)
    if (!especie || !especie.evolution_chain) return null
    const cadeia = await buscarJson(especie.evolution_chain.url)
    if (!cadeia) return null
    // Guarda, para cada espécie da cadeia, todas as espécies que vêm depois dela
    const visitar = function(no) {
      const depois = []
      no.evolves_to.forEach(filho => { depois.push(filho.species.name, ...visitar(filho)) })
      cache.cadeias[no.species.name] = depois
      return depois
    }
    visitar(cadeia.chain)
    salvarCache()
  }
  return (cache.cadeias[slugDe] || []).includes(slugPara)
}

module.exports = { listarEspecies, dadosDoPokemon, evoluiPara }
