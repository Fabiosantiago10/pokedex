// Builds recomendadas: EVs, natureza e ataques para cada estratégia, a partir dos status base da espécie.

// Ataques de status que valem a pena numa batalha 1x1, e o que cada um faz
const ATAQUES_STATUS = {
  // Aumentam o Ataque
  'Swords Dance': { papel: 'forcaFisica', efeito: 'Ataque +2 níveis (o Ataque dobra)' },
  'Dragon Dance': { papel: 'forcaFisica', efeito: 'Ataque e Velocidade +1 nível', velocidade: true },
  'Shift Gear':   { papel: 'forcaFisica', efeito: 'Velocidade +2 e Ataque +1 nível', velocidade: true },
  'Bulk Up':      { papel: 'forcaFisica', efeito: 'Ataque e Defesa +1 nível' },
  'Curse':        { papel: 'forcaFisica', efeito: 'Ataque e Defesa +1, Velocidade −1 nível' },
  'Coil':         { papel: 'forcaFisica', efeito: 'Ataque, Defesa e Precisão +1 nível' },
  'Hone Claws':   { papel: 'forcaFisica', efeito: 'Ataque e Precisão +1 nível' },
  'Howl':         { papel: 'forcaFisica', efeito: 'Ataque +1 nível' },
  'Meditate':     { papel: 'forcaFisica', efeito: 'Ataque +1 nível' },
  // Aumentam o Atq. Esp
  'Nasty Plot':   { papel: 'forcaEspecial', efeito: 'Atq. Esp +2 níveis (o Atq. Esp dobra)' },
  'Tail Glow':    { papel: 'forcaEspecial', efeito: 'Atq. Esp +3 níveis' },
  'Quiver Dance': { papel: 'forcaEspecial', efeito: 'Atq. Esp, Def. Esp e Velocidade +1 nível', velocidade: true },
  'Calm Mind':    { papel: 'forcaEspecial', efeito: 'Atq. Esp e Def. Esp +1 nível' },
  'Growth':       { papel: 'forcaEspecial', efeito: 'Ataque e Atq. Esp +1 nível (+2 no sol)' },
  'Work Up':      { papel: 'forcaEspecial', efeito: 'Ataque e Atq. Esp +1 nível' },
  // Só Velocidade
  'Agility':      { papel: 'velocidade', efeito: 'Velocidade +2 níveis (a Velocidade dobra)', velocidade: true },
  'Rock Polish':  { papel: 'velocidade', efeito: 'Velocidade +2 níveis (a Velocidade dobra)', velocidade: true },
  'Autotomize':   { papel: 'velocidade', efeito: 'Velocidade +2 níveis e fica mais leve', velocidade: true },
  // Recuperam HP
  'Recover':      { papel: 'cura', efeito: 'Recupera 50% do HP' },
  'Roost':        { papel: 'cura', efeito: 'Recupera 50% do HP' },
  'Slack Off':    { papel: 'cura', efeito: 'Recupera 50% do HP' },
  'Soft-Boiled':  { papel: 'cura', efeito: 'Recupera 50% do HP' },
  'Milk Drink':   { papel: 'cura', efeito: 'Recupera 50% do HP' },
  'Heal Order':   { papel: 'cura', efeito: 'Recupera 50% do HP' },
  'Synthesis':    { papel: 'cura', efeito: 'Recupera 50% do HP (mais no sol, menos na chuva)' },
  'Morning Sun':  { papel: 'cura', efeito: 'Recupera 50% do HP (mais no sol, menos na chuva)' },
  'Moonlight':    { papel: 'cura', efeito: 'Recupera 50% do HP (mais no sol, menos na chuva)' },
  'Wish':         { papel: 'cura', efeito: 'Recupera 50% do HP no turno seguinte' },
  'Leech Seed':   { papel: 'cura', efeito: 'Suga 1/8 do HP do adversário por turno e passa para você' },
  'Rest':         { papel: 'cura', efeito: 'Recupera todo o HP, mas dorme por 2 turnos' },
  'Aqua Ring':    { papel: 'cura', efeito: 'Recupera 1/16 do HP por turno' },
  'Ingrain':      { papel: 'cura', efeito: 'Recupera 1/16 do HP por turno' },
  // Atrapalham o adversário
  'Will-O-Wisp':  { papel: 'atrapalhar', efeito: 'Queima: o dano físico do adversário cai pela metade e ele perde 1/8 do HP por turno' },
  'Thunder Wave': { papel: 'atrapalhar', efeito: 'Paralisa: o adversário fica 4× mais lento e às vezes não ataca' },
  'Glare':        { papel: 'atrapalhar', efeito: 'Paralisa: o adversário fica 4× mais lento e às vezes não ataca' },
  'Stun Spore':   { papel: 'atrapalhar', efeito: 'Paralisa (75% de precisão): o adversário fica 4× mais lento' },
  'Toxic':        { papel: 'atrapalhar', efeito: 'Envenena gravemente: o dano aumenta a cada turno' },
  'Spore':        { papel: 'atrapalhar', efeito: 'Faz dormir (100% de precisão)' },
  'Sleep Powder': { papel: 'atrapalhar', efeito: 'Faz dormir (75% de precisão)' },
  'Hypnosis':     { papel: 'atrapalhar', efeito: 'Faz dormir (60% de precisão)' },
  'Yawn':         { papel: 'atrapalhar', efeito: 'O adversário dorme no fim do próximo turno' },
  'Confuse Ray':  { papel: 'atrapalhar', efeito: 'Confunde: às vezes o adversário bate em si mesmo' },
  // Proteção
  'Protect':      { papel: 'protecao', efeito: 'Bloqueia o ataque do turno (bom junto com Toxic ou Leech Seed)' },
  'Detect':       { papel: 'protecao', efeito: 'Bloqueia o ataque do turno' },
  'Substitute':   { papel: 'protecao', efeito: 'Gasta 25% do HP para criar um boneco que apanha no seu lugar' },
  'Reflect':      { papel: 'protecao', efeito: 'Dano físico recebido cai pela metade por 5 turnos' },
  'Light Screen': { papel: 'protecao', efeito: 'Dano especial recebido cai pela metade por 5 turnos' },
  // Clima
  'Sunny Day':    { papel: 'clima', efeito: 'Sol por 5 turnos: ataques de Fogo 1,5×, de Água 0,5×' },
  'Rain Dance':   { papel: 'clima', efeito: 'Chuva por 5 turnos: ataques de Água 1,5×, de Fogo 0,5×' }
}

// Ataques fortes mas com um custo alto (recarga, 2 turnos, desmaiar, perder força): ficam fora das builds
const ATAQUES_COM_CUSTO = [
  'Hyper Beam', 'Giga Impact', 'Blast Burn', 'Hydro Cannon', 'Frenzy Plant', 'Rock Wrecker', 'Roar of Time',
  'Explosion', 'Self-Destruct', 'Misty Explosion', 'Mind Blown', 'Steel Beam', 'Final Gambit', 'Memento',
  'Overheat', 'Draco Meteor', 'Leaf Storm', 'Psycho Boost', 'Fleur Cannon', 'Make It Rain',
  'Solar Beam', 'Solar Blade', 'Sky Attack', 'Skull Bash', 'Razor Wind', 'Freeze Shock', 'Ice Burn', 'Meteor Beam',
  'Focus Punch', 'Last Resort', 'Dream Eater', 'Future Sight', 'Doom Desire', 'Belch', 'Snore', 'Synchronoise',
  'Shadow Force', 'Phantom Force', 'Fly', 'Dig', 'Dive', 'Bounce', 'Sky Drop', 'Geomancy', 'Burn Up', 'Double Shock'
]

function temCusto(ataque) {
  return ATAQUES_COM_CUSTO.some(n => n.toLowerCase() === ataque.nome.toLowerCase())
}

// Ataques de status úteis que a espécie aprende
function statusDaEspecie(dados) {
  return dados.ataques
    .filter(a => ATAQUES_STATUS[a.nome])
    .map(a => ({ ...a, ...ATAQUES_STATUS[a.nome] }))
}

// Primeiro ataque da lista que a espécie aprende
function primeiroQueAprende(dados, nomes, jaEscolhidos = []) {
  for (const nome of nomes) {
    const a = dados.ataques.find(x => x.nome === nome)
    if (a && !jaEscolhidos.some(e => e.nome === nome)) return { ...a, ...ATAQUES_STATUS[nome] }
  }
  return null
}

function naturezaPara(sobe, desce) {
  return Object.keys(NATUREZAS).find(n => NATUREZAS[n][0] === sobe && NATUREZAS[n][1] === desce)
}

function evsVazios() {
  return { hp: 0, ataque: 0, defesa: 0, atqEsp: 0, defEsp: 0, velocidade: 0 }
}

// ---------- As estratégias ----------
// Cada uma diz se combina com a espécie (nota) e monta EVs, natureza e ataques.
function gerarBuilds(dados, ataquesAnalisados, nivel) {
  const b = dados.base
  const fisico = b.ataque >= b.atqEsp
  const forca = fisico ? 'ataque' : 'atqEsp'
  const fraco = fisico ? 'atqEsp' : 'ataque'
  const categoria = fisico ? 'Físico' : 'Especial'
  const defesaForte = b.defesa >= b.defEsp ? 'defesa' : 'defEsp'
  const defesaFraca = defesaForte === 'defesa' ? 'defEsp' : 'defesa'
  const N = NOMES_ATRIBUTOS
  const candidatos = ataquesAnalisados.filter(a => !temCusto(a))
  // Só ataques com pelo menos 40% da força do melhor da categoria (nada de Mud-Slap numa build)
  const daCategoria = function(cat) {
    const lista = candidatos.filter(a => cat.includes(a.categoria))
    const melhor = lista.length ? lista[0].forca : 0
    return lista.filter(a => a.forca >= melhor * 0.4)
  }
  const status = statusDaEspecie(dados)
  const builds = []

  // 1) Atacante rápido: bate forte e ataca primeiro
  {
    const rapido = b.velocidade >= 80
    const natureza = rapido ? naturezaPara('velocidade', fraco) : naturezaPara(forca, fraco)
    const evs = { ...evsVazios(), [forca]: 252, velocidade: 252, hp: 4 }
    const preferidos = fisico
      ? (b.velocidade < 90 ? ['Dragon Dance', 'Shift Gear', 'Agility', 'Rock Polish', 'Swords Dance', 'Bulk Up', 'Hone Claws', 'Howl']
                           : ['Swords Dance', 'Dragon Dance', 'Shift Gear', 'Bulk Up', 'Hone Claws', 'Howl'])
      : (b.velocidade < 90 ? ['Quiver Dance', 'Agility', 'Rock Polish', 'Tail Glow', 'Nasty Plot', 'Calm Mind', 'Growth', 'Work Up']
                           : ['Quiver Dance', 'Tail Glow', 'Nasty Plot', 'Calm Mind', 'Growth', 'Work Up'])
    const extra = primeiroQueAprende(dados, preferidos)
    const ataques = escolherAtaques(daCategoria([categoria]), extra ? 3 : 4)
    builds.push({
      icone: '⚡', titulo: 'Atacante rápido', foco: `${N[forca]} + Velocidade`,
      nota: (b[forca] + b.velocidade) / 2,
      evs, natureza, ataques, status: extra ? [extra] : [],
      porQue: [
        `${N[forca]} base ${b[forca]} e Velocidade base ${b.velocidade}: a ideia é atacar primeiro e derrubar rápido.`,
        rapido
          ? `Natureza ${natureza}: sobe a Velocidade para passar quem tem a mesma velocidade base.`
          : `Natureza ${natureza}: a Velocidade base dele é baixa para ganhar corrida, então a natureza sobe a força.`,
        `${N[fraco]} não é usado pelos ataques ${categoria === 'Físico' ? 'físicos' : 'especiais'}, por isso a natureza tira dele sem prejuízo.`,
        extra ? `${extra.nome}: ${extra.efeito}. Use no primeiro turno se o adversário não te derrubar de uma vez.` : null
      ]
    })
  }

  // 2) Tanque: aguenta muito e vence no cansaço
  {
    const natureza = naturezaPara(defesaForte, fraco)
    const evs = { ...evsVazios(), hp: 252, [defesaForte]: 252, [defesaFraca]: 4 }
    const escolhidos = []
    const cura = primeiroQueAprende(dados, ['Recover', 'Roost', 'Slack Off', 'Soft-Boiled', 'Milk Drink', 'Heal Order',
      'Synthesis', 'Morning Sun', 'Moonlight', 'Wish', 'Leech Seed', 'Rest', 'Aqua Ring', 'Ingrain'])
    if (cura) escolhidos.push(cura)
    const atrapalhar = primeiroQueAprende(dados, b[forca] < 80
      ? ['Toxic', 'Will-O-Wisp', 'Thunder Wave', 'Glare', 'Leech Seed', 'Stun Spore']
      : ['Will-O-Wisp', 'Toxic', 'Thunder Wave', 'Glare', 'Leech Seed', 'Stun Spore'], escolhidos)
    if (atrapalhar) escolhidos.push(atrapalhar)
    if (escolhidos.length < 2) {
      const protecao = primeiroQueAprende(dados, ['Protect', 'Detect', defesaForte === 'defesa' ? 'Reflect' : 'Light Screen'], escolhidos)
      if (protecao) escolhidos.push(protecao)
    }
    const ataques = escolherAtaques(daCategoria([categoria]), 4 - escolhidos.length)
    builds.push({
      icone: '🛡️', titulo: 'Tanque (sobrevivência)', foco: `HP + ${N[defesaForte]}`,
      nota: (b.hp + b[defesaForte] + b[defesaFraca] * 0.5) / 2.5 + (cura ? 6 : 0),
      evs, natureza, ataques, status: escolhidos,
      porQue: [
        `HP base ${b.hp}, Defesa ${b.defesa} e Def. Esp ${b.defEsp}. 252 EVs em HP e 252 em ${N[defesaForte]}, a defesa que já é mais forte.`,
        'Melhor que colocar tudo só em HP: cada stat aceita no máximo 252 EVs, e o dano recebido depende do HP e da defesa juntos.',
        `Natureza ${natureza}: sobe ${N[defesaForte]} e tira de ${N[fraco]}, que ele não usa.`,
        cura ? `${cura.nome}: ${cura.efeito}. É o que faz o tanque durar.` : 'Ele não aprende nenhum ataque de cura, então esta build rende menos.',
        atrapalhar ? `${atrapalhar.nome}: ${atrapalhar.efeito}.` : null
      ]
    })
  }

  // 3) Força bruta: lento, mas aguenta um golpe e bate forte
  {
    const natureza = naturezaPara(forca, fraco)
    const evs = { ...evsVazios(), hp: 252, [forca]: 252, [defesaForte]: 4 }
    const extra = primeiroQueAprende(dados, fisico
      ? ['Swords Dance', 'Bulk Up', 'Curse', 'Dragon Dance', 'Coil', 'Howl']
      : ['Calm Mind', 'Nasty Plot', 'Quiver Dance', 'Tail Glow', 'Growth', 'Work Up'])
    const ataques = escolherAtaques(daCategoria([categoria]), extra ? 3 : 4)
    builds.push({
      icone: '💪', titulo: 'Força bruta (lento e resistente)', foco: `HP + ${N[forca]}`,
      nota: (b.hp * 0.8 + b[forca] + (b.defesa + b.defEsp) * 0.2 + (100 - b.velocidade) * 0.3) / 2.2,
      evs, natureza, ataques, status: extra ? [extra] : [],
      porQue: [
        b.velocidade < 80
          ? `Velocidade base ${b.velocidade} é baixa: mesmo com EVs ele não passa os rápidos. Melhor usar esses EVs em HP para aguentar um golpe a mais.`
          : `Troca a Velocidade por HP: ataca depois, mas aguenta mais e devolve com força.`,
        `252 EVs em ${N[forca]} (base ${b[forca]}) e natureza ${natureza} para bater o mais forte possível.`,
        extra ? `${extra.nome}: ${extra.efeito}. Como ele aguenta, dá tempo de usar.` : null
      ]
    })
  }

  // 4) Misto: Ataque e Atq. Esp parecidos, usa os dois
  if (Math.min(b.ataque, b.atqEsp) >= 80 && Math.min(b.ataque, b.atqEsp) >= Math.max(b.ataque, b.atqEsp) * 0.85) {
    const natureza = naturezaPara('velocidade', defesaFraca)
    const evs = { ...evsVazios(), ataque: 128, atqEsp: 128, velocidade: 252 }
    const ataques = [...escolherAtaques(daCategoria(['Físico']), 2), ...escolherAtaques(daCategoria(['Especial']), 2)]
    builds.push({
      icone: '⚔️', titulo: 'Misto (físico + especial)', foco: 'Ataque + Atq. Esp + Velocidade',
      nota: (b.ataque + b.atqEsp + b.velocidade) / 3,
      evs, natureza, ataques, status: [],
      porQue: [
        `Ataque ${b.ataque} e Atq. Esp ${b.atqEsp} são parecidos: com ataques dos dois tipos, o adversário não consegue se proteger dos dois.`,
        `Natureza ${natureza}: sobe a Velocidade e tira de ${N[defesaFraca]}, a defesa que já é mais fraca.`,
        'Dividir os EVs deixa cada ataque um pouco mais fraco do que numa build focada.'
      ]
    })
  }

  // 5) Suporte rápido: fraco no ataque, mas atrapalha o adversário primeiro
  const atrapalha = status.filter(s => s.papel === 'atrapalhar' || s.papel === 'protecao' || s.papel === 'cura')
  if (atrapalha.length >= 2 && b.velocidade >= 70) {
    const natureza = naturezaPara('velocidade', fraco)
    const evs = { ...evsVazios(), hp: 252, velocidade: 252, [defesaForte]: 4 }
    const escolhidos = []
    const paralisa = primeiroQueAprende(dados, ['Thunder Wave', 'Glare', 'Spore', 'Sleep Powder', 'Stun Spore', 'Will-O-Wisp', 'Toxic', 'Hypnosis', 'Yawn'])
    if (paralisa) escolhidos.push(paralisa)
    const segundo = primeiroQueAprende(dados, ['Toxic', 'Will-O-Wisp', 'Leech Seed', 'Confuse Ray'], escolhidos)
    if (segundo) escolhidos.push(segundo)
    const terceiro = primeiroQueAprende(dados, ['Recover', 'Roost', 'Wish', 'Substitute', 'Protect', 'Reflect', 'Light Screen'], escolhidos)
    if (terceiro) escolhidos.push(terceiro)
    const ataques = escolherAtaques(daCategoria([categoria]), 4 - escolhidos.length)
    builds.push({
      icone: '🌀', titulo: 'Suporte rápido', foco: 'HP + Velocidade',
      nota: (b.velocidade + (b.hp + b.defesa + b.defEsp) / 3) / 2 - Math.max(b.ataque, b.atqEsp) * 0.15 + atrapalha.length,
      evs, natureza, ataques, status: escolhidos,
      porQue: [
        `Velocidade base ${b.velocidade}: age antes e atrapalha o adversário logo no primeiro turno.`,
        paralisa ? `${paralisa.nome}: ${paralisa.efeito}.` : null,
        'O dano vem dos ataques de status (veneno, queimadura) e não da força dele, por isso os EVs vão para HP e Velocidade.'
      ]
    })
  }

  return builds
    .map(build => ({ ...build, porQue: build.porQue.filter(Boolean) }))
    .sort((x, y) => y.nota - x.nota)
    .slice(0, 3)
}
