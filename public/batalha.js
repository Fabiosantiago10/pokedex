// Simulador de batalha 1x1 entre dois Pokémon da base, com a fórmula de dano dos jogos (geração 5).
const selA = document.getElementById('lado-a')
const selB = document.getElementById('lado-b')
const statusEl = document.getElementById('status')

let todosPokemons = []
const cacheEspecies = {}   // nome -> Promise com os dados oficiais (ataques, stats base)
const SIMULACOES = 3000

function dadosDaEspecie(nome) {
  if (!cacheEspecies[nome]) {
    cacheEspecies[nome] = fetch('/api/especies/' + encodeURIComponent(nome)).then(r => (r.ok ? r.json() : null))
  }
  return cacheEspecies[nome]
}

function tiposDe(p) {
  return [p.tipo1, p.tipo2].filter(Boolean)
}

// ---------- Fórmula de dano ----------
function danoBase(nivel, poder, ataque, defesa) {
  return Math.floor(Math.floor(Math.floor(2 * nivel / 5 + 2) * poder * ataque / Math.max(defesa, 1)) / 50) + 2
}

// Mesma ordem do jogo: crítico, variação (85–100%), STAB, efetividade
function aplicarModificadores(base, critico, variacao, stab, efet) {
  if (efet === 0) return 0
  let dano = base
  if (critico) dano *= 2
  dano = Math.floor(dano * variacao / 100)
  if (stab) dano = Math.floor(dano * 1.5)
  dano = Math.floor(dano * efet)
  return Math.max(dano, 1)
}

function textoEfetividade(efet) {
  if (efet === 0) return '<span class="efet nulo">Não afeta</span>'
  if (efet >= 2) return `<span class="efet super">Super efetivo ${efet}×</span>`
  if (efet < 1) return `<span class="efet pouco">Pouco efetivo ${efet}×</span>`
  return '<span class="efet normal">Normal</span>'
}

// Dano de cada ataque cadastrado do atacante contra o defensor
function analisarGolpes(atacante, dadosAtacante, defensor, statsAtacante = atacante.stats) {
  return atacante.movimentos.map(function(m) {
    const oficial = dadosAtacante && dadosAtacante.ataques.find(a => a.nome.toLowerCase() === m.nome.toLowerCase())
    if (!oficial || !(oficial.poder > 0) || oficial.categoria === 'Status') {
      const variavel = oficial && oficial.poder === null && oficial.categoria !== 'Status'
      return { nome: m.nome, tipo: m.tipo, semDano: true, motivo: variavel ? 'poder variável (não simulado)' : 'não causa dano' }
    }
    const fisico = oficial.categoria === 'Físico'
    const ataque = fisico ? statsAtacante.ataque : statsAtacante.atqEsp
    const defesa = fisico ? defensor.stats.defesa : defensor.stats.defEsp
    const stab = tiposDe(atacante).includes(oficial.tipo)
    const efet = efetividade(oficial.tipo, tiposDe(defensor))
    const base = danoBase(atacante.nivel, oficial.poder, ataque, defesa)
    const min = aplicarModificadores(base, false, 85, stab, efet)
    const max = aplicarModificadores(base, false, 100, stab, efet)
    const precisao = oficial.precisao ?? 100
    return {
      nome: oficial.nome, tipo: oficial.tipo, categoria: oficial.categoria, poder: oficial.poder,
      precisao, stab, efet, base, min, max, statUsado: fisico ? 'ataque' : 'atqEsp',
      media: (min + max) / 2 * precisao / 100
    }
  })
}

function melhorGolpe(golpes) {
  return golpes.filter(g => !g.semDano && g.max > 0).sort((a, b) => b.media - a.media)[0] || null
}

// ---------- Simulação de várias batalhas ----------
function rolarDano(golpe) {
  if (!golpe) return 0
  if (Math.random() * 100 >= golpe.precisao) return 0  // errou
  const critico = Math.random() < 1 / 16
  const variacao = 85 + Math.floor(Math.random() * 16)
  return aplicarModificadores(golpe.base, critico, variacao, golpe.stab, golpe.efet)
}

function simular(a, golpeA, b, golpeB) {
  const resultado = { a: 0, b: 0, empate: 0, turnos: 0 }
  if (!golpeA && !golpeB) {
    resultado.empate = SIMULACOES
    return resultado
  }
  for (let i = 0; i < SIMULACOES; i++) {
    let hpA = a.stats.hp
    let hpB = b.stats.hp
    let turno = 0
    let vencedor = null
    while (!vencedor && turno < 100) {
      turno++
      const aPrimeiro = a.stats.velocidade > b.stats.velocidade ||
        (a.stats.velocidade === b.stats.velocidade && Math.random() < 0.5)
      const ordem = aPrimeiro ? ['a', 'b'] : ['b', 'a']
      for (const lado of ordem) {
        if (lado === 'a') {
          hpB -= rolarDano(golpeA)
          if (hpB <= 0) { vencedor = 'a'; break }
        } else {
          hpA -= rolarDano(golpeB)
          if (hpA <= 0) { vencedor = 'b'; break }
        }
      }
    }
    resultado[vencedor || 'empate']++
    resultado.turnos += turno
  }
  resultado.turnos = resultado.turnos / SIMULACOES
  return resultado
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

// ---------- Desenho ----------
// Ex: 30% ou "100%+" quando o golpe tira mais que o HP inteiro
function porcentagemHp(dano, hp) {
  return dano >= hp ? '100%+' : Math.round(dano / hp * 100) + '%'
}

function htmlLado(p, golpes, oponente, melhor) {
  return `
    <div class="lado">
      <div class="lado-topo">
        ${imagemComEfeito(p, 'batalha-imagem')}
        <div>
          <h3>${escaparHtml(p.nome)}</h3>
          <div class="tipos">${badgeTipo(p.tipo1)}${badgeTipo(p.tipo2)} ${selosVariante(p)}</div>
          <p>${identificacao(p)}</p>
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
  const a = todosPokemons.find(p => p.id === selA.value)
  const b = todosPokemons.find(p => p.id === selB.value)
  const resultado = document.getElementById('resultado')
  if (!a || !b) return

  // Link da batalha (para mandar a um amigo)
  history.replaceState(null, '', `?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`)

  statusEl.textContent = 'Calculando...'
  const [dadosA, dadosB] = await Promise.all([dadosDaEspecie(a.nome), dadosDaEspecie(b.nome)])
  statusEl.textContent = ''

  const golpesA = analisarGolpes(a, dadosA, b)
  const golpesB = analisarGolpes(b, dadosB, a)
  const melhorA = melhorGolpe(golpesA)
  const melhorB = melhorGolpe(golpesB)
  const sim = simular(a, melhorA, b, melhorB)

  const pct = n => Math.round(n / SIMULACOES * 100)
  const velA = a.stats.velocidade
  const velB = b.stats.velocidade
  const primeiro = velA === velB
    ? `Mesma Velocidade (${velA}): quem ataca primeiro é sorteado a cada turno.`
    : `<strong>${escaparHtml(velA > velB ? a.nome : b.nome)}</strong> ataca primeiro (Velocidade ${Math.max(velA, velB)} contra ${Math.min(velA, velB)}).`

  let veredito
  if (!melhorA && !melhorB) veredito = 'Nenhum dos dois tem ataque que cause dano: a batalha nunca termina (empate).'
  else if (pct(sim.a) >= 60) veredito = `<strong>${escaparHtml(a.nome)}</strong> (Pokémon 1) é o favorito.`
  else if (pct(sim.b) >= 60) veredito = `<strong>${escaparHtml(b.nome)}</strong> (Pokémon 2) é o favorito.`
  else veredito = 'Batalha equilibrada: qualquer um pode ganhar.'

  resultado.innerHTML = `
    <div class="placar">
      <div class="placar-lado ${pct(sim.a) > pct(sim.b) ? 'vencedor' : ''}">
        <span class="placar-pct">${pct(sim.a)}%</span>
        <span>${escaparHtml(a.nome)} vence</span>
      </div>
      <div class="placar-meio">
        <span class="placar-empate">${pct(sim.empate)}% empate</span>
        ${melhorA || melhorB ? `<span class="placar-turnos">~${sim.turnos.toFixed(1)} turnos por batalha</span>` : ''}
      </div>
      <div class="placar-lado ${pct(sim.b) > pct(sim.a) ? 'vencedor' : ''}">
        <span class="placar-pct">${pct(sim.b)}%</span>
        <span>${escaparHtml(b.nome)} vence</span>
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
function rotulo(p) {
  return `${p.nome} · ${identificacao(p).replace(/<[^>]+>/g, '')} · IVs ${soma(p.ivs)}/186`
}

function preencherSelects() {
  // Agrupado por espécie, em ordem alfabética
  const grupos = {}
  todosPokemons.forEach(p => { (grupos[p.nome] = grupos[p.nome] || []).push(p) })
  const html = Object.keys(grupos).sort().map(nome => `
    <optgroup label="${escaparHtml(nome)}">
      ${grupos[nome].sort((x, y) => y.pontuacao - x.pontuacao).map(p => `<option value="${escaparHtml(p.id)}">${escaparHtml(rotulo(p))}</option>`).join('')}
    </optgroup>
  `).join('')
  selA.innerHTML = html
  selB.innerHTML = html
}

async function iniciar() {
  try {
    todosPokemons = await (await fetch('/api/pokemons')).json()
  } catch (erro) {
    statusEl.textContent = 'Não foi possível falar com o servidor. Tente recarregar a página.'
    console.error(erro)
    return
  }
  if (todosPokemons.length < 2) {
    statusEl.textContent = 'É preciso ter pelo menos 2 Pokémon na base para simular uma batalha.'
    return
  }
  preencherSelects()

  // Link de batalha (batalha.html?a=...&b=...) ou dois Pokémon diferentes para começar
  const params = new URLSearchParams(location.search)
  const existe = id => todosPokemons.some(p => p.id === id)
  selA.value = existe(params.get('a')) ? params.get('a') : todosPokemons[0].id
  selB.value = existe(params.get('b')) ? params.get('b') : (todosPokemons.find(p => p.id !== selA.value) || todosPokemons[0]).id

  selA.addEventListener('change', atualizar)
  selB.addEventListener('change', atualizar)
  atualizar()
}

iniciar()
