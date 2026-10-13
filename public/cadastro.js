// ATRIBUTOS, coresTipo, escaparHtml e calcularStats vêm do comum.js

// id do campo de EV/IV para cada atributo (ex: evHp, ivAtqEsp)
const SUFIXOS = { hp: 'Hp', ataque: 'Ataque', defesa: 'Defesa', atqEsp: 'AtqEsp', defEsp: 'DefEsp', velocidade: 'Velocidade' }

// Lê um número inteiro. Ignora ponto/vírgula de milhar, como o jogo mostra: "3.488" -> 3488
function valor(id) {
  return parseInt(document.getElementById(id).value.replace(/[.,\s]/g, '')) || 0
}

// ---------- Limites dos números (iguais aos do jogo) ----------
// O navegador não impede digitar 50 num campo com max=31, então conferimos aqui.
const LIMITES = { nivel: [1, 100, 'Nível'], felicidade: [0, 100, 'Felicidade'] }
ATRIBUTOS.forEach(function(a) {
  LIMITES[a] = [0, 999, `Stat ${NOMES_ATRIBUTOS[a]}`]
  LIMITES['ev' + SUFIXOS[a]] = [0, 252, `EV ${NOMES_ATRIBUTOS[a]}`]
  LIMITES['iv' + SUFIXOS[a]] = [0, 31, `IV ${NOMES_ATRIBUTOS[a]}`]
})

// Marca em vermelho o campo com número fora do limite e devolve a mensagem de erro (ou '')
function conferirLimite(id) {
  const [min, max, rotulo] = LIMITES[id]
  const campo = document.getElementById(id)
  const texto = campo.value.trim()
  const n = valor(id)
  const erro = texto !== '' && (n < min || n > max || !/^-?[\d.,\s]+$/.test(texto))
    ? `${rotulo}: deve estar entre ${min} e ${max}`
    : ''
  campo.classList.toggle('invalido', Boolean(erro))
  campo.title = erro
  return erro
}

function conferirTotalEV() {
  const total = ATRIBUTOS.reduce((t, a) => t + valor('ev' + SUFIXOS[a]), 0)
  document.querySelector('.total-ev').classList.toggle('total-invalido', total > 510)
  return total > 510 ? `O total de EVs (${total}) não pode passar de 510` : ''
}

function nomeComoSlug(nome) {
  return nome.trim().toLowerCase().replace(/[.'’:]/g, '').replace(/[\s-]+/g, '-')
}

// Junta todos os problemas do formulário antes de enviar
function validarFormulario() {
  const erros = Object.keys(LIMITES).map(conferirLimite).filter(Boolean)
  if (!document.getElementById('nivel').value.trim()) erros.push('Preencha o Nível Atual')
  const erroEV = conferirTotalEV()
  if (erroEV) erros.push(erroEV)

  const nome = campoNome.value.trim()
  if (especies.length > 0 && !especies.some(e => nomeComoSlug(e) === nomeComoSlug(nome))) {
    erros.push(`"${nome}" não é um Pokémon. Confira o nome ou use o número da Pokédex.`)
    campoNome.classList.add('invalido')
  }

  for (let n = 1; n <= 4; n++) {
    const campo = document.getElementById(`mov${n}Nome`)
    if (campo.classList.contains('invalido')) erros.push(`${especieCarregada} não aprende o ataque "${campo.value.trim()}"`)
  }
  return erros
}

// Confere cada número enquanto a pessoa digita
Object.keys(LIMITES).forEach(function(id) {
  document.getElementById(id).addEventListener('input', function() {
    conferirLimite(id)
    if (id.startsWith('ev')) conferirTotalEV()
  })
})

// ---------- Stats calculados (igual ao "No Lv. 100" do jogo) ----------
let baseAtual = null  // stats base da espécie escolhida (vêm da PokéAPI)

function lerIvsEvs() {
  const ivs = {}
  const evs = {}
  ATRIBUTOS.forEach(function(a) {
    ivs[a] = valor('iv' + SUFIXOS[a])
    evs[a] = valor('ev' + SUFIXOS[a])
  })
  return { ivs, evs }
}

// Mostra, enquanto a pessoa preenche, como os stats ficam no nível 100
function atualizarProjecao() {
  const div = document.getElementById('projecao-stats')
  const botao = document.getElementById('btn-calcular-stats')
  botao.disabled = !baseAtual
  document.getElementById('btn-descobrir-ivs').disabled = !baseAtual
  document.getElementById('btn-descobrir-evs').disabled = !baseAtual
  if (!baseAtual) {
    div.innerHTML = 'Escolha o Pokémon para ver a projeção dos stats no Lv. 100.'
    return
  }
  const { ivs, evs } = lerIvsEvs()
  const natureza = document.getElementById('natureza').value
  const stats = calcularStats(baseAtual, ivs, evs, natureza, 100)
  div.innerHTML = '<strong>🔄 No Lv. 100:</strong> ' +
    ATRIBUTOS.map(a => `${NOMES_ATRIBUTOS[a]} <strong>${stats[a]}</strong>`).join(' · ')
}

// Preenche os stats do nível atual pela fórmula, sem precisar digitar
function preencherStatsCalculados() {
  const nivel = valor('nivel')
  if (!baseAtual) return
  if (nivel < 1 || nivel > 100) {
    alert('Preencha o Nível Atual (1 a 100) primeiro.')
    return
  }
  const { ivs, evs } = lerIvsEvs()
  const stats = calcularStats(baseAtual, ivs, evs, document.getElementById('natureza').value, nivel)
  ATRIBUTOS.forEach(a => { document.getElementById(a).value = stats[a] })
}

// ---------- Descobrir IVs (jogos que não mostram os IVs, como os da Nintendo) ----------
// Testa os 32 valores possíveis de cada IV e fica com os que dão exatamente os stats anotados.
// Cada leitura de outro nível corta mais valores: com 2 ou 3 níveis, quase sempre sobra um só.
let leituras = []   // [{ nivel, stats, evs }] que o servidor guardou em cada save deste Pokémon

// Estrelas do Juiz -> faixa de IV
const FAIXAS_JUIZ = { 1: [0, 10], 2: [11, 20], 3: [21, 29], 4: [30, 30], 5: [31, 31] }

function statsDoFormulario() {
  return Object.fromEntries(ATRIBUTOS.map(a => [a, valor(a)]))
}

// Mostra os níveis que já têm stats salvos (o servidor guarda sozinho a cada save)
function mostrarLeituras() {
  document.getElementById('leituras').innerHTML = leituras.length
    ? 'Stats salvos automaticamente: ' + leituras.map(l =>
        `<span class="chip-leitura" title="${ATRIBUTOS.map(a => ABREVIACOES[a] + ' ' + l.stats[a]).join(' · ')}">Nv ${l.nivel}</span>`).join('')
    : 'Os stats ficam salvos sozinhos a cada save. Atualize a cada poucos níveis e o cálculo fica mais exato.'
}
mostrarLeituras()

function descobrirIvs() {
  const nivel = valor('nivel')
  if (!baseAtual) return
  const natureza = document.getElementById('natureza').value
  const { evs } = lerIvsEvs()
  // Leituras guardadas + o que está no formulário agora
  const todas = leituras.filter(l => l.nivel !== nivel)
  if (nivel >= 1 && nivel <= 100) todas.push({ nivel, stats: statsDoFormulario(), evs })
  if (todas.length === 0) {
    alert('Preencha o nível e os stats primeiro.')
    return
  }
  ATRIBUTOS.forEach(function(a) {
    const s = SUFIXOS[a]
    const faixa = document.getElementById('faixa' + s)
    const estrelas = Number(document.getElementById('juiz' + s).dataset.valor)
    let possiveis = Array.from({ length: 32 }, (_, iv) => iv)
    todas.filter(l => l.stats[a]).forEach(function(l) {
      possiveis = possiveis.filter(iv => calcularStats(baseAtual, { [a]: iv }, { [a]: (l.evs || evs)[a] }, natureza, l.nivel)[a] === l.stats[a])
    })
    if (estrelas) {
      const [min, max] = FAIXAS_JUIZ[estrelas]
      possiveis = possiveis.filter(iv => iv >= min && iv <= max)
    }
    faixa.className = 'faixa-iv'
    if (possiveis.length === 0) {
      faixa.textContent = 'Não bate: confira os dados'
      faixa.classList.add('erro')
      return
    }
    const min = possiveis[0]
    const max = possiveis[possiveis.length - 1]
    // Com mais de um valor possível, fica com o do meio (a faixa aparece embaixo)
    document.getElementById('iv' + s).value = possiveis[Math.floor((possiveis.length - 1) / 2)]
    faixa.textContent = min === max ? '✔ exato' : `${min} a ${max}`
    if (min === max) faixa.classList.add('exato')
  })
  atualizarTotalIV()
}

// Estrelas do Juiz: clicar marca, clicar de novo na mesma desmarca
document.getElementById('secao-ivs').addEventListener('click', function(evento) {
  const botao = evento.target.closest('.estrelas button')
  if (!botao) return
  const caixa = botao.parentElement
  const n = Number(botao.dataset.n)
  caixa.dataset.valor = Number(caixa.dataset.valor) === n ? 0 : n
  caixa.querySelectorAll('button').forEach(b => b.classList.toggle('acesa', Number(b.dataset.n) <= Number(caixa.dataset.valor)))
})

function limparEstrelas() {
  document.querySelectorAll('.estrelas').forEach(function(caixa) {
    caixa.dataset.valor = 0
    caixa.querySelectorAll('button').forEach(b => b.classList.remove('acesa'))
  })
}

// ---------- Descobrir EVs ----------
// Os IVs nunca mudam e os EVs só aumentam. As leituras antigas (quase sem EVs) dizem quais IVs são possíveis;
// os stats de agora dizem quais pares IV + EV fecham a conta. Testa todos os pares, sem chutar o IV do meio.
// Cada 4 EVs valem 1 ponto no Nv 100 (menos em nível baixo), então o resultado é uma faixa.
function descobrirEvs() {
  const nivel = valor('nivel')
  if (!baseAtual) return
  if (nivel < 1 || nivel > 100) {
    alert('Preencha o Nível Atual (1 a 100) primeiro.')
    return
  }
  const anteriores = leituras.filter(l => l.nivel < nivel)
  const semIvs = ATRIBUTOS.some(a => document.getElementById('iv' + SUFIXOS[a]).value.trim() === '')
  if (anteriores.length === 0 && semIvs) {
    alert('Descubra ou preencha os IVs primeiro: o cálculo dos EVs depende deles.')
    return
  }
  const natureza = document.getElementById('natureza').value
  const { ivs } = lerIvsEvs()
  const stat = (a, iv, ev, nv) => calcularStats(baseAtual, { [a]: iv }, { [a]: ev }, natureza, nv)[a]

  ATRIBUTOS.forEach(function(a) {
    const s = SUFIXOS[a]
    const faixa = document.getElementById('faixaEv' + s)
    faixa.className = 'faixa-iv'
    const atual = valor(a)
    if (!atual) {
      faixa.textContent = ''
      return
    }
    // IVs possíveis: pelas leituras antigas (e estrelas do Juiz) ou, sem leituras, o IV do formulário
    let ivsPossiveis = [ivs[a]]
    if (anteriores.length) {
      ivsPossiveis = Array.from({ length: 32 }, (_, iv) => iv)
        .filter(iv => anteriores.every(l => stat(a, iv, (l.evs || {})[a] || 0, l.nivel) === l.stats[a]))
      const estrelas = Number(document.getElementById('juiz' + s).dataset.valor)
      if (estrelas) ivsPossiveis = ivsPossiveis.filter(iv => iv >= FAIXAS_JUIZ[estrelas][0] && iv <= FAIXAS_JUIZ[estrelas][1])
    }
    // EVs nunca diminuem: começa do que ele já tinha na última leitura
    const evMinimo = Math.max(0, ...anteriores.map(l => (l.evs || {})[a] || 0))
    const pares = []
    ivsPossiveis.forEach(function(iv) {
      for (let ev = evMinimo; ev <= 252; ev++) if (stat(a, iv, ev, nivel) === atual) pares.push({ iv, ev })
    })
    if (pares.length === 0) {
      faixa.textContent = 'Não bate: confira os dados'
      faixa.classList.add('erro')
      return
    }
    const evs = pares.map(p => p.ev)
    const ivsOk = [...new Set(pares.map(p => p.iv))]
    const evMin = Math.min(...evs)
    const evMax = Math.max(...evs)
    // EV: fica com o menor valor possível, que é o que se tem certeza
    document.getElementById('ev' + s).value = evMin
    faixa.textContent = evMin === evMax ? '✔ exato' : `${evMin} a ${evMax}`
    if (evMin === evMax) faixa.classList.add('exato')
    // Os stats de agora também estreitam os IVs
    if (anteriores.length) {
      const faixaIv = document.getElementById('faixa' + s)
      const ivMin = Math.min(...ivsOk)
      const ivMax = Math.max(...ivsOk)
      document.getElementById('iv' + s).value = ivsOk[Math.floor((ivsOk.length - 1) / 2)]
      faixaIv.className = 'faixa-iv' + (ivMin === ivMax ? ' exato' : '')
      faixaIv.textContent = ivMin === ivMax ? '✔ exato' : `${ivMin} a ${ivMax}`
    }
  })
  atualizarTotalEV()
  atualizarTotalIV()
  atualizarProjecao()
}

// Atualiza o total de EVs em tempo real
function atualizarTotalEV() {
  const total = ATRIBUTOS.reduce((t, a) => t + valor('ev' + SUFIXOS[a]), 0)
  document.getElementById('total-ev').textContent = total
}

// Atualiza o total de IVs em tempo real
function atualizarTotalIV() {
  const total = ATRIBUTOS.reduce((t, a) => t + valor('iv' + SUFIXOS[a]), 0)
  document.getElementById('total-iv').textContent = total
}

// ---------- Treinador logado ----------
// O cadastro só funciona com o login de "Meus Pokémon": nick e PIN vêm da sessão desta aba
const sessaoAtual = lerSessao()
if (!sessaoAtual) location.replace('meus.html')

const campoTreinador = document.getElementById('treinador')
const campoPin = document.getElementById('pin')
const campoInicial = document.getElementById('inicial')
let infoNick = null  // { temPin, temInicial } do treinador logado

// O jogo fica escolhido para os próximos cadastros
const campoPlataforma = document.getElementById('plataforma')
// As estrelas do Juiz só aparecem nos jogos da Nintendo (os novos têm o Juiz na caixa do PC)
function mostrarJuiz() {
  const nintendo = campoPlataforma.value === 'Nintendo'
  document.getElementById('campo-geracao').hidden = !nintendo
  document.getElementById('secao-ivs').classList.toggle('nintendo', nintendo)
  if (!nintendo) limparEstrelas()
}
campoPlataforma.value = plataformaSalva()
mostrarJuiz()
campoPlataforma.addEventListener('change', function() {
  salvarPlataforma(campoPlataforma.value)
  mostrarJuiz()
})

if (sessaoAtual) {
  campoTreinador.value = sessaoAtual.nick
  campoPin.value = sessaoAtual.pin
  document.getElementById('nick-logado').textContent = sessaoAtual.nick
}

function sair() {
  encerrarSessao()
  location.href = 'meus.html'
}

// Quem criou o PIN antes da recuperação existir ainda pode escolher o primeiro Pokémon
async function verificarInicial() {
  if (!sessaoAtual) return
  try {
    infoNick = await (await fetch('/api/treinadores/' + encodeURIComponent(sessaoAtual.nick))).json()
    document.getElementById('campo-inicial').hidden = infoNick.temInicial
  } catch (erro) {
    console.error(erro)
  }
}

verificarInicial()

// ---------- Autocompletar com dados da PokéAPI ----------
const campoNome = document.getElementById('nome')
const statusEspecie = document.getElementById('status-especie')
let especies = []          // todos os nomes de espécies
let ataquesAtuais = {}     // ataques que o Pokémon escolhido aprende, por nome em minúsculas
let especieCarregada = ''
let ultimaBusca = ''

function preencherDatalist(id, opcoes) {
  const lista = document.getElementById(id)
  lista.innerHTML = ''
  opcoes.forEach(function(o) {
    const opcao = document.createElement('option')
    opcao.value = o.valor
    if (o.rotulo) opcao.label = o.rotulo
    lista.appendChild(opcao)
  })
}

async function carregarEspecies() {
  try {
    const resposta = await fetch('/api/especies')
    if (!resposta.ok) throw new Error(resposta.status)
    especies = await resposta.json()
    preencherDatalist('lista-especies', especies.map(nome => ({ valor: nome })))
  } catch (erro) {
    statusEspecie.textContent = 'Sem conexão com a PokéAPI: preencha os campos manualmente.'
    console.error(erro)
  }
}

// Escolhe um ataque: preenche o primeiro campo vazio e o tipo dele
function adicionarAtaque(nome) {
  for (let n = 1; n <= 4; n++) {
    const campo = document.getElementById(`mov${n}Nome`)
    if (campo.value.toLowerCase() === nome.toLowerCase()) return
    if (!campo.value) {
      campo.value = nome
      atualizarTipoAtaque(n)
      return
    }
  }
  alert('Os 4 espaços de ataque já estão preenchidos.')
}

// Quando o ataque digitado é conhecido, coloca o tipo automaticamente.
// Se o Pokémon não aprende esse ataque, o campo fica vermelho e o cadastro não é enviado.
function atualizarTipoAtaque(n) {
  const campo = document.getElementById(`mov${n}Nome`)
  const ataque = ataquesAtuais[campo.value.trim().toLowerCase()]
  if (ataque) {
    campo.value = ataque.nome
    document.getElementById(`mov${n}Tipo`).value = ataque.tipo
  }
  const desconhecido = especieCarregada && campo.value.trim() && !ataque
  campo.classList.toggle('invalido', Boolean(desconhecido))
  campo.title = desconhecido ? `${especieCarregada} não aprende esse ataque` : ''
}

for (let n = 1; n <= 4; n++) {
  document.getElementById(`mov${n}Nome`).addEventListener('change', () => atualizarTipoAtaque(n))
}

function mostrarPopulares(populares) {
  const div = document.getElementById('ataques-populares')
  const conhecidos = populares.filter(p => ataquesAtuais[p.nome])
  if (conhecidos.length === 0) {
    div.innerHTML = ''
    return
  }
  div.innerHTML = '<span class="populares-titulo">Mais usados pelos treinadores:</span>'
  conhecidos.forEach(function(p) {
    const ataque = ataquesAtuais[p.nome]
    const botao = document.createElement('button')
    botao.type = 'button'
    botao.className = 'chip-ataque'
    botao.style.borderColor = coresTipo[ataque.tipo] || '#ccc'
    botao.textContent = `${ataque.nome} (${p.vezes})`
    botao.addEventListener('click', () => adicionarAtaque(ataque.nome))
    div.appendChild(botao)
  })
}

// Mostra a imagem do Pokémon escolhido ao lado do nome
function mostrarPreview(dados) {
  const img = document.getElementById('preview-especie')
  const url = urlImagem({ numero: dados.numero })
  img.hidden = !url
  if (url) {
    img.src = url
    img.alt = dados.nome
  }
}

async function carregarEspecie(nome) {
  if (nome.toLowerCase() === ultimaBusca) return
  ultimaBusca = nome.toLowerCase()
  statusEspecie.textContent = `Buscando dados de ${nome}...`

  try {
    const resposta = await fetch('/api/especies/' + encodeURIComponent(nome))
    if (resposta.status === 404) {
      statusEspecie.textContent = `"${nome}" não é um Pokémon. Confira o nome ou use o número da Pokédex.`
      statusEspecie.classList.add('status-erro')
      campoNome.classList.add('invalido')
      document.getElementById('preview-especie').hidden = true
      return
    }
    statusEspecie.classList.remove('status-erro')
    campoNome.classList.remove('invalido')
    if (!resposta.ok) throw new Error(resposta.status)
    const dados = await resposta.json()

    // Se o usuário trocou o nome enquanto carregava, ignora esta resposta
    if (campoNome.value.trim().toLowerCase() !== nome.toLowerCase()) return

    especieCarregada = dados.nome
    mostrarPreview(dados)
    baseAtual = dados.base || null
    atualizarProjecao()
    campoNome.value = dados.nome
    document.getElementById('numero').value = dados.numero
    document.getElementById('tipo1').value = dados.tipos[0] || ''
    document.getElementById('tipo2').value = dados.tipos[1] || ''

    preencherDatalist('lista-habilidades', dados.habilidades.map(h => ({ valor: h })))
    const campoHabilidade = document.getElementById('habilidade')
    if (!dados.habilidades.includes(campoHabilidade.value)) {
      campoHabilidade.value = dados.habilidades.length === 1 ? dados.habilidades[0] : ''
    }

    ataquesAtuais = {}
    dados.ataques.forEach(a => { ataquesAtuais[a.nome.toLowerCase()] = a })
    preencherDatalist('lista-ataques', dados.ataques.map(a => ({
      valor: a.nome,
      rotulo: `${a.tipo} · ${a.metodos.join(', ')}`
    })))
    for (let n = 1; n <= 4; n++) atualizarTipoAtaque(n)

    document.getElementById('dica-ataques').textContent =
      `${dados.nome} pode aprender ${dados.ataques.length} ataques. Comece a digitar para ver as opções.`
    mostrarPopulares(dados.populares)
    statusEspecie.textContent = `✓ Dados oficiais de #${dados.numero} ${dados.nome} carregados`
  } catch (erro) {
    ultimaBusca = ''
    statusEspecie.textContent = 'Não foi possível buscar os dados agora. Preencha manualmente.'
    console.error(erro)
  }
}

// Carrega a espécie assim que o nome bate com um da lista (ao escolher uma sugestão ou ao sair do campo)
campoNome.addEventListener('input', function() {
  const nome = campoNome.value.trim().toLowerCase()
  const encontrado = especies.find(e => e.toLowerCase() === nome)
  if (encontrado) carregarEspecie(encontrado)
})
campoNome.addEventListener('change', function() {
  const nome = campoNome.value.trim()
  if (nome) carregarEspecie(nome)
})

// Busca pelo número da Pokédex (ex: 059 -> Arcanine).
// Espera a pessoa parar de digitar, senão "05" carregaria o Charmeleon antes de chegar no 059.
const campoNumero = document.getElementById('numero')
let esperaNumero = null

function buscarPorNumero() {
  clearTimeout(esperaNumero)
  const texto = campoNumero.value.trim().replace(/^#/, '')
  if (!/^\d+$/.test(texto)) return

  const numero = parseInt(texto, 10)
  if (especies.length > 0 && (numero < 1 || numero > especies.length)) {
    statusEspecie.textContent = `A Pokédex vai do 1 ao ${especies.length}.`
    return
  }

  // A lista de espécies vem em ordem de número; sem ela, o servidor também aceita o número
  const nome = especies[numero - 1] || String(numero)
  campoNome.value = nome
  carregarEspecie(nome)
}

campoNumero.addEventListener('input', function() {
  clearTimeout(esperaNumero)
  esperaNumero = setTimeout(buscarPorNumero, 500)
})
campoNumero.addEventListener('change', buscarPorNumero)

carregarEspecies()

// A projeção acompanha qualquer mudança em IVs, EVs, natureza ou nível
document.querySelector(".formulario-container").addEventListener("input", atualizarProjecao)
document.querySelector(".formulario-container").addEventListener("change", atualizarProjecao)

// Salva o Pokémon na base compartilhada e mostra o comparativo
async function salvarPokemon() {
  const treinador = campoTreinador.value.trim()
  const nome = document.getElementById('nome').value.trim()

  if (!treinador || !campoPin.value) {
    location.replace('meus.html')  // sem login não dá para cadastrar
    return
  }
  if (!nome) {
    alert('Preencha pelo menos o nome do Pokémon!')
    return
  }

  const errosFormulario = validarFormulario()
  if (errosFormulario.length > 0) {
    const div = document.getElementById('resultado-comparacao')
    div.innerHTML = `
      <div class="comparacao-pior">
        ⚠️ Corrija antes de salvar:
        <ul>${errosFormulario.map(e => `<li>${escaparHtml(e)}</li>`).join('')}</ul>
      </div>
    `
    // Leva até o primeiro campo errado
    const primeiro = document.querySelector('.formulario-container .invalido')
    if (primeiro) primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' })
    else div.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const pokemon = {
    treinador: treinador,
    plataforma: document.getElementById('plataforma').value,
    geracaoJogo: document.getElementById('geracaoJogo').value,
    numero: document.getElementById('numero').value,
    nome: nome,
    tipo1: document.getElementById('tipo1').value,
    tipo2: document.getElementById('tipo2').value,
    natureza: document.getElementById('natureza').value,
    habilidade: document.getElementById('habilidade').value,
    apelido: document.getElementById('apelido').value,
    sexo: document.getElementById('sexo').value,
    alfa: document.getElementById('alfa').checked,
    shiny: document.getElementById('shiny').checked,
    nivel: valor('nivel'),
    proxNivel: valor('proxNivel'),
    stats: { felicidade: valor('felicidade') },
    evs: {},
    ivs: {},
    movimentos: [1, 2, 3, 4].map(n => ({
      nome: document.getElementById(`mov${n}Nome`).value,
      tipo: document.getElementById(`mov${n}Tipo`).value
    })).filter(m => m.nome)
  }

  ATRIBUTOS.forEach(function(a) {
    pokemon.stats[a] = valor(a)
    pokemon.evs[a] = valor('ev' + SUFIXOS[a])
    pokemon.ivs[a] = valor('iv' + SUFIXOS[a])
  })

  const divResultado = document.getElementById('resultado-comparacao')

  // Desativa o botão enquanto salva, para um clique duplo não cadastrar duas vezes
  const botao = document.querySelector('.btn-salvar')
  if (botao.disabled) return
  botao.disabled = true
  botao.textContent = 'Salvando...'

  try {
    // Editando: atualiza o registro existente. Senão: cadastra um novo.
    const resposta = await fetch(idEdicao ? '/api/pokemons/' + encodeURIComponent(idEdicao) : '/api/pokemons', {
      method: idEdicao ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pokemon, pin: campoPin.value, inicial: campoInicial.value })
    })

    const resultado = await resposta.json()

    // PIN não confere mais (ex: trocado em outro lugar): pede para entrar de novo
    if (resposta.status === 401) {
      encerrarSessao()
      divResultado.innerHTML = `
        <div class="comparacao-pior">
          ⚠️ Seu login expirou. <a href="meus.html">Entre de novo em Meus Pokémon</a> para continuar. Os dados digitados aqui não foram salvos.
        </div>
      `
      return
    }
    if (!resposta.ok) {
      divResultado.innerHTML = `
        <div class="comparacao-pior">
          ⚠️ Não foi possível salvar:
          <ul>${resultado.erros.map(e => `<li>${escaparHtml(e)}</li>`).join('')}</ul>
        </div>
      `
      return
    }

    // Se o primeiro Pokémon foi escolhido agora, o campo não precisa mais aparecer
    if (campoInicial.value) document.getElementById('campo-inicial').hidden = true

    const salvo = resultado.pokemon
    // O servidor guardou os stats deste save: atualiza a lista de níveis
    if (Array.isArray(salvo.leituras)) {
      leituras = salvo.leituras
      mostrarLeituras()
    }

    const comp = resultado.comparacao
    const nomeSeguro = escaparHtml(salvo.nome)
    const link = `<a href="index.html?especie=${encodeURIComponent(salvo.nome)}">Ver comparativo completo</a>`

    if (idEdicao) {
      divResultado.innerHTML = `
        <div class="comparacao-melhor">
          ✏️ Alterações salvas! ${nomeSeguro} agora está em ${comp.posicao}º de ${comp.total} da espécie. ${link} · <a href="historico.html?id=${encodeURIComponent(salvo.id)}">📜 Ver histórico</a>
        </div>
      `
      divResultado.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (!comp.melhorAnterior) {
      divResultado.innerHTML = `
        <div class="comparacao-melhor">
          ✅ ${nomeSeguro} cadastrado! É o primeiro ${nomeSeguro} da base! ${link}
        </div>
      `
    } else if (comp.posicao === 1) {
      divResultado.innerHTML = `
        <div class="comparacao-melhor">
          🏆 Seu ${nomeSeguro} é o mais forte da base, entre ${comp.total}! ${link}
        </div>
      `
    } else {
      divResultado.innerHTML = `
        <div class="comparacao-pior">
          📊 Seu ${nomeSeguro} ficou em ${comp.posicao}º de ${comp.total} da espécie. ${link}
        </div>
      `
    }

    limparFormulario()
    divResultado.scrollIntoView({ behavior: 'smooth', block: 'center' })

  } catch (erro) {
    alert('Erro ao salvar. Verifique se o servidor está rodando!')
    console.error(erro)
  } finally {
    botao.disabled = false
    botao.textContent = idEdicao ? 'Salvar alterações' : 'Cadastrar Pokémon'
  }
}

// ---------- Modo edição (cadastro.html?editar=<id>) ----------
const idEdicao = new URLSearchParams(location.search).get('editar')

function preencherFormulario(p) {
  const campos = {
    treinador: p.treinador, plataforma: plataformaDe(p), geracaoJogo: p.geracaoJogo || '', numero: p.numero, nome: p.nome, tipo1: p.tipo1, tipo2: p.tipo2 || '',
    natureza: p.natureza, habilidade: p.habilidade, nivel: p.nivel, proxNivel: p.proxNivel,
    apelido: p.apelido, sexo: p.sexo,
    felicidade: p.stats.felicidade
  }
  ATRIBUTOS.forEach(function(a) {
    campos[a] = p.stats[a]
    campos['ev' + SUFIXOS[a]] = p.evs[a]
    campos['iv' + SUFIXOS[a]] = p.ivs[a]
  })
  p.movimentos.forEach(function(m, i) {
    campos[`mov${i + 1}Nome`] = m.nome
    campos[`mov${i + 1}Tipo`] = m.tipo
  })
  Object.entries(campos).forEach(([id, v]) => { document.getElementById(id).value = v ?? '' })
  document.getElementById('alfa').checked = Boolean(p.alfa)
  document.getElementById('shiny').checked = Boolean(p.shiny)
  leituras = Array.isArray(p.leituras) ? p.leituras : []
  mostrarLeituras()
  mostrarJuiz()
  atualizarTotalEV()
  atualizarTotalIV()
}

// Depois de 24 horas do cadastro, só vale o que é possível no jogo (o servidor confere de novo ao salvar)
const HORAS_PARA_CORRIGIR = 24

function aplicarTravas(p) {
  const limite = new Date(new Date(p.criadoEm).getTime() + HORAS_PARA_CORRIGIR * 3600 * 1000)
  const aviso = document.createElement('div')
  aviso.className = 'aviso-edicao'
  if (Date.now() < limite.getTime()) {
    aviso.innerHTML = `✏️ Até <strong>${limite.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong>
      você pode corrigir qualquer dado (erro de digitação). Depois disso, só o que muda no jogo: nível, evolução, EVs, stats e ataques.`
  } else {
    ;['plataforma', 'natureza', 'sexo', 'alfa', 'shiny'].forEach(id => { document.getElementById(id).disabled = true })
    // A geração do jogo pode ser informada uma vez por quem cadastrou antes do campo existir
    if (p.geracaoJogo) document.getElementById('geracaoJogo').disabled = true
    document.getElementById('nivel').min = p.nivel
    const pokemmo = plataformaDe(p) === 'PokeMMO'
    if (pokemmo) {
      ATRIBUTOS.forEach(a => { document.getElementById('iv' + SUFIXOS[a]).disabled = true })
      document.getElementById('btn-descobrir-ivs').hidden = true
    }
    aviso.innerHTML = `🔒 Para manter a base confiável, depois do cadastro só muda o que muda no jogo:
      <ul>
        <li>✅ Pode: subir de nível, evoluir (${escaparHtml(p.nome)} → evolução dele), EVs, stats, ataques, habilidade e apelido.</li>
        <li>🚫 Não pode: trocar o jogo, a natureza, o sexo, Shiny/Alfa, voltar de nível ou virar outra espécie.</li>
        <li>${pokemmo ? '🚫 IVs: no PokeMMO o jogo mostra o valor exato, então não mudam.'
          : '⚠️ IVs: só podem ser corrigidos se baterem com os stats dos saves anteriores (ou ir para 31 com Hyper Training, a partir do Nv 50).'}</li>
      </ul>`
  }
  document.querySelector('.subtitulo').after(aviso)
}

async function iniciarEdicao() {
  document.querySelector('.formulario-container h2').textContent = 'Editar Pokémon'
  document.querySelector('.subtitulo').textContent =
    'Atualize o que mudou no jogo e salve. A versão anterior fica no histórico.'
  const botao = document.querySelector('.btn-salvar')
  botao.textContent = 'Salvar alterações'
  // Editando não é "Cadastrar": nenhuma das abas fica marcada
  document.getElementById('aba-cadastrar').classList.remove('ativa')

  // Os dados completos (com apelido) só vêm com nick + PIN, pela sessão de "Meus Pokémon"
  const sessao = lerSessao()
  try {
    if (!sessao) throw new Error('sem sessão')
    const resposta = await fetch('/api/meus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick: sessao.nick, pin: sessao.pin })
    })
    if (!resposta.ok) throw new Error(resposta.status)
    const pokemon = (await resposta.json()).pokemons.find(p => p.id === idEdicao)
    if (!pokemon) throw new Error('não é deste treinador')
    preencherFormulario(pokemon)
    aplicarTravas(pokemon)
    campoPin.value = sessao.pin
    // Carrega habilidades e ataques da espécie para o autocompletar
    carregarEspecie(pokemon.nome)
  } catch (erro) {
    // Mostra o problema no topo, onde a pessoa vê, e não deixa salvar um formulário vazio
    botao.disabled = true
    const aviso = document.createElement('div')
    aviso.className = 'comparacao-pior'
    aviso.innerHTML = `
      ⚠️ Para editar, entre primeiro em <a href="meus.html">Meus Pokémon</a> com o seu nick e PIN
      e clique em "Editar" no Pokémon. Nada foi apagado.
    `
    document.querySelector('.subtitulo').after(aviso)
    console.error(erro)
  }
}

if (idEdicao) iniciarEdicao()

// Depois de cadastrar, deixa o formulário pronto para o próximo Pokémon (mantém só o treinador)
function limparFormulario() {
  document.querySelectorAll('.formulario-container input, .formulario-container select').forEach(function(campo) {
    // O nick continua: normalmente se cadastra vários Pokémon em sequência
    if (campo.id === 'treinador' || campo.id === 'pin' || campo.id === 'inicial' || campo.id === 'plataforma' || campo.id === 'geracaoJogo') return
    if (campo.type === 'checkbox' || campo.type === 'radio') {
      campo.checked = false
      return
    }
    campo.value = ''
    campo.classList.remove('invalido')
    campo.title = ''
  })

  especieCarregada = ''
  baseAtual = null
  atualizarProjecao()
  ultimaBusca = ''
  ataquesAtuais = {}
  preencherDatalist('lista-habilidades', [])
  preencherDatalist('lista-ataques', [])
  document.getElementById('ataques-populares').innerHTML = ''
  document.getElementById('dica-ataques').textContent =
    'Escolha o Pokémon acima para ver só os ataques que ele pode aprender.'
  statusEspecie.textContent = ''
  statusEspecie.classList.remove('status-erro')
  document.getElementById('preview-especie').hidden = true
  document.querySelector('.total-ev').classList.remove('total-invalido')
  document.querySelectorAll('.faixa-iv').forEach(f => { f.textContent = '' })
  limparEstrelas()
  leituras = []
  mostrarLeituras()
  atualizarTotalEV()
  atualizarTotalIV()
}
