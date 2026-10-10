// Copia os Pokémon e os PINs salvos neste computador (pasta data/) para o MongoDB Atlas.
// Pode rodar mais de uma vez: quem já existe no banco é atualizado, não duplicado.
//
// Uso: node migrar-para-mongo.js "mongodb+srv://usuario:senha@cluster.../"
const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')

const uri = process.argv[2] || process.env.MONGODB_URI
if (!uri) {
  console.error('Informe o endereço do MongoDB: node migrar-para-mongo.js "mongodb+srv://..."')
  process.exit(1)
}

function ler(arquivo) {
  const caminho = path.join(__dirname, 'data', arquivo)
  return fs.existsSync(caminho) ? JSON.parse(fs.readFileSync(caminho, 'utf8')) : []
}

async function migrar() {
  const pokemons = ler('pokemons.json')
  const treinadores = ler('treinadores.json')

  const cliente = new MongoClient(uri)
  await cliente.connect()
  try {
    const banco = cliente.db(process.env.MONGODB_DB || 'pokedex')

    if (pokemons.length > 0) {
      await banco.collection('pokemons').bulkWrite(pokemons.map(p => ({
        replaceOne: { filter: { id: p.id }, replacement: p, upsert: true }
      })))
    }
    if (treinadores.length > 0) {
      await banco.collection('treinadores').bulkWrite(treinadores.map(t => ({
        replaceOne: { filter: { chave: t.chave }, replacement: t, upsert: true }
      })))
    }

    console.log(`${pokemons.length} Pokémon e ${treinadores.length} PIN(s) copiados para o MongoDB.`)
    console.log(`Agora o banco tem ${await banco.collection('pokemons').countDocuments()} Pokémon.`)
  } finally {
    await cliente.close()
  }
}

migrar().catch(function(erro) {
  console.error('Erro na migração:', erro.message)
  process.exit(1)
})
