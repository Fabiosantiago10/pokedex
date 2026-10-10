function renderizarTop5(pokemons) {
  const top5 = [...pokemons]
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .slice(0, 5)

  const lista = document.getElementById('top5-lista')

  if (top5.length === 0) {
    lista.innerHTML = '<div class="top5-vazio">Nenhum Pokémon cadastrado ainda.</div>'
    return
  }

  const medalhas = ['ouro', 'prata', 'bronze', '', '']
  const emojis = ['🥇', '🥈', '🥉', '4º', '5º']

  lista.innerHTML = top5.map(function(p, i) {
    return `
      <div class="top5-card" data-id="${escaparHtml(p.id)}" style="border-top-color:${coresTipo[p.tipo1] || '#ccc'}">
        <div class="top5-posicao ${medalhas[i]}">${emojis[i]}</div>
        <div class="top5-nome">${escaparHtml(p.nome)}</div>
        ${p.alfa || p.shiny ? `<div>${selosVariante(p)}</div>` : ''}
        <div class="treinador">de ${escaparHtml(p.treinador)}</div>
        <div style="margin-bottom:6px">${badgeTipo(p.tipo1)}${badgeTipo(p.tipo2)}</div>
        <div class="top5-pontuacao">${p.pontuacao}<span>/100</span></div>
      </div>
    `
  }).join('')

  lista.querySelectorAll('.top5-card').forEach(function(card) {
    card.addEventListener('click', function() {
      abrirDetalhe(todosPokemons.find(p => p.id === card.dataset.id))
    })
  })
}

function renderizarCards(lista) {
  const main = document.getElementById('lista')
  main.innerHTML = ''

  if (lista.length === 0) {
    main.innerHTML = '<p style="color:#aaa; text-align:center; grid-column:1 / -1">Nenhum Pokémon encontrado.</p>'
    return
  }

  lista.forEach(function(pokemon) {
    const card = document.createElement('div')
    card.className = 'card'
    card.style.borderTopColor = coresTipo[pokemon.tipo1] || "#ccc"
    card.innerHTML = `
      <span class="numero">#${escaparHtml(pokemon.numero)}</span>
      <h2>${escaparHtml(pokemon.nome)}</h2>
      ${selosVariante(pokemon)}
      <div class="treinador">Treinador: ${escaparHtml(pokemon.treinador)}</div>
      <div class="identificacao">${identificacao(pokemon)}</div>
      <div>${badgeTipo(pokemon.tipo1)}${badgeTipo(pokemon.tipo2)}</div>
      <div class="stats">
        <span>HP: ${pokemon.stats.hp}</span>
        <span>Ataque: ${pokemon.stats.ataque}</span>
        <span>Velocidade: ${pokemon.stats.velocidade}</span>
      </div>
      <div class="iv-total">IVs: ${soma(pokemon.ivs)}/186</div>
      <div class="pontuacao-card">⭐ ${pokemon.pontuacao}/100</div>
    `
    card.addEventListener('click', function() { abrirDetalhe(pokemon) })
    main.appendChild(card)
  })
}

function tabela(obj, sufixo = '') {
  return `<table>${ATRIBUTOS.map(a =>
    `<tr><td>${NOMES_ATRIBUTOS[a]}</td><td>${obj[a]}${sufixo}</td></tr>`
  ).join('')}</table>`
}

// Ranking da mesma espécie entre todos os treinadores, com o Pokémon aberto destacado
function htmlComparativo(pokemon) {
  const alvo = pokemon.nome.toLowerCase()
  const ranking = todosPokemons
    .filter(p => p.nome.toLowerCase() === alvo)
    .sort((a, b) => b.pontuacao - a.pontuacao)

  if (ranking.length < 2) {
    return `<p class="comparativo-vazio">Ainda não há outro ${escaparHtml(pokemon.nome)} na base.
      Mande o link para um amigo cadastrar o dele!</p>`
  }

  const media = Math.round(ranking.reduce((t, p) => t + p.pontuacao, 0) / ranking.length)
  const posicao = ranking.findIndex(p => p.id === pokemon.id) + 1

  return `
    <p class="comparativo-resumo">
      ${posicao}º de ${ranking.length} ${escaparHtml(pokemon.nome)} na base · média ${media}/100
    </p>
    <table class="comparativo">
      <tr>
        <th>#</th><th>Treinador</th><th>Identificação</th>
        ${ATRIBUTOS.map(a => `<th title="IV ${NOMES_ATRIBUTOS[a]}">IV ${NOMES_ATRIBUTOS[a]}</th>`).join('')}
        <th>EVs</th><th>Nota</th>
      </tr>
      ${ranking.map((p, i) => `
        <tr class="${p.id === pokemon.id ? 'atual' : ''}">
          <td>${i + 1}º</td>
          <td>${escaparHtml(p.treinador)} ${selosVariante(p)}</td>
          <td class="col-identificacao">${identificacao(p)}</td>
          ${ATRIBUTOS.map(a => `<td class="${p.ivs[a] === 31 ? 'perfeito' : ''}">${p.ivs[a]}</td>`).join('')}
          <td>${soma(p.evs)}</td>
          <td><strong>${p.pontuacao}</strong></td>
        </tr>
      `).join('')}
    </table>
  `
}

// O botão de editar só aparece para quem cadastrou (nick salvo neste navegador)
function ehDoTreinadorAtual(pokemon) {
  return treinadorAtual() === pokemon.treinador.toLowerCase()
}

function abrirDetalhe(pokemon) {
  if (!pokemon) return
  document.getElementById('detalhe').style.display = 'flex'
  document.getElementById('detalhe-conteudo').innerHTML = `
    <button onclick="fecharDetalhe()" style="float:right; border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
    <div class="detalhe-header">
      <span class="numero">#${escaparHtml(pokemon.numero)}</span>
      <h2>${escaparHtml(pokemon.nome)}</h2>
      ${selosVariante(pokemon)}
      <div style="margin:6px 0">${badgeTipo(pokemon.tipo1)}${badgeTipo(pokemon.tipo2)}</div>
      <p style="color:#666; font-size:14px">Treinador: <strong>${escaparHtml(pokemon.treinador)}</strong></p>
      <p style="color:#666; font-size:14px">Natureza: ${escaparHtml(pokemon.natureza)} | Habilidade: ${escaparHtml(pokemon.habilidade)}</p>
      <p style="color:#666; font-size:14px">${identificacao(pokemon)} | EXP p/ próx. nível: ${pokemon.proxNivel.toLocaleString()}</p>
      ${ehDoTreinadorAtual(pokemon)
        ? `<a class="btn-editar" href="cadastro.html?editar=${encodeURIComponent(pokemon.id)}">✏️ Editar</a>`
        : ''}
    </div>
    <div class="pontuacao-detalhe">
      <span>${pokemon.pontuacao}</span><small>/100</small>
      <p>Pontuação geral (70% IVs + 30% stats no Lv. 100)</p>
    </div>
    <div class="secao secao-comparativo">
      <h3>Comparativo com outros treinadores</h3>
      ${htmlComparativo(pokemon)}
    </div>
    <div class="detalhe-secoes">
      <div class="secao">
        <h3>Stats</h3>
        <div class="alternar-stats" id="alternar-stats" hidden>
          <button type="button" data-nivel="${pokemon.nivel}" class="ativo">Nv ${pokemon.nivel} (atual)</button>
          <button type="button" data-nivel="100">🔄 No Lv. 100</button>
        </div>
        <div id="tabela-stats">${tabela(pokemon.stats)}</div>
        <p class="nota-projecao" id="nota-projecao" hidden>Projeção com os IVs, EVs e natureza atuais.</p>
        <table><tr><td>Felicidade</td><td>${pokemon.stats.felicidade}%</td></tr></table>
      </div>
      <div class="secao">
        <h3>EVs <span class="total-badge">${soma(pokemon.evs)}/510</span></h3>
        ${tabela(pokemon.evs)}
      </div>
      <div class="secao">
        <h3>IVs <span class="total-badge">${soma(pokemon.ivs)}/186</span></h3>
        ${tabela(pokemon.ivs)}
      </div>
      <div class="secao">
        <h3>Movimentos</h3>
        ${pokemon.movimentos.map(m => `
          <div class="movimento">
            <span>${escaparHtml(m.nome)}</span>
            ${badgeTipo(m.tipo)}
          </div>
        `).join('') || '<p style="color:#aaa; font-size:14px">Nenhum movimento cadastrado.</p>'}
      </div>
    </div>
  `
  prepararProjecao(pokemon)
}

// Busca os stats base da espécie e ativa o botão "No Lv. 100", igual ao do jogo
let detalheAberto = null

async function prepararProjecao(pokemon) {
  detalheAberto = pokemon.id
  if (pokemon.nivel >= 100) return  // já está no nível máximo
  let base
  try {
    const resposta = await fetch('/api/especies/' + encodeURIComponent(pokemon.nome))
    if (!resposta.ok) return
    base = (await resposta.json()).base
  } catch (erro) {
    return  // sem PokéAPI: fica só com os stats cadastrados
  }
  // Se outro Pokémon foi aberto enquanto carregava, não mexe na janela
  if (!base || detalheAberto !== pokemon.id) return

  const botoes = document.getElementById('alternar-stats')
  botoes.hidden = false
  botoes.querySelectorAll('button').forEach(function(botao) {
    botao.addEventListener('click', function() {
      const nivel = parseInt(botao.dataset.nivel)
      const noAtual = nivel === pokemon.nivel
      // No nível atual mostra o que foi cadastrado; nos outros, calcula pela fórmula
      const stats = noAtual
        ? pokemon.stats
        : calcularStats(base, pokemon.ivs, pokemon.evs, pokemon.natureza, nivel)
      document.getElementById('tabela-stats').innerHTML = tabela(stats)
      document.getElementById('nota-projecao').hidden = noAtual
      botoes.querySelectorAll('button').forEach(b => b.classList.toggle('ativo', b === botao))
    })
  })
}

function fecharDetalhe() {
  detalheAberto = null
  document.getElementById('detalhe').style.display = 'none'
}

let todosPokemons = []

// Cards sempre do mais forte para o mais fraco
function aplicarFiltros() {
  const texto = document.getElementById('busca').value.toLowerCase()
  const filtrados = todosPokemons
    .filter(p => p.nome.toLowerCase().includes(texto))
    .sort((a, b) => b.pontuacao - a.pontuacao)
  renderizarCards(filtrados)
}

document.getElementById('busca').addEventListener('input', aplicarFiltros)

async function carregarPokemons() {
  try {
    const resposta = await fetch('/api/pokemons')
    todosPokemons = await resposta.json()
  } catch (erro) {
    document.getElementById('lista').innerHTML =
      '<p style="color:#cc0000; text-align:center; grid-column:1 / -1">Não foi possível falar com o servidor. Ele está rodando?</p>'
    console.error(erro)
    return
  }

  renderizarTop5(todosPokemons)
  aplicarFiltros()

  // Vindo do cadastro (index.html?especie=Pikachu): já filtra pela espécie
  const especie = new URLSearchParams(location.search).get('especie')
  if (especie) {
    document.getElementById('busca').value = especie
    aplicarFiltros()
  }
}

carregarPokemons()
