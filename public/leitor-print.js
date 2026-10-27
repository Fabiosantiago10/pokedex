// "📷 Ler do print": lê os prints do Sumário do PokeMMO e preenche o cadastro.
// O reconhecimento de texto (Tesseract.js) roda no navegador: a imagem não sai do computador.
const BIBLIOTECA_OCR = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
let carregandoOcr = null

function carregarOcr() {
  if (!carregandoOcr) {
    carregandoOcr = new Promise(function(resolve, reject) {
      const script = document.createElement('script')
      script.src = BIBLIOTECA_OCR
      script.onload = resolve
      script.onerror = () => reject(new Error('Não foi possível carregar o leitor de prints'))
      document.head.appendChild(script)
    })
  }
  return carregandoOcr
}

// O Sumário tem texto claro em fundo escuro: aumenta, inverte e deixa só preto e branco (o OCR lê melhor)
// limiar: a partir de que claridade o pixel conta como texto (muda entre as leituras de nova tentativa)
function prepararImagem(imagem, limiar = 140) {
  const escala = imagem.width < 1400 ? 2 : 1
  const canvas = document.createElement('canvas')
  canvas.width = imagem.width * escala
  canvas.height = imagem.height * escala
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height)
  const dados = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = dados.data
  for (let i = 0; i < px.length; i += 4) {
    const luz = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    const valor = luz > limiar ? 0 : 255  // texto claro vira preto; fundo escuro vira branco
    px[i] = px[i + 1] = px[i + 2] = valor
  }
  ctx.putImageData(dados, 0, 0)
  return canvas
}

function abrirImagem(arquivo) {
  return new Promise(function(resolve, reject) {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => reject(new Error('Imagem inválida'))
    img.src = url
  })
}

// ---------- Entender o texto lido ----------
const NATUREZAS_TODAS = [...Object.keys(NATUREZAS), 'Hardy', 'Docile', 'Serious', 'Bashful', 'Quirky']

function semAcento(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// O OCR troca letras parecidas com números: "1s" = 15, "l" = 1, "O" = 0
function paraNumero(trecho) {
  const limpo = trecho.replace(/[sS]/g, '5').replace(/[lI|i!]/g, '1').replace(/[oOQD]/g, '0').replace(/[zZ]/g, '2').replace(/[bB]/g, '8')
  const m = limpo.match(/^\d{1,4}/)
  return m ? Number(m[0]) : null
}

// O número logo depois do rótulo (ex: "IV HP: 1s 2 Poliwag" -> 15). Em "HP: 13 / 13" fica com o máximo.
function numeroDoRotulo(linha) {
  const dois = linha.indexOf(':')
  const depois = (dois >= 0 ? linha.slice(dois + 1) : linha.replace(/^\D*/, '')).trim()
  const fracao = depois.match(/^([\dsSlIoO|]{1,3})\s*\/\s*([\dsSlIoO|]{1,3})/)
  if (fracao) return paraNumero(fracao[2])
  return paraNumero(depois)
}

// Qual stat a linha descreve (o OCR às vezes erra pontos e espaços, por isso a busca é tolerante)
function statDaLinha(linha) {
  const t = semAcento(linha).toLowerCase()
    .replace(/^\W*[i1l|][vy](?=\s|[a-z])/, ' ')  // tira o "IV" do começo, mesmo grudado ("IvDef")
    .replace(/^\W*e[vy](?=\s|[a-z])/, ' ')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ')
  if (/\batq\s*esp/.test(t)) return 'atqEsp'
  if (/\bdef\s*esp/.test(t)) return 'defEsp'
  if (/\bvel/.test(t)) return 'velocidade'
  if (/\bataque\b/.test(t)) return 'ataque'
  if (/\bdefesa\b/.test(t)) return 'defesa'
  if (/\bhp\b/.test(t)) return 'hp'
  return null
}

function lerTexto(texto) {
  const lido = { ivs: {}, evs: {}, stats: {}, repetido: false }
  texto.split(/\n+/).forEach(function(linhaOriginal) {
    const linha = linhaOriginal.trim()
    if (!linha) return
    const sem = semAcento(linha)

    let m
    if ((m = sem.match(/Pokedex\D{0,6}([\dlIoO]{1,4})/i))) lido.numero = paraNumero(m[1])
    if ((m = sem.match(/\b[Ll][vy]\.?\s*([\dlIoOsS|]{1,3})\b/)) || (m = sem.match(/\bNv\.?\s*([\dlIoOsS|]{1,3})\b/i))) {
      const nivel = paraNumero(m[1])
      if (nivel >= 1 && nivel <= 100) lido.nivel = nivel
    }
    if ((m = sem.match(/Felicidade\D{0,4}(\d{1,3})/i))) lido.felicidade = Number(m[1])
    if (/Natureza/i.test(sem)) {
      const natureza = NATUREZAS_TODAS.find(n => new RegExp('\\b' + n + '\\b', 'i').test(sem))
      if (natureza) lido.natureza = natureza
    }
    // Caixa do PC: "Nv. 19 Tauros ♂" (nível + espécie) e "Habilidade: Anger Point"
    if ((m = sem.match(/\bN[vy]\.?\s*[\dlIoOsS|]{1,3}\s+([A-Za-z][A-Za-z.'\- ]{1,20})/))) lido.nomeLido = m[1].trim()
    if ((m = sem.match(/Habilidade\W*([A-Za-z][A-Za-z' -]{1,25})/i))) lido.habilidade = m[1].trim()

    // Caixa do PC: "Stats: 58/48/41/23/35/45", "IVs: 4/29/3/5/23/26", "EVs: 0/0/0/0/0/0"
    // Se o rótulo sair ilegível ("ms 4/29/3/5/23/26"), vale a ordem da tela: Stats, depois IVs, depois EVs
    const lista = sem.match(/^(.*?)((?:[\dsSlIoO|]{1,3}\s*\/\s*){5}[\dsSlIoO|]{1,3})\s*$/)
    if (lista && !/186/.test(lista[2])) {
      const rotulo = lista[1].replace(/[^A-Za-z1|]/g, '')
      const valores = lista[2].split('/').map(v => paraNumero(v.trim()))
      const ordem = ['stats', 'ivs', 'evs']
      let tipo = /^st/i.test(rotulo) ? 'stats' : /^E[VY]/i.test(rotulo) ? 'evs' : /^[I1l|][VY']/i.test(rotulo) ? 'ivs' : null
      if (!tipo) tipo = ordem[Math.min(ordem.indexOf(lido.ultimaLista || 'stats') + (lido.ultimaLista ? 1 : 0), 2)]
      const limite = tipo === 'ivs' ? 31 : tipo === 'evs' ? 252 : 999
      if (valores.length === 6 && valores.every(v => v !== null && v <= limite)) {
        ATRIBUTOS.forEach((a, i) => { lido[tipo][a] = valores[i] })
      }
      lido.ultimaLista = tipo
      return
    }

    // "Total: 134 / 186" da aba de IVs: serve para conferir se os 6 IVs foram lidos certo
    if (/^\W*Total\b/i.test(sem)) {
      const total = sem.match(/Total\W*([\dsSlIoO|]{1,3})\s*\/\s*186/i)
      if (total) lido.totalIvs = paraNumero(total[1])
      return
    }

    const stat = statDaLinha(linha)
    if (!stat) return
    const valor = numeroDoRotulo(sem)
    if (valor === null) return
    // O OCR costuma ler "IV" como "IY", "1V", "lV" ou grudado ("IvDef"); "EV" como "EY"
    const ehIv = /^\W*[I1l|][VYv](?=\s|[A-Z]|[a-z]|:)/.test(sem) && !/^\W*[I1l|][VYv]elo/i.test(sem.replace(/\s/g, ''))
    const ehEv = /^\W*E[VYv](?=\s|[A-Z]|:)/.test(sem)
    const destino = ehIv ? lido.ivs : ehEv ? lido.evs : lido.stats
    if (stat in destino) lido.repetido = true  // dois Pokémon no mesmo print
    else if (ehIv ? valor <= 31 : ehEv ? valor <= 252 : valor <= 999) destino[stat] = valor
  })
  return lido
}

// ---------- Preencher o formulário ----------
function preencherCampo(id, valor) {
  const campo = document.getElementById(id)
  if (!campo || valor === undefined || valor === null) return false
  campo.value = valor
  campo.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

function ataquesNoTexto(texto) {
  // Compara cada linha com os ataques que a espécie aprende (sem espaços, hífen e maiúsculas)
  const limpar = s => semAcento(s).toLowerCase().replace(/[^a-z]/g, '')
  const conhecidos = Object.values(ataquesAtuais)
  const achados = []
  texto.split(/\n+/).forEach(function(linha) {
    // Na Caixa do PC o ataque vem com o tipo na frente ("dark Payback"): tenta com e sem a primeira palavra
    const semTipo = linha.trim().replace(/^\S+\s+/, '')
    for (const l of [limpar(linha), limpar(semTipo)]) {
      if (l.length < 3) continue
      const ataque = conhecidos.find(a => limpar(a.nome) === l)
      if (ataque && !achados.includes(ataque.nome)) {
        achados.push(ataque.nome)
        break
      }
    }
  })
  return achados.slice(0, 4)
}

async function lerPrints(arquivos) {
  const status = document.getElementById('status-print')
  const lista = [...arquivos].filter(a => a.type.startsWith('image/'))
  if (!lista.length) return
  status.className = 'status-print'
  status.textContent = 'Carregando o leitor (só na primeira vez demora um pouco)...'
  try {
    await carregarOcr()
    const textos = []
    const lido = { ivs: {}, evs: {}, stats: {}, repetido: false }
    // Junta o que cada leitura achou; o que já foi lido não é trocado
    const juntar = function(l) {
      ;['ivs', 'evs', 'stats'].forEach(k => ATRIBUTOS.forEach(a => { if (lido[k][a] === undefined && l[k][a] !== undefined) lido[k][a] = l[k][a] }))
      ;['numero', 'nivel', 'felicidade', 'natureza', 'totalIvs', 'nomeLido', 'habilidade'].forEach(k => { if (lido[k] === undefined && l[k] !== undefined) lido[k] = l[k] })
      lido.repetido = lido.repetido || l.repetido
    }
    for (let i = 0; i < lista.length; i++) {
      status.textContent = `Lendo o print ${i + 1} de ${lista.length}...`
      const imagem = await abrirImagem(lista[i])
      // Se a linha de IVs ou de stats saiu incompleta, lê de novo com outro contraste e completa
      const doPrint = { ivs: {}, stats: {} }
      for (const limiar of [140, 100, 180]) {
        const resultado = await Tesseract.recognize(prepararImagem(imagem, limiar), 'eng')
        textos.push(resultado.data.text)
        const l = lerTexto(resultado.data.text)
        juntar(l)
        Object.assign(doPrint.ivs, l.ivs)
        Object.assign(doPrint.stats, l.stats)
        const ivsAchados = Object.keys(doPrint.ivs).length
        const statsAchados = Object.keys(doPrint.stats).length
        // Linha que parece a dos IVs da Caixa do PC ("I's: Af20/3/5/23/26") mas não deu 6 números: vale ler de novo
        const linhaIvRuim = ivsAchados === 0 && /^\W*[I1l|][^\s:/]{0,3}\s*:.*\/.*\//m.test(resultado.data.text)
        // Print que tem IVs ou stats: para quando estiverem completos; print sem nenhum (aba de informações): uma leitura basta
        if (!linhaIvRuim && (ivsAchados === 0 || ivsAchados === 6) && (statsAchados === 0 || statsAchados === 6)) break
        status.textContent = `Lendo o print ${i + 1} de ${lista.length} de novo, com outro contraste...`
      }
    }
    const texto = textos.join('\n')
    window.ultimoTextoLido = texto  // para conferir o que o leitor entendeu (console do navegador)

    // Confere os IVs com o "Total" que o jogo mostra. Se faltou ler um só, o total diz qual é.
    let avisoTotal = ''
    if (lido.totalIvs !== undefined) {
      const faltando = ATRIBUTOS.filter(a => lido.ivs[a] === undefined)
      const somaLida = ATRIBUTOS.reduce((t, a) => t + (lido.ivs[a] || 0), 0)
      if (faltando.length === 1 && lido.totalIvs - somaLida >= 0 && lido.totalIvs - somaLida <= 31) {
        lido.ivs[faltando[0]] = lido.totalIvs - somaLida
      } else if (faltando.length === 0 && somaLida !== lido.totalIvs) {
        avisoTotal = `⚠️ A soma dos IVs lidos dá ${somaLida}, mas o jogo mostra Total ${lido.totalIvs}: algum número foi lido errado. Confira os IVs.`
      }
    }

    // Print do PokeMMO (é o único que mostra IVs no Sumário)
    if (Object.keys(lido.ivs).length) {
      const plataforma = document.getElementById('plataforma')
      if (!plataforma.disabled) {
        plataforma.value = 'PokeMMO'
        plataforma.dispatchEvent(new Event('change'))
      }
    }
    // Sem número da Pokédex (Caixa do PC): acha a espécie pelo nome lido ("Nv. 19 Tauros")
    if (!lido.numero && lido.nomeLido) {
      const limpar = s => s.toLowerCase().replace(/[^a-z]/g, '')
      const palavras = lido.nomeLido.split(/\s+/)
      for (let n = palavras.length; n >= 1 && !lido.numero; n--) {
        const candidato = limpar(palavras.slice(0, n).join(' '))
        const indice = especies.findIndex(e => limpar(e) === candidato)
        if (indice >= 0) lido.numero = indice + 1
      }
    }
    // Ainda sem espécie (Sumário: o nome aparece no topo, "Magikarp ♀ Lv. 5"): procura um nome de espécie no texto
    if (!lido.numero) {
      const nomes = new Map(especies.map((e, i) => [e.toLowerCase().replace(/[^a-z]/g, ''), i + 1]))
      for (const palavra of texto.split(/[^A-Za-z.'-]+/)) {
        const chave = palavra.toLowerCase().replace(/[^a-z]/g, '')
        if (chave.length >= 4 && nomes.has(chave)) {
          lido.numero = nomes.get(chave)
          break
        }
      }
    }
    if (lido.numero && !idEdicao) {
      campoNumero.value = lido.numero
      campoNome.value = especies[lido.numero - 1] || String(lido.numero)
      await carregarEspecie(campoNome.value)
    }
    preencherCampo('nivel', lido.nivel)
    preencherCampo('felicidade', lido.felicidade)
    preencherCampo('habilidade', lido.habilidade)
    if (lido.natureza && !document.getElementById('natureza').disabled) {
      document.getElementById('natureza').value = lido.natureza
      document.getElementById('natureza').dispatchEvent(new Event('change', { bubbles: true }))
    }
    ATRIBUTOS.forEach(function(a) {
      preencherCampo(a, lido.stats[a])
      preencherCampo('iv' + SUFIXOS[a], lido.ivs[a])
      preencherCampo('ev' + SUFIXOS[a], lido.evs[a])
    })
    const ataques = ataquesNoTexto(texto)
    ataques.forEach(adicionarAtaque)
    atualizarTotalEV()
    atualizarTotalIV()
    atualizarProjecao()

    // Resumo do que foi lido (e do que faltou), para a pessoa conferir
    const partes = []
    if (lido.numero) partes.push(`#${lido.numero} ${campoNome.value}`)
    if (lido.habilidade) partes.push(lido.habilidade)
    if (lido.nivel) partes.push(`Nv ${lido.nivel}`)
    if (lido.natureza) partes.push(lido.natureza)
    if (Object.keys(lido.ivs).length) partes.push(`IVs ${ATRIBUTOS.map(a => lido.ivs[a] ?? '?').join('/')}`)
    if (Object.keys(lido.stats).length) partes.push(`stats ${ATRIBUTOS.map(a => lido.stats[a] ?? '?').join('/')}`)
    if (Object.keys(lido.evs).length) partes.push(`EVs ${ATRIBUTOS.map(a => lido.evs[a] ?? '?').join('/')}`)
    if (ataques.length) partes.push(`ataques: ${ataques.join(', ')}`)
    const faltou = []
    if (!lido.numero) faltou.push('espécie (número da Pokédex)')
    if (!lido.natureza) faltou.push('natureza')
    if (ATRIBUTOS.some(a => lido.ivs[a] === undefined)) faltou.push('IVs')
    if (ATRIBUTOS.some(a => lido.stats[a] === undefined)) faltou.push('stats')
    status.className = 'status-print ' + (partes.length ? 'ok' : 'erro')
    status.innerHTML = partes.length
      ? `✔ Lido: ${escaparHtml(partes.join(' · '))}.` +
        (faltou.length ? `<br>Faltou: ${escaparHtml(faltou.join(', '))}. Envie o print dessa aba do Sumário ou digite.` : '') +
        (avisoTotal ? `<br><span class="aviso-total">${escaparHtml(avisoTotal)}</span>` : '') +
        (lido.repetido ? '<br>⚠️ O print parece ter mais de um Pokémon: usei o primeiro. Confira os números.' : '') +
        '<br><strong>Confira tudo antes de salvar</strong> (o sexo e o apelido não são lidos).'
      : 'Não consegui ler nada. Use o print do Sumário do PokeMMO, com a janela inteira e sem cortar os números.'
  } catch (erro) {
    status.className = 'status-print erro'
    status.textContent = 'Não foi possível ler o print: ' + erro.message
    console.error(erro)
  }
}

document.getElementById('arquivo-print').addEventListener('change', function() {
  lerPrints(this.files)
  this.value = ''
})
// Colar o print (Ctrl+V) em qualquer lugar da página
document.addEventListener('paste', function(evento) {
  const imagens = [...(evento.clipboardData ? evento.clipboardData.files : [])].filter(f => f.type.startsWith('image/'))
  if (imagens.length) {
    evento.preventDefault()
    lerPrints(imagens)
  }
})
