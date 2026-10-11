// Dicas de batalha: quais ataques causam mais dano para um Pokémon.
// Força estimada de um ataque = poder × precisão × STAB × (stat usado ÷ maior stat de ataque)
const campoEspecie = document.getElementById('especie')
const campoQual = document.getElementById('qual')
const statusEl = document.getElementById('status')

let especies = []        // nomes de todas as espécies (autocompletar)
let todosPokemons = []   // Pokémon da base (sem dados do treinador)
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

// Escolhe 4 ataques fortes e de tipos diferentes, para acertar bem o maior número de tipos
function sugerirQuatro(ataques) {
  const candidatos = ataques.filter(a => a.disp.agora)
  if (candidatos.length === 0) return []
  const maior = candidatos[0].forca
  const escolhidos = []
  const cobertos = new Set()
  while (escolhidos.length < 4 && escolhidos.length < candidatos.length) {
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
    const motivo = oficial && oficial.poder === null && oficial.categoria !== 'Status'
      ? 'tem poder variável, não entra no cálculo'
      : 'não causa dano (ataque de status)'
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

function renderizar() {
  const resultado = document.getElementById('resultado')
  if (!dadosEspecie) {
    resultado.innerHTML = ''
    return
  }

  const pokemon = todosPokemons.find(p => p.id === campoQual.value) || null
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
}

// ---------- Escolha do Pokémon ----------
function preencherOpcoes(nome, idPreferido) {
  const daEspecie = todosPokemons
    .filter(p => p.nome.toLowerCase() === nome.toLowerCase())
    .sort((a, b) => b.pontuacao - a.pontuacao)
  campoQual.innerHTML = daEspecie.map((p, i) =>
    `<option value="${escaparHtml(p.id)}">${i + 1}º da base · ${identificacao(p).replace(/<[^>]+>/g, '')} · IVs ${soma(p.ivs)}/186</option>`
  ).join('') + '<option value="">Só a espécie (stats base)</option>'
  campoQual.disabled = false
  campoQual.value = idPreferido || (daEspecie[0] ? daEspecie[0].id : '')
}

let ultimaEspecie = ''

async function escolherEspecie(nome, idPreferido) {
  if (!nome || nome.toLowerCase() === ultimaEspecie) return
  ultimaEspecie = nome.toLowerCase()
  statusEl.textContent = `Buscando os ataques de ${nome}...`
  try {
    const resposta = await fetch('/api/especies/' + encodeURIComponent(nome))
    if (resposta.status === 404) {
      statusEl.textContent = `"${nome}" não é um Pokémon.`
      dadosEspecie = null
      renderizar()
      return
    }
    if (!resposta.ok) throw new Error(resposta.status)
    dadosEspecie = await resposta.json()
    campoEspecie.value = dadosEspecie.nome
    statusEl.textContent = ''
    preencherOpcoes(dadosEspecie.nome, idPreferido)
    renderizar()
  } catch (erro) {
    ultimaEspecie = ''
    statusEl.textContent = 'Não foi possível buscar os dados agora. Tente de novo.'
    console.error(erro)
  }
}

campoEspecie.addEventListener('input', function() {
  const nome = campoEspecie.value.trim().toLowerCase()
  const encontrado = especies.find(e => e.toLowerCase() === nome)
  if (encontrado) escolherEspecie(encontrado)
})
campoEspecie.addEventListener('change', () => escolherEspecie(campoEspecie.value.trim()))
campoQual.addEventListener('change', renderizar)

async function iniciar() {
  try {
    const [respEspecies, respPokemons] = await Promise.all([fetch('/api/especies'), fetch('/api/pokemons')])
    especies = await respEspecies.json()
    todosPokemons = await respPokemons.json()
    document.getElementById('lista-especies').innerHTML = especies.map(e => `<option value="${escaparHtml(e)}">`).join('')
  } catch (erro) {
    statusEl.textContent = 'Não foi possível falar com o servidor. Tente recarregar a página.'
    console.error(erro)
    return
  }

  // Vindo dos detalhes de um Pokémon (dicas.html?id=...): já abre com ele
  const id = new URLSearchParams(location.search).get('id')
  const pokemon = id && todosPokemons.find(p => p.id === id)
  if (pokemon) escolherEspecie(pokemon.nome, pokemon.id)
}

iniciar()
