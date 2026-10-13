// Histórico de um Pokémon: compara cada save com o anterior e estima os EVs ganhos no caminho.
const sessao = lerSessao()
if (!sessao) location.replace('meus.html')

const statusEl = document.getElementById('status')
const cacheEspecies = {}

// Exemplos de Pokémon que dão cada EV (os mais comuns em Kanto: FireRed / LeafGreen)
const QUEM_DA_EV = {
  hp: ['Caterpie', 'Nidoran♀', 'Jigglypuff (2)', 'Slowpoke'],
  ataque: ['Mankey', 'Nidoran♂', 'Ekans', 'Paras', 'Machop', 'Bellsprout', 'Krabby', 'Goldeen'],
  defesa: ['Geodude', 'Sandshrew', 'Onix', 'Shellder', 'Squirtle', 'Metapod (2)', 'Kakuna (2)'],
  atqEsp: ['Gastly', 'Abra', 'Oddish', 'Psyduck', 'Magnemite', 'Bulbasaur'],
  defEsp: ['Tentacool', 'Venonat', 'Drowzee', 'Seel'],
  velocidade: ['Pidgey', 'Rattata', 'Spearow', 'Zubat', 'Diglett', 'Meowth', 'Poliwag', 'Magikarp', 'Pikachu (2)']
}

function dadosDaEspecie(nome) {
  if (!cacheEspecies[nome]) {
    cacheEspecies[nome] = fetch('/api/especies/' + encodeURIComponent(nome)).then(r => (r.ok ? r.json() : null))
  }
  return cacheEspecies[nome]
}

function dataCurta(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ---------- EVs ganhos entre dois saves ----------
// Os IVs não mudam: com o IV cadastrado, testa quais EVs fecham o stat novo.
// O que passar dos EVs que ele já tinha antes foi ganho em batalha.
function estimarEvsGanhos(antes, depois, base) {
  const resultado = {}
  ATRIBUTOS.forEach(function(a) {
    const evAntes = (antes.evs && antes.evs[a]) || 0
    const possiveis = []
    for (let ev = evAntes; ev <= 252; ev++) {
      if (calcularStats(base, { [a]: depois.ivs[a] }, { [a]: ev }, depois.natureza, depois.nivel)[a] === depois.stats[a]) possiveis.push(ev)
    }
    resultado[a] = possiveis.length
      ? { min: possiveis[0] - evAntes, max: possiveis[possiveis.length - 1] - evAntes }
      : null  // não bate: o IV cadastrado deve estar errado
  })
  return resultado
}

function htmlAnaliseEvs(ganhos) {
  const certos = ATRIBUTOS.filter(a => ganhos[a] && ganhos[a].min > 0)
  const talvez = ATRIBUTOS.filter(a => ganhos[a] && ganhos[a].min === 0 && ganhos[a].max >= 4)
  const naoBate = ATRIBUTOS.filter(a => !ganhos[a])

  const linhas = []
  if (certos.length) {
    linhas.push(`<p><strong>Ganhou EVs com certeza em:</strong> ${certos.map(a =>
      `${NOMES_ATRIBUTOS[a]} (${ganhos[a].min === ganhos[a].max ? ganhos[a].min : ganhos[a].min + ' a ' + ganhos[a].max})`).join(', ')}.</p>`)
    linhas.push(`<p class="suspeitos"><strong>Ele provavelmente derrotou:</strong></p><ul class="suspeitos">${certos.map(a =>
      `<li>${NOMES_ATRIBUTOS[a]}: ${QUEM_DA_EV[a].join(', ')}</li>`).join('')}</ul>`)
  } else {
    linhas.push('<p>Os stats mudaram só pelo nível: não dá para afirmar que ele ganhou EVs.</p>')
  }
  if (talvez.length) {
    linhas.push(`<p class="explica-pequena">Pode ter ganho um pouco (ainda não aparece nos stats) em: ${talvez.map(a => NOMES_ATRIBUTOS[a]).join(', ')}.
      Em nível baixo, até ${Math.max(...talvez.map(a => ganhos[a].max))} EVs não mudam o stat.</p>`)
  }
  if (naoBate.length) {
    linhas.push(`<p class="explica-pequena erro">A conta não fecha em ${naoBate.map(a => NOMES_ATRIBUTOS[a]).join(', ')}:
      o IV cadastrado deve estar errado. Use o 🧮 Descobrir IVs no cadastro.</p>`)
  }
  return `<div class="analise"><h4>🔎 EVs ganhos entre os dois saves</h4>${linhas.join('')}</div>`
}

// ---------- O que mudou entre dois saves ----------
function htmlMudancas(antes, depois) {
  const itens = []
  if (antes.nome !== depois.nome) itens.push(`✨ <strong>Evoluiu:</strong> ${escaparHtml(antes.nome)} → ${escaparHtml(depois.nome)}`)
  if (antes.nivel !== depois.nivel) itens.push(`⬆️ <strong>Nível:</strong> ${antes.nivel} → ${depois.nivel} (${depois.nivel > antes.nivel ? '+' : ''}${depois.nivel - antes.nivel})`)
  if (antes.natureza !== depois.natureza) itens.push(`<strong>Natureza:</strong> ${escaparHtml(antes.natureza || '—')} → ${escaparHtml(depois.natureza || '—')}`)
  if (antes.habilidade !== depois.habilidade) itens.push(`<strong>Habilidade:</strong> ${escaparHtml(antes.habilidade || '—')} → ${escaparHtml(depois.habilidade || '—')}`)

  const nomes = l => (l || []).map(m => m.nome)
  const novos = nomes(depois.movimentos).filter(n => !nomes(antes.movimentos).includes(n))
  const esquecidos = nomes(antes.movimentos).filter(n => !nomes(depois.movimentos).includes(n))
  if (novos.length || esquecidos.length) {
    itens.push(`⚔️ <strong>Ataques:</strong> ${novos.map(n => `<span class="mais">+ ${escaparHtml(n)}</span>`).join(' ')} ${esquecidos.map(n => `<span class="menos">− ${escaparHtml(n)}</span>`).join(' ')}`)
  }
  const ivsMudaram = ATRIBUTOS.filter(a => antes.ivs[a] !== depois.ivs[a])
  if (ivsMudaram.length) {
    itens.push(`<strong>IVs corrigidos:</strong> ${ivsMudaram.map(a => `${NOMES_ATRIBUTOS[a]} ${antes.ivs[a]} → ${depois.ivs[a]}`).join(', ')}`)
  }
  return itens.length ? `<ul class="mudancas">${itens.map(i => `<li>${i}</li>`).join('')}</ul>` : ''
}

function htmlTabelaStats(antes, depois) {
  return `
    <table class="tabela-historico">
      <tr><th></th>${ATRIBUTOS.map(a => `<th>${ABREVIACOES[a]}</th>`).join('')}</tr>
      <tr><td>Stats</td>${ATRIBUTOS.map(a => {
        const d = depois.stats[a] - antes.stats[a]
        return `<td><strong>${depois.stats[a]}</strong>${d ? `<small class="${d > 0 ? 'mais' : 'menos'}">${d > 0 ? '+' : ''}${d}</small>` : ''}</td>`
      }).join('')}</tr>
      <tr><td>EVs</td>${ATRIBUTOS.map(a => {
        const d = (depois.evs[a] || 0) - (antes.evs[a] || 0)
        return `<td>${depois.evs[a] || 0}${d ? `<small class="${d > 0 ? 'mais' : 'menos'}">${d > 0 ? '+' : ''}${d}</small>` : ''}</td>`
      }).join('')}</tr>
    </table>
  `
}

function cabecalho(v, titulo) {
  return `
    <div class="passo-topo">
      ${imagemPokemon(v, 'passo-imagem')}
      <div>
        <strong>${escaparHtml(v.nome)} · Nv ${v.nivel}</strong>
        <small>${titulo} · ${dataCurta(v.data)}</small>
      </div>
    </div>
  `
}

async function renderizar(pokemon) {
  // Do primeiro save até o de agora
  const versoes = [...(pokemon.historico || []), { ...pokemon, data: pokemon.atualizadoEm || pokemon.criadoEm }]
  const div = document.getElementById('historico')

  const passos = []
  for (let i = versoes.length - 1; i >= 1; i--) {
    const antes = versoes[i - 1]
    const depois = versoes[i]
    const dados = await dadosDaEspecie(depois.nome)
    passos.push(`
      <div class="passo">
        ${cabecalho(depois, i === versoes.length - 1 ? 'Agora' : 'Save ' + (i + 1))}
        ${htmlMudancas(antes, depois) || '<p class="explica-pequena">Nada mudou além dos números abaixo.</p>'}
        ${htmlTabelaStats(antes, depois)}
        ${dados && dados.base ? htmlAnaliseEvs(estimarEvsGanhos(antes, depois, baseDoPokemon(pokemon, dados))) : ''}
      </div>
    `)
  }
  const primeiro = versoes[0]
  passos.push(`
    <div class="passo primeiro">
      ${cabecalho(primeiro, versoes.length === 1 ? 'Agora (primeiro cadastro)' : 'Primeiro cadastro')}
      <table class="tabela-historico">
        <tr><th></th>${ATRIBUTOS.map(a => `<th>${ABREVIACOES[a]}</th>`).join('')}</tr>
        <tr><td>Stats</td>${ATRIBUTOS.map(a => `<td><strong>${primeiro.stats[a]}</strong></td>`).join('')}</tr>
        <tr><td>EVs</td>${ATRIBUTOS.map(a => `<td>${primeiro.evs[a] || 0}</td>`).join('')}</tr>
      </table>
    </div>
  `)

  div.innerHTML = `
    <div class="resumo-historico">
      ${imagemComEfeito(pokemon, 'historico-imagem')}
      <div>
        <h3>${escaparHtml(pokemon.nome)} ${seloPlataforma(pokemon)}</h3>
        <p>${identificacao(pokemon)}</p>
        <p>${versoes.length === 1
          ? 'Ainda não há histórico: na próxima vez que você editar e salvar, a versão de hoje fica guardada aqui.'
          : `${versoes.length} saves, de ${dataCurta(versoes[0].data)} até hoje.`}</p>
        <a class="link-editar" href="cadastro.html?editar=${encodeURIComponent(pokemon.id)}">✏️ Atualizar (subiu de nível, evoluiu, trocou ataque...)</a>
      </div>
    </div>
    ${passos.join('')}
  `
}

document.getElementById('sair').addEventListener('click', function() {
  encerrarSessao()
  location.href = 'meus.html'
})

async function iniciar() {
  if (!sessao) return
  document.getElementById('nick-logado').textContent = sessao.nick
  const id = new URLSearchParams(location.search).get('id')
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
    const pokemon = (await resposta.json()).pokemons.find(p => p.id === id)
    if (!pokemon) {
      statusEl.innerHTML = 'Pokémon não encontrado entre os seus. Volte para <a href="meus.html">Meus Pokémon</a>.'
      return
    }
    await renderizar(pokemon)
  } catch (erro) {
    statusEl.textContent = 'Não foi possível falar com o servidor. Tente recarregar a página.'
    console.error(erro)
  }
}

iniciar()
