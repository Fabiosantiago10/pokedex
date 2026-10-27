// Página do planejador de breeding: escolhe um Pokémon e lista os melhores parceiros entre os do treinador.
const sessao = lerSessao()
if (!sessao) location.replace('meus.html')

const statusEl = document.getElementById('status')
const selEscolhido = document.getElementById('escolhido')
const selFoco = document.getElementById('foco')
const cacheEspecies = {}
let meusPokemons = []

const NOMES_FOCO = { fisico: 'atacante físico', especial: 'atacante especial', todos: 'todos os IVs iguais' }

function dadosDaEspecie(nome) {
  if (!cacheEspecies[nome]) {
    cacheEspecies[nome] = fetch('/api/especies/' + encodeURIComponent(nome)).then(r => (r.ok ? r.json() : null)).catch(() => null)
  }
  return cacheEspecies[nome]
}

// Só PokeMMO: a regra de herança é a que vimos lá (nos jogos de emulador é outra)
function doPokeMMO() {
  return meusPokemons
    .filter(p => plataformaDe(p) === 'PokeMMO')
    .sort((x, y) => (parseInt(x.numero, 10) || 9999) - (parseInt(y.numero, 10) || 9999) || soma(y.ivs) - soma(x.ivs))
}

function descricao(p) {
  return `${identificacao(p).replace(/<[^>]+>/g, '')} · IVs ${soma(p.ivs)}/186`
}

const seletor = criarSeletorPokemon(selEscolhido, doPokeMMO, descricao)

function sexo(p) {
  return SIMBOLO_SEXO[p.sexo] || ''
}

function textoItem(item, pai) {
  if (item.tipo === 'power') return `<strong>${POWER_ITEMS[item.stat]}</strong> no ${pai} (trava ${NOMES_ATRIBUTOS[item.stat]} 31)`
  if (item.tipo === 'everstone') return `<strong>Everstone</strong> no ${pai} (passa a natureza)`
  return ''
}

function htmlCasal(posicao, escolhido, parceiro, plano, filhote, foco, aviso) {
  const pesos = PESOS_FOCO[foco]
  const itens = [textoItem(plano.itemA, escolhido.nome + ' ' + sexo(escolhido)), textoItem(plano.itemB, parceiro.nome + ' ' + sexo(parceiro))].filter(Boolean)
  const melhorPai = Math.max(pontosDoPokemon(escolhido, foco), pontosDoPokemon(parceiro, foco))
  const melhoraMedia = plano.pontos - (plano.natureza ? 30 : 0) > melhorPai
  // 31 que algum dos pais tem e que o filhote pode perder
  const perde = ATRIBUTOS.filter(s => pesos[s] > 0 && (escolhido.ivs[s] === 31 || parceiro.ivs[s] === 31) && Math.min(...plano.porStat[s].valores) < 31)
  return `
    <div class="casal ${posicao === 1 ? 'melhor-casal' : ''}">
      <div class="casal-topo">
        <span class="casal-posicao">${posicao}º</span>
        <div class="casal-pais">
          ${imagemPokemon(parceiro, 'casal-imagem')}
          <div>
            <strong>com ${escaparHtml(parceiro.nome)} ${sexo(parceiro)}</strong>
            <small>${escaparHtml(descricao(parceiro))}</small>
          </div>
        </div>
        <div class="casal-filhote">
          <small>Filhote</small>
          <strong>🥚 ${escaparHtml(filhote)}</strong>
        </div>
      </div>
      <p class="casal-itens">${itens.length ? '🎒 ' + itens.join(' · ') : '🎒 Sem item: nenhum IV 31 para travar.'}
        ${plano.natureza ? ` Natureza: <strong>${escaparHtml(plano.natureza)}</strong>.` : ' Natureza: sorteada.'}</p>
      <table class="tabela-casal">
        <tr><th></th>${ATRIBUTOS.map(s => `<th class="${pesos[s] ? '' : 'nao-importa'}">${ABREVIACOES[s]}</th>`).join('')}</tr>
        <tr><td>${escaparHtml(escolhido.nome)} ${sexo(escolhido)}</td>${ATRIBUTOS.map(s => `<td class="${escolhido.ivs[s] === 31 ? 'perfeito' : ''}">${escolhido.ivs[s]}</td>`).join('')}</tr>
        <tr><td>${escaparHtml(parceiro.nome)} ${sexo(parceiro)}</td>${ATRIBUTOS.map(s => `<td class="${parceiro.ivs[s] === 31 ? 'perfeito' : ''}">${parceiro.ivs[s]}</td>`).join('')}</tr>
        <tr class="linha-filhote"><td>Filhote</td>${ATRIBUTOS.map(s => {
          const r = plano.porStat[s]
          return `<td class="${pesos[s] ? '' : 'nao-importa'}">${r.travado ? `<strong>${r.valores[0]}</strong> 🔒` : r.valores.join(' · ')}</td>`
        }).join('')}</tr>
      </table>
      <p class="casal-resumo">
        IVs do filhote: <strong>${plano.pior}</strong> no pior caso · <strong>${Math.round(plano.esperado)}</strong> em média ·
        <strong>${plano.melhor}</strong> no melhor caso (de 186).
        ${melhoraMedia ? '<span class="bom">Em média sai melhor que os dois pais.</span>' : '<span class="atencao">Em média sai pior que o melhor dos pais.</span>'}
      </p>
      ${perde.length ? `<p class="casal-aviso">⚠️ Pode perder o 31 em ${perde.map(s => NOMES_ATRIBUTOS[s]).join(', ')}.</p>` : ''}
      ${aviso ? `<p class="casal-aviso">⚠️ ${escaparHtml(aviso)}</p>` : ''}
    </div>
  `
}

async function atualizar() {
  const escolhido = meusPokemons.find(p => p.id === selEscolhido.value)
  const resultado = document.getElementById('resultado')
  seletor.atualizar()
  if (!escolhido) return
  history.replaceState(null, '', '?id=' + encodeURIComponent(escolhido.id))

  statusEl.textContent = 'Procurando parceiros...'
  const candidatos = doPokeMMO().filter(p => p.id !== escolhido.id)
  const nomes = [...new Set([escolhido, ...candidatos].map(p => p.nome))]
  const dados = Object.fromEntries(await Promise.all(nomes.map(async n => [n, await dadosDaEspecie(n)])))
  if (selEscolhido.value !== escolhido.id) return  // trocou de Pokémon enquanto buscava
  statusEl.textContent = ''

  const dadosEscolhido = dados[escolhido.nome]
  const foco = selFoco.value || focoDaEspecie(dadosEscolhido)
  const casais = candidatos
    .map(function(parceiro) {
      const cruzar = podemCruzar(escolhido, dadosEscolhido, parceiro, dados[parceiro.nome])
      if (!cruzar.ok) return null
      const plano = planejarCasal(escolhido, parceiro, foco)
      const nasce = p => (dados[p.nome] && dados[p.nome].nasceComo) || p.nome
      const quem = maeDoCasal(escolhido, dadosEscolhido, parceiro, dados[parceiro.nome])
      const opcoes = quem === 'a' ? [nasce(escolhido)] : quem === 'b' ? [nasce(parceiro)] : [...new Set([nasce(escolhido), nasce(parceiro)])]
      const filhote = opcoes.join(' ou ')
      // Mesma linha: o filhote é (ou pode ser) da espécie do escolhido
      const mesmaLinha = opcoes.includes(nasce(escolhido))
      const aviso = [cruzar.aviso, opcoes.length > 1 ? `O filhote nasce como ${opcoes.join(' ou ')}, conforme quem for a fêmea.` : ''].filter(Boolean).join(' ')
      return { parceiro, plano, filhote, aviso, mesmaLinha }
    })
    .filter(Boolean)
    .filter(c => !document.getElementById('so-mesma').checked || c.mesmaLinha)
    .sort((x, y) => y.plano.pontos - x.plano.pontos)

  const grupos = (dadosEscolhido && dadosEscolhido.gruposOvo) || []
  resultado.innerHTML = `
    <p class="resumo-breeding">
      Objetivo: <strong>${NOMES_FOCO[foco]}</strong> · Grupo de ovo: <strong>${grupos.join(', ') || '—'}</strong> ·
      ${casais.length ? `${casais.length} parceiro(s) entre os seus Pokémon` : 'nenhum parceiro entre os seus Pokémon'}
    </p>
    ${grupos.includes('no-eggs') ? '<p class="casal-aviso">Esta espécie não bota ovo.</p>' : ''}
    ${casais.length
      ? casais.slice(0, 10).map((c, i) => htmlCasal(i + 1, escolhido, c.parceiro, c.plano, c.filhote, foco, c.aviso)).join('')
      : `<p class="vazio-pequeno">Nenhum parceiro que gere um ${escaparHtml((dadosEscolhido && dadosEscolhido.nasceComo) || escolhido.nome)}.
          Cadastre mais Pokémon da mesma espécie (do sexo oposto) ou um Ditto${document.getElementById('so-mesma').checked ? ', ou desmarque "Só filhotes da mesma espécie"' : ''}.</p>`}
    ${casais.length > 10 ? `<p class="explica-pequena">Mostrando os 10 melhores de ${casais.length}.</p>` : ''}
  `
}

selEscolhido.addEventListener('change', atualizar)
selFoco.addEventListener('change', atualizar)
document.getElementById('so-mesma').addEventListener('change', atualizar)
document.getElementById('sair').addEventListener('click', function() {
  encerrarSessao()
  location.href = 'meus.html'
})

async function iniciar() {
  if (!sessao) return
  document.getElementById('nick-logado').textContent = sessao.nick
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
  const lista = doPokeMMO()
  if (lista.length === 0) {
    statusEl.innerHTML = 'Cadastre seus Pokémon do PokeMMO em <a href="cadastro.html">➕ Cadastrar Pokémon</a> para planejar o breeding.'
    return
  }
  selEscolhido.innerHTML = lista.map(p => `<option value="${escaparHtml(p.id)}">${escaparHtml(p.nome)}</option>`).join('')
  const id = new URLSearchParams(location.search).get('id')
  if (lista.some(p => p.id === id)) selEscolhido.value = id
  atualizar()
}

iniciar()
