// Seletor de Pokémon com foto e busca, no lugar da lista do navegador (que fica escondida e guarda o valor).
//   select: o <select> original (continua sendo a fonte do valor e dispara "change")
//   obterLista(): os Pokémon que podem ser escolhidos, já na ordem
//   descricao(p): a linha pequena embaixo do nome (ex: "Nv 100 · Bold")
function criarSeletorPokemon(select, obterLista, descricao) {
  const caixa = document.createElement('div')
  caixa.className = 'seletor'
  caixa.innerHTML = `
    <button type="button" class="seletor-botao" aria-haspopup="listbox" aria-expanded="false"></button>
    <div class="seletor-painel" hidden>
      <input type="search" class="seletor-busca" placeholder="Buscar pelo nome..." autocomplete="off" aria-label="Buscar Pokémon">
      <div class="seletor-lista" role="listbox"></div>
    </div>
  `
  select.hidden = true
  select.after(caixa)
  const botao = caixa.querySelector('.seletor-botao')
  const painel = caixa.querySelector('.seletor-painel')
  const busca = caixa.querySelector('.seletor-busca')
  const lista = caixa.querySelector('.seletor-lista')

  function conteudo(p) {
    return `
      ${imagemPokemon(p, 'seletor-imagem')}
      <span class="seletor-texto">
        <strong>${escaparHtml(p.nome)}</strong>
        <small>${descricao(p)}</small>
      </span>
    `
  }

  function desenharBotao() {
    const p = obterLista().find(x => x.id === select.value)
    botao.innerHTML = (p ? conteudo(p) : '<span class="seletor-texto"><strong>Escolha um Pokémon</strong></span>') +
      '<span class="seletor-seta" aria-hidden="true">▾</span>'
  }

  function desenharLista() {
    const texto = busca.value.trim().toLowerCase()
    const itens = obterLista().filter(p => p.nome.toLowerCase().includes(texto))
    lista.innerHTML = itens.length
      ? itens.map(p => `<button type="button" role="option" class="seletor-item ${p.id === select.value ? 'atual' : ''}"
          data-id="${escaparHtml(p.id)}" aria-selected="${p.id === select.value}">${conteudo(p)}</button>`).join('')
      : '<p class="seletor-vazio">Nenhum Pokémon com esse nome.</p>'
  }

  function abrir(aberto) {
    painel.hidden = !aberto
    botao.setAttribute('aria-expanded', String(aberto))
    caixa.classList.toggle('aberto', aberto)
    if (aberto) {
      busca.value = ''
      desenharLista()
      busca.focus()
      const atual = lista.querySelector('.atual')
      if (atual) atual.scrollIntoView({ block: 'nearest' })
    }
  }

  botao.addEventListener('click', () => abrir(painel.hidden))
  busca.addEventListener('input', desenharLista)
  lista.addEventListener('click', function(evento) {
    const item = evento.target.closest('[data-id]')
    if (!item) return
    select.value = item.dataset.id
    abrir(false)
    desenharBotao()
    select.dispatchEvent(new Event('change'))
    botao.focus()
  })
  // Fecha ao clicar fora ou com Esc; Enter na busca escolhe o primeiro da lista
  document.addEventListener('click', evento => { if (!caixa.contains(evento.target)) abrir(false) })
  caixa.addEventListener('keydown', function(evento) {
    if (evento.key === 'Escape' && !painel.hidden) {
      abrir(false)
      botao.focus()
    }
    if (evento.key === 'Enter' && evento.target === busca) {
      evento.preventDefault()
      const primeiro = lista.querySelector('[data-id]')
      if (primeiro) primeiro.click()
    }
  })

  return { atualizar: desenharBotao }
}
