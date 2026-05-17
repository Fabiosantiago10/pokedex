// Lista de Pokémons — cada {} é um Pokémon com todos os seus dados
const pokemons = [
  {
    numero: "018",
    nome: "Pidgeot",
    natureza: "Jolly",
    tipo1: "Normal",
    tipo2: "Flying",
    habilidade: "Keen Eye",
    exp: 751719,
    proxNivel: 10441,
    stats: {
      hp: 258,
      hpMax: 258,
      felicidade: 100,
      ataque: 191,
      defesa: 154,
      atqEsp: 142,
      defEsp: 150,
      velocidade: 262
    },
    evs: {
      hp: 54,
      ataque: 102,
      defesa: 53,
      atqEsp: 66,
      defEsp: 41,
      velocidade: 194,
      total: 510
    },
    ivs: {
      hp: 31,
      ataque: 24,
      defesa: 5,
      atqEsp: 5,
      defEsp: 16,
      velocidade: 14,
      total: 95
    },
    movimentos: [
      { nome: "Fly", tipo: "Flying" },
      { nome: "Hurricane", tipo: "Flying" },
      { nome: "Gust", tipo: "Flying" },
      { nome: "Quick Attack", tipo: "Normal" }
    ]
  },
  {
    numero: "025",
    nome: "Pikachu",
    natureza: "Hasty",
    tipo1: "Electric",
    tipo2: null,
    habilidade: "Static",
    exp: 120000,
    proxNivel: 5000,
    stats: {
      hp: 35,
      hpMax: 35,
      felicidade: 80,
      ataque: 55,
      defesa: 40,
      atqEsp: 50,
      defEsp: 50,
      velocidade: 90
    },
    evs: {
      hp: 0,
      ataque: 0,
      defesa: 0,
      atqEsp: 0,
      defEsp: 0,
      velocidade: 0,
      total: 0
    },
    ivs: {
      hp: 20,
      ataque: 18,
      defesa: 12,
      atqEsp: 25,
      defEsp: 10,
      velocidade: 30,
      total: 115
    },
    movimentos: [
      { nome: "Thunderbolt", tipo: "Electric" },
      { nome: "Quick Attack", tipo: "Normal" },
      { nome: "Iron Tail", tipo: "Steel" },
      { nome: "Volt Tackle", tipo: "Electric" }
    ]
  }
]

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
      <h2>${pokemon.nome}</h2>
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        ${badgeTipo(pokemon.tipo1)}
        ${pokemon.tipo2 ? badgeTipo(pokemon.tipo2) : ''}
      </div>
      <div class="stats">
        <span>HP: ${pokemon.stats.hp}</span>
        <span>Ataque: ${pokemon.stats.ataque}</span>
        <span>Velocidade: ${pokemon.stats.velocidade}</span>
      </div>
      <div class="iv-total">IVs: ${pokemon.ivs.total}/186</div>
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
    <div class="detalhe-header">
      <span class="numero">#${pokemon.numero}</span>
      <h2>${pokemon.nome}</h2>
      <div style="display:flex; gap:6px; margin:6px 0;">
        ${badgeTipo(pokemon.tipo1)}
        ${pokemon.tipo2 ? badgeTipo(pokemon.tipo2) : ''}
      </div>
      <p>Natureza: ${pokemon.natureza} | Habilidade: ${pokemon.habilidade}</p>
      <p>EXP: ${pokemon.exp.toLocaleString()} | Próx. nível: ${pokemon.proxNivel.toLocaleString()}</p>
    </div>

    <div class="detalhe-secoes">

      <div class="secao">
        <h3>Stats</h3>
        <table>
          <tr><td>HP</td><td>${pokemon.stats.hp} / ${pokemon.stats.hpMax}</td></tr>
          <tr><td>Felicidade</td><td>${pokemon.stats.felicidade}%</td></tr>
          <tr><td>Ataque</td><td>${pokemon.stats.ataque}</td></tr>
          <tr><td>Defesa</td><td>${pokemon.stats.defesa}</td></tr>
          <tr><td>Atq. Esp</td><td>${pokemon.stats.atqEsp}</td></tr>
          <tr><td>Def. Esp</td><td>${pokemon.stats.defEsp}</td></tr>
          <tr><td>Velocidade</td><td>${pokemon.stats.velocidade}</td></tr>
        </table>
      </div>

      <div class="secao">
        <h3>EVs <span class="total-badge">${pokemon.evs.total}/510</span></h3>
        <table>
          <tr><td>HP</td><td>${pokemon.evs.hp}</td></tr>
          <tr><td>Ataque</td><td>${pokemon.evs.ataque}</td></tr>
          <tr><td>Defesa</td><td>${pokemon.evs.defesa}</td></tr>
          <tr><td>Atq. Esp</td><td>${pokemon.evs.atqEsp}</td></tr>
          <tr><td>Def. Esp</td><td>${pokemon.evs.defEsp}</td></tr>
          <tr><td>Velocidade</td><td>${pokemon.evs.velocidade}</td></tr>
        </table>
      </div>

      <div class="secao">
        <h3>IVs <span class="total-badge">${pokemon.ivs.total}/186</span></h3>
        <table>
          <tr><td>HP</td><td>${pokemon.ivs.hp}</td></tr>
          <tr><td>Ataque</td><td>${pokemon.ivs.ataque}</td></tr>
          <tr><td>Defesa</td><td>${pokemon.ivs.defesa}</td></tr>
          <tr><td>Atq. Esp</td><td>${pokemon.ivs.atqEsp}</td></tr>
          <tr><td>Def. Esp</td><td>${pokemon.ivs.defEsp}</td></tr>
          <tr><td>Velocidade</td><td>${pokemon.ivs.velocidade}</td></tr>
        </table>
      </div>

      <div class="secao">
        <h3>Movimentos</h3>
        ${pokemon.movimentos.map(m => `
          <div class="movimento">
            <span>${m.nome}</span>
            ${badgeTipo(m.tipo)}
          </div>
        `).join('')}
      </div>

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

// Renderiza todos ao carregar
renderizarCards(pokemons)