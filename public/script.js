// Página principal: pódio, cards, ranking e detalhes.
// Nada aqui mostra o treinador: a API pública não envia de quem é cada Pokémon.

let todosPokemons = []
let visao = 'cards'

function corTipo(tipo) {
  return coresTipo[tipo] || '#9aa0a6'
}

// Fundo suave com as cores dos tipos do Pokémon
function fundoTipo(p) {
  const c1 = corTipo(p.tipo1)
  const c2 = p.tipo2 ? corTipo(p.tipo2) : c1
  return `linear-gradient(135deg, ${c1}40 0%, ${c2}26 100%)`
}

function linhaIdentificacao(p) {
  return `<span class="identificacao">${identificacao(p)}</span>`
}

function resumoIVs(p) {
  const perfeitos = contarPerfeitos(p.ivs)
  return `IVs ${soma(p.ivs)}/186${perfeitos ? ` · <span class="perfeitos">${perfeitos}×31</span>` : ''}`
}

// Status em grade compacta (HP, Atq, Def...), com a natureza em verde/vermelho
function statsCompactos(p) {
  return `<span class="stats-compactos">${ATRIBUTOS.map(a => `
    <span class="stat-compacto ${marcaNatureza(p.natureza, a)}"><small>${ABREVIACOES[a]}</small><strong>${p.stats[a]}</strong></span>
  `).join('')}</span>`
}

// Status em lista (um por linha), igual ao das cartas
function statsLista(p) {
  return `<span class="stats-lista">${ATRIBUTOS.map(a => `
    <span class="atributo ${marcaNatureza(p.natureza, a)}">
      <span class="atributo-nome">${NOMES_ATRIBUTOS[a]}</span>
      <strong>${p.stats[a]}</strong>
    </span>
  `).join('')}</span>`
}

// A ordem continua do mais forte para o mais fraco (IVs + stats); só a nota não aparece
function ordenarPorNota(lista) {
  return [...lista].sort((a, b) => b.pontuacao - a.pontuacao)
}

// ---------- Pódio ----------
function renderizarPodio(lista) {
  const top = ordenarPorNota(lista).slice(0, 5)
  const podio = document.getElementById('podio')
  const resto = document.getElementById('podio-resto')

  if (top.length === 0) {
    podio.innerHTML = '<p class="vazio">Nenhum Pokémon cadastrado ainda. Seja o primeiro!</p>'
    resto.innerHTML = ''
    return
  }

  // Ordem visual do pódio: 2º, 1º, 3º
  const medalhas = ['🥇', '🥈', '🥉']
  const ordem = [1, 0, 2].filter(i => top[i])
  podio.innerHTML = ordem.map(i => {
    const p = top[i]
    return `
      <button type="button" class="podio-item lugar-${i + 1}" data-id="${escaparHtml(p.id)}" style="background:${fundoTipo(p)}">
        <span class="medalha">${medalhas[i]}</span>
        ${imagemComEfeito(p, 'podio-imagem')}
        <span class="podio-nome">${escaparHtml(p.nome)}</span>
        <span class="tipos">${badgeTipo(p.tipo1)}${badgeTipo(p.tipo2)}</span>
        ${p.alfa || p.shiny ? `<span>${selosVariante(p)}</span>` : ''}
        ${statsLista(p)}
        <span class="podio-ivs">${resumoIVs(p)}</span>
        <span class="degrau">${i + 1}º</span>
      </button>
    `
  }).join('')

  resto.innerHTML = top.slice(3).map((p, i) => `
    <button type="button" class="resto-item" data-id="${escaparHtml(p.id)}">
      <span class="resto-posicao">${i + 4}º</span>
      ${imagemPokemon(p, 'resto-imagem')}
      <span class="resto-nome">${escaparHtml(p.nome)} ${selosVariante(p)}</span>
      <span class="tipos">${badgeTipo(p.tipo1)}${badgeTipo(p.tipo2)}</span>
      <span class="resto-ivs">${resumoIVs(p)}</span>
      <span class="resto-stats">${statsLista(p)}</span>
    </button>
  `).join('')
}

// ---------- Cartas (status no estilo das cartas de Super Trunfo) ----------
function htmlCarta(p) {
  const stats = p.stats
  const cor = corTipo(p.tipo1)
  const perfeitos = contarPerfeitos(p.ivs)
  return `
    <button type="button" class="carta" data-id="${escaparHtml(p.id)}" style="--cor:${cor}">
      <span class="carta-cabecalho">
        <span class="carta-codigo">#${escaparHtml(p.numero)}</span>
        <span class="carta-nome">${escaparHtml(p.nome)}</span>
      </span>
      <span class="carta-arte" style="background:${fundoTipo(p)}">
        ${imagemComEfeito(p, 'carta-imagem', 'so-hover')}
        <span class="carta-tipos">${badgeTipo(p.tipo1)}${badgeTipo(p.tipo2)}</span>
        ${p.alfa || p.shiny ? `<span class="carta-selos">${selosVariante(p)}</span>` : ''}
      </span>
      <span class="carta-atributos">
        <span class="carta-subtitulo">Stats</span>
        ${ATRIBUTOS.map(a => `
          <span class="atributo ${marcaNatureza(p.natureza, a)}">
            <span class="atributo-nome">${NOMES_ATRIBUTOS[a]}</span>
            <strong>${stats[a]}</strong>
          </span>
        `).join('')}
      </span>
      <span class="carta-resumo">
        <span class="resumo-bloco">
          <small>IVs</small>
          <strong>${soma(p.ivs)}<em>/186</em></strong>
          ${perfeitos ? `<span class="perfeitos">${perfeitos}×31</span>` : ''}
        </span>
        <span class="resumo-bloco">
          <small>EVs</small>
          <strong>${soma(p.evs)}<em>/510</em></strong>
        </span>
        <span class="resumo-bloco">
          <small>Nível</small>
          <strong>${p.nivel}${SIMBOLO_SEXO[p.sexo] ? ' ' + SIMBOLO_SEXO[p.sexo] : ''}</strong>
        </span>
      </span>
      <span class="carta-rodape">
        <span><small>Natureza</small> ${escaparHtml(p.natureza || '—')} ${p.natureza ? `<em>(${efeitoNatureza(p.natureza)})</em>` : ''}</span>
        <span><small>Habilidade</small> ${escaparHtml(p.habilidade || '—')}</span>
      </span>
    </button>
  `
}

function renderizarCards(lista) {
  const grade = document.getElementById('lista')
  if (lista.length === 0) {
    grade.innerHTML = '<p class="vazio">Nenhum Pokémon encontrado.</p>'
    return
  }
  grade.innerHTML = lista.map(htmlCarta).join('')
}

// ---------- Ranking detalhado ----------
function renderizarRanking(lista) {
  const div = document.getElementById('ranking')
  if (lista.length === 0) {
    div.innerHTML = '<p class="vazio">Nenhum Pokémon encontrado.</p>'
    return
  }
  div.innerHTML = `
    <table class="tabela-ranking">
      <thead>
        <tr>
          <th>#</th><th colspan="2">Pokémon</th><th class="col-opcional">Nível · Natureza</th>
          <th>IVs</th><th class="col-opcional">EVs</th><th class="col-opcional">Status</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map((p, i) => `
          <tr data-id="${escaparHtml(p.id)}" tabindex="0">
            <td class="col-posicao">${i < 3 ? ['🥇', '🥈', '🥉'][i] : (i + 1) + 'º'}</td>
            <td class="col-imagem">${imagemPokemon(p, 'ranking-imagem')}</td>
            <td>
              <strong>${escaparHtml(p.nome)}</strong> ${selosVariante(p)}<br>
              <span class="tipos">${badgeTipo(p.tipo1)}${badgeTipo(p.tipo2)}</span>
            </td>
            <td class="col-opcional">${linhaIdentificacao(p)}</td>
            <td class="col-ivs">
              <span class="valor-ivs">${soma(p.ivs)}<small>/186</small></span>
              ${contarPerfeitos(p.ivs) ? `<span class="perfeitos">${contarPerfeitos(p.ivs)}×31</span>` : ''}
              ${barra(soma(p.ivs), 186, corTipo(p.tipo1))}
            </td>
            <td class="col-opcional">${soma(p.evs)}<small>/510</small></td>
            <td class="col-opcional col-stats">${statsCompactos(p)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

// ---------- Detalhes ----------
function linhasBarras(valores, maximo, cor, destaque31) {
  return ATRIBUTOS.map(a => `
    <div class="linha-barra">
      <span class="rotulo-barra">${NOMES_ATRIBUTOS[a]}</span>
      <span class="valor-barra ${destaque31 && valores[a] === 31 ? 'perfeito' : ''}">${valores[a]}</span>
      ${barra(valores[a], maximo, cor)}
    </div>
  `).join('')
}

function barrasStats(stats, cor) {
  const maior = Math.max(...ATRIBUTOS.map(a => stats[a]))
  return linhasBarras(stats, Math.max(255, maior), cor, false)
}

// Ranking da mesma espécie, com o Pokémon aberto destacado (sem nomes de treinador)
function htmlComparativo(pokemon) {
  const alvo = pokemon.nome.toLowerCase()
  const ranking = ordenarPorNota(todosPokemons.filter(p => p.nome.toLowerCase() === alvo))

  if (ranking.length < 2) {
    return `<p class="vazio-pequeno">Ainda não há outro ${escaparHtml(pokemon.nome)} na base.
      Mande o link para um amigo cadastrar o dele!</p>`
  }

  const posicao = ranking.findIndex(p => p.id === pokemon.id) + 1

  return `
    <p class="comparativo-resumo"><strong>${posicao}º de ${ranking.length}</strong> ${escaparHtml(pokemon.nome)} na base</p>
    <div class="tabela-rolagem">
      <table class="comparativo">
        <tr>
          <th>#</th><th>Nível · Natureza</th>
          ${ATRIBUTOS.map(a => `<th title="IV de ${NOMES_ATRIBUTOS[a]}">${NOMES_ATRIBUTOS[a]}</th>`).join('')}
          <th>EVs</th>
        </tr>
        ${ranking.map((p, i) => `
          <tr class="${p.id === pokemon.id ? 'atual' : ''}">
            <td>${i + 1}º</td>
            <td class="col-identificacao">${identificacao(p)} ${selosVariante(p)}</td>
            ${ATRIBUTOS.map(a => `<td class="${p.ivs[a] === 31 ? 'perfeito' : ''}">${p.ivs[a]}</td>`).join('')}
            <td>${soma(p.evs)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `
}

function abrirDetalhe(pokemon) {
  if (!pokemon) return
  const cor = corTipo(pokemon.tipo1)
  const modal = document.getElementById('detalhe')
  modal.classList.add('aberto')
  document.body.classList.add('sem-rolagem')

  document.getElementById('detalhe-conteudo').innerHTML = `
    <button type="button" class="fechar" onclick="fecharDetalhe()" aria-label="Fechar">✕</button>
    <div class="detalhe-topo" style="background:${fundoTipo(pokemon)}">
      ${imagemComEfeito(pokemon, 'detalhe-imagem')}
      <div class="detalhe-info">
        <span class="card-numero">#${escaparHtml(pokemon.numero)}</span>
        <h2>${escaparHtml(pokemon.nome)}</h2>
        <div class="tipos">${badgeTipo(pokemon.tipo1)}${badgeTipo(pokemon.tipo2)} ${selosVariante(pokemon)}</div>
        <p>${identificacao(pokemon)}${pokemon.habilidade ? ' · ' + escaparHtml(pokemon.habilidade) : ''}</p>
      </div>
    </div>


    <div class="detalhe-grade">
      <div class="painel">
        <div class="painel-cabecalho">
          <h3>Stats</h3>
          <div class="alternar-stats" id="alternar-stats" hidden>
            <button type="button" data-nivel="${pokemon.nivel}" class="ativo">Nv ${pokemon.nivel}</button>
            <button type="button" data-nivel="100">🔄 Lv. 100</button>
          </div>
        </div>
        <div id="barras-stats">${barrasStats(pokemon.stats, cor)}</div>
        <p class="nota-projecao" id="nota-projecao" hidden>Projeção com os IVs, EVs e natureza atuais.</p>
        <p class="felicidade">Felicidade: ${pokemon.stats.felicidade}%</p>
      </div>

      <div class="painel">
        <div class="painel-cabecalho">
          <h3>IVs</h3>
          <span class="total-badge">${soma(pokemon.ivs)}/186</span>
        </div>
        ${linhasBarras(pokemon.ivs, 31, cor, true)}
      </div>

      <div class="painel">
        <div class="painel-cabecalho">
          <h3>EVs</h3>
          <span class="total-badge">${soma(pokemon.evs)}/510</span>
        </div>
        ${linhasBarras(pokemon.evs, 252, cor, false)}
      </div>

      <div class="painel">
        <div class="painel-cabecalho"><h3>Ataques</h3></div>
        <div class="ataques">
          ${pokemon.movimentos.map(m => `
            <span class="ataque" style="border-color:${corTipo(m.tipo)}">
              <span>${escaparHtml(m.nome)}</span>${badgeTipo(m.tipo)}
            </span>
          `).join('') || '<p class="vazio-pequeno">Nenhum ataque cadastrado.</p>'}
        </div>
      </div>
    </div>

    <div class="painel painel-largo">
      <div class="painel-cabecalho"><h3>Comparativo da espécie</h3></div>
      ${htmlComparativo(pokemon)}
    </div>
  `
  prepararProjecao(pokemon, cor)
}

// Busca os stats base da espécie e ativa o botão "Lv. 100", igual ao do jogo
let detalheAberto = null

async function prepararProjecao(pokemon, cor) {
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
      document.getElementById('barras-stats').innerHTML = barrasStats(stats, cor)
      document.getElementById('nota-projecao').hidden = noAtual
      botoes.querySelectorAll('button').forEach(b => b.classList.toggle('ativo', b === botao))
    })
  })
}

function fecharDetalhe() {
  detalheAberto = null
  document.getElementById('detalhe').classList.remove('aberto')
  document.body.classList.remove('sem-rolagem')
}

document.addEventListener('keydown', function(evento) {
  if (evento.key === 'Escape') fecharDetalhe()
})

// Qualquer card, linha do ranking ou item do pódio abre os detalhes
document.addEventListener('click', function(evento) {
  const alvo = evento.target.closest('[data-id]')
  if (!alvo || alvo.closest('#detalhe')) return
  abrirDetalhe(todosPokemons.find(p => p.id === alvo.dataset.id))
})
document.getElementById('ranking').addEventListener('keydown', function(evento) {
  const linha = evento.target.closest('tr[data-id]')
  if (linha && evento.key === 'Enter') abrirDetalhe(todosPokemons.find(p => p.id === linha.dataset.id))
})

// ---------- Filtro e troca de visão ----------
function aplicarFiltros() {
  const texto = document.getElementById('busca').value.trim().toLowerCase()
  const filtrados = ordenarPorNota(todosPokemons.filter(p => p.nome.toLowerCase().includes(texto)))
  document.getElementById('contador').textContent = filtrados.length ? `(${filtrados.length})` : ''
  if (visao === 'cards') renderizarCards(filtrados)
  else renderizarRanking(filtrados)
}

function trocarVisao(nova) {
  visao = nova
  document.getElementById('lista').hidden = nova !== 'cards'
  document.getElementById('ranking').hidden = nova !== 'ranking'
  document.querySelectorAll('.alternar-visao button').forEach(b => b.classList.toggle('ativo', b.dataset.visao === nova))
  try {
    localStorage.setItem('visao', nova)
  } catch (e) {}
  aplicarFiltros()
}

document.querySelectorAll('.alternar-visao button').forEach(function(botao) {
  botao.addEventListener('click', () => trocarVisao(botao.dataset.visao))
})
document.getElementById('busca').addEventListener('input', aplicarFiltros)

async function carregarPokemons() {
  try {
    const resposta = await fetch('/api/pokemons')
    todosPokemons = await resposta.json()
  } catch (erro) {
    document.getElementById('lista').innerHTML =
      '<p class="vazio erro">Não foi possível falar com o servidor. Tente recarregar a página.</p>'
    console.error(erro)
    return
  }

  renderizarPodio(todosPokemons)

  // Vindo do cadastro (index.html?especie=Pikachu): já filtra pela espécie
  const especie = new URLSearchParams(location.search).get('especie')
  if (especie) document.getElementById('busca').value = especie

  let salva = 'cards'
  try {
    salva = localStorage.getItem('visao') || 'cards'
  } catch (e) {}
  trocarVisao(salva === 'ranking' ? 'ranking' : 'cards')
}

carregarPokemons()
