// Onde os dados ficam salvos:
// - Online (variável MONGODB_URI definida): no MongoDB Atlas, que não se perde quando o servidor reinicia.
// - No seu computador (sem MONGODB_URI): nos arquivos data/pokemons.json e data/treinadores.json.
//
// Os dados são carregados na memória quando o servidor inicia (a base é pequena),
// e cada alteração é gravada também no banco/arquivo.
const fs = require('fs')
const path = require('path')

const PASTA_DADOS = path.join(__dirname, 'data')
const ARQUIVOS = {
  pokemons: path.join(PASTA_DADOS, 'pokemons.json'),
  treinadores: path.join(PASTA_DADOS, 'treinadores.json')
}

const pokemons = []     // { id, treinador, nome, ivs, evs, ... }
const treinadores = []  // { chave (nick em minúsculas), nick, pinHash, salt, criadoEm }
let colecoes = null     // coleções do MongoDB, quando conectado

function lerArquivo(arquivo) {
  if (!fs.existsSync(arquivo)) return []
  const conteudo = fs.readFileSync(arquivo, 'utf8').trim()
  return conteudo ? JSON.parse(conteudo) : []
}

function gravarArquivo(arquivo, dados) {
  fs.mkdirSync(PASTA_DADOS, { recursive: true })
  // Escreve num arquivo temporário e renomeia, para não corromper os dados se o servidor cair no meio
  const temp = arquivo + '.tmp'
  fs.writeFileSync(temp, JSON.stringify(dados, null, 2))
  fs.renameSync(temp, arquivo)
}

async function iniciar() {
  const uri = process.env.MONGODB_URI
  if (uri) {
    const { MongoClient } = require('mongodb')
    const cliente = new MongoClient(uri)
    await cliente.connect()
    const banco = cliente.db(process.env.MONGODB_DB || 'pokedex')
    colecoes = { pokemons: banco.collection('pokemons'), treinadores: banco.collection('treinadores') }
    await colecoes.pokemons.createIndex({ id: 1 }, { unique: true })
    await colecoes.treinadores.createIndex({ chave: 1 }, { unique: true })
    pokemons.push(...await colecoes.pokemons.find({}, { projection: { _id: 0 } }).toArray())
    treinadores.push(...await colecoes.treinadores.find({}, { projection: { _id: 0 } }).toArray())
    console.log('Dados salvos no MongoDB')
  } else {
    pokemons.push(...lerArquivo(ARQUIVOS.pokemons))
    treinadores.push(...lerArquivo(ARQUIVOS.treinadores))
    console.log('Dados salvos em arquivos na pasta data/ (defina MONGODB_URI para usar o MongoDB)')
  }
}

// Grava um Pokémon novo ou alterado (ele já deve estar na lista `pokemons`)
async function salvarPokemon(pokemon) {
  if (colecoes) {
    await colecoes.pokemons.replaceOne({ id: pokemon.id }, pokemon, { upsert: true })
  } else {
    gravarArquivo(ARQUIVOS.pokemons, pokemons)
  }
}

// Grava vários de uma vez (ex: depois de recalcular as notas)
async function salvarVariosPokemons(lista) {
  if (lista.length === 0) return
  if (colecoes) {
    await colecoes.pokemons.bulkWrite(lista.map(p => ({
      replaceOne: { filter: { id: p.id }, replacement: p, upsert: true }
    })))
  } else {
    gravarArquivo(ARQUIVOS.pokemons, pokemons)
  }
}

async function salvarTreinador(treinador) {
  if (colecoes) {
    await colecoes.treinadores.replaceOne({ chave: treinador.chave }, treinador, { upsert: true })
  } else {
    gravarArquivo(ARQUIVOS.treinadores, treinadores)
  }
}

module.exports = { pokemons, treinadores, iniciar, salvarPokemon, salvarVariosPokemons, salvarTreinador }
