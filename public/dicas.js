// Dicas de batalha: quais ataques causam mais dano para um Pokémon.
// Força estimada de um ataque = poder × precisão × STAB × (stat usado ÷ maior stat de ataque)
const campoQual = document.getElementById('qual')
const statusEl = document.getElementById('status')

// Só funciona com o login de "Meus Pokémon": as dicas são para os Pokémon do próprio treinador
const sessao = lerSessao()
if (!sessao) location.replace('meus.html')

let meusPokemons = []    // Pokémon do treinador logado
let todosPokemons = []   // Pokémon da base (sem dados do treinador), para testar contra
let dadosEspecie = null  // dados oficiais da espécie escolhida (tipos, stats base, ataques)

// ---------- Cálculos ----------
function disponibilidade(ataque, nivel) {
  const porNivel = ataque.metodos.find(m => m.startsWith('Nível'))
  const nivelAprende = porNivel ? parseInt(porNivel.replace(/\D/g, ''), 10) : null
  const outros = ataque.metodos.filter(m => !m.startsWith('Nível'))
  if (nivelAprende !== null && nivelAprende <= nivel) return { agora: true, texto: `Já aprende (Nv ${nivelAprende})` }
  if (outros.length) return { agora: true, texto: outros.join(' / ') }
  return { agora: false, texto: `Só no Nv ${nivelAprende}` }
}

function analisarAtaques(dados, stats, nivel) {
  const maiorStat = Math.max(stats.ataque, stats.atqEsp, 1)
  return dados.ataques
    .filter(a => a.poder > 0 && a.categoria !== 'Status')
    .map(function(a) {
      const stab = dados.tipos.includes(a.tipo)
      const precisao = a.precisao ?? 100
      const stat = a.categoria === 'Físico' ? stats.ataque : stats.atqEsp
      const forca = a.poder * (precisao / 100) * (stab ? 1.5 : 1) * (stat / maiorStat)
      return { ...a, stab, precisao, forca, disp: disponibilidade(a, nivel) }
    })
    .sort((a, b) => b.forca - a.forca)
}

// Escolhe n ataques fortes e de tipos diferentes, para acertar bem o maior número de tipos
function escolherAtaques(candidatos, n) {
  if (candidatos.length === 0 || n <= 0) return []
  const maior = candidatos[0].forca
  const escolhidos = []
  const cobertos = new Set()
  while (escolhidos.length < n && escolhidos.length < candidatos.length) {
    let melhor = null
    let melhorValor = -Infinity
    candidatos.forEach(function(a) {
      if (escolhidos.includes(a)) return
      const novos = TIPOS.filter(t => !cobertos.has(t) && efetividade(a.tipo, [t]) >= 2).length
      const repetido = escolhidos.some(e => e.tipo === a.tipo)
      const valor = a.forca / maior + novos * 0.12 - (repetido ? 0.6 : 0)
      if (valor > melhorValor) {
        melhorValor = valor
        melhor = a
      }
    })
    escolhidos.push(melhor)
    TIPOS.forEach(t => { if (efetividade(melhor.tipo, [t]) >= 2) cobertos.add(t) })
  }
  return escolhidos
}

function sugerirQuatro(ataques) {
  return escolherAtaques(ataques.filter(a => a.disp.agora && !temCusto(a)), 4)
}

function cobertura(ataques) {
  const superEfetivo = []
  const ruins = []
  TIPOS.forEach(function(t) {
    const melhor = Math.max(...ataques.map(a => efetividade(a.tipo, [t])))
    if (melhor >= 2) superEfetivo.push(t)
    else if (melhor < 1) ruins.push(t)
  })
  return { superEfetivo, ruins }
}

// ---------- Desenho da página ----------
function detalhesAtaque(a) {
  const partes = [`Poder ${a.poder}`, `Precisão ${a.precisao}%`]
  if (a.stab) partes.push('<span class="tag-stab" title="Mesmo tipo do Pokémon: 1,5× de dano">STAB 1,5×</span>')
  return partes.join(' · ')
}

function cartaoAtaque(a, maior) {
  return `
    <div class="ataque-sugerido" style="--cor:${coresTipo[a.tipo] || '#9aa0a6'}">
      <div class="ataque-topo">
        <strong>${escaparHtml(a.nome)}</strong>
        ${badgeTipo(a.tipo)}
      </div>
      <div class="ataque-info">${a.categoria} · ${detalhesAtaque(a)}</div>
      ${barra(a.forca, maior, coresTipo[a.tipo])}
      <div class="ataque-como ${a.disp.agora ? '' : 'bloqueado'}">${escaparHtml(a.disp.texto)}</div>
    </div>
  `
}

function chipsTipos(tipos) {
  return tipos.length ? tipos.map(badgeTipo).join('') : '<span class="nenhum">nenhum</span>'
}

// Analisa os ataques que o Pokémon cadastrado já tem
function htmlAtaquesAtuais(pokemon, ataques) {
  if (!pokemon) return ''
  const linhas = pokemon.movimentos.map(function(m) {
    const oficial = dadosEspecie.ataques.find(a => a.nome.toLowerCase() === m.nome.toLowerCase())
    const analisado = ataques.find(a => a.nome.toLowerCase() === m.nome.toLowerCase())
    if (analisado) {
      const posicao = ataques.indexOf(analisado) + 1
      return `<li>${badgeTipo(m.tipo)} <strong>${escaparHtml(m.nome)}</strong> — ${posicao}º ataque mais forte de ${ataques.length}</li>`
    }
    const util = oficial && ATAQUES_STATUS[oficial.nome]
    if (util) {
      return `<li class="estrategia">${badgeTipo(m.tipo)} <strong>${escaparHtml(m.nome)}</strong> — não causa dano, mas é útil na estratégia: ${escaparHtml(util.efeito)}</li>`
    }
    const motivo = oficial && oficial.poder === null && oficial.categoria !== 'Status'
      ? 'tem poder variável, não entra no cálculo'
      : 'não causa dano e quase não ajuda numa batalha 1x1'
    return `<li class="sem-dano">${badgeTipo(m.tipo)} <strong>${escaparHtml(m.nome)}</strong> — ${motivo}</li>`
  })
  const algumDano = pokemon.movimentos.some(m => ataques.some(a => a.nome.toLowerCase() === m.nome.toLowerCase()))
  const alerta = pokemon.movimentos.length && !algumDano
    ? `<p class="alerta">⚠️ Nenhum ataque atual causa dano. Numa batalha contra outro ${escaparHtml(pokemon.nome)} igual, ninguém vence.
       Com um dos ataques sugeridos abaixo, este passa a ganhar.</p>`
    : ''
  return `
    <div class="painel">
      <div class="painel-cabecalho"><h3>Ataques atuais deste ${escaparHtml(pokemon.nome)}</h3></div>
      ${pokemon.movimentos.length ? `<ul class="lista-atuais">${linhas.join('')}</ul>` : '<p class="vazio-pequeno">Nenhum ataque cadastrado.</p>'}
      ${alerta}
    </div>
  `
}

// ---------- Builds recomendadas ----------
const IVS_PERFEITOS = { hp: 31, ataque: 31, defesa: 31, atqEsp: 31, defEsp: 31, velocidade: 31 }
const PAPEIS = {
  forcaFisica: 'Aumentam o Ataque', forcaEspecial: 'Aumentam o Atq. Esp', velocidade: 'Aumentam a Velocidade',
  cura: 'Recuperam HP', atrapalhar: 'Atrapalham o adversário', protecao: 'Proteção', clima: 'Clima'
}
const cacheEspecies = {}
let contraId = ''
let nivelSimulacao = 50
let rodadaBuilds = 0   // evita desenhar um resultado antigo se o usuário trocar de Pokémon no meio

function dadosDaEspecie(nome) {
  if (!cacheEspecies[nome]) {
    cacheEspecies[nome] = fetch('/api/especies/' + encodeURIComponent(nome)).then(r => (r.ok ? r.json() : null))
  }
  return cacheEspecies[nome]
}

function pokemonAtual() {
  return meusPokemons.find(p => p.id === campoQual.value) || null
}

// O Pokémon recalculado num nível, para comparar os dois no mesmo nível
function nivelado(p, base, nivel, mudancas = {}) {
  const evs = mudancas.evs || p.evs
  const natureza = mudancas.natureza || p.natureza
  return { ...p, nivel, stats: calcularStats(base, p.ivs, evs, natureza, nivel), movimentos: mudancas.movimentos || p.movimentos }
}

function testar(meu, dadosMeu, oponente, dadosOponente) {
  const golpesMeu = analisarGolpes(meu, dadosMeu, oponente)
  const golpesOp = analisarGolpes(oponente, dadosOponente, meu)
  const melhorMeu = melhorGolpe(golpesMeu)
  const melhorOp = melhorGolpe(golpesOp)
  const sim = simular(meu, melhorMeu, oponente, melhorOp)
  const pct = n => Math.round(n / SIMULACOES * 100)
  return { vence: pct(sim.a), perde: pct(sim.b), empate: pct(sim.empate), melhorMeu, melhorOp, meu, oponente }
}

function htmlTeste(t) {
  if (!t) return ''
  const classe = t.vence >= 60 ? 'bom' : t.perde >= 60 ? 'ruim' : 'meio'
  const golpe = (g, alvo) => g
    ? (g.min >= alvo.stats.hp
      ? `${escaparHtml(g.nome)} derruba com um acerto`
      : `${escaparHtml(g.nome)} tira ${porcentagemHp(g.min, alvo.stats.hp)}–${porcentagemHp(g.max, alvo.stats.hp)} do HP`)
    : 'nenhum ataque que cause dano'
  return `
    <div class="teste ${classe}">
      <div class="teste-placar"><strong>Vence ${t.vence}%</strong><span>empate ${t.empate}% · perde ${t.perde}%</span></div>
      <p>Seu melhor golpe: ${golpe(t.melhorMeu, t.oponente)}.</p>
      <p>Ele usa: ${golpe(t.melhorOp, t.meu)}.</p>
      <p>${t.meu.stats.velocidade > t.oponente.stats.velocidade ? 'Você ataca primeiro'
        : t.meu.stats.velocidade < t.oponente.stats.velocidade ? 'Ele ataca primeiro' : 'Mesma Velocidade (sorteio)'}
        (${t.meu.stats.velocidade} × ${t.oponente.stats.velocidade}).</p>
    </div>
  `
}

function htmlItemAtaque(a, nivel) {
  const disp = disponibilidade(a, nivel)
  const detalhe = a.categoria === 'Status'
    ? escaparHtml(a.efeito)
    : `${a.categoria} · Poder ${a.poder} · ${a.precisao ?? 100}%${dadosEspecie.tipos.includes(a.tipo) ? ' · <span class="tag-stab">STAB</span>' : ''}`
  return `
    <li class="${a.categoria === 'Status' ? 'item-status' : ''}">
      <div>${badgeTipo(a.tipo)} <strong>${escaparHtml(a.nome)}</strong></div>
      <small>${detalhe}</small>
      <small class="como ${disp.agora ? '' : 'bloqueado'}">${escaparHtml(disp.texto)}</small>
    </li>
  `
}

function htmlBuild(build, posicao, ivs, teste, destaque, nivel) {
  const stats = calcularStats(dadosEspecie.base, ivs, build.evs, build.natureza, nivelSimulacao)
  const evs = ATRIBUTOS.filter(a => build.evs[a] > 0)
  const ataques = [...build.ataques, ...build.status]
  return `
    <div class="build ${destaque ? 'destaque' : ''}">
      <div class="build-topo">
        <span class="build-posicao">${posicao + 1}ª opção${destaque ? ' · 🏆 melhor no teste' : ''}</span>
        <h4>${build.icone} ${build.titulo}</h4>
        <small>Foco: ${build.foco}</small>
      </div>
      <div class="build-bloco">
        <span class="rotulo">EVs</span>
        <div class="chips-evs">${evs.map(a => `<span class="chip-ev ${build.evs[a] >= 128 ? 'forte' : ''}">${build.evs[a]} ${NOMES_ATRIBUTOS[a]}</span>`).join('')}</div>
      </div>
      <div class="build-bloco">
        <span class="rotulo">Natureza</span>
        <strong>${build.natureza}</strong> <small>(${efeitoNatureza(build.natureza)})</small>
      </div>
      <div class="build-bloco">
        <span class="rotulo">Stats no Nv ${nivelSimulacao}</span>
        <div class="stats-build">
          ${ATRIBUTOS.map(a => `<span class="stat-compacto ${marcaNatureza(build.natureza, a)} ${build.evs[a] >= 128 ? 'investido' : ''}"><small>${ABREVIACOES[a]}</small><strong>${stats[a]}</strong></span>`).join('')}
        </div>
      </div>
      <div class="build-bloco">
        <span class="rotulo">Ataques</span>
        ${ataques.length ? `<ul class="lista-build">${ataques.map(a => htmlItemAtaque(a, nivel)).join('')}</ul>` : '<p class="vazio-pequeno">Nenhum ataque bom para esta build.</p>'}
      </div>
      <details class="por-que">
        <summary>Por que esta build?</summary>
        <ul>${build.porQue.map(t => `<li>${escaparHtml(t)}</li>`).join('')}</ul>
      </details>
      ${htmlTeste(teste)}
    </div>
  `
}

function htmlStatusUteis() {
  const lista = statusDaEspecie(dadosEspecie)
  if (!lista.length) return ''
  const grupos = {}
  lista.forEach(a => { (grupos[a.papel] = grupos[a.papel] || []).push(a) })
  return `
    <div class="painel">
      <div class="painel-cabecalho"><h3>🧪 Ataques de status úteis que o ${escaparHtml(dadosEspecie.nome)} aprende</h3></div>
      <p class="explica-builds">Não causam dano, mas mudam a batalha: deixam você mais forte ou mais rápido, curam, ou enfraquecem o adversário.</p>
      <div class="grupos-status">
        ${Object.keys(PAPEIS).filter(p => grupos[p]).map(p => `
          <div>
            <h4>${PAPEIS[p]}</h4>
            <ul>${grupos[p].map(a => `<li><strong>${escaparHtml(a.nome)}</strong> — ${escaparHtml(a.efeito)}</li>`).join('')}</ul>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function htmlPainelBuilds(pokemon) {
  const outros = todosPokemons.filter(p => !pokemon || p.id !== pokemon.id)
  const grupos = {}
  outros.forEach(p => { (grupos[p.nome] = grupos[p.nome] || []).push(p) })
  const opcoes = Object.keys(grupos).sort().map(nome => `
    <optgroup label="${escaparHtml(nome)}">
      ${grupos[nome].sort((x, y) => y.pontuacao - x.pontuacao).map(p =>
        `<option value="${escaparHtml(p.id)}" ${p.id === contraId ? 'selected' : ''}>${escaparHtml(p.nome)} · ${identificacao(p).replace(/<[^>]+>/g, '')}${meusPokemons.some(m => m.id === p.id) ? ' (seu)' : ''}</option>`).join('')}
    </optgroup>
  `).join('')
  const total = ATRIBUTOS.reduce((s, a) => s + dadosEspecie.base[a], 0)
  return `
    <div class="painel">
      <div class="painel-cabecalho"><h3>🏆 Top 3 builds para o ${escaparHtml(dadosEspecie.nome)}</h3></div>
      <p class="explica-builds">
        Como treinar este Pokémon para cada estratégia: onde colocar os EVs, qual natureza e quais ataques.
        A 1ª opção é a que mais combina com os status base da espécie.
        Escolha um adversário da base para ver qual build ganha dele.
      </p>
      ${total < 350 ? `<p class="alerta">Os status base do ${escaparHtml(dadosEspecie.nome)} são baixos (total ${total}).
        Nenhuma build faz milagre: se ele evolui, vale mais evoluir antes de investir EVs.</p>` : ''}
      <div class="controles-builds">
        <label>Testar contra (opcional)
          <select id="contra">
            <option value="">Nenhum adversário</option>
            ${opcoes}
          </select>
        </label>
        <label>Nível do teste
          <select id="nivel-sim">
            ${[50, 100].map(n => `<option value="${n}" ${n === nivelSimulacao ? 'selected' : ''}>Nv ${n} (os dois)</option>`).join('')}
          </select>
        </label>
      </div>
      <div id="builds-lista" class="grade-builds"></div>
      <div id="builds-atual"></div>
      <p class="explica">
        O teste usa a mesma conta da aba Batalha: só ataques que causam dano. Ataques de status (Agility, Will-O-Wisp, Swords Dance...)
        não entram, então builds com eles costumam ir melhor no jogo do que no teste. Habilidades e itens também não entram.
        ${pokemon ? `Os stats usam os IVs deste ${escaparHtml(pokemon.nome)}.` : 'Os stats usam IV 31 em tudo.'}
      </p>
    </div>
  `
}

async function renderizarBuilds() {
  const lista = document.getElementById('builds-lista')
  if (!lista || !dadosEspecie) return
  const rodada = ++rodadaBuilds
  const especie = dadosEspecie
  const pokemon = pokemonAtual()
  const nivel = pokemon ? pokemon.nivel : 100
  const ivs = pokemon ? pokemon.ivs : IVS_PERFEITOS
  const builds = gerarBuilds(especie, analisarAtaques(especie, especie.base, nivel), nivel)

  let testes = []
  let testeAtual = null
  const oponente = todosPokemons.find(p => p.id === contraId)
  if (oponente) {
    lista.innerHTML = '<p class="vazio-pequeno">Testando as builds...</p>'
    const dadosOp = await dadosDaEspecie(oponente.nome)
    if (rodada !== rodadaBuilds) return
    if (dadosOp && dadosOp.base) {
      const op = nivelado(oponente, dadosOp.base, nivelSimulacao)
      const molde = pokemon || { nome: especie.nome, tipo1: especie.tipos[0], tipo2: especie.tipos[1] || '', ivs, evs: {}, natureza: '', movimentos: [] }
      const base = { ...molde, nome: especie.nome, tipo1: especie.tipos[0], tipo2: especie.tipos[1] || '', ivs }
      testes = builds.map(b => testar(
        nivelado(base, especie.base, nivelSimulacao, {
          evs: b.evs, natureza: b.natureza, movimentos: [...b.ataques, ...b.status].map(a => ({ nome: a.nome, tipo: a.tipo }))
        }), especie, op, dadosOp))
      if (pokemon) testeAtual = testar(nivelado(pokemon, especie.base, nivelSimulacao), especie, op, dadosOp)
    }
  }

  // Destaca a build que mais vence, só se não der empate entre todas
  const vitorias = testes.map(t => t.vence)
  const melhor = testes.length && Math.max(...vitorias) > Math.min(...vitorias) ? Math.max(...vitorias) : null
  lista.innerHTML = builds.map((b, i) =>
    htmlBuild(b, i, ivs, testes[i], melhor !== null && testes[i].vence === melhor, nivel)).join('')

  document.getElementById('builds-atual').innerHTML = testeAtual ? `
    <div class="comparar-atual">
      <h4>E o seu ${escaparHtml(pokemon.nome)} do jeito que está hoje?</h4>
      <p class="explica-builds">Com os EVs, a natureza (${escaparHtml(pokemon.natureza)}) e os ataques cadastrados, contra o ${escaparHtml(oponente.nome)}, os dois no Nv ${nivelSimulacao}:</p>
      ${htmlTeste(testeAtual)}
    </div>
  ` : ''
}

function renderizar() {
  const resultado = document.getElementById('resultado')
  if (!dadosEspecie) {
    resultado.innerHTML = ''
    return
  }

  const pokemon = pokemonAtual()
  const stats = pokemon ? pokemon.stats : dadosEspecie.base
  const nivel = pokemon ? pokemon.nivel : 100
  const ataques = analisarAtaques(dadosEspecie, stats, nivel)
  const sugestao = sugerirQuatro(ataques)
  const maior = ataques.length ? ataques[0].forca : 1
  const { superEfetivo, ruins } = cobertura(sugestao)
  const variaveis = dadosEspecie.ataques.filter(a => a.poder === null && a.categoria !== 'Status')

  const estilo = stats.ataque === stats.atqEsp
    ? 'Equilibrado: Ataque e Atq. Esp iguais'
    : stats.ataque > stats.atqEsp
      ? `Atacante <strong>Físico</strong> (Ataque ${stats.ataque} &gt; Atq. Esp ${stats.atqEsp})`
      : `Atacante <strong>Especial</strong> (Atq. Esp ${stats.atqEsp} &gt; Ataque ${stats.ataque})`

  const pokemonParaImagem = pokemon || { numero: dadosEspecie.numero, nome: dadosEspecie.nome, tipo1: dadosEspecie.tipos[0] }

  resultado.innerHTML = `
    <div class="resumo-dicas">
      ${imagemComEfeito(pokemonParaImagem, 'dicas-imagem')}
      <div>
        <h3>${escaparHtml(dadosEspecie.nome)}</h3>
        <div class="tipos">${dadosEspecie.tipos.map(badgeTipo).join('')}</div>
        <p>${pokemon ? identificacao(pokemon) : 'Stats base da espécie'}</p>
        <p>${estilo}</p>
        <p class="explica">Ataques do tipo ${dadosEspecie.tipos.join(' e ')} ganham STAB (1,5× de dano).</p>
      </div>
    </div>

    ${htmlAtaquesAtuais(pokemon, ataques)}

    ${htmlPainelBuilds(pokemon)}

    ${htmlStatusUteis()}

    <div class="painel">
      <div class="painel-cabecalho"><h3>⭐ Sugestão de 4 ataques</h3></div>
      ${sugestao.length
        ? `<div class="grade-sugestao">${sugestao.map(a => cartaoAtaque(a, maior)).join('')}</div>
           <div class="cobertura">
             <p><strong>Super efetivo contra:</strong> ${chipsTipos(superEfetivo)}</p>
             <p><strong>Nenhum ataque acerta bem:</strong> ${chipsTipos(ruins)}</p>
           </div>`
        : '<p class="vazio-pequeno">Este Pokémon ainda não pode usar nenhum ataque que cause dano.</p>'}
    </div>

    <div class="painel">
      <div class="painel-cabecalho"><h3>Todos os ataques que causam dano (${ataques.length})</h3></div>
      <div class="tabela-rolagem">
        <table class="tabela-ataques">
          <tr><th>Ataque</th><th>Tipo</th><th>Categoria</th><th>Poder</th><th>Precisão</th><th>Como aprende</th><th>Força estimada</th></tr>
          ${ataques.map(a => `
            <tr class="${a.disp.agora ? '' : 'bloqueado'}">
              <td><strong>${escaparHtml(a.nome)}</strong>${a.stab ? ' <span class="tag-stab">STAB</span>' : ''}</td>
              <td>${badgeTipo(a.tipo)}</td>
              <td>${a.categoria}</td>
              <td>${a.poder}</td>
              <td>${a.precisao}%</td>
              <td>${escaparHtml(a.disp.texto)}</td>
              <td class="col-forca">${barra(a.forca, maior, coresTipo[a.tipo])}</td>
            </tr>
          `).join('')}
        </table>
      </div>
      ${variaveis.length
        ? `<p class="explica">Com poder variável (não entram no cálculo): ${variaveis.map(a => escaparHtml(a.nome)).join(', ')}.</p>`
        : ''}
    </div>
  `

  document.getElementById('contra').addEventListener('change', function() {
    contraId = this.value
    renderizarBuilds()
  })
  document.getElementById('nivel-sim').addEventListener('change', function() {
    nivelSimulacao = Number(this.value)
    renderizarBuilds()
  })
  renderizarBuilds()
}

// ---------- Escolha do Pokémon (só os do treinador logado) ----------
function rotuloMeu(p) {
  return `${p.nome} · ${identificacao(p).replace(/<[^>]+>/g, '')} · IVs ${soma(p.ivs)}/186`
}

function preencherMeus() {
  const grupos = {}
  meusPokemons.forEach(p => { (grupos[p.nome] = grupos[p.nome] || []).push(p) })
  campoQual.innerHTML = Object.keys(grupos).sort().map(nome => `
    <optgroup label="${escaparHtml(nome)}">
      ${grupos[nome].sort((x, y) => y.pontuacao - x.pontuacao).map(p => `<option value="${escaparHtml(p.id)}">${escaparHtml(rotuloMeu(p))}</option>`).join('')}
    </optgroup>
  `).join('')
  campoQual.disabled = false
}

async function escolherPokemon() {
  const pokemon = pokemonAtual()
  if (!pokemon) return
  history.replaceState(null, '', '?id=' + encodeURIComponent(pokemon.id))
  statusEl.textContent = `Buscando os ataques de ${pokemon.nome}...`
  const dados = await dadosDaEspecie(pokemon.nome)
  if (pokemonAtual() !== pokemon) return  // trocou de Pokémon enquanto buscava
  if (!dados) {
    statusEl.textContent = 'Não foi possível buscar os dados agora. Tente de novo.'
    return
  }
  dadosEspecie = dados
  statusEl.textContent = ''
  renderizar()
}

campoQual.addEventListener('change', escolherPokemon)

document.getElementById('sair').addEventListener('click', function() {
  encerrarSessao()
  location.href = 'meus.html'
})

async function iniciar() {
  if (!sessao) return
  document.getElementById('nick-logado').textContent = sessao.nick
  try {
    const [respMeus, respTodos] = await Promise.all([
      fetch('/api/meus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick: sessao.nick, pin: sessao.pin })
      }),
      fetch('/api/pokemons')
    ])
    if (respMeus.status === 401 || respMeus.status === 403) {
      encerrarSessao()
      location.replace('meus.html')
      return
    }
    if (!respMeus.ok || !respTodos.ok) throw new Error(respMeus.status + ' / ' + respTodos.status)
    meusPokemons = (await respMeus.json()).pokemons
    todosPokemons = await respTodos.json()
  } catch (erro) {
    statusEl.textContent = 'Não foi possível falar com o servidor. Tente recarregar a página.'
    console.error(erro)
    return
  }

  if (meusPokemons.length === 0) {
    campoQual.innerHTML = '<option value="">Você ainda não cadastrou nenhum Pokémon</option>'
    statusEl.innerHTML = 'Cadastre um Pokémon em <a href="cadastro.html">➕ Cadastrar Pokémon</a> para ver as dicas dele.'
    return
  }
  preencherMeus()

  // Vindo de "Meus Pokémon" (dicas.html?id=...): já abre com ele
  const id = new URLSearchParams(location.search).get('id')
  if (meusPokemons.some(p => p.id === id)) campoQual.value = id
  escolherPokemon()
}

iniciar()
