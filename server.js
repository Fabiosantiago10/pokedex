const express = require('express')
const cors = require('cors')
const path = require('path')
const crypto = require('crypto')
const db = require('./db')
const pokeapi = require('./pokeapi')
const { calcularStats } = require('./public/comum.js')

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

// Confere o PIN do nick. Se o nick ainda não tem PIN, o PIN informado passa a ser o dele.
async function autenticar(nick, pin) {
  pin = String(pin || '')
  if (pin.length < 4 || pin.length > 20) {
    return { status: 400, erro: 'O PIN deve ter de 4 a 20 caracteres' }
  }

  const chave = nick.toLowerCase()
  const treinador = buscarTreinador(nick)
  if (!treinador) {
    const salt = crypto.randomBytes(16).toString('hex')
    const novo = { chave, nick, salt, pinHash: hashPin(pin, salt), criadoEm: new Date().toISOString() }
    db.treinadores.push(novo)
    await db.salvarTreinador(novo)
    return { ok: true, novo: true }
  }

  // Muitos erros seguidos bloqueiam o nick por um tempo (evita testar todos os PINs)
  const registro = tentativas.get(chave) || { erros: 0, bloqueadoAte: 0 }
  if (registro.bloqueadoAte > Date.now()) {
    const minutos = Math.ceil((registro.bloqueadoAte - Date.now()) / 60000)
    return { status: 429, erro: `Muitas tentativas com PIN errado. Tente de novo em ${minutos} minuto(s).` }
  }

  const correto = crypto.timingSafeEqual(
    Buffer.from(hashPin(pin, treinador.salt), 'hex'),
    Buffer.from(treinador.pinHash, 'hex')
  )
  if (!correto) {
    registro.erros++
    if (registro.erros >= MAX_TENTATIVAS) {
      registro.erros = 0
      registro.bloqueadoAte = Date.now() + MINUTOS_BLOQUEIO * 60000
    }
    tentativas.set(chave, registro)
    return { status: 401, erro: `PIN incorreto para o nick ${treinador.nick}` }
  }

  tentativas.delete(chave)
  return { ok: true }
}

// ---------- Regras do jogo ----------
const ATRIBUTOS = ['hp', 'ataque', 'defesa', 'atqEsp', 'defEsp', 'velocidade']

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
function validarPokemon(corpo) {
  const erros = []

  const pokemon = {
    treinador: texto(corpo.treinador, 30),
    numero: texto(corpo.numero, 4),
    nome: texto(corpo.nome),
    tipo1: texto(corpo.tipo1, 15),
    tipo2: texto(corpo.tipo2, 15) || null,
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

    if (pokemon.stats[a] < 0 || pokemon.stats[a] > 999) erros.push(`Stat ${a} deve estar entre 0 e 999`)
    if (pokemon.evs[a] < 0 || pokemon.evs[a] > 252) erros.push(`EV ${a} deve estar entre 0 e 252`)
    if (pokemon.ivs[a] < 0 || pokemon.ivs[a] > 31) erros.push(`IV ${a} deve estar entre 0 e 31`)
  })

  if (!pokemon.treinador) erros.push('Informe o seu nick do jogo')
  if (!pokemon.nome) erros.push('Informe o nome do Pokémon')
  if (soma(pokemon.evs) > 510) erros.push('O total de EVs não pode passar de 510')
  if (pokemon.nivel < 1 || pokemon.nivel > 100) erros.push('O nível deve estar entre 1 e 100')
  return { pokemon, erros }
}

function mesmaEspecie(nome) {
  const alvo = nome.toLowerCase()
  return pokemons.filter(p => p.nome.toLowerCase() === alvo)
}

// Ranking de uma espécie: do mais forte para o mais fraco
function rankingDaEspecie(nome) {
  return mesmaEspecie(nome).sort((a, b) => b.pontuacao - a.pontuacao)
}

// Mesmo treinador com um Pokémon idêntico (espécie, nível, stats, IVs e EVs) = cadastro repetido.
// `ignorarId` deixa de fora o próprio Pokémon quando ele está sendo editado.
function encontrarRepetido(pokemon, ignorarId) {
  return mesmaEspecie(pokemon.nome).find(p =>
    p.id !== ignorarId &&
    p.treinador.toLowerCase() === pokemon.treinador.toLowerCase() &&
    p.nivel === pokemon.nivel &&
    ATRIBUTOS.every(a =>
      p.ivs[a] === pokemon.ivs[a] && p.evs[a] === pokemon.evs[a] && p.stats[a] === pokemon.stats[a]
    )
  )
}

// ---------- Rotas ----------
app.get('/api/status', function(req, res) {
  res.json({ mensagem: 'Servidor da Pokédex funcionando!', total: pokemons.length })
})

// Lista todos (filtros opcionais: ?treinador=Fabio&especie=Pikachu)
app.get('/api/pokemons', function(req, res) {
  let lista = pokemons
  if (req.query.treinador) {
    const t = String(req.query.treinador).toLowerCase()
    lista = lista.filter(p => p.treinador.toLowerCase() === t)
  }
  if (req.query.especie) {
    const e = String(req.query.especie).toLowerCase()
    lista = lista.filter(p => p.nome.toLowerCase() === e)
  }
  res.json(lista)
})

// Comparativo de uma espécie entre todos os treinadores
app.get('/api/ranking/:especie', function(req, res) {
  const ranking = rankingDaEspecie(req.params.especie)
  const media = ranking.length
    ? Math.round(ranking.reduce((t, p) => t + p.pontuacao, 0) / ranking.length)
    : 0
  res.json({ especie: req.params.especie, total: ranking.length, media, ranking })
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
  const { pokemon, erros } = validarPokemon(req.body || {})
  if (erros.length > 0) {
    return res.status(400).json({ erros })
  }

  const auth = await autenticar(pokemon.treinador, req.body.pin)
  if (!auth.ok) return res.status(auth.status).json({ erros: [auth.erro] })

  const anteriores = rankingDaEspecie(pokemon.nome)

  if (encontrarRepetido(pokemon)) {
    return res.status(409).json({
      erros: [`Você já cadastrou esse ${pokemon.nome} (mesmo nível, stats, IVs e EVs).`]
    })
  }

  pokemon.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  pokemon.pontuacao = await pontuar(pokemon)
  pokemon.criadoEm = new Date().toISOString()

  pokemons.push(pokemon)
  await db.salvarPokemon(pokemon)

  const ranking = rankingDaEspecie(pokemon.nome)
  res.status(201).json({
    pokemon,
    pinCriado: Boolean(auth.novo),
    comparacao: {
      posicao: ranking.findIndex(p => p.id === pokemon.id) + 1,
      total: ranking.length,
      melhorAnterior: anteriores[0] || null
    }
  })
})

// Diz se o nick já tem PIN, para o formulário mostrar "crie um PIN" ou "digite seu PIN"
app.get('/api/treinadores/:nick', function(req, res) {
  const nick = String(req.params.nick).trim()
  const temPokemons = pokemons.some(p => p.treinador.toLowerCase() === nick.toLowerCase())
  res.json({ temPin: Boolean(buscarTreinador(nick)), temPokemons })
})

// Um Pokémon só (usado pela tela de edição)
app.get('/api/pokemons/:id', function(req, res) {
  const pokemon = pokemons.find(p => p.id === req.params.id)
  if (!pokemon) return res.status(404).json({ erros: ['Pokémon não encontrado'] })
  res.json(pokemon)
})

// Edita um Pokémon. Só o mesmo treinador que cadastrou pode editar.
app.put('/api/pokemons/:id', async function(req, res) {
  const indice = pokemons.findIndex(p => p.id === req.params.id)
  if (indice === -1) return res.status(404).json({ erros: ['Pokémon não encontrado'] })

  const original = pokemons[indice]
  const { pokemon, erros } = validarPokemon(req.body || {})
  if (erros.length > 0) return res.status(400).json({ erros })

  if (pokemon.treinador.toLowerCase() !== original.treinador.toLowerCase()) {
    return res.status(403).json({ erros: ['Só quem cadastrou este Pokémon pode editá-lo'] })
  }
  const auth = await autenticar(original.treinador, req.body.pin)
  if (!auth.ok) return res.status(auth.status).json({ erros: [auth.erro] })

  if (encontrarRepetido(pokemon, original.id)) {
    return res.status(409).json({
      erros: [`Você já tem outro ${pokemon.nome} igual a este (mesmo nível, stats, IVs e EVs).`]
    })
  }

  // Mantém identidade e data de criação; recalcula a nota
  pokemon.id = original.id
  pokemon.treinador = original.treinador
  pokemon.criadoEm = original.criadoEm
  pokemon.atualizadoEm = new Date().toISOString()
  pokemon.pontuacao = await pontuar(pokemon)

  pokemons[indice] = pokemon
  await db.salvarPokemon(pokemon)

  const ranking = rankingDaEspecie(pokemon.nome)
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
      recalcularNotas().catch(erro => console.error('Erro ao recalcular notas:', erro))
    })
  })
  .catch(function(erro) {
    console.error('Não foi possível conectar ao banco de dados:', erro.message)
    process.exit(1)
  })
