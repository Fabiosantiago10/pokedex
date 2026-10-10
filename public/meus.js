const campoNick = document.getElementById('nick')
const campoFiltro = document.getElementById('filtro-especie')
let meusPokemons = []
let nickBuscado = ''

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
  return `
    <div class="grupo" style="border-left-color:${coresTipo[primeiro.tipo1] || '#ccc'}">
      <div class="grupo-cabecalho">
        <h3>${escaparHtml(primeiro.nome)} <span class="grupo-total">${grupo.length}</span></h3>
        <div>${badgeTipo(primeiro.tipo1)}${badgeTipo(primeiro.tipo2)}</div>
      </div>
      <div class="tabela-rolagem">
        <table class="tabela-meus">
          <tr><th>#</th><th>Como reconhecer</th><th>IVs</th><th>EVs</th><th>Nota</th><th></th></tr>
          ${grupo.map((p, i) => `
            <tr class="${i === 0 && grupo.length > 1 ? 'mais-forte' : ''}">
              <td>${i === 0 && grupo.length > 1 ? '🏆' : (i + 1) + 'º'}</td>
              <td class="col-onde">${identificacao(p)} ${selosVariante(p)}</td>
              <td>${soma(p.ivs)}/186</td>
              <td>${soma(p.evs)}</td>
              <td><strong>${p.pontuacao}</strong></td>
              <td>${p.treinador.toLowerCase() === treinadorAtual()
                ? `<a class="link-editar" href="cadastro.html?editar=${encodeURIComponent(p.id)}">Editar</a>`
                : ''}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    </div>
  `
}

function renderizar() {
  const texto = campoFiltro.value.trim().toLowerCase()
  const filtrados = meusPokemons.filter(p => p.nome.toLowerCase().includes(texto))
  const grupos = agruparPorEspecie(filtrados)
  const divGrupos = document.getElementById('grupos')

  if (grupos.length === 0) {
    divGrupos.innerHTML = '<p class="vazio">Nenhum Pokémon encontrado com esse filtro.</p>'
    return
  }
  divGrupos.innerHTML = grupos.map(htmlGrupo).join('')
}

// `salvar`: só guarda o nick quando a pessoa digitou (não quando veio de um link compartilhado)
async function buscarMeus(nick, salvar) {
  const resumo = document.getElementById('resumo')
  resumo.textContent = 'Buscando...'
  document.getElementById('grupos').innerHTML = ''

  try {
    const resposta = await fetch('/api/pokemons?treinador=' + encodeURIComponent(nick))
    if (!resposta.ok) throw new Error(resposta.status)
    meusPokemons = await resposta.json()
  } catch (erro) {
    resumo.textContent = 'Não foi possível falar com o servidor. Ele está rodando?'
    console.error(erro)
    return
  }

  nickBuscado = nick
  if (meusPokemons.length === 0) {
    campoFiltro.hidden = true
    resumo.innerHTML = `
      Nenhum Pokémon cadastrado com o nick <strong>${escaparHtml(nick)}</strong>.
      Confira se está escrito igual ao do cadastro, ou <a href="cadastro.html">cadastre o primeiro</a>.
    `
    return
  }

  // Guarda o nick: o cadastro já vem preenchido e o botão Editar aparece na Pokédex
  if (salvar) salvarTreinador(nick)

  const especies = new Set(meusPokemons.map(p => p.nome.toLowerCase())).size
  resumo.innerHTML = `<strong>${escaparHtml(meusPokemons[0].treinador)}</strong> tem
    ${meusPokemons.length} Pokémon cadastrado(s) em ${especies} espécie(s).`
  campoFiltro.hidden = false
  renderizar()
}

document.getElementById('form-nick').addEventListener('submit', function(evento) {
  evento.preventDefault()
  const nick = campoNick.value.trim()
  if (nick) buscarMeus(nick, true)
})

campoFiltro.addEventListener('input', renderizar)

// meus.html?nick=SrFos abre direto a lista desse treinador (link para mandar a um amigo).
// Sem isso, usa o nick já usado neste navegador.
const nickDoLink = new URLSearchParams(location.search).get('nick')
campoNick.value = nickDoLink || nickSalvo()
if (campoNick.value) buscarMeus(campoNick.value, false)
