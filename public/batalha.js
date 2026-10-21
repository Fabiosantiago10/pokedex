// Simulador de batalha 1x1 entre dois Pokémon da base, com a fórmula de dano dos jogos (geração 5).
const selA = document.getElementById('lado-a')
const selB = document.getElementById('lado-b')
const statusEl = document.getElementById('status')

let todosPokemons = []
const cacheEspecies = {}   // nome -> Promise com os dados oficiais (ataques, stats base)

function dadosDaEspecie(nome) {
  if (!cacheEspecies[nome]) {
    cacheEspecies[nome] = fetch('/api/especies/' + encodeURIComponent(nome)).then(r => (r.ok ? r.json() : null))
  }
  return cacheEspecies[nome]
}

// ---------- IVs e EVs: quanto mudaria o dano ----------
function comMaximo(p, base, atributo, nivel) {
  const ivs = { ...p.ivs, [atributo]: 31 }
  const evs = { ...p.evs, [atributo]: 252 }
  return calcularStats(base, ivs, evs, p.natureza, nivel)
}

function htmlIvsEvs(p, dadosP, golpe, oponente) {
  if (!golpe || !dadosP || !dadosP.base) return ''
  const atributo = golpe.statUsado
  const nomeStat = NOMES_ATRIBUTOS[atributo]
  const maxAgora = comMaximo(p, dadosP.base, atributo, p.nivel)
  const max100 = comMaximo(p, dadosP.base, atributo, 100)
  const golpeMax = analisarGolpes({ ...p, movimentos: [{ nome: golpe.nome, tipo: golpe.tipo }] }, dadosP, oponente, maxAgora)[0]
  const mudou = golpeMax.max !== golpe.max || golpeMax.min !== golpe.min
  return `
    <div class="ivs-evs">
      <h4>${escaparHtml(p.nome)}: ${nomeStat} (usado no ${escaparHtml(golpe.nome)})</h4>
      <table class="tabela-ivs">
        <tr><td>Status base da espécie</td><td><strong>${dadosP.base[atributo]}</strong></td></tr>
        <tr><td>Agora (IV ${p.ivs[atributo]}, EV ${p.evs[atributo]}, Nv ${p.nivel})</td><td><strong>${p.stats[atributo]}</strong></td></tr>
        <tr><td>Com IV 31 + 252 EVs, no mesmo nível</td><td><strong>${maxAgora[atributo]}</strong></td></tr>
        <tr><td>Com IV 31 + 252 EVs, no Nv 100</td><td><strong>${max100[atributo]}</strong></td></tr>
      </table>
      <p>${mudou
        ? `Com IV 31 e 252 EVs em ${nomeStat}, o ${escaparHtml(golpe.nome)} passaria de <strong>${golpe.min}–${golpe.max}</strong> para <strong>${golpeMax.min}–${golpeMax.max}</strong> de dano.`
        : `No nível ${p.nivel}, nem IV 31 + 252 EVs mudariam o dano do ${escaparHtml(golpe.nome)} (continua ${golpe.min}–${golpe.max}). IVs e EVs pesam mais quanto maior o nível.`}</p>
    </div>
  `
}

// ---------- E se fosse no nível X? ----------
// Recalcula os stats no nível escolhido com os IVs, EVs e natureza de hoje.
// Se "Evoluir" estiver marcado e o nível permitir, evolui (ex: Rattata Nv 100 vira Raticate, que evolui no Nv 20).
// Evolução por pedra ou troca não acontece sozinha (não depende de nível).
let nivelBatalha = null   // null = cada um no nível de hoje

async function projetar(p, dados) {
  if (!nivelBatalha || !dados) return { p, dados }
  let atual = dados
  const caminho = []
  const evoluir = document.getElementById('evoluir').checked
  // Só evolui para frente: num nível menor que o de hoje ele continua a mesma espécie
  while (evoluir && nivelBatalha > p.nivel && atual && atual.evolucoes) {
    const proxima = atual.evolucoes.find(e => e.nivel && e.nivel <= nivelBatalha)
    if (!proxima) break
    const dadosProxima = await dadosDaEspecie(proxima.nome)
    if (!dadosProxima) break
    caminho.push(`${dadosProxima.nome} (Nv ${proxima.nivel})`)
    atual = dadosProxima
  }
  const base = baseDoPokemon(p, atual)
  return {
    dados: atual,
    p: {
      ...p,
      nome: atual.nome,
      numero: atual.numero,
      tipo1: atual.tipos[0],
      tipo2: atual.tipos[1] || null,
      nivel: nivelBatalha,
      stats: calcularStats(base, p.ivs, p.evs, p.natureza, nivelBatalha),
      projecao: { nivelHoje: p.nivel, nomeHoje: p.nome, caminho }
    }
  }
}

// ---------- Desenho ----------
function htmlLado(p, golpes, oponente, melhor) {
  return `
    <div class="lado">
      <div class="lado-topo">
        ${imagemComEfeito(p, 'batalha-imagem')}
        <div>
          <h3>${escaparHtml(p.nome)}</h3>
          <div class="tipos">${badgeTipo(p.tipo1)}${badgeTipo(p.tipo2)} ${selosVariante(p)}</div>
          <p>${identificacao(p)}</p>
          ${p.projecao ? `<p class="nota-projecao">🔮 Simulado no Nv ${p.nivel} · hoje: ${escaparHtml(p.projecao.nomeHoje)} Nv ${p.projecao.nivelHoje}${p.projecao.caminho.length ? ' · evoluiu para ' + p.projecao.caminho.map(escaparHtml).join(' → ') : ''}</p>` : ''}
        </div>
      </div>
      <div class="stats-lado">
        ${ATRIBUTOS.map(a => `<span class="stat-compacto ${marcaNatureza(p.natureza, a)}"><small>${ABREVIACOES[a]}</small><strong>${p.stats[a]}</strong></span>`).join('')}
      </div>
      <h4>Ataques contra ${escaparHtml(oponente.nome)} (${oponente.stats.hp} HP)</h4>
      ${golpes.length ? golpes.map(g => g.semDano
        ? `<div class="golpe sem-dano">${badgeTipo(g.tipo)} <strong>${escaparHtml(g.nome)}</strong> <span>— ${g.motivo}</span></div>`
        : `<div class="golpe ${g === melhor ? 'melhor' : ''}" style="--cor:${coresTipo[g.tipo] || '#9aa0a6'}">
             <div class="golpe-topo">
               <span>${badgeTipo(g.tipo)} <strong>${escaparHtml(g.nome)}</strong> ${g === melhor ? '<span class="tag-melhor">mais forte</span>' : ''}</span>
               ${textoEfetividade(g.efet)}
             </div>
             <div class="golpe-info">
               ${g.categoria} · Poder ${g.poder} · Precisão ${g.precisao}%${g.stab ? ' · <span class="tag-stab">STAB 1,5×</span>' : ''}
             </div>
             <div class="golpe-dano">
               ${g.max > 0
                 ? `<strong>${g.min}–${g.max}</strong> de dano por acerto
                    (${porcentagemHp(g.min, oponente.stats.hp)}–${porcentagemHp(g.max, oponente.stats.hp)} do HP)
                    · derruba em <strong>${Math.ceil(oponente.stats.hp / g.max)}${Math.ceil(oponente.stats.hp / g.max) !== Math.ceil(oponente.stats.hp / g.min) ? '–' + Math.ceil(oponente.stats.hp / g.min) : ''}</strong> acerto(s)`
                 : 'Não causa dano neste adversário'}
             </div>
           </div>`
      ).join('') : '<p class="vazio-pequeno">Nenhum ataque cadastrado.</p>'}
    </div>
  `
}

async function atualizar() {
  const originalA = todosPokemons.find(p => p.id === selA.value)
  const originalB = todosPokemons.find(p => p.id === selB.value)
  const resultado = document.getElementById('resultado')
  seletorA.atualizar()
  seletorB.atualizar()
  if (!originalA || !originalB) return

  // Link da batalha (para mandar a um amigo), com o nível escolhido
  const extra = nivelBatalha ? `&nv=${nivelBatalha}${document.getElementById('evoluir').checked ? '' : '&evo=0'}` : ''
  history.replaceState(null, '', `?a=${encodeURIComponent(originalA.id)}&b=${encodeURIComponent(originalB.id)}${extra}`)

  statusEl.textContent = 'Calculando...'
  const [dadosOrigA, dadosOrigB] = await Promise.all([dadosDaEspecie(originalA.nome), dadosDaEspecie(originalB.nome)])
  // A conferência do x1 entre jogos usa os dados de verdade (de hoje)
  const problemasEntreJogos = plataformaAtual !== ENTRE_JOGOS ? [] : [[originalA, dadosOrigA], [originalB, dadosOrigB]]
    .map(([p, d]) => ({ p, stats: statsQueNaoBatem(p, baseDoPokemon(p, d)) }))
    .filter(x => x.stats.length)
  const [projA, projB] = await Promise.all([projetar(originalA, dadosOrigA), projetar(originalB, dadosOrigB)])
  const a = projA.p
  const b = projB.p
  const dadosA = projA.dados
  const dadosB = projB.dados
  statusEl.textContent = ''

  // Entre jogos: só simula se os stats dos dois batem com a fórmula (senão o jogo deles tem dados diferentes)
  let avisoEntreJogos = ''
  if (plataformaAtual === ENTRE_JOGOS) {
    const problemas = problemasEntreJogos
    if (problemas.length) {
      resultado.innerHTML = `<div class="aviso-entre-jogos bloqueado">
        🚫 <strong>Esta batalha entre jogos foi bloqueada.</strong>
        ${problemas.map(x => `O ${escaparHtml(x.p.nome)} do ${nomeDoJogo(x.p)} tem stats que não batem com a fórmula
          (${x.stats.map(s => NOMES_ATRIBUTOS[s]).join(', ')}).`).join(' ')}
        Pode ser erro no cadastro ou status base diferentes naquele jogo; nos dois casos a comparação não seria justa.
      </div>`
      return
    }
    avisoEntreJogos = `<div class="aviso-entre-jogos" title="No FireRed, físico ou especial depende do tipo do ataque; no PokeMMO, de cada ataque. O ranking continua separado por jogo.">
      🔀 <strong>Entre jogos</strong> (${escaparHtml(nomeDoJogo(a))} x ${escaparHtml(nomeDoJogo(b))}) com as regras do PokeMMO. Só para diversão: no jogo o resultado pode ser outro.
    </div>`
  }

  const golpesA = analisarGolpes(a, dadosA, b)
  const golpesB = analisarGolpes(b, dadosB, a)
  const melhorA = melhorGolpe(golpesA)
  const melhorB = melhorGolpe(golpesB)
  const sim = simular(a, melhorA, b, melhorB)

  const pct = n => Math.round(n / SIMULACOES * 100)
  // Nomes de cada lado: com a mesma espécie dos dois lados, diz de qual jogo (ou qual lado) é cada um
  const mesmaEspecie = a.nome === b.nome
  const nomeLado = (p, n) => escaparHtml(p.nome) + (!mesmaEspecie ? '' : plataformaDe(a) !== plataformaDe(b) ? ' do ' + nomeDoJogo(p) : ' (Pokémon ' + n + ')')
  const nomeA = nomeLado(a, 1)
  const nomeB = nomeLado(b, 2)
  const velA = a.stats.velocidade
  const velB = b.stats.velocidade
  const primeiro = velA === velB
    ? `Mesma Velocidade (${velA}): quem ataca primeiro é sorteado a cada turno.`
    : `<strong>${velA > velB ? nomeA : nomeB}</strong> ataca primeiro (Velocidade ${Math.max(velA, velB)} contra ${Math.min(velA, velB)}).`

  let veredito
  if (!melhorA && !melhorB) veredito = 'Nenhum dos dois tem ataque que cause dano: a batalha nunca termina (empate).'
  else if (pct(sim.a) >= 60) veredito = `<strong>${nomeA}</strong> é o favorito.`
  else if (pct(sim.b) >= 60) veredito = `<strong>${nomeB}</strong> é o favorito.`
  else veredito = 'Batalha equilibrada: qualquer um pode ganhar.'

  resultado.innerHTML = `
    ${avisoEntreJogos}
    <div class="placar">
      <div class="placar-lado ${pct(sim.a) > pct(sim.b) ? 'vencedor' : ''}">
        <span class="placar-pct">${pct(sim.a)}%</span>
        <span>${nomeA} vence</span>
      </div>
      <div class="placar-meio">
        <span class="placar-empate">${pct(sim.empate)}% empate</span>
        ${melhorA || melhorB ? `<span class="placar-turnos">~${sim.turnos.toFixed(1)} turnos por batalha</span>` : ''}
      </div>
      <div class="placar-lado ${pct(sim.b) > pct(sim.a) ? 'vencedor' : ''}">
        <span class="placar-pct">${pct(sim.b)}%</span>
        <span>${nomeB} vence</span>
      </div>
    </div>
    <div class="barra-placar">
      <span style="width:${pct(sim.a)}%; background:${coresTipo[a.tipo1] || '#9aa0a6'}"></span>
      <span style="width:${pct(sim.empate)}%; background:#cfd4da"></span>
      <span style="width:${pct(sim.b)}%; background:${coresTipo[b.tipo1] || '#9aa0a6'}"></span>
    </div>
    <p class="veredito">${veredito} ${primeiro}</p>
    <button type="button" class="botao-link" id="copiar-link">🔗 Copiar link desta batalha</button>

    <div class="lados">
      ${htmlLado(a, golpesA, b, melhorA)}
      ${htmlLado(b, golpesB, a, melhorB)}
    </div>

    <div class="painel painel-ivs">
      <div class="painel-cabecalho"><h3>IVs e EVs fazem diferença?</h3></div>
      <p class="explica-ivs">
        Nenhum ataque exige um valor de IV ou EV. O dano depende do <strong>stat</strong> de quem ataca
        (Ataque para golpes físicos, Atq. Esp para especiais) e do de quem defende (Defesa ou Def. Esp).
        Esse stat vem do <strong>status base da espécie</strong>, somado aos IVs (até 31) e EVs (até 252, cada 4 EVs = 1 ponto no Nv 100),
        e tudo é multiplicado pelo <strong>nível</strong>. Por isso, em nível baixo, IVs e EVs quase não mudam o dano.
      </p>
      <div class="grade-ivs">
        ${htmlIvsEvs(a, dadosA, melhorA, b)}
        ${htmlIvsEvs(b, dadosB, melhorB, a)}
      </div>
    </div>
  `

  document.getElementById('copiar-link').addEventListener('click', async function() {
    try {
      await navigator.clipboard.writeText(location.href)
      this.textContent = '✅ Link copiado! Mande para o seu amigo'
    } catch (e) {
      this.textContent = location.href
    }
  })
}

// ---------- Escolha dos Pokémon ----------
// Linha curta embaixo do nome: nível e natureza (e o jogo, quando são de jogos diferentes)
function descricaoLado(p) {
  const jogo = plataformaAtual === ENTRE_JOGOS ? ` · ${PLATAFORMAS[plataformaDe(p)].icone} ${escaparHtml(nomeDoJogo(p))}` : ''
  return identificacao(p).replace(/<[^>]+>/g, '') + jogo
}

// Na ordem da Pokédex; da mesma espécie, o mais forte primeiro
function listaParaEscolher() {
  return [...doJogo()].sort((x, y) => (parseInt(x.numero, 10) || 9999) - (parseInt(y.numero, 10) || 9999) || y.pontuacao - x.pontuacao)
}

const seletorA = criarSeletorPokemon(selA, listaParaEscolher, descricaoLado)
const seletorB = criarSeletorPokemon(selB, listaParaEscolher, descricaoLado)

// ---------- Jogo: só batalham Pokémon do mesmo jogo ----------
// Exceção: "Entre jogos" junta PokeMMO e emuladores com jogo até a 5ª geração (#001 a #649)
const ENTRE_JOGOS = 'entre'
let plataformaAtual = plataformaSalva()
let statusX1 = { ativo: false, motivo: 'Carregando...' }

function doJogo() {
  if (plataformaAtual === ENTRE_JOGOS) return todosPokemons.filter(podeX1EntreJogos)
  return todosPokemons.filter(p => plataformaDe(p) === plataformaAtual)
}

function renderizarFiltroPlataforma() {
  document.getElementById('filtro-plataforma').innerHTML = Object.entries(PLATAFORMAS).map(([id, plat]) => {
    const total = todosPokemons.filter(p => plataformaDe(p) === id).length
    return `<button type="button" role="tab" class="chip-plataforma ${id === plataformaAtual ? 'ativo' : ''}" data-plataforma="${id}" aria-selected="${id === plataformaAtual}">
      ${plat.icone} ${plat.nome} <span>${total}</span>
    </button>`
  }).join('') + `<button type="button" role="tab" class="chip-plataforma ${plataformaAtual === ENTRE_JOGOS ? 'ativo' : ''} ${statusX1.ativo ? '' : 'desligado'}"
      data-plataforma="${ENTRE_JOGOS}" aria-selected="${plataformaAtual === ENTRE_JOGOS}" title="PokeMMO x emulador com jogo até a 5ª geração">
      🔀 Entre jogos <span>${todosPokemons.filter(podeX1EntreJogos).length}</span>
    </button>`
}

// Preenche as duas listas com os Pokémon do jogo escolhido e começa com dois diferentes
function trocarJogo(idA, idB) {
  renderizarFiltroPlataforma()
  const lista = doJogo()
  if (plataformaAtual === ENTRE_JOGOS && !statusX1.ativo) {
    selA.innerHTML = ''
    selB.innerHTML = ''
    document.getElementById('resultado').innerHTML = ''
    statusEl.textContent = '🔀 ' + statusX1.motivo
    return
  }
  if (lista.length < 2) {
    selA.innerHTML = ''
    selB.innerHTML = ''
    document.getElementById('resultado').innerHTML = ''
    statusEl.textContent = plataformaAtual === ENTRE_JOGOS
      ? 'É preciso ter pelo menos 2 Pokémon que podem lutar entre jogos (PokeMMO ou emulador com jogo até a 5ª geração, #001 a #649).'
      : `É preciso ter pelo menos 2 Pokémon do ${PLATAFORMAS[plataformaAtual].nome} na base para simular uma batalha.`
    return
  }
  statusEl.textContent = ''
  preencherSelects()
  const existe = id => lista.some(p => p.id === id)
  selA.value = existe(idA) ? idA : lista[0].id
  selB.value = existe(idB) && idB !== selA.value ? idB : (lista.find(p => p.id !== selA.value) || lista[0]).id
  atualizar()
}

document.getElementById('filtro-plataforma').addEventListener('click', function(evento) {
  const botao = evento.target.closest('[data-plataforma]')
  if (!botao) return
  plataformaAtual = botao.dataset.plataforma
  if (plataformaAtual !== ENTRE_JOGOS) salvarPlataforma(plataformaAtual)
  trocarJogo()
})

// As listas escondidas guardam a escolha; quem aparece na tela é o seletor com foto
function preencherSelects() {
  const html = listaParaEscolher().map(p => `<option value="${escaparHtml(p.id)}">${escaparHtml(p.nome)}</option>`).join('')
  selA.innerHTML = html
  selB.innerHTML = html
}

// Controles do nível da batalha
function escolherNivel(nivel) {
  nivelBatalha = nivel >= 1 && nivel <= 100 ? nivel : null
  document.querySelectorAll('.chip-nivel').forEach(c => c.classList.toggle('ativo', String(nivelBatalha || '') === c.dataset.nivel))
  const outro = document.getElementById('nivel-outro')
  outro.classList.toggle('ativo', Boolean(nivelBatalha) && nivelBatalha !== 50 && nivelBatalha !== 100)
  if (!outro.classList.contains('ativo')) outro.value = ''
  atualizar()
}

document.getElementById('chips-nivel').addEventListener('click', function(evento) {
  const chip = evento.target.closest('.chip-nivel')
  if (chip) escolherNivel(Number(chip.dataset.nivel) || null)
})
document.getElementById('nivel-outro').addEventListener('change', function() {
  escolherNivel(parseInt(this.value, 10) || null)
})
document.getElementById('evoluir').addEventListener('change', () => atualizar())

async function iniciar() {
  try {
    todosPokemons = await (await fetch('/api/pokemons')).json()
  } catch (erro) {
    statusEl.textContent = 'Não foi possível falar com o servidor. Tente recarregar a página.'
    console.error(erro)
    return
  }
  selA.addEventListener('change', atualizar)
  selB.addEventListener('change', atualizar)

  try {
    statusX1 = await (await fetch('/api/x1-entre-jogos')).json()
  } catch (erro) {
    statusX1 = { ativo: false, motivo: 'Não foi possível verificar o x1 entre jogos agora.' }
  }

  // Link de batalha (batalha.html?a=...&b=...): abre no jogo do Pokémon 1, ou "Entre jogos" se forem de jogos diferentes
  const params = new URLSearchParams(location.search)
  const pokemonA = todosPokemons.find(p => p.id === params.get('a'))
  const pokemonB = todosPokemons.find(p => p.id === params.get('b'))
  if (pokemonA) plataformaAtual = plataformaDe(pokemonA)
  if (pokemonA && pokemonB && plataformaDe(pokemonA) !== plataformaDe(pokemonB)) plataformaAtual = ENTRE_JOGOS
  // Link com nível (batalha.html?...&nv=100&evo=0)
  if (params.get('evo') === '0') document.getElementById('evoluir').checked = false
  const nivelLink = parseInt(params.get('nv'), 10)
  if (nivelLink >= 1 && nivelLink <= 100) {
    nivelBatalha = nivelLink
    document.querySelectorAll('.chip-nivel').forEach(c => c.classList.toggle('ativo', String(nivelLink) === c.dataset.nivel))
    if (nivelLink !== 50 && nivelLink !== 100) {
      document.getElementById('nivel-outro').value = nivelLink
      document.getElementById('nivel-outro').classList.add('ativo')
    }
  }
  trocarJogo(params.get('a'), params.get('b'))
}

iniciar()
