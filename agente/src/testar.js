// Testa o agente com prints salvos, sem ficar assistindo a tela.
// Uso: npm run testar -- print-stats.png print-golpes.png [--salvar]
import fs from 'node:fs/promises'
import { exigir } from './config.js'
import { imagemGrande, imagemPequena } from './captura.js'
import { classificarTela, lerResumo } from './claude.js'
import { Montagem } from './juntar.js'
import { processarPokemon } from './processar.js'

const args = process.argv.slice(2)
const salvar = args.includes('--salvar')
const arquivos = args.filter(a => !a.startsWith('--'))
if (!arquivos.length) {
  console.log('Uso: npm run testar -- print1.png [print2.png ...] [--salvar]')
  process.exit(1)
}
exigir('anthropicKey')
if (salvar) exigir('githubToken')

const montagem = new Montagem(Infinity)
for (const arquivo of arquivos) {
  const png = await fs.readFile(arquivo)
  const { tela, especie } = await classificarTela(await imagemPequena(png))
  console.log(`${arquivo}: tela = ${tela}${especie ? ` (${especie})` : ''}`)
  if (tela !== 'resumo') continue
  const dados = await lerResumo(await imagemGrande(png))
  console.log(JSON.stringify(dados, null, 2))
  montagem.adicionar(dados)
}

const pokemon = montagem.fechar()
if (!pokemon) {
  console.log('Nenhuma tela de resumo encontrada nos prints.')
  process.exit(0)
}
const resultado = await processarPokemon(pokemon, { salvar })
if (resultado) console.log(`\nResultado (${resultado.acao}):\n${JSON.stringify(resultado.pokemon, null, 2)}`)
