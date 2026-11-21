// Agente "Minha Pokédex": assiste a tela enquanto você joga PokeMMO.
// Ele só tira fotos da tela — não aperta teclas, não clica e não lê a memória do jogo.
import fs from 'node:fs/promises'
import path from 'node:path'
import { config, exigir } from './config.js'
import { Detector, capturarTela, imagemGrande, imagemPequena, listarTelas, miniatura } from './captura.js'
import { classificarTela, lerResumo } from './claude.js'
import { Montagem } from './juntar.js'
import { notificar } from './notificar.js'
import { processarPokemon } from './processar.js'

if (process.argv.includes('--listar-telas')) {
  const telas = await listarTelas()
  console.log('Monitores encontrados (use o id em MONITOR no .env):')
  for (const t of telas) console.log(`  id=${t.id}  ${t.name ?? ''}  ${t.width ?? ''}x${t.height ?? ''}`)
  process.exit(0)
}

exigir('anthropicKey')
if (!config.soLocal) exigir('githubToken')
await fs.mkdir(config.pastaCapturas, { recursive: true })

const detector = new Detector({ telaParadaMs: config.telaParadaMs })
const montagem = new Montagem(config.finalizarMs)
let ocupado = false
let ultimoErro = 0

async function guardarPrint(png, tipo) {
  const nome = `${new Date().toISOString().replace(/[:.]/g, '-')}-${tipo}.png`
  await fs.writeFile(path.join(config.pastaCapturas, nome), png)
}

async function finalizar(bruto) {
  try {
    await processarPokemon(bruto)
  } catch (e) {
    notificar('Erro ao cadastrar', `${bruto?.nome ?? 'Pokémon'}: ${e.message}`)
  }
}

async function ciclo() {
  if (ocupado) return
  ocupado = true
  try {
    const expirado = montagem.verificarTempo()
    if (expirado) await finalizar(expirado)

    const png = await capturarTela(config.monitor)
    if (!detector.avaliar(await miniatura(png))) return

    const { tela, especie } = await classificarTela(await imagemPequena(png))
    if (tela === 'captura') {
      await guardarPrint(png, 'captura')
      notificar(`Capturou ${especie || 'um Pokémon'}!`, 'Abra o resumo dele (stats, IVs e golpes) para eu cadastrar e avaliar.')
    } else if (tela === 'resumo') {
      await guardarPrint(png, 'resumo')
      const dados = await lerResumo(await imagemGrande(png))
      console.log(`Lendo resumo: ${dados.nome ?? '?'}`)
      const anterior = montagem.adicionar(dados)
      if (anterior) await finalizar(anterior)
      if (montagem.completo()) await finalizar(montagem.fechar())
    }
  } catch (e) {
    // Evita encher a tela de erros repetidos (ex.: internet caiu)
    if (Date.now() - ultimoErro > 30000) console.error(`Erro: ${e.message}`)
    ultimoErro = Date.now()
  } finally {
    ocupado = false
  }
}

async function sair() {
  const pendente = montagem.fechar()
  if (pendente) await finalizar(pendente)
  process.exit(0)
}
process.on('SIGINT', sair)
process.on('SIGTERM', sair)

console.log(`Minha Pokédex assistindo a tela ${config.monitor ?? 'principal'} a cada ${config.intervaloMs} ms. Salvando em ${config.soLocal ? 'agente/dados (só local)' : `${config.githubRepo}/${config.githubArquivo}`}.`)
console.log('Capture um Pokémon e abra o resumo dele. Ctrl+C para parar.')
setInterval(ciclo, config.intervaloMs)
