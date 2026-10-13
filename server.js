const express = require('express')
const cors = require('cors')
const path = require('path')
const crypto = require('crypto')
const db = require('./db')
const pokeapi = require('./pokeapi')
const { calcularStats, NATUREZAS, PLATAFORMAS, plataformaDe } = require('./public/comum.js')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Cada Pokémon cadastrado por qualquer treinador fica nesta lista (e no banco, ver db.js),
// então a base cresce a cada pessoa que usa a Pokédex.
const pokemons = db.pokemons

// ---------- PIN por nick ----------
// Sem login: cada nick tem um PIN, criado no primeiro cadastro.
// Para cadastrar ou editar com um nick, é preciso o PIN dele.
const MAX_TENTATIVAS = 5
const MINUTOS_BLOQUEIO = 15
const tentativas = new Map()  // nick -> { erros, bloqueadoAte }

function hashPin(pin, salt) {
  return crypto.scryptSync(pin, salt, 32).toString('hex')
}

function buscarTreinador(nick) {
  const chave = nick.toLowerCase()
  return db.treinadores.find(t => t.chave === chave)
}

function confere(valor, salt, hashSalvo) {
  return crypto.timingSafeEqual(Buffer.from(hashPin(valor, salt), 'hex'), Buffer.from(hashSalvo, 'hex'))
}

// Para recuperar o PIN, o treinador informa o seu primeiro Pokémon (escolhido ao criar o PIN)
const INICIAIS = ['Bulbasaur', 'Charmander', 'Squirtle']

function validarPin(pin) {
  pin = String(pin || '')
  return pin.length < 4 || pin.length > 20 ? 'O PIN deve ter de 4 a 20 caracteres' : ''
}

// Muitos erros seguidos (de PIN ou de inicial) bloqueiam o nick por um tempo
function bloqueio(chave) {
  const registro = tentativas.get(chave)
  if (!registro || registro.bloqueadoAte <= Date.now()) return ''
  const minutos = Math.ceil((registro.bloqueadoAte - Date.now()) / 60000)
  return `Muitas tentativas erradas. Tente de novo em ${minutos} minuto(s).`
}

function registrarErro(chave) {
  const registro = tentativas.get(chave) || { erros: 0, bloqueadoAte: 0 }
  registro.erros++
  if (registro.erros >= MAX_TENTATIVAS) {
    registro.erros = 0
    registro.bloqueadoAte = Date.now() + MINUTOS_BLOQUEIO * 60000
  }
  tentativas.set(chave, registro)
}

function guardarInicial(treinador, inicial) {
  treinador.inicialHash = hashPin(inicial, treinador.salt)
}

// Confere o PIN do nick. Se o nick ainda não tem PIN, o PIN informado passa a ser o dele
// (e aí é obrigatório escolher o inicial, usado para recuperar o PIN depois).
async function autenticar(nick, pin, inicial) {
  const erroPin = validarPin(pin)
  if (erroPin) return { status: 400, erro: erroPin }
  const inicialValido = INICIAIS.includes(inicial)

  const chave = nick.toLowerCase()
  const treinador = buscarTreinador(nick)
  if (!treinador) {
    if (!inicialValido) {
      return { status: 400, erro: 'Escolha o seu primeiro Pokémon: ele é usado para recuperar o PIN se você esquecer' }
    }
    const salt = crypto.randomBytes(16).toString('hex')
    // Se o nick já tem Pokémon, mantém a grafia usada neles (ex: "SrFos" mesmo digitando "srfos")
    const existente = pokemons.find(p => p.treinador.toLowerCase() === chave)
    const grafia = existente ? existente.treinador : nick
    const novo = { chave, nick: grafia, salt, pinHash: hashPin(pin, salt), criadoEm: new Date().toISOString() }
    guardarInicial(novo, inicial)
    db.treinadores.push(novo)
    await db.salvarTreinador(novo)
    return { ok: true, novo: true }
  }

  const bloqueado = bloqueio(chave)
  if (bloqueado) return { status: 429, erro: bloqueado }

  if (!confere(pin, treinador.salt, treinador.pinHash)) {
    registrarErro(chave)
    return { status: 401, erro: `PIN incorreto para o nick ${treinador.nick}` }
  }
  tentativas.delete(chave)

  // Quem criou o PIN antes da recuperação existir pode escolher o inicial agora
  if (!treinador.inicialHash && inicialValido) {
    guardarInicial(treinador, inicial)
    await db.salvarTreinador(treinador)
  }
  return { ok: true }
}

// ---------- Regras do jogo ----------
const ATRIBUTOS = ['hp', 'ataque', 'defesa', 'atqEsp', 'defEsp', 'velocidade']
const NOMES_ATRIBUTOS = { hp: 'HP', ataque: 'Ataque', defesa: 'Defesa', atqEsp: 'Atq. Esp', defEsp: 'Def. Esp', velocidade: 'Velocidade' }
// As 20 naturezas que mudam stats + as 5 neutras
const NOMES_NATUREZAS = [...Object.keys(NATUREZAS), 'Bashful', 'Docile', 'Hardy', 'Quirky', 'Serious']

function soma(obj) {
  return ATRIBUTOS.reduce((total, a) => total + obj[a], 0)
}

// A pontuação é calculada no servidor para ninguém conseguir "inventar" uma nota.
// 70% vem dos IVs e 30% dos stats projetados no Lv. 100 (igual ao "No Lv. 100" do jogo),
// assim um Pokémon de nível baixo não perde pontos só por ainda não ter treinado.
function calcularPontuacao(pokemon, base) {
  const stats = base
    ? calcularStats(base, pokemon.ivs, pokemon.evs, pokemon.natureza, 100)
    : pokemon.stats  // sem os stats base (PokéAPI fora do ar), usa os stats digitados
  const pontuacaoIV = (soma(pokemon.ivs) / 186) * 70
  const pontuacaoStats = Math.min(soma(stats) / 1500, 1) * 30
  return Math.round(pontuacaoIV + pontuacaoStats)
}

async function statsBase(nome) {
  try {
    const dados = await pokeapi.dadosDoPokemon(nome)
    return dados ? dados.base : null
  } catch (erro) {
    console.error('Sem stats base para ' + nome + ':', erro.message)
    return null
  }
}

async function pontuar(pokemon) {
  return calcularPontuacao(pokemon, await statsBase(pokemon.nome))
}

// Pokémon cadastrados antes do campo "jogo" existir eram todos do PokeMMO
async function marcarPlataformaAntiga() {
  const antigos = pokemons.filter(p => !p.plataforma)
  if (antigos.length === 0) return
  antigos.forEach(p => { p.plataforma = 'PokeMMO' })
  await db.salvarVariosPokemons(antigos)
  console.log(antigos.length + ' Pokémon marcado(s) como PokeMMO')
}

// Recalcula as notas de toda a base (ex: depois de mudar a fórmula)
async function recalcularNotas() {
  const alterados = []
  for (const pokemon of pokemons) {
    const nota = await pontuar(pokemon)
    if (nota !== pokemon.pontuacao) {
      pokemon.pontuacao = nota
      alterados.push(pokemon)
    }
  }
  if (alterados.length > 0) {
    await db.salvarVariosPokemons(alterados)
    console.log(alterados.length + ' nota(s) recalculada(s)')
  }
}

function numero(valor) {
  const n = parseInt(valor, 10)
  return Number.isFinite(n) ? n : 0
}

function texto(valor, max = 40) {
  return String(valor || '').trim().slice(0, max)
}

// Normaliza o que veio do formulário e devolve uma lista de erros
async function validarPokemon(corpo) {
  const erros = []

  const pokemon = {
    treinador: texto(corpo.treinador, 30),
    numero: texto(corpo.numero, 4),
    nome: texto(corpo.nome),
    tipo1: texto(corpo.tipo1, 15),
    tipo2: texto(corpo.tipo2, 15) || null,
    plataforma: texto(corpo.plataforma, 20),
    natureza: texto(corpo.natureza, 20),
    habilidade: texto(corpo.habilidade),
    // Para reconhecer o Pokémon no jogo (vários da mesma espécie parecem iguais no PC)
    apelido: texto(corpo.apelido, 20),
    sexo: ['M', 'F'].includes(corpo.sexo) ? corpo.sexo : '',
    alfa: corpo.alfa === true,
    shiny: corpo.shiny === true,
    nivel: numero(corpo.nivel),
    proxNivel: numero(corpo.proxNivel),
    stats: { felicidade: numero(corpo.stats && corpo.stats.felicidade) },
    evs: {},
    ivs: {},
    movimentos: (Array.isArray(corpo.movimentos) ? corpo.movimentos : [])
      .slice(0, 4)
      .map(m => ({ nome: texto(m && m.nome), tipo: texto(m && m.tipo, 15) }))
      .filter(m => m.nome)
  }

  ATRIBUTOS.forEach(function(a) {
    pokemon.stats[a] = numero(corpo.stats && corpo.stats[a])
    pokemon.evs[a] = numero(corpo.evs && corpo.evs[a])
    pokemon.ivs[a] = numero(corpo.ivs && corpo.ivs[a])

    const nomeAtributo = NOMES_ATRIBUTOS[a]
    if (pokemon.stats[a] < 0 || pokemon.stats[a] > 999) erros.push(`${nomeAtributo}: o stat deve estar entre 0 e 999`)
    if (pokemon.evs[a] < 0 || pokemon.evs[a] > 252) erros.push(`EV de ${nomeAtributo}: deve estar entre 0 e 252`)
    if (pokemon.ivs[a] < 0 || pokemon.ivs[a] > 31) erros.push(`IV de ${nomeAtributo}: deve estar entre 0 e 31`)
  })

  if (!pokemon.treinador) erros.push('Informe o seu nick do jogo')
  if (!PLATAFORMAS[pokemon.plataforma]) erros.push('Escolha de qual jogo é o Pokémon (PokeMMO, Pixelmon ou jogos oficiais)')
  if (!pokemon.nome) erros.push('Informe o nome do Pokémon')
  if (soma(pokemon.evs) > 510) erros.push('O total de EVs não pode passar de 510')
  if (pokemon.nivel < 1 || pokemon.nivel > 100) erros.push('O nível deve estar entre 1 e 100')
  if (pokemon.stats.felicidade < 0 || pokemon.stats.felicidade > 100) erros.push('A felicidade deve estar entre 0 e 100%')
  if (pokemon.natureza && !NOMES_NATUREZAS.includes(pokemon.natureza)) erros.push(`A natureza "${pokemon.natureza}" não existe`)

  if (pokemon.nome) erros.push(...await conferirComDadosOficiais(pokemon))
  return { pokemon, erros }
}

// Confere com a PokéAPI se o Pokémon existe e se ele aprende os ataques informados.
// Também corrige nome, número, tipos e o tipo de cada ataque pelos dados oficiais.
async function conferirComDadosOficiais(pokemon) {
  let dados
  try {
    dados = await pokeapi.dadosDoPokemon(pokemon.nome)
  } catch (erro) {
    // PokéAPI fora do ar: não dá para conferir, então aceita o que foi digitado
    console.error('Sem PokéAPI para conferir ' + pokemon.nome + ':', erro.message)
    return []
  }
  if (!dados) return [`O Pokémon "${pokemon.nome}" não existe. Confira o nome ou use o número da Pokédex.`]

  pokemon.nome = dados.nome
  pokemon.numero = dados.numero
  pokemon.tipo1 = dados.tipos[0] || ''
  pokemon.tipo2 = dados.tipos[1] || null

  const erros = []
  const aprende = new Map(dados.ataques.map(a => [a.nome.toLowerCase(), a]))
  pokemon.movimentos.forEach(function(m) {
    const oficial = aprende.get(m.nome.toLowerCase())
    if (!oficial) {
      erros.push(`${dados.nome} não aprende o ataque "${m.nome}"`)
      return
    }
    m.nome = oficial.nome
    m.tipo = oficial.tipo
  })
  return erros
}

function mesmaEspecie(nome) {
  const alvo = nome.toLowerCase()
  return pokemons.filter(p => p.nome.toLowerCase() === alvo)
}

// Ranking de uma espécie num jogo: do mais forte para o mais fraco.
// Pokémon de jogos diferentes não se comparam (regras diferentes).
function rankingDaEspecie(nome, plataforma) {
  return mesmaEspecie(nome)
    .filter(p => !plataforma || plataformaDe(p) === plataforma)
    .sort((a, b) => b.pontuacao - a.pontuacao)
}

// Mesmo treinador com um Pokémon idêntico (espécie, nível, stats, IVs e EVs) = cadastro repetido.
// `ignorarId` deixa de fora o próprio Pokémon quando ele está sendo editado.
function encontrarRepetido(pokemon, ignorarId) {
  return mesmaEspecie(pokemon.nome).find(p =>
    p.id !== ignorarId &&
    plataformaDe(p) === pokemon.plataforma &&
    p.treinador.toLowerCase() === pokemon.treinador.toLowerCase() &&
    p.nivel === pokemon.nivel &&
    ATRIBUTOS.every(a =>
      p.ivs[a] === pokemon.ivs[a] && p.evs[a] === pokemon.evs[a] && p.stats[a] === pokemon.stats[a]
    )
  )
}

// Histórico: a cada edição guarda como o Pokémon estava antes (nível, espécie, stats, ataques...).
// Serve para comparar a evolução e estimar os EVs ganhos entre um save e outro.
const CAMPOS_HISTORICO = ['nome', 'numero', 'tipo1', 'tipo2', 'nivel', 'natureza', 'habilidade', 'stats', 'ivs', 'evs', 'movimentos']
const MAX_HISTORICO = 50

function adicionarAoHistorico(original, novo) {
  const historico = Array.isArray(original.historico) ? original.historico : []
  const foto = Object.fromEntries(CAMPOS_HISTORICO.map(c => [c, original[c]]))
  const mudou = CAMPOS_HISTORICO.some(c => JSON.stringify(original[c]) !== JSON.stringify(novo[c]))
  if (!mudou) return historico
  foto.data = original.atualizadoEm || original.criadoEm
  return historico.concat(foto).slice(-MAX_HISTORICO)
}

// ---------- Leituras de stats ----------
// A cada save o servidor anota nível, stats e EVs (uma por nível). Com stats de vários níveis,
// o "Descobrir IVs" fica exato. Só o servidor grava: o navegador não consegue inventar leituras.
const MAX_LEITURAS = 40

function leituraDe(p) {
  return {
    nivel: p.nivel,
    stats: Object.fromEntries(ATRIBUTOS.map(a => [a, p.stats[a]])),
    evs: Object.fromEntries(ATRIBUTOS.map(a => [a, p.evs[a] || 0]))
  }
}

function comLeitura(lista, p) {
  return lista
    .filter(l => l.nivel !== p.nivel)
    .concat(leituraDe(p))
    .sort((a, b) => a.nivel - b.nivel)
    .slice(-MAX_LEITURAS)
}

// ---------- Regras de edição ----------
// Nas primeiras 24 horas dá para corrigir tudo (erro de digitação no cadastro).
// Depois, só vale o que é possível no jogo: subir de nível, evoluir, ganhar EVs, trocar ataques.
const HORAS_PARA_CORRIGIR = 24

function podeCorrigirTudo(original) {
  return Date.now() - new Date(original.criadoEm).getTime() < HORAS_PARA_CORRIGIR * 3600 * 1000
}

async function validarEdicao(original, novo) {
  if (podeCorrigirTudo(original)) return []
  const erros = []
  const plataforma = plataformaDe(original)

  if (novo.plataforma !== plataforma) erros.push('O jogo não pode mudar depois do cadastro')
  if (novo.nivel < original.nivel) erros.push(`O nível não pode diminuir (estava no Nv ${original.nivel})`)
  if (novo.natureza !== original.natureza) erros.push(`A natureza não muda no jogo (é ${original.natureza || 'neutra'})`)
  if (novo.sexo !== (original.sexo || '')) erros.push('O sexo não muda no jogo')
  if (novo.shiny !== Boolean(original.shiny)) erros.push('Shiny não muda no jogo')
  if (novo.alfa !== Boolean(original.alfa)) erros.push('Alfa não muda no jogo')

  // Espécie: a mesma ou uma evolução dela
  const evoluiu = novo.nome.toLowerCase() !== original.nome.toLowerCase()
  if (evoluiu) {
    let ok = null
    try { ok = await pokeapi.evoluiPara(original.nome, novo.nome) } catch (e) { ok = null }
    if (ok === false) erros.push(`${original.nome} não evolui para ${novo.nome}`)
    if (ok === null) erros.push('Não foi possível conferir a evolução agora. Tente de novo em alguns minutos.')
  }

  // Stats não caem com nível nem com evolução; só se os EVs daquele stat diminuíram (frutas, reset de EVs)
  if (!evoluiu) {
    ATRIBUTOS.forEach(function(a) {
      const evCaiu = (novo.evs[a] || 0) < (original.evs[a] || 0)
      if (!evCaiu && novo.stats[a] < original.stats[a]) {
        erros.push(`${NOMES_ATRIBUTOS[a]} não pode cair de ${original.stats[a]} para ${novo.stats[a]} sem diminuir os EVs`)
      }
    })
  }

  // IVs: no PokeMMO o jogo mostra o valor exato, então não mudam.
  // Nos outros jogos podem ir para 31 a partir do Nv 50 (Hyper Training / Bottle Cap) ou ser corrigidos,
  // desde que o novo IV feche a conta com os stats de todos os saves anteriores.
  const ivsMudaram = ATRIBUTOS.filter(a => novo.ivs[a] !== original.ivs[a])
  if (ivsMudaram.length && plataforma === 'PokeMMO') {
    erros.push('No PokeMMO os IVs aparecem no jogo e não mudam: ' + ivsMudaram.map(a => NOMES_ATRIBUTOS[a]).join(', '))
  } else if (ivsMudaram.length) {
    const versoes = [...(original.historico || []), original, novo]
    for (const a of ivsMudaram.filter(a => !(novo.ivs[a] === 31 && novo.nivel >= 50))) {
      for (const v of versoes) {
        const base = await statsBase(v.nome)
        if (!base) continue
        let fecha = false
        for (let ev = 0; ev <= 252 && !fecha; ev++) {
          fecha = calcularStats(base, { [a]: novo.ivs[a] }, { [a]: ev }, novo.natureza, v.nivel)[a] === v.stats[a]
        }
        if (!fecha) {
          erros.push(`IV ${novo.ivs[a]} de ${NOMES_ATRIBUTOS[a]} não bate com o save do Nv ${v.nivel} (${NOMES_ATRIBUTOS[a]} ${v.stats[a]}). Use o 🧮 Descobrir IVs.`)
          break
        }
      }
    }
  }
  return erros
}

// ---------- Rotas ----------
app.get('/api/status', function(req, res) {
  res.json({ mensagem: 'Servidor da Pokédex funcionando!', total: pokemons.length })
})

// O que é público não diz de quem é o Pokémon: sem treinador e sem apelido.
// Só o próprio treinador vê esses dados, em "Meus Pokémon" (com o PIN).
function publico(pokemon) {
  const { treinador, apelido, leituras, historico, ...resto } = pokemon
  return resto
}

// Lista todos (filtro opcional: ?especie=Pikachu)
app.get('/api/pokemons', function(req, res) {
  let lista = pokemons
  if (req.query.especie) {
    const e = String(req.query.especie).toLowerCase()
    lista = lista.filter(p => p.nome.toLowerCase() === e)
  }
  res.json(lista.map(publico))
})

// Comparativo de uma espécie entre todos os treinadores
app.get('/api/ranking/:especie', function(req, res) {
  const plataforma = PLATAFORMAS[req.query.plataforma] ? req.query.plataforma : null
  const ranking = rankingDaEspecie(req.params.especie, plataforma)
  const media = ranking.length
    ? Math.round(ranking.reduce((t, p) => t + p.pontuacao, 0) / ranking.length)
    : 0
  res.json({ especie: req.params.especie, total: ranking.length, media, ranking: ranking.map(publico) })
})

// "Meus Pokémon": com nick + PIN, devolve os Pokémon do treinador com todos os dados.
// Se o nick ainda não tem PIN, cria (com o primeiro Pokémon, igual ao cadastro).
app.post('/api/meus', async function(req, res) {
  const nick = String((req.body && req.body.nick) || '').trim().slice(0, 30)
  if (!nick) return res.status(400).json({ erros: ['Informe o seu nick do jogo'] })

  const auth = await autenticar(nick, req.body.pin, req.body.inicial)
  if (!auth.ok) return res.status(auth.status).json({ erros: [auth.erro] })

  const chave = nick.toLowerCase()
  const meus = pokemons.filter(p => p.treinador.toLowerCase() === chave)
  const treinador = buscarTreinador(nick)
  // Para o "Testar contra" das Dicas: quem está logado vê de quem é cada Pokémon (sem o apelido)
  const adversarios = pokemons.map(p => ({ ...publico(p), treinador: p.treinador }))
  res.json({ nick: treinador.nick, pinCriado: Boolean(auth.novo), pokemons: meus, adversarios })
})

// Nomes de todas as espécies (autocompletar do cadastro)
app.get('/api/especies', async function(req, res) {
  try {
    res.json(await pokeapi.listarEspecies())
  } catch (erro) {
    console.error(erro)
    res.status(502).json({ erro: 'Não foi possível consultar a PokéAPI' })
  }
})

// Dados oficiais de uma espécie: número, tipos, habilidades e ataques que ela aprende.
// Junta os ataques mais usados pelos treinadores da base com essa espécie.
app.get('/api/especies/:nome', async function(req, res) {
  try {
    const dados = await pokeapi.dadosDoPokemon(req.params.nome)
    if (!dados) return res.status(404).json({ erro: 'Pokémon não encontrado' })

    const uso = {}
    mesmaEspecie(dados.nome).forEach(function(p) {
      p.movimentos.forEach(function(m) {
        const chave = m.nome.toLowerCase()
        uso[chave] = (uso[chave] || 0) + 1
      })
    })
    const populares = Object.entries(uso)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nome, vezes]) => ({ nome, vezes }))

    res.json({ ...dados, populares })
  } catch (erro) {
    console.error(erro)
    res.status(502).json({ erro: 'Não foi possível consultar a PokéAPI' })
  }
})

// Cadastra um Pokémon e já devolve como ele ficou no ranking da espécie
app.post('/api/pokemons', async function(req, res) {
  const { pokemon, erros } = await validarPokemon(req.body || {})
  if (erros.length > 0) {
    return res.status(400).json({ erros })
  }

  const auth = await autenticar(pokemon.treinador, req.body.pin, req.body.inicial)
  if (!auth.ok) return res.status(auth.status).json({ erros: [auth.erro] })

  const anteriores = rankingDaEspecie(pokemon.nome, pokemon.plataforma)

  if (encontrarRepetido(pokemon)) {
    return res.status(409).json({
      erros: [`Você já cadastrou esse ${pokemon.nome} (mesmo nível, stats, IVs e EVs).`]
    })
  }

  pokemon.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  pokemon.leituras = comLeitura([], pokemon)
  pokemon.pontuacao = await pontuar(pokemon)
  pokemon.criadoEm = new Date().toISOString()

  pokemons.push(pokemon)
  await db.salvarPokemon(pokemon)

  const ranking = rankingDaEspecie(pokemon.nome, pokemon.plataforma)
  res.status(201).json({
    pokemon,
    pinCriado: Boolean(auth.novo),
    comparacao: {
      posicao: ranking.findIndex(p => p.id === pokemon.id) + 1,
      total: ranking.length,
      melhorAnterior: anteriores[0] ? publico(anteriores[0]) : null
    }
  })
})

// Diz se o nick já tem PIN, para o formulário mostrar "crie um PIN" ou "digite seu PIN"
app.get('/api/treinadores/:nick', function(req, res) {
  const nick = String(req.params.nick).trim()
  const treinador = buscarTreinador(nick)
  res.json({ temPin: Boolean(treinador), temInicial: Boolean(treinador && treinador.inicialHash) })
})

// "Esqueci meu PIN": quem acerta o primeiro Pokémon do nick define um PIN novo
app.post('/api/treinadores/recuperar', async function(req, res) {
  const nick = String((req.body && req.body.nick) || '').trim()
  const { inicial, novoPin } = req.body || {}
  const treinador = nick && buscarTreinador(nick)
  if (!treinador) return res.status(404).json({ erros: ['Esse nick ainda não tem PIN. É só cadastrar um Pokémon para criar.'] })
  if (!treinador.inicialHash) {
    return res.status(400).json({ erros: ['Esse nick não escolheu um primeiro Pokémon, então não dá para recuperar o PIN por aqui.'] })
  }

  const erroPin = validarPin(novoPin)
  if (erroPin) return res.status(400).json({ erros: ['Novo PIN: ' + erroPin] })

  const bloqueado = bloqueio(treinador.chave)
  if (bloqueado) return res.status(429).json({ erros: [bloqueado] })

  if (!INICIAIS.includes(inicial) || !confere(inicial, treinador.salt, treinador.inicialHash)) {
    registrarErro(treinador.chave)
    return res.status(401).json({ erros: ['Esse não é o primeiro Pokémon cadastrado para este nick'] })
  }

  tentativas.delete(treinador.chave)
  // Novo salt para o PIN; o inicial é recalculado com ele para continuar valendo
  treinador.salt = crypto.randomBytes(16).toString('hex')
  treinador.pinHash = hashPin(String(novoPin), treinador.salt)
  guardarInicial(treinador, inicial)
  treinador.pinAlteradoEm = new Date().toISOString()
  await db.salvarTreinador(treinador)
  res.json({ ok: true })
})

// Um Pokémon só (sem dados do dono; a edição usa "Meus Pokémon", que pede o PIN)
app.get('/api/pokemons/:id', function(req, res) {
  const pokemon = pokemons.find(p => p.id === req.params.id)
  if (!pokemon) return res.status(404).json({ erros: ['Pokémon não encontrado'] })
  res.json(publico(pokemon))
})

// Edita um Pokémon. Só o mesmo treinador que cadastrou pode editar.
app.put('/api/pokemons/:id', async function(req, res) {
  const indice = pokemons.findIndex(p => p.id === req.params.id)
  if (indice === -1) return res.status(404).json({ erros: ['Pokémon não encontrado'] })

  const original = pokemons[indice]
  const { pokemon, erros } = await validarPokemon(req.body || {})
  if (erros.length > 0) return res.status(400).json({ erros })

  if (pokemon.treinador.toLowerCase() !== original.treinador.toLowerCase()) {
    return res.status(403).json({ erros: ['Só quem cadastrou este Pokémon pode editá-lo'] })
  }
  const auth = await autenticar(original.treinador, req.body.pin, req.body.inicial)
  if (!auth.ok) return res.status(auth.status).json({ erros: [auth.erro] })

  const errosEdicao = await validarEdicao(original, pokemon)
  if (errosEdicao.length > 0) return res.status(400).json({ erros: errosEdicao })

  if (encontrarRepetido(pokemon, original.id)) {
    return res.status(409).json({
      erros: [`Você já tem outro ${pokemon.nome} igual a este (mesmo nível, stats, IVs e EVs).`]
    })
  }

  // Mantém identidade e data de criação; recalcula a nota
  pokemon.id = original.id
  pokemon.treinador = original.treinador
  pokemon.criadoEm = original.criadoEm
  pokemon.historico = adicionarAoHistorico(original, pokemon)
  // Leituras: as antigas + a de agora. Se na janela de correção o nível foi diminuído, o nível antigo estava errado.
  let anteriores = Array.isArray(original.leituras) && original.leituras.length ? original.leituras : [leituraDe(original)]
  if (podeCorrigirTudo(original) && pokemon.nivel < original.nivel) anteriores = anteriores.filter(l => l.nivel !== original.nivel)
  pokemon.leituras = comLeitura(anteriores, pokemon)
  pokemon.atualizadoEm = new Date().toISOString()
  pokemon.pontuacao = await pontuar(pokemon)

  pokemons[indice] = pokemon
  await db.salvarPokemon(pokemon)

  const ranking = rankingDaEspecie(pokemon.nome, pokemon.plataforma)
  res.json({
    pokemon,
    comparacao: {
      posicao: ranking.findIndex(p => p.id === pokemon.id) + 1,
      total: ranking.length
    }
  })
})

// Conecta no banco antes de começar a atender
const PORT = process.env.PORT || 3000
db.iniciar()
  .then(function() {
    app.listen(PORT, function() {
      console.log('Servidor rodando na porta ' + PORT)
      console.log(pokemons.length + ' Pokémon(s) no banco')
      // Um depois do outro: os dois gravam a base
      marcarPlataformaAntiga()
        .then(recalcularNotas)
        .catch(erro => console.error('Erro ao atualizar a base:', erro))
    })
  })
  .catch(function(erro) {
    console.error('Não foi possível conectar ao banco de dados:', erro.message)
    process.exit(1)
  })
