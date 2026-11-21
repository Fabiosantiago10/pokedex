import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

import { Montagem, mesclar, normalizar, chave, completo } from '../src/juntar.js'
import { comparar } from '../src/comparar.js'
import { inserirOuAtualizar } from '../src/base.js'
import { Detector, miniatura, imagemPequena, imagemGrande } from '../src/captura.js'

const abaStats = { nome: 'Garchomp', natureza: 'Jolly', nivel: 40, ivs: { hp: 31, ataque: 31, defesa: 20, atqEsp: 5, defEsp: 12, velocidade: 31 }, evs: { hp: 0, ataque: 30, defesa: null, atqEsp: 0, defEsp: 0, velocidade: 40 } }
const abaGolpes = { nome: 'Garchomp', movimentos: [{ nome: 'Earthquake', tipo: 'Ground' }, { nome: 'Dragon Claw', tipo: 'Dragon' }], natureza: null }

test('junta as abas do mesmo Pokémon e fecha ao trocar de Pokémon', () => {
  const m = new Montagem(1000)
  assert.equal(m.adicionar(abaStats, 0), null)
  assert.equal(m.completo(), false)
  assert.equal(m.adicionar(abaGolpes, 10), null)
  assert.equal(m.completo(), true)
  assert.equal(m.atual.natureza, 'Jolly', 'null de outra aba não apaga valor lido')
  const anterior = m.adicionar({ nome: 'Lucario' }, 20)
  assert.equal(anterior.nome, 'Garchomp')
  assert.equal(m.atual.nome, 'Lucario')
  assert.equal(m.verificarTempo(500), null)
  assert.equal(m.verificarTempo(2000).nome, 'Lucario')
})

test('normaliza no formato do site com totais', () => {
  const p = normalizar(mesclar(mesclar({}, abaStats), abaGolpes))
  assert.equal(p.ivs.total, 130)
  assert.equal(p.evs.total, 70)
  assert.equal(p.evs.defesa, null)
  assert.equal(p.stats.hpMax, null)
  assert.equal(p.numero, '???')
  assert.ok(completo(p))
})

test('compara com a mesma espécie e insere/atualiza sem duplicar', () => {
  const novo = normalizar({ ...abaStats, ...abaGolpes, natureza: 'Jolly' })
  const outro = normalizar({ ...abaStats, natureza: 'Adamant', ivs: { hp: 31, ataque: 31, defesa: 31, atqEsp: 31, defEsp: 31, velocidade: 31 } })
  const c = comparar(novo, [outro, normalizar({ nome: 'Pikachu', natureza: 'Hasty', ivs: abaStats.ivs })])
  assert.equal(c.posicao, 2)
  assert.equal(c.totalEspecie, 2)
  assert.match(c.texto, /2º de 2 Garchomp/)
  assert.deepEqual(c.ivs31, ['HP', 'Ataque', 'Velocidade'])

  const lista = [outro]
  assert.equal(inserirOuAtualizar(lista, { ...novo, avaliacao: { nota: 7 } }), 'novo')
  const subiuNivel = { ...novo, nivel: 50, evs: { ...novo.evs, ataque: 100 } }
  assert.equal(inserirOuAtualizar(lista, subiuNivel), 'atualizado')
  assert.equal(lista.length, 2)
  assert.equal(lista[1].nivel, 50)
  assert.equal(lista[1].evs.ataque, 100)
  assert.equal(lista[1].avaliacao.nota, 7)
  assert.equal(chave(lista[1]), chave(novo))
})

test('detector só dispara com tela parada e diferente da última analisada', async () => {
  const img = cor => sharp({ create: { width: 320, height: 180, channels: 3, background: cor } }).png().toBuffer()
  const a = await miniatura(await img('#000000'))
  const b = await miniatura(await img('#ffffff'))
  const d = new Detector({ telaParadaMs: 1000 })
  assert.equal(d.avaliar(a, 0), false)
  assert.equal(d.avaliar(a, 500), false)
  assert.equal(d.avaliar(a, 1200), true)
  assert.equal(d.avaliar(a, 2500), false, 'mesma tela não é analisada de novo')
  assert.equal(d.avaliar(b, 2600), false, 'acabou de mudar')
  assert.equal(d.avaliar(b, 3700), true)
  const grande = await img('#123456')
  assert.ok((await imagemPequena(grande)).length > 0)
  assert.ok((await imagemGrande(grande)).length > 0)
})

test('ponta a ponta: lê as abas, avalia e salva (API simulada, modo local)', async () => {
  const respostas = {
    registrar_pokemon: [abaStats, abaGolpes],
    avaliar_pokemon: [{ nota: 8, resumo: 'Bom físico rápido.', valeTreinar: true, naturezaIdeal: 'Jolly', evsSugeridos: { hp: 4, ataque: 252, defesa: 0, atqEsp: 0, defEsp: 0, velocidade: 252 }, golpesSugeridos: ['Earthquake', 'Outrage', 'Swords Dance', 'Stone Edge'], item: 'Life Orb', melhorar: ['SpD baixo não importa'] }]
  }
  const pedidos = []
  const servidor = http.createServer((req, res) => {
    let corpo = ''
    req.on('data', c => (corpo += c))
    req.on('end', () => {
      const pedido = JSON.parse(corpo)
      pedidos.push(pedido)
      const nome = pedido.tools[0].name
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: 'msg_1', type: 'message', role: 'assistant', model: pedido.model, stop_reason: 'tool_use', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
        content: [{ type: 'tool_use', id: 't1', name: nome, input: respostas[nome].shift() }]
      }))
    })
  })
  await new Promise(r => servidor.listen(0, r))
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), 'pokedex-'))
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${servidor.address().port}`
  process.env.ANTHROPIC_API_KEY = 'teste'
  process.env.SO_LOCAL = 'true'

  const { config } = await import('../src/config.js')
  config.anthropicKey = 'teste'
  config.soLocal = true
  config.pastaDados = pasta
  const { lerResumo } = await import('../src/claude.js')
  const { processarPokemon } = await import('../src/processar.js')

  const m = new Montagem(Infinity)
  m.adicionar(await lerResumo(Buffer.from('x')))
  m.adicionar(await lerResumo(Buffer.from('x')))
  const r = await processarPokemon(m.fechar())
  assert.equal(r.acao, 'novo')
  assert.equal(r.pokemon.avaliacao.nota, 8)
  assert.match(r.pokemon.avaliacao.comparacao, /Primeiro Garchomp/)

  const salvo = JSON.parse(await fs.readFile(path.join(pasta, 'pokemons.json'), 'utf8'))
  assert.equal(salvo.length, 1)
  assert.equal(salvo[0].ivs.total, 130)

  // Ver o mesmo Pokémon de novo não gasta outra avaliação
  const antes = pedidos.length
  const r2 = await processarPokemon({ ...abaStats, ...abaGolpes, natureza: 'Jolly', nivel: 45 })
  assert.equal(r2.acao, 'atualizado')
  assert.equal(pedidos.length, antes)
  assert.equal(JSON.parse(await fs.readFile(path.join(pasta, 'pokemons.json'), 'utf8'))[0].nivel, 45)
  assert.equal(pedidos[0].tool_choice.name, 'registrar_pokemon')
  servidor.close()
})
