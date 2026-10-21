// "Meus Pokémon": o treinador entra com nick + PIN e vê só os Pokémon dele.
// A sessão (nick + PIN) fica só nesta aba, para editar sem digitar o PIN de novo.
const campoNick = document.getElementById('nick')
const campoPin = document.getElementById('pin')
const campoInicial = document.getElementById('inicial')
const campoFiltro = document.getElementById('filtro-especie')
let meusPokemons = []

// Mostra o campo do primeiro Pokémon quando o nick ainda não tem PIN
async function verificarNick() {
  const nick = campoNick.value.trim()
  const aviso = document.getElementById('aviso-nick')
  if (!nick) return
  try {
    const info = await (await fetch('/api/treinadores/' + encodeURIComponent(nick))).json()
    if (campoNick.value.trim() !== nick) return
    document.getElementById('campo-inicial').hidden = info.temPin
    aviso.textContent = info.temPin ? '' : `O nick ${nick} ainda não tem PIN: o que você digitar agora vira o PIN dele. Guarde bem!`
  } catch (erro) {
    console.error(erro)
  }
}

let jogoFiltro = ''   // '' = todos os jogos

// Agrupa por espécie; dentro de cada grupo, do mais forte para o mais fraco
function agruparPorEspecie(lista) {
  const grupos = {}
  lista.forEach(function(p) {
    // Mesma espécie de jogos diferentes fica em grupos separados (não se comparam)
    const chave = p.nome.toLowerCase() + '|' + plataformaDe(p)
    if (!grupos[chave]) grupos[chave] = []
    grupos[chave].push(p)
  })
  const ordem = document.getElementById('ordem').value
  // "Atualizados por último": o grupo vale pelo save mais recente dele
  const maisRecente = g => g.map(p => String(p.atualizadoEm || p.criadoEm || '')).sort().pop()
  return Object.values(grupos)
    .map(g => g.sort((a, b) => b.pontuacao - a.pontuacao))
    .sort(ordem === 'recentes'
      ? (a, b) => maisRecente(b).localeCompare(maisRecente(a))
      : (a, b) => ORDENS_LISTA[ordem].comparar(a[0], b[0]))
}

// Chips de jogo com a quantidade de cada um
function renderizarFiltroJogo() {
  const jogos = Object.keys(PLATAFORMAS).filter(id => meusPokemons.some(p => plataformaDe(p) === id))
  document.getElementById('filtro-jogo').hidden = jogos.length < 2
  document.getElementById('filtro-jogo').innerHTML = [['', '📋 Todos', meusPokemons.length],
    ...jogos.map(id => [id, PLATAFORMAS[id].icone + ' ' + PLATAFORMAS[id].nome, meusPokemons.filter(p => plataformaDe(p) === id).length])]
    .map(([id, nome, total]) => `<button type="button" role="tab" class="chip-plataforma ${id === jogoFiltro ? 'ativo' : ''}" data-jogo="${id}" aria-selected="${id === jogoFiltro}">${nome} <span>${total}</span></button>`)
    .join('')
}

document.getElementById('filtro-jogo').addEventListener('click', function(evento) {
  const botao = evento.target.closest('[data-jogo]')
  if (!botao) return
  jogoFiltro = botao.dataset.jogo
  renderizar()
})
document.getElementById('ordem').addEventListener('change', renderizar)

// Espécies abertas (continuam abertas ao filtrar ou trocar a ordem)
const abertos = new Set()
let abrirTodos = false

function chaveGrupo(p) {
  return p.nome.toLowerCase() + '|' + plataformaDe(p)
}

function htmlGrupo(grupo) {
  const primeiro = grupo[0]
  const cor = coresTipo[primeiro.tipo1] || '#9aa0a6'
  const chave = chaveGrupo(primeiro)
  const aberto = abrirTodos || abertos.has(chave)
  return `
    <details class="grupo" style="border-left-color:${cor}" data-chave="${escaparHtml(chave)}" ${aberto ? 'open' : ''}>
      <summary class="grupo-cabecalho">
        ${imagemPokemon(primeiro, 'grupo-imagem')}
        <div class="grupo-nome">
          <h3><small>#${escaparHtml(primeiro.numero)}</small> ${escaparHtml(primeiro.nome)} <span class="total-badge">${grupo.length}</span></h3>
          <span class="tipos">${badgeTipo(primeiro.tipo1)}${badgeTipo(primeiro.tipo2)}</span>
        </div>
        <div class="grupo-melhor">
          <small>${grupo.length > 1 ? '🏆 Melhor' : 'Único'}</small>
          <span>${identificacao(primeiro).replace(/<[^>]+>/g, '')} · IVs ${soma(primeiro.ivs)}/186</span>
        </div>
        <span class="seta" aria-hidden="true">▾</span>
      </summary>
      <div class="tabela-rolagem">
        <table class="tabela-meus">
          <tr><th>#</th><th>Como reconhecer no jogo</th><th>IVs</th><th>EVs</th><th></th></tr>
          ${grupo.map((p, i) => `
            <tr class="${i === 0 && grupo.length > 1 ? 'mais-forte' : ''}">
              <td>${i === 0 && grupo.length > 1 ? '🏆' : (i + 1) + 'º'}</td>
              <td class="col-onde">${identificacao(p)} ${selosVariante(p)}</td>
              <td class="col-ivs">
                <strong>${soma(p.ivs)}</strong><small>/186</small>
                ${contarPerfeitos(p.ivs) ? `<span class="perfeitos">${contarPerfeitos(p.ivs)}×31</span>` : ''}
                ${barra(soma(p.ivs), 186, cor)}
              </td>
              <td>${soma(p.evs)}</td>
              <td class="col-acoes">
                <a class="link-editar" href="cadastro.html?editar=${encodeURIComponent(p.id)}">Editar</a>
                <a class="link-editar" href="dicas.html?id=${encodeURIComponent(p.id)}">💡 Builds</a>
                <a class="link-editar" href="historico.html?id=${encodeURIComponent(p.id)}">📜 Histórico</a>
              </td>
            </tr>
          `).join('')}
        </table>
      </div>
    </details>
  `
}

// Lembra quais espécies a pessoa abriu
document.getElementById('grupos').addEventListener('toggle', function(evento) {
  const grupo = evento.target
  if (!grupo.matches || !grupo.matches('details.grupo')) return
  if (grupo.open) abertos.add(grupo.dataset.chave)
  else abertos.delete(grupo.dataset.chave)
}, true)

// Separado por jogo (cada jogo com o seu título) e, dentro dele, por espécie
function renderizar() {
  const texto = campoFiltro.value.trim().toLowerCase()
  const divGrupos = document.getElementById('grupos')
  renderizarFiltroJogo()
  if (meusPokemons.length === 0) {
    divGrupos.innerHTML = '<p class="vazio">Você ainda não cadastrou nenhum Pokémon. <a href="cadastro.html">Cadastre o primeiro!</a></p>'
    return
  }
  const filtrados = meusPokemons.filter(p => p.nome.toLowerCase().includes(texto) && (!jogoFiltro || plataformaDe(p) === jogoFiltro))
  // Procurando uma espécie (ou com poucas), já mostra tudo aberto
  abrirTodos = Boolean(texto) || agruparPorEspecie(filtrados).length <= 3
  const jogos = Object.keys(PLATAFORMAS).filter(id => filtrados.some(p => plataformaDe(p) === id))
  divGrupos.innerHTML = jogos.length
    ? jogos.map(function(id) {
        const doJogo = filtrados.filter(p => plataformaDe(p) === id)
        return `
          <h3 class="titulo-jogo">${PLATAFORMAS[id].icone} ${PLATAFORMAS[id].nome} <span>${doJogo.length} Pokémon</span></h3>
          ${agruparPorEspecie(doJogo).map(htmlGrupo).join('')}
        `
      }).join('')
    : '<p class="vazio">Nenhum Pokémon encontrado com esse filtro.</p>'
}

async function entrar(nick, pin, inicial) {
  const erro = document.getElementById('erro-entrar')
  erro.textContent = ''
  try {
    const resposta = await fetch('/api/meus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick, pin, inicial })
    })
    const resultado = await resposta.json()
    if (!resposta.ok) {
      erro.textContent = resultado.erros.join(' ')
      encerrarSessao()
      return false
    }

    salvarSessao(resultado.nick, pin)
    salvarTreinador(resultado.nick)
    meusPokemons = resultado.pokemons

    document.getElementById('area-entrar').hidden = true
    document.getElementById('area-lista').hidden = false
    document.getElementById('nome-treinador').textContent = resultado.nick
    const especies = new Set(meusPokemons.map(p => p.nome.toLowerCase())).size
    document.getElementById('resumo').textContent = (resultado.pinCriado ? '🔐 PIN criado! ' : '') +
      `Você tem ${meusPokemons.length} Pokémon cadastrado(s) em ${especies} espécie(s).`
    renderizar()
    return true
  } catch (e) {
    erro.textContent = 'Não foi possível falar com o servidor. Tente de novo.'
    console.error(e)
    return false
  }
}

document.getElementById('form-entrar').addEventListener('submit', function(evento) {
  evento.preventDefault()
  entrar(campoNick.value.trim(), campoPin.value, campoInicial.value)
})

document.getElementById('sair').addEventListener('click', function() {
  encerrarSessao()
  meusPokemons = []
  campoPin.value = ''
  document.getElementById('area-lista').hidden = true
  document.getElementById('area-entrar').hidden = false
})

// ---------- Esqueci meu PIN ----------
function abrirRecuperacao() {
  document.getElementById('recuperar-resultado').textContent = ''
  document.getElementById('painel-recuperar').hidden = false
  if (!campoNick.value.trim()) campoNick.focus()
}

function fecharRecuperacao() {
  document.getElementById('painel-recuperar').hidden = true
  document.getElementById('novo-pin').value = ''
  document.querySelectorAll('input[name="recuperar-inicial"]').forEach(r => { r.checked = false })
}

async function recuperarPin() {
  const nick = campoNick.value.trim()
  const escolhido = document.querySelector('input[name="recuperar-inicial"]:checked')
  const novoPin = document.getElementById('novo-pin').value
  const resultado = document.getElementById('recuperar-resultado')

  if (!nick) {
    resultado.textContent = 'Digite o seu nick no campo acima.'
    campoNick.focus()
    return
  }
  if (!escolhido) {
    resultado.textContent = 'Escolha o seu primeiro Pokémon.'
    return
  }
  if (novoPin.length < 4) {
    resultado.textContent = 'O novo PIN deve ter de 4 a 20 caracteres.'
    return
  }

  try {
    const resposta = await fetch('/api/treinadores/recuperar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick, inicial: escolhido.value, novoPin })
    })
    const dados = await resposta.json()
    if (!resposta.ok) {
      resultado.textContent = dados.erros.join(' ')
      return
    }
    // PIN trocado: já entra com ele
    campoPin.value = novoPin
    fecharRecuperacao()
    entrar(nick, novoPin, '')
  } catch (erro) {
    resultado.textContent = 'Não foi possível falar com o servidor.'
    console.error(erro)
  }
}

campoNick.addEventListener('change', verificarNick)
campoFiltro.addEventListener('input', renderizar)

// Já entra se a sessão desta aba ainda estiver aberta
campoNick.value = nickSalvo()
const sessao = lerSessao()
if (sessao) {
  campoNick.value = sessao.nick
  entrar(sessao.nick, sessao.pin, '')
} else if (campoNick.value) {
  verificarNick()
  campoPin.focus()
}
