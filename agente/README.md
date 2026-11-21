# Agente Minha Pokédex

Fica rodando no PC enquanto você joga PokeMMO. Quando você captura um Pokémon e abre o resumo dele, o agente lê os dados, compara com a sua base, dá uma nota, sugere a build e salva no `pokemons.json` do site.

**Ele só assiste.** Tira fotos da tela e nada mais: não aperta teclas, não clica e não lê a memória do jogo.

## Como funciona

1. A cada 1,5 s ele tira uma foto da tela e compara com a anterior no próprio PC, sem custo.
2. Quando a tela fica parada (menus ficam parados, batalha não) e é diferente da última vista, manda uma versão pequena para o Claude Haiku perguntar: "é o resumo de um Pokémon ou a mensagem de captura?"
3. **Captura:** aparece uma notificação pedindo para você abrir o resumo.
4. **Resumo:** manda a imagem em boa qualidade para o Claude Sonnet ler espécie, natureza, habilidade, stats, IVs, EVs e golpes. Ele junta as abas (stats, IVs/EVs, golpes) do mesmo Pokémon.
5. Com os IVs lidos, compara com os outros da mesma espécie na base, pede a avaliação (nota, natureza ideal, EVs, golpes, item, o que melhorar), salva no GitHub e mostra uma notificação no Windows. O Render atualiza o site sozinho.
6. Se você abrir de novo um Pokémon que já está na base, ele só atualiza nível, EVs e golpes, sem gastar outra avaliação.

## Instalação (uma vez)

1. Instale o [Node.js 20 ou mais novo](https://nodejs.org).
2. No terminal, dentro da pasta `agente`:
   ```
   npm install
   copy .env.example .env
   ```
3. Abra o `.env` e preencha:
   - `ANTHROPIC_API_KEY`: chave em console.anthropic.com.
   - `GITHUB_TOKEN`: token *fine-grained* com acesso só ao repositório `pokedex` e permissão **Contents: Read and write**.
4. Se tiver mais de um monitor, rode `npm run telas` e coloque o id do monitor do jogo em `MONITOR`.

## Uso

| Comando | O que faz |
| --- | --- |
| `npm start` | Começa a assistir. Ctrl+C para parar |
| `npm run testar -- stats.png golpes.png` | Testa com prints salvos, sem salvar |
| `npm run testar -- stats.png golpes.png --salvar` | Testa e salva na base |
| `npm run time -- "Elite 4 de Sinnoh"` | Monta um time com builds usando só a sua base |
| `npm test` | Testes automáticos (não usam a API) |

Dica: antes de jogar, rode o `testar` com prints das abas do resumo do PokeMMO para ver se ele lê tudo certo.

## Arquivos

- `agente/dados/pokemons.json`: cópia local da base.
- `agente/dados/capturas/`: os prints que ele analisou, para conferir se algo saiu errado.
- `agente/dados/time-sugerido.md`: o último time montado.

A pasta `dados` e o `.env` não vão para o GitHub.

## Custo

Só chama a API quando a tela para num menu novo. Cada classificação com o Haiku usa uma imagem pequena (fração de centavo). Cada Pokémon lido e avaliado com o Sonnet custa alguns centavos. Para gastar menos, aumente `TELA_PARADA_MS` ou `INTERVALO_MS` no `.env`.

## Ajustes no `.env`

- `SO_LOCAL=true`: salva só no PC, sem GitHub.
- `FINALIZAR_MS`: quanto tempo sem ver o resumo até fechar o cadastro (padrão 25 s).
- `MODELO_CLASSIFICAR` / `MODELO_LER`: modelos do Claude usados.
