// Captura da tela e detecção local (sem custo) de quando vale a pena olhar com atenção.
// O agente SÓ tira fotos da tela: não envia teclas, cliques nem lê a memória do jogo.
import screenshot from 'screenshot-desktop'
import sharp from 'sharp'

export async function listarTelas() {
  return screenshot.listDisplays()
}

export async function capturarTela(monitor) {
  const opcoes = { format: 'png' }
  if (monitor !== undefined) opcoes.screen = monitor
  return screenshot(opcoes)
}

// Miniatura em cinza 64x36 para comparar quadros rapidamente
export async function miniatura(png) {
  return sharp(png).resize(64, 36, { fit: 'fill' }).greyscale().raw().toBuffer()
}

// Diferença média entre duas miniaturas (0 = iguais, 255 = totalmente diferentes)
export function diferenca(a, b) {
  if (!a || !b || a.length !== b.length) return 255
  let soma = 0
  for (let i = 0; i < a.length; i++) soma += Math.abs(a[i] - b[i])
  return soma / a.length
}

// Versões da imagem para mandar ao Claude
export async function imagemPequena(png) {
  return sharp(png).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 60 }).toBuffer()
}

export async function imagemGrande(png) {
  return sharp(png).resize({ width: 1600, withoutEnlargement: true }).png().toBuffer()
}

// Decide quando analisar: a tela precisa estar parada (menus) e diferente da última analisada.
export class Detector {
  constructor({ telaParadaMs, limiarParada = 2.5, limiarNovo = 6 }) {
    this.telaParadaMs = telaParadaMs
    this.limiarParada = limiarParada
    this.limiarNovo = limiarNovo
    this.anterior = null
    this.paradaDesde = null
    this.ultimaAnalisada = null
  }

  // Retorna true quando este quadro merece ser classificado
  avaliar(mini, agora = Date.now()) {
    const mudou = diferenca(mini, this.anterior) > this.limiarParada
    this.anterior = mini
    if (mudou) {
      this.paradaDesde = agora
      return false
    }
    if (this.paradaDesde === null) this.paradaDesde = agora
    const parada = agora - this.paradaDesde >= this.telaParadaMs
    const nova = diferenca(mini, this.ultimaAnalisada) > this.limiarNovo
    if (parada && nova) {
      this.ultimaAnalisada = mini
      return true
    }
    return false
  }
}
