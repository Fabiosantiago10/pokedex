// Chamadas ao Claude: classificar a tela, ler o resumo do Pokémon, avaliar e montar time.
import Anthropic from '@anthropic-ai/sdk'
import { config } from './config.js'

let cliente = null
function api() {
  if (!cliente) cliente = new Anthropic({ apiKey: config.anthropicKey })
  return cliente
}

const statsSchema = (descricao) => ({
  type: 'object',
  description: descricao,
  properties: {
    hp: { type: ['integer', 'null'] },
    ataque: { type: ['integer', 'null'] },
    defesa: { type: ['integer', 'null'] },
    atqEsp: { type: ['integer', 'null'] },
    defEsp: { type: ['integer', 'null'] },
    velocidade: { type: ['integer', 'null'] }
  }
})

const FERRAMENTA_CLASSIFICAR = {
  name: 'classificar_tela',
  description: 'Diz que tipo de tela do PokeMMO aparece na imagem.',
  input_schema: {
    type: 'object',
    properties: {
      tela: {
        type: 'string',
        enum: ['resumo', 'captura', 'outra'],
        description: 'resumo = janela de resumo/sumário/detalhes de um Pokémon (stats, IVs, EVs, golpes ou info); captura = mensagem de que um Pokémon foi capturado; outra = qualquer outra coisa'
      },
      especie: { type: ['string', 'null'], description: 'Nome da espécie em inglês, se aparecer' }
    },
    required: ['tela', 'especie']
  }
}

const FERRAMENTA_LER = {
  name: 'registrar_pokemon',
  description: 'Registra os dados do Pokémon que estão VISÍVEIS na tela de resumo do PokeMMO.',
  input_schema: {
    type: 'object',
    properties: {
      nome: { type: ['string', 'null'], description: 'Espécie em inglês (não o apelido)' },
      apelido: { type: ['string', 'null'] },
      numero: { type: ['string', 'null'], description: 'Número da Pokédex Nacional com 3 dígitos, ex: "018"' },
      nivel: { type: ['integer', 'null'] },
      natureza: { type: ['string', 'null'], description: 'Em inglês, ex: Jolly' },
      tipo1: { type: ['string', 'null'], description: 'Em inglês, ex: Normal' },
      tipo2: { type: ['string', 'null'] },
      habilidade: { type: ['string', 'null'] },
      exp: { type: ['integer', 'null'] },
      proxNivel: { type: ['integer', 'null'] },
      stats: {
        type: 'object',
        properties: {
          hp: { type: ['integer', 'null'] },
          hpMax: { type: ['integer', 'null'] },
          felicidade: { type: ['integer', 'null'] },
          ataque: { type: ['integer', 'null'] },
          defesa: { type: ['integer', 'null'] },
          atqEsp: { type: ['integer', 'null'] },
          defEsp: { type: ['integer', 'null'] },
          velocidade: { type: ['integer', 'null'] }
        }
      },
      evs: statsSchema('EVs de cada atributo, se visíveis'),
      ivs: statsSchema('IVs de cada atributo (0 a 31), se visíveis'),
      movimentos: {
        type: ['array', 'null'],
        items: {
          type: 'object',
          properties: { nome: { type: 'string' }, tipo: { type: ['string', 'null'] } },
          required: ['nome']
        }
      }
    },
    required: ['nome']
  }
}

const FERRAMENTA_AVALIAR = {
  name: 'avaliar_pokemon',
  description: 'Avalia o Pokémon e sugere a build para o PokeMMO.',
  input_schema: {
    type: 'object',
    properties: {
      nota: { type: 'number', description: '0 a 10, considerando IVs nos atributos que importam para a função dele e a natureza' },
      resumo: { type: 'string', description: 'Uma ou duas frases curtas em português' },
      valeTreinar: { type: 'boolean' },
      naturezaIdeal: { type: 'string' },
      evsSugeridos: statsSchema('Distribuição de EVs sugerida, total até 510'),
      golpesSugeridos: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      item: { type: ['string', 'null'] },
      melhorar: { type: 'array', items: { type: 'string' }, description: 'O que melhorar (IVs fracos que importam, EVs, natureza), curto' }
    },
    required: ['nota', 'resumo', 'valeTreinar', 'naturezaIdeal', 'evsSugeridos', 'golpesSugeridos', 'melhorar']
  }
}

async function chamarFerramenta({ modelo, ferramenta, conteudo, maxTokens = 1500, sistema }) {
  const resposta = await api().messages.create({
    model: modelo,
    max_tokens: maxTokens,
    system: sistema,
    tools: [ferramenta],
    tool_choice: { type: 'tool', name: ferramenta.name },
    messages: [{ role: 'user', content: conteudo }]
  })
  const bloco = resposta.content.find(b => b.type === 'tool_use')
  if (!bloco) throw new Error('O Claude não devolveu dados')
  return bloco.input
}

const imagem = (buffer, tipo) => ({
  type: 'image',
  source: { type: 'base64', media_type: tipo, data: buffer.toString('base64') }
})

export async function classificarTela(jpeg) {
  return chamarFerramenta({
    modelo: config.modeloClassificar,
    ferramenta: FERRAMENTA_CLASSIFICAR,
    maxTokens: 200,
    conteudo: [
      imagem(jpeg, 'image/jpeg'),
      { type: 'text', text: 'Esta é a tela de um jogador de PokeMMO. Classifique a tela.' }
    ]
  })
}

export async function lerResumo(png) {
  return chamarFerramenta({
    modelo: config.modeloLer,
    ferramenta: FERRAMENTA_LER,
    sistema: 'Você lê telas do PokeMMO. Registre só o que está visível na imagem. Campos que não aparecem ficam null; nunca invente IVs, EVs ou stats. Número da Pokédex e tipos você pode completar pelo nome da espécie.',
    conteudo: [
      imagem(png, 'image/png'),
      { type: 'text', text: 'Registre os dados deste Pokémon.' }
    ]
  })
}

export async function avaliarPokemon(pokemon, comparacao) {
  return chamarFerramenta({
    modelo: config.modeloLer,
    ferramenta: FERRAMENTA_AVALIAR,
    sistema: 'Você é um treinador experiente de PokeMMO (mecânicas da Geração 5, sem Fada na tabela de tipos do jogo base, EVs até 252 por atributo e 510 no total, IVs 0-31). Responda em português do Brasil, curto e direto.',
    conteudo: [{
      type: 'text',
      text: `Pokémon recém-cadastrado:\n${JSON.stringify(pokemon, null, 2)}\n\nComparação com os da mesma espécie na base do jogador:\n${JSON.stringify(comparacao, null, 2)}\n\nAvalie e sugira a build (natureza, EVs, golpes e item).`
    }]
  })
}

export async function sugerirTime(pokemons, objetivo) {
  const resposta = await api().messages.create({
    model: config.modeloLer,
    max_tokens: 3000,
    system: 'Você é um treinador experiente de PokeMMO. Responda em português do Brasil, em Markdown, direto ao ponto.',
    messages: [{
      role: 'user',
      content: `Esta é a minha base de Pokémon:\n${JSON.stringify(pokemons.map(({ avaliacao, ...p }) => p), null, 2)}\n\nObjetivo: ${objetivo}\n\nMonte o melhor time de até 6 só com Pokémon da base. Para cada um: função, natureza, EVs, golpes e item. Depois diga o que falta no time e qual Pokémon eu deveria capturar ou treinar para cobrir.`
    }]
  })
  return resposta.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
}
