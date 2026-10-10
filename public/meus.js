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

// Agrupa por espécie; dentro de cada grupo, do mais forte para o mais fraco
function agruparPorEspecie(lista) {
  const grupos = {}
  lista.forEach(function(p) {
    const chave = p.nome.toLowerCase()
    if (!grupos[chave]) grupos[chave] = []
    grupos[chave].push(p)
  })
  return Object.values(grupos)
    .map(g => g.sort((a, b) => b.pontuacao - a.pontuacao))
    .sort((a, b) => b.length - a.length || a[0].nome.localeCompare(b[0].nome))
}

function htmlGrupo(grupo) {
  const primeiro = grupo[0]
  const cor = coresTipo[primeiro.tipo1] || '#9aa0a6'
  return `
    <div class="grupo" style="border-top-color:${cor}">
      <div class="grupo-cabecalho">
        ${imagemPokemon(primeiro, 'grupo-imagem')}
        <div>
          <h3>${escaparHtml(primeiro.nome)} <span class="total-badge">${grupo.length}</span></h3>
          <span class="tipos">${badgeTipo(primeiro.tipo1)}${badgeTipo(primeiro.tipo2)}</span>
        </div>
      </div>
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
              <td><a class="link-editar" href="cadastro.html?editar=${encodeURIComponent(p.id)}">Editar</a></td>
            </tr>
          `).join('')}
        </table>
      </div>
    </div>
  `
}

function renderizar() {
  const texto = campoFiltro.value.trim().toLowerCase()
  const grupos = agruparPorEspecie(meusPokemons.filter(p => p.nome.toLowerCase().includes(texto)))
  const divGrupos = document.getElementById('grupos')
  if (meusPokemons.length === 0) {
    divGrupos.innerHTML = '<p class="vazio">Você ainda não cadastrou nenhum Pokémon. <a href="cadastro.html">Cadastre o primeiro!</a></p>'
    return
  }
  divGrupos.innerHTML = grupos.length
    ? grupos.map(htmlGrupo).join('')
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
