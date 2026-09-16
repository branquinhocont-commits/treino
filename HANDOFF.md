# HANDOFF — App de treino para celular (projeto pessoal, Guilherme)

> Escrito para quem pegar o projeto depois: você mesmo daqui a três meses, ou um agente.
> **Última revisão: 15/09/2026.** Antes desta data o documento afirmava coisas que o código
> não fazia — os validadores da seção 9, por exemplo, nunca existiram como arquivo. Agora
> existem e rodam. Se você mudar o código e não mudar este texto, ele volta a mentir.
>
> Premissa que manda em tudo: **Android primeiro, custo zero, um usuário só.**

---

## 1. PROMPT INICIAL

```
Você vai continuar um app de treino de musculação: um único arquivo HTML que já roda como
PWA instalável, com programa embutido e auditoria de volume semanal.

Contexto de uso: Android, dentro da academia, uma mão só, entre séries, tela suja,
internet ruim no subsolo. App pessoal, um único usuário, sem backend, sem contas.

Regras que não se negociam:
1. Leia `index.html` inteiro e este HANDOFF antes de escrever código.
2. Local-first. Nenhuma chamada de rede em runtime, nenhum login, nenhum servidor.
3. Não reescreva em React/Next/Flutter/React Native. O código é vanilla JS por decisão
   consciente (seção 3). Você vai modularizar, não reimplementar.
4. Não substitua os pictogramas SVG por biblioteca de ícones nem por GIF. São esqueletos
   articulados feitos à mão, com validação matemática (seção 7).
5. Não quebre a migração de dados da seção 6 — há registros reais nesse formato no celular.
6. Rode `node ferramentas/validar.js` e `node ferramentas/testar-comportamento.js` antes de
   dizer que terminou. Publicar é `node ferramentas/publicar.js`, que roda os dois e só
   carimba a versão se ambos passarem.
7. Nunca use `str.replace` sem contar as ocorrências (seção 10, item 4).
```

---

## 2. O que é o app

Registrador de treino **com o programa embutido**. Hevy, Strong e similares são cadernos
vazios: você digita o que fez. Aqui o programa vem pronto, baseado em literatura de
hipertrofia, e o app audita sozinho o volume semanal por grupo muscular.

O que ele faz e nenhum caderno faz:

- programa periodizado pronto, em 3 níveis + um modo de academia alternativa
- volume semanal por músculo alvo comparado com a faixa da literatura
- **o ciclo com o personal fechado**: o relatório da semana sai pronto para colar num LLM, e
  a resposta dele volta para dentro do app como nota da semana — de modo que o relatório da
  semana seguinte já sai contendo o que foi recomendado antes. É o eixo do projeto, não um
  extra: é a única coisa aqui que um caderno de treino não pode ser.

**É ferramenta pessoal, não produto.** Isso foi decidido em 15/09/2026 e é o que dá sentido
ao resto: sem loja, sem conta, sem sincronização, sem diferencial competitivo como critério
de nada. Se um dia virar produto, o modelo de dados (chave única no disco, sessão sem dono)
precisa ser revisto **antes** de qualquer outra coisa — não depois.

## 3. Plataforma: decidido, PWA e só

Preços verificados em setembro de 2026.

| Caminho | Custo | Veredito |
|---|---|---|
| **PWA no GitHub Pages** | **R$ 0** | **é o que está em uso** |
| Capacitor → APK sideload | R$ 0 | **cortado** — ver abaixo |
| Google Play (conta pessoal) | US$ 25 uma vez | fora de escopo: é ferramenta pessoal |
| App Store / iOS | US$ 99 por ano | não fazer |
| Expo / React Native | grátis | exigiria reescrever tudo, inclusive os 40 desenhos |

**Por que o Capacitor foi cortado.** A tabela de custos mede preço, e o custo dele não é
preço: é atrito permanente. Hoje mudar uma série é editar um arquivo e recarregar; com
Capacitor viraria Android Studio + gradle + keystore + sideload, toda vez. Num app que você
ajusta quase toda semana, isso é imposto cobrado em cada ideia.

Dos cinco plugins que justificavam a mudança, quatro têm equivalente web já implementado:

- `keep-awake` → **Wake Lock API**, já em uso durante o treino
- `preferences` → **`navigator.storage.persist()`**, já chamado no `carregar()`. Era o motivo
  de fundo do plugin (medo de o navegador descartar o `localStorage`) e custou uma linha
- `filesystem` + `share` → **`Blob` + `<a download>`**, já em Ajustes
- `haptics` → `navigator.vibrate`, suficiente

Sobrava a notificação local com o app fechado. Resolvida por outro caminho: o alarme do fim
do descanso é **agendado no relógio do WebAudio**, não num `setTimeout`, então toca na hora
certa mesmo com a aba estrangulada em segundo plano; mais vibração e, se autorizada,
notificação do service worker. Se um dia isso provar não bastar na prática, o Capacitor volta
à mesa — mas com um problema concreto na mão, não por antecipação.

## 4. Fases

### FASE 0 — rede de segurança ✅ feita em 15/09/2026
Git iniciado (o commit `4070d7b` guarda o estado anterior a qualquer correção, inclusive a
pasta `files (2)` e o zip duplicados, hoje removidos).

### FASE 1 — PWA instalável ✅ feita em 15/09/2026
- `manifest.webmanifest` com `display: standalone` e ícones 192/512 + maskable, gerados por
  `ferramentas/gerar-icones.js` a partir do mesmo desenho do `<link rel=icon>`
- Service worker reescrito: **rede primeiro para o documento**, cache-first para fontes,
  stale-while-revalidate para o resto, versionamento e limpeza de cache antigo no `activate`
- Wake Lock durante o treino, com novo pedido no `visibilitychange`
- Timer por timestamp, **persistido em `estado.desc`**
- `navigator.storage.persist()`
- Backup como arquivo e restauração por arquivo

**Fica pendente da fase 1:** as fontes ainda vêm do Google Fonts. O service worker as guarda
depois da primeira abertura online, então offline funciona a partir daí — mas a primeira
abertura offline cai no fallback de sistema. Para resolver de vez é baixar os `.woff2` e
embutir; foi deixado de fora por não ser possível baixar arquivo nesta sessão.

### FASE 2 — modularizar
Agora sim, com git para voltar atrás e com os validadores rodando. Alvo, sem mudar uma linha
de lógica:

```
/src
  index.html          shell + links dos assets
  /css/app.css        tokens e componentes (seção 11)
  /js/dados/          exercicios.js (EX, MUSC, ALT), icones.js (ICO), programas.js (NIVEIS)
  /js/estado.js       modelo, migração, adaptador de disco
  /js/telas/          agenda.js, treino.js, semana.js, ajustes.js
  /js/app.js          roteamento das abas, descanso, barra de contexto
/public               manifest.webmanifest, icones/, fontes/, sw.js
```

Build com **Vite** só para juntar os módulos. **Sem TypeScript**: converter 2.000 linhas dá
trabalho e não resolve nenhum bug atual.

### O que **não** fazer em nenhuma fase
Backend, login, sincronização em nuvem, analytics, assinatura, loja de exercícios, loja de
aplicativos. Custa dinheiro, tempo ou privacidade e não resolve nada do que dói.

## 5. Organização do código

Hoje: um `index.html` de ~100 KB com tudo dentro, mais:

```
/ferramentas          NÃO vai para o Pages
  ambiente.js             carrega o JS do index num DOM de mentira
  validar.js              os quatro testes da seção 9
  testar-comportamento.js prova as correções críticas, não só a sintaxe
  gerar-icones.js         PNG do manifest, escrito na mão com zlib
  publicar.js             roda tudo e carimba a versão no sw.js
/icones                   os três PNG gerados
```

## 6. Modelo de dados (não quebrar)

Objeto `estado`, serializado em JSON sob a chave `treino-bluefit-v1`.

```js
estado = {
  nivel:   'ini' | 'int' | 'avz' | 'predio',
  atual:   '2026-09-12#1' | null,          // sessão aberta
  aba:     'agenda' | 'treino' | 'volume' | 'ajustes',
  aberto:  'a1' | null,                    // exercício expandido
  mes:     '2026-09',                      // mês visível no calendário
  semVer:  2,                              // semana visível na aba Semana
  inicio:  '2026-09-14',                   // SEGUNDA-FEIRA base do número da semana
  ancoraLivre: false,                      // true se o usuário fixou um dia que não é segunda
  ses:     { '2026-09-12#1': { id, data, nivel, dia:'A', ts, fim:ts|null } },
  reg:     { '2026-09-12#1|a1|0': { kg:'22.5', reps:'8', ok:true, pr:false } },
  checkin: { 2: { sono:'7 a 8h', energia:'boa', dor:'nenhuma' } },
  desc:    { fim: 1789…, nome:'Remada curvada', avisou:false } | null,
  notas:   { 2: { texto:'resposta do personal…', ts: 1789… } }
}
```

- id de sessão = `AAAA-MM-DD#n` — o `#n` permite dois treinos no mesmo dia
- chave de registro = `idSessão|idExercício|índiceDaSérie`
- número da semana = `floor((data − inicio) / 7 dias) + 1`, com `inicio` na segunda-feira.
  **Mudar a âncora desloca o número de todas as semanas do histórico** — a tela avisa
- `desc.fim` é um **instante**, não uma contagem. O que resta é sempre recalculado do relógio
- houve um formato antigo de 5 partes (`nivel|semana|dia|ex|serie`); `migrar()` converte.
  **Mantenha a função** — existem dados reais nesse formato
- chaves de socorro que o app cria e **nunca apaga**: `…v1.quebrado.<carimbo>` (backup que não
  deu parse) e `…v1.antes-de-restaurar.<carimbo>` (estado anterior a uma restauração)

## 7. Pictogramas articulados

Cada exercício tem um SVG 64×64 montado por `desenho(id)` a partir de `ICO[id]`:

```js
a1: {
  eq:    'equipamento fixo',
  corpo: 'partes que não se movem',
  ch: [{ p:[26,38], r:35, s:[[26,38,19,31]],        // ombro: pivô, graus, segmento
         f:{ p:[19,31], r:-70, s:[[19,31,27,26]],    // cotovelo aninhado no ombro
             w: halter(27,26) }}]                    // peso preso na mão
}
```

Aninhar as juntas é o que mantém o membro preso ao corpo e o peso preso à mão. A animação é
uma única keyframe CSS (`rep`) aplicada a cada `<g class="an">`, com `--r`, `--dx` e `--dy`.

Um nó pode não ter segmento nenhum: é uma **peça do aparelho que translada** (a almofada do
joelho na panturrilha sentada, `e6`). O validador trata esse caso à parte — nó com junta `p`
mas sem segmento continua sendo erro.

Rode `node ferramentas/validar.js --movimento` para ver as 46 cadeias com curso e sentido.

## 8. Conteúdo de treino

Regras e fontes completas em `hipertrofia-pratica.skill`. No app:

- `EX` — 40 exercícios: nome, equipamento, dica de execução
- `MUSC` — `[[alvo],[auxiliares]]` por exercício
- `ALT` — o que fazer quando o aparelho está ocupado
- `NIVEIS` — 4 programas:

| Programa | Dias | Séries/músculo alvo/semana | RIR | Deload |
|---|---|---|---|---|
| Iniciante | 3 corpo inteiro | 8–12 | 3 | nenhum nas 12 primeiras |
| Intermediário | 5 | 12–20 | 1–2 | semana 7 |
| Avançado | 6 (PPL 2×) | 14–22 | 0–2 | semana 6 |
| Academia do prédio | 2 avulsos | **sem faixa** | 1–2 | — |

**A faixa só vale para os nove grupos que os programas tratam como ALVO** (`PRINCIPAIS`).
Ombro posterior, trapézio, antebraço, abdômen e lombar (`ACESSORIOS`) entram quase sempre
como auxiliares, valendo meia série, e por construção nunca alcançam o piso: antes de
15/09/2026 ficavam em vermelho permanente na aba Semana. Agora são contados e mostrados, mas
não julgados. Alerta que nunca apaga ensina a ignorar o próximo.

**O modo "academia do prédio" não tem faixa.** As regras do próprio nível dizem que ele é
complemento, não programa; media-lo com régua de programa acusava excesso justamente quando
você fez o que devia. As séries dele somam no total da semana; a faixa aplicada é a do
programa principal daquela semana — não a do nível que está selecionado agora.

Invariantes: série do músculo alvo conta 1, auxiliar conta 0,5; exercício `opt:true` fica fora
da conta. **Toda mudança em `NIVEIS` exige rodar `validar.js`** — já houve quatro rodadas de
correção (quadríceps, panturrilha, tríceps e, em 15/09/2026, glúteo do iniciante, que estava
em 7,5 contra piso 8 e passou a 8,5 com uma série a mais de `e5`).

## 9. Validação

Sem framework de teste. Dois scripts em Node, e um teste manual que nenhum dos dois cobre.

```bash
node ferramentas/validar.js              # a, b, c, d
node ferramentas/validar.js --movimento  # imprime curso e sentido das 46 cadeias
node ferramentas/testar-comportamento.js # as correções críticas
node ferramentas/publicar.js             # roda os dois e carimba a versão
```

**a) Integridade** — cruza EX × MUSC × ICO × ALT, acusa órfão nos dois sentidos, músculo
desconhecido, exercício sem alvo, e músculo que não esteja em PRINCIPAIS nem em ACESSORIOS.

**b) Auditoria de volume** — soma séries por músculo alvo em cada programa e compara com a
faixa. Reprova se algum dos nove principais ficar fora. Avisa se um acessório cresceu tanto
que talvez devesse virar principal.

**c) Direção do movimento** — aplica as rotações aninhadas de dentro para fora, reprova por
curso menor que 3,5 unidades ou ponta fora do viewBox, e imprime o sentido em palavras.

**d) Render em DOM falso** — `ferramentas/ambiente.js` carrega o JS do `index.html` com
`document`, `window` e `localStorage` de mentira, roda `carregar()` até o fim (é assíncrono:
**tem que dar `await`**) e confere que cabeçalho, tela e as quatro abas saíram preenchidos.

**`testar-comportamento.js`** prova o que sintaxe não prova: que um backup corrompido vai para
quarentena em vez de ser sobrescrito; que nada é gravado antes de `carregar()` confirmar a
leitura; que o descanso é retomado depois de fechar o app e descartado se venceu há muito;
que o recorde por repetição inverteu a ordem certa; que a âncora cai na segunda.

**Teste manual que continua obrigatório e que nenhum script faz:** instalar no celular, modo
avião, tela bloqueada por 2 minutos, voltar e conferir o cronômetro e o alarme.

## 10. Armadilhas já pagas (não repetir)

1. **`window.storage` existe mas falha** em alguns visualizadores, e **`localStorage` lança
   SecurityError** em iframe sem same-origin. A cascata de três níveis resolve. Não simplifique.
2. **`setInterval` congela** com a tela apagada, e variável solta morre em qualquer recarga.
   O descanso é um instante gravado no estado; o que resta é sempre recalculado.
3. **O arquivo precisa se chamar `index.html`** no Pages.
4. **`str.replace` sem contador** em scripts de patch: um comentário existia no CSS e no JS e
   o CSS inteiro foi duplicado para dentro do `<script>`. Conte as ocorrências e **aborte** se
   não for exatamente uma. Em 15/09/2026 essa regra salvou o arquivo de novo: um patch casou
   com `const nv=NIVEIS[estado.nivel]` em dois lugares e parou sozinho.
5. **Passo do botão +/− precisa ser proporcional** (2,5 / 5 / 10 kg conforme a carga) e aceitar
   segurar para acelerar.
6. **Nunca usar imagem de exercício de terceiros.** Posters de Pinterest, EvolutionFit e
   QuickFit são protegidos.
7. **Alvo de toque mínimo de 46 px.**
8. **Service worker cache-first puro congela o app na primeira versão instalada**, para
   sempre, sem nenhum sinal na tela. Documento vai por rede primeiro. A versão instalada
   aparece em Ajustes justamente para você poder conferir que a correção chegou.
9. **`catch(e){}` em volta de um `JSON.parse` de dados do usuário é uma bomba**: o estado volta
   ao padrão e a primeira gravação apaga o que era recuperável. Toda leitura que falhar guarda
   o original numa chave de quarentena antes de seguir.
10. **Recorde só por carga premia o comportamento errado.** 20 kg × 5 batia 18 kg × 12. A
    comparação é por 1RM estimado (Epley), que é só para comparar séries entre si.

## 11. Design system

```
--ground #0B0D10   fundo          --panel  #14181D   superfície
--panel2 #1B2027   superfície 2   --line   #262C34   divisória
--ink    #F4F6F8   texto          --dim    #868E9A   texto secundário
--sinal  #FFD447   estado ativo (cronômetro, recorde, nível)
--feito  #4ED8A0   concluído      --alerta #FF7A6B   fora da faixa
--alvo   #E5484D   músculo alvo   --aux    #5B8DEF   músculo auxiliar
--toque  46px      alvo mínimo de toque
```

Barlow Condensed nos números, Inter no texto. Conceito: placar de academia — número grande,
legível de relance, um único acento de cor reservado ao que está acontecendo agora.

Navegação: 4 abas fixas na base (Agenda, Treino, Semana, Ajustes) e, acima delas, uma barra de
contexto que alterna entre "próxima série" e cronômetro de descanso.

## 12. Backlog

**[ALTO] Editar o programa pelo app.** Hoje `NIVEIS` é fixo no código. Permitir trocar
exercício, séries, reps, RIR e descanso, salvando como override em `estado.custom[nivel][dia]`
sem perder o programa base. A auditoria de volume precisa rodar sobre base + override — e o
`validar.js` precisa ganhar um modo que leia o override do backup.

**[ALTO] Gráfico de progressão por exercício.** Carga ao longo das semanas, SVG puro, dentro do
card expandido. Agora que o recorde é por 1RM estimado, o eixo natural é esse.

**[MÉDIO] Fontes embutidas.** Baixar os `.woff2` e precarregar, para a primeira abertura
offline não cair no fallback.

**[MÉDIO] Cronômetro em tela cheia**, legível a 2 metros, um toque para pular.

**[MÉDIO] Troca rápida de exercício na sessão**, usando `ALT`, com histórico separado.

**[BAIXO] Deload automático:** quando `semanaDe(hoje) % deload === 0`, exibir o programa com
metade das séries e RIR 4 em vez de só avisar.

**[BAIXO] Aderência por mês:** planejado × realizado.

**[BAIXO] Modularizar** (fase 2). Rebaixado de propósito: é arrumação, não capacidade, e o
arquivo único ainda cabe na cabeça.

## 13. Estado atual (já funciona)

- Calendário mensal; toque no dia escolhe o treino, com o próximo da sequência sugerido; dois
  ou mais treinos no mesmo dia; reabrir treino anterior
- 40 exercícios com desenho animado articulado, mapa muscular frente/costas e link de vídeo
- Registro por série com carga sugerida; recorde pessoal por 1RM estimado
- Descanso por timestamp, com trava de tela, alarme sonoro agendado, vibração e notificação;
  sobrevive a fechar o app
- Encerramento com resumo (séries, tonelagem, recordes, o que ficou pra trás)
- Aba Semana: volume dos nove principais contra a faixa do programa da semana, acessórios
  contados sem faixa, comparação com a semana anterior, check-in, relatório de texto da semana
  e do mês, e **a nota da resposta do personal, que entra no relatório da semana seguinte**
- Ajustes: nível, âncora da semana, versão instalada, backup em arquivo e em texto,
  restauração dos dois, autorização de notificação
- 4 programas com histórico separado, migração do formato antigo, PWA instalável que se
  atualiza sozinho
