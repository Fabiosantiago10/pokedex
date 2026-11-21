// Lista de Pokémons — carregada do arquivo pokemons.json (o agente adiciona os novos lá)
let pokemons = []

// Cores por tipo
const coresTipo = {
  Normal: "#A8A878",
  Flying: "#98D8D8",
  Electric: "#F8D030",
  Fire: "#F08030",
  Water: "#6890F0",
  Grass: "#78C850",
  Poison: "#A040A0",
  Bug: "#A8B820",
  Rock: "#B8A038",
  Ground: "#E0C068",
  Psychic: "#F85888",
  Ice: "#98D8D8",
  Dragon: "#7038F8",
  Dark: "#705848",
  Steel: "#B8B8D0",
  Fairy: "#EE99AC",
  Fighting: "#C03028",
  Ghost: "#705898"
}

// Mostra um traço quando o agente não conseguiu ler o valor
function v(x) {
  return x === null || x === undefined ? '–' : esc(x)
}

// Escapa texto vindo da base (lido de prints pelo agente)
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// Bloco com a avaliação feita pelo agente
function blocoAvaliacao(a) {
  if (!a) return ''
  const evs = a.evsSugeridos ? Object.entries(a.evsSugeridos).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${esc(k)}`).join(' / ') : ''
  return `
      <div class="secao">
        <h3>Avaliação <span class="total-badge">${esc(a.nota)}/10</span></h3>
        <p>${esc(a.resumo)}</p>
        ${a.comparacao ? `<p><b>Na base:</b> ${esc(a.comparacao)}</p>` : ''}
        ${a.naturezaIdeal ? `<p><b>Natureza ideal:</b> ${esc(a.naturezaIdeal)}</p>` : ''}
        ${evs ? `<p><b>EVs:</b> ${evs}</p>` : ''}
        ${a.golpesSugeridos?.length ? `<p><b>Golpes:</b> ${a.golpesSugeridos.map(esc).join(', ')}</p>` : ''}
        ${a.item ? `<p><b>Item:</b> ${esc(a.item)}</p>` : ''}
        ${a.melhorar?.length ? `<p><b>Melhorar:</b> ${a.melhorar.map(esc).join('; ')}</p>` : ''}
      </div>`
}

// Gera o badge de tipo
function badgeTipo(tipo) {
  const cor = coresTipo[tipo] || "#888"
  return `<span class="badge" style="background-color:${cor}">${tipo}</span>`
}

// Gera os cards na lista
function renderizarCards(lista) {
  const main = document.getElementById('lista')
  main.innerHTML = ''

  lista.forEach(function(pokemon) {
    const card = document.createElement('div')
    card.className = 'card'
    card.style.borderTopColor = coresTipo[pokemon.tipo1] || "#ccc"

    card.innerHTML = `
      <span class="numero">#${pokemon.numero}</span>
      <h2>${esc(pokemon.nome)}</h2>
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        ${badgeTipo(pokemon.tipo1)}
        ${pokemon.tipo2 ? badgeTipo(pokemon.tipo2) : ''}
      </div>
      <div class="stats">
        <span>HP: ${v(pokemon.stats.hp)}</span>
        <span>Ataque: ${v(pokemon.stats.ataque)}</span>
        <span>Velocidade: ${v(pokemon.stats.velocidade)}</span>
      </div>
      <div class="iv-total">IVs: ${v(pokemon.ivs.total)}/186${pokemon.avaliacao ? ` · Nota ${esc(pokemon.avaliacao.nota)}/10` : ''}</div>
    `

    // Ao clicar abre o detalhe
    card.addEventListener('click', function() {
      abrirDetalhe(pokemon)
    })

    main.appendChild(card)
  })
}

// Abre tela de detalhe
function abrirDetalhe(pokemon) {
  document.getElementById('detalhe').style.display = 'flex'
  document.getElementById('detalhe-conteudo').innerHTML = `
    <button onclick="fecharDetalhe()" style="float:right; border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
    <div class="detalhe-header">
      <span class="numero">#${pokemon.numero}</span>
      <h2>${esc(pokemon.nome)}</h2>
      <div style="display:flex; gap:6px; margin:6px 0;">
        ${badgeTipo(pokemon.tipo1)}
        ${pokemon.tipo2 ? badgeTipo(pokemon.tipo2) : ''}
      </div>
      <p>Natureza: ${esc(pokemon.natureza)} | Habilidade: ${esc(pokemon.habilidade)}</p>
      <p>${pokemon.nivel ? `Nível: ${esc(pokemon.nivel)} | ` : ''}EXP: ${(pokemon.exp ?? 0).toLocaleString()} | Próx. nível: ${(pokemon.proxNivel ?? 0).toLocaleString()}</p>
    </div>

    <div class="detalhe-secoes">

      <div class="secao">
        <h3>Stats</h3>
        <table>
          <tr><td>HP</td><td>${v(pokemon.stats.hp)} / ${v(pokemon.stats.hpMax)}</td></tr>
          <tr><td>Felicidade</td><td>${v(pokemon.stats.felicidade)}%</td></tr>
          <tr><td>Ataque</td><td>${v(pokemon.stats.ataque)}</td></tr>
          <tr><td>Defesa</td><td>${v(pokemon.stats.defesa)}</td></tr>
          <tr><td>Atq. Esp</td><td>${v(pokemon.stats.atqEsp)}</td></tr>
          <tr><td>Def. Esp</td><td>${v(pokemon.stats.defEsp)}</td></tr>
          <tr><td>Velocidade</td><td>${v(pokemon.stats.velocidade)}</td></tr>
        </table>
      </div>

      <div class="secao">
        <h3>EVs <span class="total-badge">${v(pokemon.evs.total)}/510</span></h3>
        <table>
          <tr><td>HP</td><td>${v(pokemon.evs.hp)}</td></tr>
          <tr><td>Ataque</td><td>${v(pokemon.evs.ataque)}</td></tr>
          <tr><td>Defesa</td><td>${v(pokemon.evs.defesa)}</td></tr>
          <tr><td>Atq. Esp</td><td>${v(pokemon.evs.atqEsp)}</td></tr>
          <tr><td>Def. Esp</td><td>${v(pokemon.evs.defEsp)}</td></tr>
          <tr><td>Velocidade</td><td>${v(pokemon.evs.velocidade)}</td></tr>
        </table>
      </div>

      <div class="secao">
        <h3>IVs <span class="total-badge">${v(pokemon.ivs.total)}/186</span></h3>
        <table>
          <tr><td>HP</td><td>${v(pokemon.ivs.hp)}</td></tr>
          <tr><td>Ataque</td><td>${v(pokemon.ivs.ataque)}</td></tr>
          <tr><td>Defesa</td><td>${v(pokemon.ivs.defesa)}</td></tr>
          <tr><td>Atq. Esp</td><td>${v(pokemon.ivs.atqEsp)}</td></tr>
          <tr><td>Def. Esp</td><td>${v(pokemon.ivs.defEsp)}</td></tr>
          <tr><td>Velocidade</td><td>${v(pokemon.ivs.velocidade)}</td></tr>
        </table>
      </div>

      <div class="secao">
        <h3>Movimentos</h3>
        ${pokemon.movimentos.map(m => `
          <div class="movimento">
            <span>${esc(m.nome)}</span>
            ${badgeTipo(m.tipo)}
          </div>
        `).join('')}
      </div>
${blocoAvaliacao(pokemon.avaliacao)}
    </div>
  `
}

// Fecha o detalhe
function fecharDetalhe() {
  document.getElementById('detalhe').style.display = 'none'
}

// Busca por nome
document.getElementById('busca').addEventListener('input', function() {
  const texto = this.value.toLowerCase()
  const filtrados = pokemons.filter(function(p) {
    return p.nome.toLowerCase().includes(texto)
  })
  renderizarCards(filtrados)
})

// Filtro por tipo (botões do topo)
function filtrar(tipo) {
  if (tipo === 'todos') return renderizarCards(pokemons)
  renderizarCards(pokemons.filter(p => p.tipo1 === tipo || p.tipo2 === tipo))
}

// Carrega a base do pokemons.json e renderiza
fetch('pokemons.json', { cache: 'no-store' })
  .then(r => r.json())
  .then(dados => {
    pokemons = dados
    renderizarCards(pokemons)
  })
  .catch(() => {
    document.getElementById('lista').innerHTML = '<p>Não foi possível carregar pokemons.json</p>'
  })