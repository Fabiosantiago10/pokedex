// Captura: quais Pokémon do treinador servem para capturar (deixar com 1 de HP, dormir, paralisar)
// e, escolhendo o alvo, qual deles usar e com qual bola.
const sessao = lerSessao()
if (!sessao) location.replace('meus.html')

const statusEl = document.getElementById('status')
const selJogo = document.getElementById('jogo')
const campoAlvo = document.getElementById('alvo')
const cacheEspecies = {}
let meusPokemons = []
let dadosPorNome = {}

// Golpes de captura com a precisão da 5ª geração (a do PokeMMO; a PokéAPI dá a atual)
const GOLPES_HP = {
  'False Swipe': { tipo: 'Normal', efeito: 'deixa o alvo com 1 de HP, nunca derruba' },
  'Super Fang': { tipo: 'Normal', efeito: 'tira metade do HP que o alvo tem' },
  'Night Shade': { tipo: 'Ghost', efeito: 'tira HP igual ao nível do seu Pokémon (cuidado para não derrubar)' }
}
const GOLPES_SONO = {
  'Spore': { tipo: 'Grass', precisao: 100 },
  'Dark Void': { tipo: 'Dark', precisao: 80 },
  'Sleep Powder': { tipo: 'Grass', precisao: 75 },
  'Lovely Kiss': { tipo: 'Normal', precisao: 75 },
  'Hypnosis': { tipo: 'Psychic', precisao: 60 },
  'Sing': { tipo: 'Normal', precisao: 55 },
  'Grass Whistle': { tipo: 'Grass', precisao: 55 },
  'Yawn': { tipo: 'Normal', precisao: 100, atraso: true }
}
const GOLPES_PARALISIA = {
  'Thunder Wave': { tipo: 'Electric', precisao: 100 },
  'Glare': { tipo: 'Normal', precisao: 90 },
  'Stun Spore': { tipo: 'Grass', precisao: 75 }
}

// Habilidades do alvo que atrapalham a captura (todas que ele PODE ter, incluindo a escondida)
const HABILIDADES_ALVO = {
  insomnia: { bloqueia: 'sono', texto: 'não dorme' },
  vitalspirit: { bloqueia: 'sono', texto: 'não dorme' },
  limber: { bloqueia: 'paralisia', texto: 'não fica paralisado' },
  magicbounce: { bloqueia: 'status', texto: 'devolve golpes de sono e paralisia para você' },
  shedskin: { texto: 'pode se curar do sono ou da paralisia sozinho' },
  earlybird: { texto: 'acorda mais rápido' },
  static: { texto: 'pode paralisar seu Pokémon quando ele usa False Swipe (golpe de contato)' },
  flamebody: { texto: 'pode queimar seu Pokémon quando ele usa False Swipe' },
  poisonpoint: { texto: 'pode envenenar seu Pokémon quando ele usa False Swipe' },
  effectspore: { texto: 'pode adormecer ou paralisar seu Pokémon quando ele usa False Swipe' },
  roughskin: { texto: 'tira HP do seu Pokémon quando ele usa False Swipe' },
  ironbarbs: { texto: 'tira HP do seu Pokémon quando ele usa False Swipe' },
  synchronize: { texto: 'se você paralisar, seu Pokémon fica paralisado também' },
  voltabsorb: { bloqueiaGolpe: 'Electric', texto: 'absorve Thunder Wave' },
  motordrive: { bloqueiaGolpe: 'Electric', texto: 'absorve Thunder Wave' },
  lightningrod: { bloqueiaGolpe: 'Electric', texto: 'absorve Thunder Wave' },
  sapsipper: { bloqueiaGolpe: 'Grass', texto: 'absorve Spore, Sleep Powder e Stun Spore' }
}

const chave = texto => String(texto || '').toLowerCase().replace(/[^a-z]/g, '')

function dadosDaEspecie(nome) {
  if (!cacheEspecies[nome]) {
    cacheEspecies[nome] = fetch('/api/especies/' + encodeURIComponent(nome)).then(r => (r.ok ? r.json() : null)).catch(() => null)
  }
  return cacheEspecies[nome]
}

// O Pokémon já sabe o golpe, pode aprender (TM, tutor, relembrar) ou só mais tarde?
function situacaoGolpe(p, dados, nome) {
  if (p.movimentos.some(m => chave(m.nome) === chave(nome))) return { nivel: 2, texto: 'já sabe' }
  const oficial = dados && dados.ataques.find(a => a.nome === nome)
  if (!oficial) return null
  // No PokeMMO valem os golpes da 5ª geração (o Venusaur, por exemplo, só ganhou TM de False Swipe nos jogos novos)
  const metodos = selJogo.value === 'PokeMMO' && oficial.metodos5 ? oficial.metodos5 : oficial.metodos
  const porNivel = metodos.find(m => m.startsWith('Nível'))
  const nivelAprende = porNivel ? parseInt(porNivel.replace(/\D/g, ''), 10) : null
  if (metodos.includes('TM')) return { nivel: 1, texto: 'pode aprender por TM' }
  if (metodos.includes('Tutor')) return { nivel: 1, texto: 'pode aprender no tutor' }
  if (nivelAprende !== null && nivelAprende <= p.nivel) return { nivel: 1, texto: `relembra no Move Reminder (Nv ${nivelAprende})` }
  if (nivelAprende !== null) return { nivel: 0, texto: `aprende no Nv ${nivelAprende}` }
  return null  // só por ovo
}

// Melhor golpe de uma lista, preferindo o que ele já sabe e depois o mais preciso
function melhorGolpe(p, dados, tabela, permitido = () => true) {
  const olhosCompostos = chave(p.habilidade) === 'compoundeyes'
  return Object.entries(tabela)
    .filter(([nome, info]) => permitido(nome, info))
    .map(function([nome, info]) {
      const sit = situacaoGolpe(p, dados, nome)
      if (!sit) return null
      const precisao = info.precisao ? Math.min(100, Math.round(info.precisao * (olhosCompostos ? 1.3 : 1))) : 100
      return { nome, ...info, precisao, sit }
    })
    .filter(Boolean)
    .sort((a, b) => b.sit.nivel - a.sit.nivel || b.precisao - a.precisao)[0] || null
}

// Tudo o que um Pokémon do treinador oferece para capturar
function ferramentas(p, alvo) {
  const dados = dadosPorNome[p.nome]
  const tiposAlvo = alvo ? alvo.tipos : []
  const habAlvo = alvo ? alvo.habilidades.map(h => HABILIDADES_ALVO[chave(h)]).filter(Boolean) : []
  const golpeBloqueado = info => efetividade(info.tipo, tiposAlvo) === 0 || habAlvo.some(h => h.bloqueiaGolpe === info.tipo)
  const hp = melhorGolpe(p, dados, GOLPES_HP, (nome, info) => !golpeBloqueado(info))
  const sono = melhorGolpe(p, dados, GOLPES_SONO, (nome, info) => !golpeBloqueado(info))
  // Thunder Wave não pega em Terra (o tipo Elétrico não acerta)
  const paralisia = melhorGolpe(p, dados, GOLPES_PARALISIA, (nome, info) => !golpeBloqueado(info))
  const sincroniza = chave(p.habilidade) === 'synchronize'
  return { p, dados, hp, sono, paralisia, sincroniza }
}

function pontos(f, alvo) {
  const valor = g => (g ? (g.sit.nivel === 2 ? 1 : g.sit.nivel === 1 ? 0.7 : 0.25) : 0)
  let total = 0
  if (f.hp) total += valor(f.hp) * (f.hp.nome === 'False Swipe' ? 50 : 30)
  const status = Math.max(f.sono ? valor(f.sono) * f.sono.precisao * 0.4 : 0, f.paralisia ? valor(f.paralisia) * f.paralisia.precisao * 0.25 : 0)
  total += status + Math.min(f.p.nivel, 100) / 10
  if (alvo && f.dados && riscoDoAlvo(alvo, f.dados) >= 2) total -= 25
  return total
}

// Quanto o alvo bate no seu Pokémon com os golpes do próprio tipo (2 = super efetivo)
function riscoDoAlvo(alvo, dadosMeu) {
  return Math.max(...alvo.tipos.map(t => efetividade(t, dadosMeu.tipos)))
}

function textoGolpe(g) {
  if (!g) return ''
  const precisao = g.precisao < 100 ? ` (${g.precisao}%)` : ''
  return `<strong>${escaparHtml(g.nome)}</strong>${precisao} <span class="sit sit-${g.sit.nivel}">${escaparHtml(g.sit.texto)}</span>`
}

function cartaoCapturador(f, alvo, posicao) {
  const linhas = []
  if (f.hp) linhas.push(`<li>❤️ ${textoGolpe(f.hp)}: ${escaparHtml(f.hp.efeito)}</li>`)
  if (f.sono) linhas.push(`<li>💤 ${textoGolpe(f.sono)}${f.sono.atraso ? ': o alvo dorme no turno seguinte' : ''}</li>`)
  if (f.paralisia) linhas.push(`<li>⚡ ${textoGolpe(f.paralisia)}</li>`)
  if (f.sincroniza) linhas.push(`<li>🔁 <strong>Synchronize</strong>: no 1º lugar do time, o selvagem tem 20% de chance de vir com a natureza <strong>${escaparHtml(f.p.natureza || '?')}</strong></li>`)
  const avisos = []
  if (alvo && f.dados && riscoDoAlvo(alvo, f.dados) >= 2) avisos.push(`O ${alvo.nome} bate super efetivo nele: pode derrubar seu Pokémon.`)
  if (!f.hp && f.dados) avisos.push('Não tem golpe para deixar o alvo com pouco HP: use junto com outro Pokémon.')
  return `
    <div class="capturador ${posicao === 1 ? 'melhor-capturador' : ''}">
      <div class="capturador-topo">
        ${posicao ? `<span class="capturador-posicao">${posicao}º</span>` : ''}
        ${imagemPokemon(f.p, 'capturador-imagem')}
        <div>
          <strong>${escaparHtml(f.p.nome)}</strong>
          <small>${identificacao(f.p)}${f.p.habilidade ? ' · ' + escaparHtml(f.p.habilidade) : ''}</small>
        </div>
      </div>
      <ul class="capturador-golpes">${linhas.join('')}</ul>
      ${avisos.map(a => `<p class="capturador-aviso">⚠️ ${escaparHtml(a)}</p>`).join('')}
    </div>
  `
}

function bolasPara(alvo) {
  const bolas = [{ nome: 'Quick Ball', quando: 'no 1º turno, antes de qualquer golpe' }]
  if (alvo.tipos.includes('Water') || alvo.tipos.includes('Bug')) bolas.push({ nome: 'Net Ball', quando: `o ${alvo.nome} é de ${alvo.tipos.join('/')}: chance 3× maior` })
  bolas.push({ nome: 'Dusk Ball', quando: 'à noite ou dentro de caverna' })
  const jaTem = meusPokemons.some(p => plataformaDe(p) === selJogo.value && chave(p.nome) === chave(alvo.nome))
  if (jaTem) bolas.push({ nome: 'Repeat Ball', quando: `você já tem um ${alvo.nome}: chance 3× maior` })
  bolas.push({ nome: 'Timer Ball', quando: 'depois do 10º turno' })
  bolas.push({ nome: 'Ultra Ball', quando: 'nos outros casos' })
  return bolas
}

function htmlAlvo(alvo, lista) {
  const habilidades = alvo.habilidades.map(h => ({ nome: h, info: HABILIDADES_ALVO[chave(h)] })).filter(h => h.info)
  const fantasma = alvo.tipos.includes('Ghost')
  const terra = alvo.tipos.includes('Ground')
  const avaliados = lista.map(p => ferramentas(p, alvo)).filter(f => f.hp || f.sono || f.paralisia)
    .sort((a, b) => pontos(b, alvo) - pontos(a, alvo))
  const dicas = []
  if (fantasma) dicas.push('É Fantasma: <strong>False Swipe e Super Fang não acertam</strong> (são do tipo Normal). Use Night Shade com cuidado, ou golpes fracos, e capriche no sono.')
  if (terra) dicas.push('É Terra: <strong>Thunder Wave não pega</strong>. Para paralisar, use Stun Spore ou Glare.')
  habilidades.forEach(h => dicas.push(`Pode ter <strong>${escaparHtml(h.nome)}</strong>: ${escaparHtml(h.info.texto)}.`))
  const semSono = habilidades.some(h => h.info.bloqueia === 'sono')
  if (semSono) dicas.push('Se ele não dormir, paralise: a paralisia também aumenta a chance de captura (um pouco menos que o sono).')

  return `
    <div class="painel">
      <div class="painel-cabecalho"><h3>🎯 Para capturar ${escaparHtml(alvo.nome)} ${alvo.tipos.map(badgeTipo).join('')}</h3></div>
      ${dicas.length ? `<ul class="dicas-alvo">${dicas.map(d => `<li>${d}</li>`).join('')}</ul>` : '<p class="explica-pequena">Nada de especial: False Swipe + sono funciona.</p>'}
      ${avaliados.length
        ? `<p class="explica-pequena">Seus melhores Pokémon para essa captura, do melhor para o pior:</p>
           <div class="grade-capturadores">${avaliados.slice(0, 4).map((f, i) => cartaoCapturador(f, alvo, i + 1)).join('')}</div>`
        : '<p class="vazio-pequeno">Nenhum dos seus Pokémon cadastrados tem golpe de captura para esse alvo. Veja as sugestões abaixo.</p>'}
      <h4 class="titulo-bolas">Qual bola usar</h4>
      <ul class="bolas">${bolasPara(alvo).map(b => `<li><strong>${b.nome}</strong>: ${escaparHtml(b.quando)}</li>`).join('')}</ul>
    </div>
  `
}

// Espécies boas de captura, para quem ainda não tem um capturador completo
const SUGESTOES = [
  { nome: 'Parasect', texto: 'Spore (100%) + False Swipe. O mais usado. Paras no Mt. Moon e na Safari Zone; evolui no Nv 24.' },
  { nome: 'Breloom', texto: 'Spore + False Swipe, e aguenta mais que o Parasect. Shroomish evolui no Nv 23.' },
  { nome: 'Gallade', texto: 'False Swipe + Hypnosis. Kirlia macho com Dawn Stone.' },
  { nome: 'Butterfree', texto: 'Com Compound Eyes, o Sleep Powder acerta 97%. Não tem False Swipe: use junto com outro.' }
]

function renderizar(alvo) {
  const lista = meusPokemons.filter(p => plataformaDe(p) === selJogo.value)
  const avaliados = lista.map(p => ferramentas(p, null))
  const completos = avaliados.filter(f => f.hp && f.hp.nome === 'False Swipe' && (f.sono || f.paralisia))
  const uteis = avaliados.filter(f => f.hp || f.sono || f.paralisia || f.sincroniza).sort((a, b) => pontos(b) - pontos(a))
  const temCompletoAgora = completos.some(f => f.hp.sit.nivel === 2 && ((f.sono && f.sono.sit.nivel === 2) || (f.paralisia && f.paralisia.sit.nivel === 2)))

  document.getElementById('resultado').innerHTML = `
    ${alvo ? htmlAlvo(alvo, lista) : ''}
    <div class="painel">
      <div class="painel-cabecalho"><h3>Seus Pokémon que ajudam a capturar (${uteis.length} de ${lista.length})</h3></div>
      <p class="explica-pequena">
        ${temCompletoAgora
          ? '✅ Você já tem um capturador completo (False Swipe + sono ou paralisia).'
          : completos.length
            ? '🟡 Você tem Pokémon que <strong>podem</strong> virar capturador completo: ensine os golpes marcados como "pode aprender".'
            : '🔴 Nenhum dos seus Pokémon junta False Swipe com sono ou paralisia. Use dois juntos (um tira o HP, outro põe para dormir) ou pegue um dos sugeridos abaixo.'}
      </p>
      ${uteis.length
        ? `<div class="grade-capturadores">${uteis.slice(0, 12).map(f => cartaoCapturador(f, null, 0)).join('')}</div>`
        : '<p class="vazio-pequeno">Nenhum Pokémon cadastrado neste jogo aprende golpes de captura.</p>'}
      ${uteis.length > 12 ? `<p class="explica-pequena">Mostrando 12 de ${uteis.length}.</p>` : ''}
    </div>
    ${temCompletoAgora ? '' : `
    <div class="painel">
      <div class="painel-cabecalho"><h3>Bons capturadores para pegar e treinar</h3></div>
      <ul class="sugestoes">${SUGESTOES.map(s => `<li><strong>${s.nome}</strong>: ${escaparHtml(s.texto)}</li>`).join('')}</ul>
    </div>`}
  `
}

async function atualizar() {
  const lista = meusPokemons.filter(p => plataformaDe(p) === selJogo.value)
  const nomes = [...new Set(lista.map(p => p.nome))]
  const nomeAlvo = campoAlvo.value.trim()
  statusEl.textContent = 'Analisando os golpes dos seus Pokémon...'
  const [alvo] = await Promise.all([
    nomeAlvo ? dadosDaEspecie(nomeAlvo) : null,
    ...nomes.map(async n => { dadosPorNome[n] = await dadosDaEspecie(n) })
  ])
  statusEl.textContent = nomeAlvo && !alvo ? `Não achei o Pokémon "${nomeAlvo}". Confira o nome (em inglês, como no jogo).` : ''
  renderizar(alvo)
  const params = new URLSearchParams({ jogo: selJogo.value })
  if (alvo) params.set('alvo', alvo.nome)
  history.replaceState(null, '', '?' + params)
}

selJogo.addEventListener('change', atualizar)
campoAlvo.addEventListener('change', atualizar)
document.getElementById('limpar-alvo').addEventListener('click', function() {
  campoAlvo.value = ''
  atualizar()
})
document.getElementById('sair').addEventListener('click', function() {
  encerrarSessao()
  location.href = 'meus.html'
})

async function iniciar() {
  if (!sessao) return
  document.getElementById('nick-logado').textContent = sessao.nick
  fetch('/api/especies').then(r => r.json()).then(function(nomes) {
    document.getElementById('lista-especies').innerHTML = nomes.map(n => `<option value="${escaparHtml(n)}">`).join('')
  }).catch(() => {})
  try {
    const resposta = await fetch('/api/meus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick: sessao.nick, pin: sessao.pin })
    })
    if (resposta.status === 401 || resposta.status === 403) {
      encerrarSessao()
      location.replace('meus.html')
      return
    }
    if (!resposta.ok) throw new Error(resposta.status)
    meusPokemons = (await resposta.json()).pokemons
  } catch (erro) {
    statusEl.textContent = 'Não foi possível falar com o servidor. Tente recarregar a página.'
    console.error(erro)
    return
  }
  if (meusPokemons.length === 0) {
    statusEl.innerHTML = 'Cadastre seus Pokémon em <a href="cadastro.html">➕ Cadastrar Pokémon</a> para ver quais servem para capturar.'
    return
  }
  const plataformas = Object.keys(PLATAFORMAS).filter(id => meusPokemons.some(p => plataformaDe(p) === id))
  selJogo.innerHTML = plataformas.map(id => `<option value="${id}">${PLATAFORMAS[id].icone} ${PLATAFORMAS[id].curto}</option>`).join('')
  const params = new URLSearchParams(location.search)
  selJogo.value = plataformas.includes(params.get('jogo')) ? params.get('jogo') : plataformas.includes('PokeMMO') ? 'PokeMMO' : plataformas[0]
  if (params.get('alvo')) campoAlvo.value = params.get('alvo')
  atualizar()
}

iniciar()
