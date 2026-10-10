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

// Lembra o nome do treinador para não precisar digitar de novo
const campoTreinador = document.getElementById('treinador')
try {
  campoTreinador.value = localStorage.getItem('treinador') || ''
} catch (e) {}

// ---------- PIN do nick ----------
// O PIN não é guardado no navegador; fica só no campo enquanto a página estiver aberta
const campoPin = document.getElementById('pin')
const statusPin = document.getElementById('status-pin')

const campoInicial = document.getElementById('inicial')
let infoNick = null  // { temPin, temInicial } do nick digitado

async function verificarPinDoNick() {
  const nick = campoTreinador.value.trim()
  if (!nick) return
  try {
    const resposta = await fetch('/api/treinadores/' + encodeURIComponent(nick))
    const info = await resposta.json()
    if (campoTreinador.value.trim() !== nick) return  // o nick mudou enquanto carregava
    infoNick = info
    statusPin.classList.toggle('pin-novo', !info.temPin)
    statusPin.textContent = info.temPin
      ? `Digite o PIN do nick ${nick}.`
      : `O nick ${nick} ainda não tem PIN: o que você digitar agora vira o PIN dele. Guarde bem!`
    // O primeiro Pokémon é pedido ao criar o PIN (ou para quem ainda não escolheu)
    document.getElementById('campo-inicial').hidden = info.temPin && info.temInicial
    document.getElementById('link-esqueci').hidden = !info.temPin
  } catch (erro) {
    console.error(erro)
  }
}

campoTreinador.addEventListener('change', verificarPinDoNick)
verificarPinDoNick()

// ---------- Esqueci meu PIN ----------
function abrirRecuperacao() {
  const nick = campoTreinador.value.trim()
  if (!nick) {
    alert('Digite o seu nick primeiro.')
    return
  }
  if (infoNick && infoNick.temPin && !infoNick.temInicial) {
    alert('Esse nick não escolheu um primeiro Pokémon quando criou o PIN, então não dá para recuperar por aqui.')
    return
  }
  document.getElementById('recuperar-nick').textContent = nick
  document.getElementById('recuperar-resultado').innerHTML = ''
  const painel = document.getElementById('painel-recuperar')
  painel.hidden = false
  painel.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function fecharRecuperacao() {
  document.getElementById('painel-recuperar').hidden = true
  document.getElementById('novo-pin').value = ''
  document.querySelectorAll('input[name="recuperar-inicial"]').forEach(r => { r.checked = false })
}

async function recuperarPin() {
  const nick = campoTreinador.value.trim()
  const escolhido = document.querySelector('input[name="recuperar-inicial"]:checked')
  const novoPin = document.getElementById('novo-pin').value
  const divResultado = document.getElementById('recuperar-resultado')

  if (!escolhido) {
    divResultado.innerHTML = '<p class="status-erro-texto">Escolha o seu primeiro Pokémon.</p>'
    return
  }
  if (novoPin.length < 4) {
    divResultado.innerHTML = '<p class="status-erro-texto">O novo PIN deve ter de 4 a 20 caracteres.</p>'
    return
  }

  try {
    const resposta = await fetch('/api/treinadores/recuperar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick, inicial: escolhido.value, novoPin })
    })
    const resultado = await resposta.json()
    if (!resposta.ok) {
      divResultado.innerHTML = `<p class="status-erro-texto">${escaparHtml(resultado.erros.join(' '))}</p>`
      return
    }
    // Já deixa o PIN novo no campo, para continuar o cadastro
    campoPin.value = novoPin
    if (lerSessao()) salvarSessao(nick, novoPin)  // a sessão de "Meus Pokémon" passa a usar o PIN novo
    fecharRecuperacao()
    statusPin.classList.remove('pin-novo')
    statusPin.textContent = `🔐 PIN do nick ${nick} trocado! Ele já está preenchido acima.`
  } catch (erro) {
    divResultado.innerHTML = '<p class="status-erro-texto">Não foi possível falar com o servidor.</p>'
    console.error(erro)
  }
}

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

  if (!treinador || !nome) {
    alert('Preencha pelo menos o seu nick do jogo e o nome do Pokémon!')
    return
  }
  if (campoPin.value.length < 4) {
    alert('Digite o PIN do seu nick (4 a 20 caracteres).')
    campoPin.focus()
    return
  }
  if (infoNick && !infoNick.temPin && !campoInicial.value) {
    alert('Escolha o seu primeiro Pokémon. Ele é usado para recuperar o PIN se você esquecer.')
    campoInicial.focus()
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

    if (!resposta.ok) {
      divResultado.innerHTML = `
        <div class="comparacao-pior">
          ⚠️ Não foi possível salvar:
          <ul>${resultado.erros.map(e => `<li>${escaparHtml(e)}</li>`).join('')}</ul>
        </div>
      `
      return
    }

    // Só guarda o nick depois que o servidor aceitou o PIN
    salvarTreinador(treinador)
    // Agora o nick tem PIN (e o primeiro Pokémon, se foi escolhido): esconde o campo e mostra "Esqueci"
    infoNick = { temPin: true, temInicial: Boolean((infoNick && infoNick.temInicial) || campoInicial.value) }
    document.getElementById('campo-inicial').hidden = infoNick.temInicial
    document.getElementById('link-esqueci').hidden = false
    if (resultado.pinCriado) {
      statusPin.classList.remove('pin-novo')
      statusPin.textContent = `🔐 PIN criado para o nick ${treinador}. Ele será pedido para cadastrar e editar.`
    }

    const salvo = resultado.pokemon
    const comp = resultado.comparacao
    const nomeSeguro = escaparHtml(salvo.nome)
    const link = `<a href="index.html?especie=${encodeURIComponent(salvo.nome)}">Ver comparativo completo</a>`

    if (idEdicao) {
      divResultado.innerHTML = `
        <div class="comparacao-melhor">
          ✏️ Alterações salvas! ${nomeSeguro} agora está em ${comp.posicao}º de ${comp.total} da espécie. ${link}
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
    treinador: p.treinador, numero: p.numero, nome: p.nome, tipo1: p.tipo1, tipo2: p.tipo2 || '',
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
  atualizarTotalEV()
  atualizarTotalIV()
}

async function iniciarEdicao() {
  document.querySelector('.formulario-container h2').textContent = 'Editar Pokémon'
  document.querySelector('.subtitulo').textContent =
    'Corrija os dados e salve. A pontuação e o ranking são recalculados.'
  const botao = document.querySelector('.btn-salvar')
  botao.textContent = 'Salvar alterações'
  // O dono não muda na edição: o servidor confere esse nome
  campoTreinador.readOnly = true

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
    campoPin.value = sessao.pin
    verificarPinDoNick()
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

// Cadastro novo com a sessão aberta: nick e PIN já vêm preenchidos
if (!idEdicao) {
  const sessao = lerSessao()
  if (sessao && sessao.nick.toLowerCase() === campoTreinador.value.trim().toLowerCase()) {
    campoPin.value = sessao.pin
  }
}

if (idEdicao) iniciarEdicao()

// Depois de cadastrar, deixa o formulário pronto para o próximo Pokémon (mantém só o treinador)
function limparFormulario() {
  document.querySelectorAll('.formulario-container input, .formulario-container select').forEach(function(campo) {
    // O nick continua: normalmente se cadastra vários Pokémon em sequência
    if (campo.id === 'treinador' || campo.id === 'pin' || campo.id === 'inicial') return
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
  atualizarTotalEV()
  atualizarTotalIV()
}
