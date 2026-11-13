# HANDOFF — App de treino para celular (projeto pessoal, Guilherme)

> Escrito para quem pegar o projeto depois: você mesmo daqui a três meses, ou um agente.
> **Última revisão: 12/11/2026**, quando as duas linhagens do app (a do repositório, com as
> proteções de dado, e a versão nova, com o Massa 2027 e as telas novas) viraram um arquivo só
> e a interface foi redesenhada. Se você mudar o código e não mudar este texto, ele volta a mentir.
>
> Premissa que manda em tudo: **Android primeiro, custo zero, um usuário só.**

---

## 1. PROMPT INICIAL

```
Você vai continuar um app de treino de musculação: um único arquivo HTML que roda como PWA
instalável, com o programa embutido, meta de carga por série e auditoria de volume semanal.

Contexto de uso: Samsung Galaxy em modo escuro, dentro da academia, uma mão só, entre séries,
internet ruim no subsolo. App pessoal, um único usuário, sem backend, sem contas.

Regras que não se negociam:
1. Leia `index.html` inteiro e este HANDOFF antes de escrever código.
2. Local-first. Nenhuma chamada de rede em runtime, nenhum login, nenhum servidor, nenhuma
   fonte ou script de CDN. A única exceção é a camada de nuvem, que só liga quando o app roda
   dentro do Claude (`window.claude`).
3. Não reescreva em React/Next/Flutter/React Native. O código é vanilla JS por decisão
   consciente (seção 3). Arquivo único, sem build.
4. Não substitua os pictogramas SVG por biblioteca de ícones nem por GIF. São esqueletos
   articulados feitos à mão, com validação matemática (seção 7).
5. Não quebre a migração de dados da seção 6: há registros reais nesses formatos no celular.
6. Rode `node ferramentas/validar.js` e `node ferramentas/testar-comportamento.js` antes de
   dizer que terminou. Publicar é `node ferramentas/publicar.js`, que roda os dois e só
   carimba a versão se ambos passarem.
7. Nunca use `str.replace` sem contar as ocorrências (seção 10, item 4).
8. Nunca use `alert`, `confirm` ou `prompt`: confirmação é folha deslizante (`confirmar()`).
9. Tema único, escuro. Não crie bloco de tema claro (seção 11).
```

---

## 2. O que é o app

Registrador de treino **com o programa embutido**. Hevy, Strong e similares são cadernos
vazios: você digita o que fez. Aqui o programa vem pronto, a carga e as repetições de cada
série já vêm preenchidas com a meta, e o app audita sozinho o volume semanal por músculo.

O que ele faz e nenhum caderno faz:

- programa periodizado pronto (Massa 2027 e os quatro anteriores), editável dentro do app
- a tela Hoje responde em dois segundos: que dia é, o que está programado na semana, o que
  fazer hoje e um botão para começar
- meta de carga por progressão dupla: bateu o topo da faixa, sobe a carga
- volume semanal por músculo alvo comparado com a faixa da literatura
- **o ciclo com o personal fechado**: o relatório da semana sai pronto para o Claude, e a
  resposta volta para dentro do app, de modo que o relatório da semana seguinte já sai com
  o que foi recomendado antes

**É ferramenta pessoal, não produto.** Sem loja, sem conta. Se um dia virar produto, o modelo
de dados (chave única no disco, sessão sem dono) precisa ser revisto **antes** de qualquer
outra coisa.

**Roda em dois lugares, com o mesmo arquivo:**

| Onde | Como sabe | O que muda |
|---|---|---|
| PWA em `https://branquinhocont-commits.github.io/treino/` (uso principal) | `window.claude` não existe | service worker, versão e aviso de atualização; "Copiar relatório para o Claude", "Colar a resposta do personal"; backup em arquivo |
| Dentro do Claude (artifact) | `temClaude()` é verdadeiro | sincroniza com o banco (`window.claude.use('db')`), "Pedir avaliação" (`use('sample')`), recado do personal na tela Hoje, status de nuvem em Ajustes. O service worker não é registrado |

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

### FASE 0 — rede de segurança ✅ 15/09/2026
Git iniciado.

### FASE 1 — PWA instalável ✅ 15/09/2026
- `manifest.webmanifest` com `display: standalone` e ícones 192/512 + maskable, gerados por
  `ferramentas/gerar-icones.js`
- Service worker: **rede primeiro para o documento**, stale-while-revalidate para o resto,
  versionamento e limpeza de cache antigo no `activate`
- Wake Lock durante o treino, com novo pedido no `visibilitychange`
- Descanso por timestamp, **persistido em `estado.desc`**
- `navigator.storage.persist()`
- Backup como arquivo e restauração por arquivo

### FASE 1b — unificação e redesenho ✅ 12/11/2026
- As duas linhagens viraram um `index.html` só (seção 13 lista o que veio de cada uma)
- Migração de dado para a versão 3 (seção 6)
- Interface refeita: tema escuro único, abas Hoje / Agenda / Evolução / Programa, folhas
  deslizantes, botão voltar do Android tratado (seção 11)
- **Sem webfont**: pilha de sistema. A pendência antiga das fontes do Google deixou de existir
  (o `sw.js` ainda tem a regra de cache para elas; é inofensiva e sai quando a lista da casca
  for mexida)

### FASE 2 — modularizar
Rebaixada: é arrumação, não capacidade. O arquivo tem ~2.700 linhas e ainda cabe na cabeça
porque está em blocos com cabeçalho (seção 5). Se for feita, é com Vite só para juntar
módulos, sem TypeScript.

### O que **não** fazer em nenhuma fase
Backend próprio, login, analytics, assinatura, loja de exercícios, loja de aplicativos.

## 5. Organização do código

Um `index.html` de ~185 KB com tudo dentro, nesta ordem. Os blocos de JS têm um comentário
de cabeçalho com este nome; procure por ele.

```
<head>           metas (color-scheme dark, theme-color), ícone SVG inline, manifest
<style>          tokens em :root, depois um bloco por componente/tela (seção 11)
<body>           #app > #tela (a tela) · #base (#dock + #abas, fixos embaixo) · #folha · #toast · #arqBkp
<script>
  DADOS          EX (41 exercícios) · NIVEIS (programas) · ICO/cadeia()/desenho() (pictogramas)
                 ALT · MUSC · NOMES · PRINCIPAIS/ACESSORIOS/FAIXAS · corpo() (mapa muscular)
                 extras da academia do prédio
  estado e disco estado, disco (cascata de 3 níveis), salvar()/salvarJa(), normaliza(),
                 migrarVersao(), adotarDoDisco(), carregar(), migrar() (formato de 5 partes)
  nuvem          temClaude(), sincronizar(), conectarNuvem()   (só dentro do Claude)
  datas          iso, hoje, segundaDe, semanaDe, semanaDatas
  programa efetivo  exValidos, diasDe, editavel, agendaDe, volumePlanejado
  sessões        sessoes, criarSessao, atual, sessaoDia, exDaSessao
  registros      pega, e1rm, melhorMarca, passoDe, metaDe, sugestao, duracao, resumo, histEx
  estatísticas   statsSemana, statsMes, statsDe, comparaExercicios
  check-in       PERGUNTAS
  relatório      textoRelatorio, textoMes, notaDe, respostaDe
  o que fazer hoje  sugerido()
  descanso       iniciarDescanso, restante, agendarAlarme (WebAudio), segurarTela (Wake Lock)
  interface      anilha()/pratao(), IC (ícones), render(), uma função por tela
                 (telaHoje, telaTreino, telaResumo, telaAgenda, telaEvolucao, telaPrograma,
                 telaAjustes), abrirFolha()/confirmar(), renderDock(), tique(),
                 ACOES (um método por data-a), ligar() (eventos delegados), registrarSW()
```

**Como a tela funciona.** Cada tela é uma função que devolve uma string de HTML; `render()` a
põe em `#tela`. Não há `onclick`: todo elemento clicável tem `data-a="nomeDaAcao"` e os
parâmetros em outros `data-*`; `ligar()` escuta o clique em `#app` e chama `ACOES[nome](dataset, elemento)`.
Para criar um botão novo, escreva o HTML com `data-a` e acrescente o método em `ACOES`.

**Nomes que não podem ser reusados.** `disco` é o armazenamento; a função que desenha a anilha
pequena chama `anilha()`. A classe `.an` é do pictograma animado; a anilha usa `.disco`.

```
/ferramentas          NÃO vai para o Pages
  ambiente.js             carrega o JS do index num DOM de mentira, com relógio congelável
  validar.js              integridade, volume, movimento, render de todas as telas, regras do arquivo
  testar-comportamento.js as proteções e as regras de negócio, uma a uma (seção 9)
  dado-antigo.json        dado SINTÉTICO no formato antigo do repositório, para o teste de migração
  backup-real.json        cópia do dado real do celular. Está no .gitignore: nunca publicar
  gerar-icones.js         PNG do manifest, escrito na mão com zlib
  publicar.js             roda tudo e carimba a versão no sw.js
/icones                   os três PNG gerados
```

## 6. Modelo de dados (não quebrar)

Objeto `estado`, serializado em JSON sob a chave `treino-bluefit-v1`.

```js
estado = {
  versao:  3,                              // versão do formato. Ausente = dado do app antigo
  nivel:   'm27' | 'ini' | 'int' | 'avz' | 'predio',   // programa em uso
  atual:   '2026-11-12#1' | null,          // sessão aberta na tela de treino
  aba:     'hoje' | 'agenda' | 'evolucao' | 'programa' | 'ajustes' | 'treino',
  aberto:  'a1' | '-' | null,              // exercício expandido no treino
  mes:     '2026-11',                      // mês visível na Agenda e em Evolução > Mês
  semVer:  9,                              // semana visível em Evolução > Semana
  evo:     'semana' | 'mes' | 'ex',        // sub-aba de Evolução
  pAberto: 'A' | null,                     // treino expandido em Programa
  inicio:  '2026-09-14',                   // SEGUNDA-FEIRA base do número da semana
  ancoraLivre: false,                      // true se o usuário fixou um dia que não é segunda
  ses:     { '2026-11-12#1': { id, data, nivel, dia:'C', ts, ini:ts|null, fim:ts|null, upd? } },
  reg:     { '2026-11-12#1|d4|0': { kg:'32.5', reps:'8', ok:true, pr:false, t:ts } },
  pulo:    { '2026-11-12#1|d3': 'aparelho ocupado' },          // "Não fiz", com o motivo
  checkin: { 9: { sono:'7 a 8h', energia:'boa', dor:'nenhuma' } },
  desc:    { fim: 1794…, total:150, nome:'série 2, Puxada…', avisou:false } | null,
  notas:   { 9: { texto, ts }, 'M2026-11': { texto, ts } },    // resposta do personal colada à mão
  aval:    { 'S9': { texto, ts }, 'M2026-11': { texto, ts } }, // avaliação gerada dentro do Claude
  agenda:  { m27: { 1:'A', 2:'B', 4:'C', 5:'D' } },            // semana programada, se editada
  custom:  { dias: { 'm27|A': [ { id, s, reps, rir, desc, opt?, nota? } ] }, upd: ts }
}
```

- id de sessão = `AAAA-MM-DD#n`; o `#n` permite dois treinos no mesmo dia
- chave de registro = `idSessão|idExercício|índiceDaSérie`. `kg` é texto com ponto decimal
  (a tela mostra e aceita vírgula). `t` é a hora em que a série foi marcada; `s.ini` é a hora
  da primeira série. A duração do treino sai daí
- número da semana = `floor((data − inicio) / 7 dias) + 1`, com `inicio` na segunda-feira.
  **Mudar a âncora desloca o número de todas as semanas do histórico**: a tela avisa
- `desc.fim` é um **instante**, não uma contagem. O que resta é sempre recalculado do relógio
- `notas` da semana usa o número da semana como chave (formato do app antigo); a do mês usa
  `'M'+mês`. `respostaDe(chave)` devolve a nota ou, na falta dela, a avaliação
- `custom.dias['programa|dia']` é a lista **completa** de exercícios daquele dia depois de
  editada. `diasDe(programa)` devolve o programa efetivo (base + edição). `NIVEIS` nunca é
  alterado em runtime. Entrada inválida (exercício que não existe, série fora de 1 a 10,
  repetido) é descartada por `exValidos()`; se não sobrar nada, vale o programa base
- `agenda[programa]` é `{ diaDaSemana(0=dom…6=sáb): idDoDia }`. Sem ela, `agendaDe()` usa
  `NIVEIS[programa].agenda` se existir, ou distribui os dias fixos (sem `extra`) na semana
- chaves de socorro que o app cria e **nunca apaga**: `…v1.quebrado.<carimbo>` (dado que não
  deu parse) e `…v1.antes-de-restaurar.<carimbo>` (estado anterior a uma restauração)

**As duas migrações. Mantenha as duas.**

1. `migrar()`: formato muito antigo, de 5 partes (`nivel|semana|dia|ex|serie`), vira sessões
   com data.
2. `migrarVersao()`: se `estado.versao < 3` (ou ausente), define `nivel='m27'` e grava
   `versao=3`. **Uma vez só**: quem escolher outro programa depois não é empurrado de volta.
   Nenhuma sessão e nenhuma série é tocada; as sessões antigas continuam com `nivel` `int`
   ou `ini`, e por isso **os programas antigos não podem sair de `NIVEIS`**.

`normaliza()` roda em toda carga e em toda restauração: cria os campos novos que faltarem
(`pulo`, `agenda`, `custom`, `aval`, `checkin`, `notas`) e conserta valores fora do esperado.

**Série registrada não some.** `exDaSessao(s)` devolve os exercícios do programa como ele está
hoje **mais** o que foi registrado na sessão e depois saiu do programa (exercício trocado,
série removida), marcado com `fora:true`. Toda conta e toda tela de sessão passa por ela.

**Para receber um programa novo** (ou a revisão do `m27`): troque o objeto em `NIVEIS` por
`{ nome, curto, sub, plano, deload, regras, dias[, agenda] }`, com `extra:true` nos dias que
são bônus, acrescente a faixa em `FAIXAS` (ou `null` se não tiver) e rode `validar.js`.

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

Rode `node ferramentas/validar.js --movimento` para ver as 47 cadeias com curso e sentido.

## 8. Conteúdo de treino

Regras e fontes completas em `hipertrofia-pratica.skill`. No app:

- `EX` — 41 exercícios: nome, equipamento, dica de execução
- `MUSC` — `[[alvo],[auxiliares]]` por exercício
- `ALT` — o que fazer quando o aparelho está ocupado
- `NIVEIS` — 5 programas:

| Programa | Dias | Séries/músculo alvo/semana | RIR | Deload |
|---|---|---|---|---|
| **Massa 2027** (`m27`, em uso) | 4 fixos (superior/inferior 2×) + 2 extras | 10–20, só nos dias fixos | 1–2 compostos, 0–1 isoladores | semana 8 |
| Iniciante | 3 corpo inteiro | 8–12 | 3 | nenhum nas 12 primeiras |
| Intermediário | 5 | 12–20 | 1–2 | semana 7 |
| Avançado | 6 (PPL 2×) | 14–22 | 0–2 | semana 6 |
| Academia do prédio | 2 avulsos | **sem faixa** | 1–2 | — |

**A faixa só vale para os nove grupos que os programas tratam como ALVO** (`PRINCIPAIS`).
Ombro posterior, trapézio, antebraço, abdômen e lombar (`ACESSORIOS`) entram quase sempre
como auxiliares, valendo meia série: são contados e mostrados, mas não julgados. Alerta que
nunca apaga ensina a ignorar o próximo.

**Dia com `extra:true` é bônus.** Fica fora da semana padrão, da auditoria de volume e da
conta de treinos da semana. Na tela Hoje ele é oferecido quando a semana está em dia.

**O modo "academia do prédio" não tem faixa.** É complemento, não programa. A faixa aplicada
numa semana é a do programa mais usado nela (`nivelDaSemana`), não a do que está selecionado
agora. Na semana em curso a tela não acusa "abaixo da faixa": só depois que ela fecha.

Invariantes: série do músculo alvo conta 1, auxiliar conta 0,5; exercício `opt:true` fica fora
da conta. **Toda mudança em `NIVEIS` exige rodar `validar.js`.**

**Meta de carga (`metaDe`).** Progressão dupla sobre a última vez que o exercício foi feito,
em qualquer treino: se pelo menos duas séries na carga mais alta bateram o topo da faixa de
repetições, sobe a carga (2,5 kg em músculo pequeno ou carga abaixo de 20 kg; 5 kg no resto)
e a meta volta ao piso da faixa; senão, mesma carga e uma repetição a mais.

## 9. Validação

Sem framework de teste. Dois scripts em Node, e um teste manual que nenhum dos dois cobre.

```bash
node ferramentas/validar.js              # a, b, c, d, e
node ferramentas/validar.js --movimento  # imprime curso e sentido das 47 cadeias
node ferramentas/testar-comportamento.js # proteções e regras de negócio
node ferramentas/testar-comportamento.js --backup caminho.json   # migração sobre um backup real
node ferramentas/publicar.js             # roda os dois e carimba a versão
```

**a) Integridade** — cruza EX × MUSC × ICO × ALT, acusa órfão nos dois sentidos, músculo
desconhecido, exercício sem alvo, e músculo que não esteja em PRINCIPAIS nem em ACESSORIOS.

**b) Auditoria de volume** — soma séries por músculo alvo em cada programa, **só nos dias sem
`extra`**, e compara com a faixa (m27: 10–20). Confere também a forma de cada programa:
campos obrigatórios, id de dia repetido, exercício repetido no dia, agenda padrão válida.

**c) Direção do movimento** — aplica as rotações aninhadas de dentro para fora, reprova por
curso menor que 3,5 unidades ou ponta fora do viewBox.

**d) Render em DOM falso** — `ferramentas/ambiente.js` carrega o JS do `index.html` com
`document`, `window` e `localStorage` de mentira e um relógio congelado numa quinta-feira,
roda `carregar()` (assíncrono: **tem que dar `await`**) e desenha todas as abas, todas as
folhas, todos os dias de todos os programas em treino, e um treino inteiro (✓, descanso,
"Não fiz", encerrar, resumo). Depois abre o dado antigo e desenha todas as sessões dele.
Reprova tela vazia e tela com `undefined` ou `NaN` no texto.

**e) Regras do arquivo** — sem `alert/confirm/prompt`, sem script, fonte ou estilo externo,
sem chamada de rede, `color-scheme: dark` declarado, sem tema claro, sem a regra
`#app button{…}` (seção 10, item 11).

**`testar-comportamento.js`** prova, um a um: (1) dado corrompido vai para quarentena;
(2) nada é gravado antes de `carregar()` terminar, nem com toque na tela no meio; (3) descanso
retomado depois de fechar o app; (4) recorde por 1RM estimado; (5) âncora na segunda;
(6) **migração do dado antigo** (sintético e, se o arquivo existir, o backup real): nenhuma
sessão e nenhuma série perdida ou alterada, `nivel` vira `m27` uma vez só, estatísticas batem
com o dado cru; (7) `metaDe()`; (8) `sugerido()`; (9) edição de programa; (10) registro de
série, recorde, descanso persistido, passo do − e +, descarte de treino vazio; (11) PWA ×
dentro do Claude; (12) restaurar backup.

**Teste manual que continua obrigatório e que nenhum script faz:** instalar no celular, modo
avião, tela bloqueada por 2 minutos, voltar e conferir o cronômetro e o alarme. E abrir no
navegador da Samsung com o modo escuro do aparelho ligado, para conferir que ele não inverte
as cores.

## 10. Armadilhas já pagas (não repetir)

1. **`window.storage` existe mas falha** em alguns visualizadores, e **`localStorage` lança
   SecurityError** em iframe sem same-origin. A cascata de três níveis resolve. Não simplifique.
2. **`setInterval` congela** com a tela apagada, e variável solta morre em qualquer recarga.
   O descanso é um instante gravado no estado; o que resta é sempre recalculado.
3. **O arquivo precisa se chamar `index.html`** no Pages.
4. **`str.replace` sem contador** em scripts de patch: conte as ocorrências e **aborte** se
   não for exatamente uma.
5. **Passo do botão +/− precisa ser proporcional** (2,5 / 5 / 10 kg conforme a carga) e aceitar
   segurar para repetir. Descendo de 30 kg o passo é o da faixa de baixo (30 → 27,5).
6. **Nunca usar imagem de exercício de terceiros.**
7. **Alvo de toque mínimo de 48 px**, em altura e largura.
8. **Service worker cache-first puro congela o app na primeira versão instalada.** Documento
   vai por rede primeiro, e a versão instalada aparece em Ajustes.
9. **`catch(e){}` em volta de um `JSON.parse` de dados do usuário é uma bomba**: toda leitura
   que falhar guarda o original numa chave de quarentena antes de seguir.
10. **Recorde só por carga premia o comportamento errado.** A comparação é por 1RM estimado
    (Epley), que é só para comparar séries entre si.
11. **Uma regra `#app button{…}` anula o estilo de todos os botões por especificidade** (id
    ganha de classe). O reset de botão é por elemento (`button{…}`), que perde para qualquer
    classe. `validar.js` reprova se a regra voltar.
12. **Uma classe para duas coisas** (`.nav` já foi barra de abas e navegação de mês). Cada
    componente tem a sua: `.navmes`, `#abas`, `.seg`.
13. **Texto cortado em item de lista.** Nome de exercício quebra em duas linhas
    (`overflow-wrap:anywhere`); não use `text-overflow:ellipsis` em nome.
14. **Barra fixa cobrindo conteúdo.** `#tela` tem `padding-bottom` para as abas, e mais quando
    o dock está na tela (`#app.com-dock`, `#app.em-treino`).
15. **O navegador da Samsung força um modo escuro próprio** em página clara ou com dois temas.
    Tema único, `color-scheme: dark` em `:root`, `<meta name="color-scheme" content="dark">`
    e fundo escuro explícito em `html` e `body`.
16. **`salvar()` espera 350 ms.** Fechar o app logo depois do ✓ perdia a série. `salvarJa()`
    grava na hora no `visibilitychange` e no `pagehide`, mas **só se houver mudança pendente**:
    uma instância parada não pode sobrescrever o que outra gravou.
17. **App instalado e aba do navegador dividem o mesmo `localStorage`.** A instância que ficou
    para trás adota o dado novo pelo evento `storage` (`adotarDoDisco`).
18. **Dois nomes iguais no mesmo escopo derrubam o arquivo inteiro** (`disco` já foi objeto e
    função ao mesmo tempo). O teste d pega, porque nada renderiza.
19. **Editar o programa escondia série já registrada.** Use `exDaSessao()`, nunca
    `sessaoDia(s).ex`, para listar ou contar o que há numa sessão.

## 11. Design system

**Tema único, escuro e assumido.** Grafite e giz; a única cor viva na tela é a do treino.

```
--fundo #131417   fundo            --sup   #1C1E22   superfície
--sup2  #272A2F   superfície 2     --sup3  #353940   superfície 3, botão em folha
--linha #2B2E34   divisória        --giz   #F3F1EC   texto e botão principal
--dim   #A3A6AD   texto secundário --apag  #72767E   texto apagado, ícone inativo
--tinta #131417   texto sobre giz
--ok    #45D08B   série feita, subiu --alerta #FF8D5C  fora da faixa, caiu
--ouro  #F4C546   recorde
--alvo  #E5463C   músculo alvo     --aux   #3F7DF0   músculo auxiliar
```

**Identidade: cada treino é uma anilha olímpica.** A ordem dos dias fixos do programa dá a
cor: A vermelha (25 kg), B azul (20), C amarela (15), D verde (10), o quinto branca (5), o
sexto grafite (2,5). Dia extra é cinza. `corDia(programa, dia)` devolve a letra da cor e a
classe `.c-r/.c-b/.c-y/.c-g/.c-w/.c-k/.c-x` define `--cor` (a cor) e `--sobre` (a tinta que
se lê em cima dela). A cor aparece na fita da semana, no calendário, na barra de progresso e
no dock de descanso do treino, e na anilha grande do destaque de Hoje (`pratao()`), que é o
único elemento decorativo do app: aro, sulco, miolo de aço e a gravação "TREINO A 25 KG".

**Tipografia.** Pilha de sistema (`system-ui, Roboto, 'Segoe UI', sans-serif`): nativa no
Android, carrega offline. Hierarquia por peso e tamanho: título de tela 28/800, título do
destaque 30/800, seção 19/800, número grande 21 a 36/800, texto 15, apoio 13. Números sempre
com `tabular-nums` (classe `.num`). Sem caixa alta em rótulo.

**Superfície em vez de cartão.** As listas são linhas com divisória sobre o fundo. Superfície
(`--sup`) só marca o que está em foco: o destaque de Hoje, o exercício aberto no treino, o
treino aberto em Programa, o dia de hoje na fita. Raios: 26 destaque e folha, 22 bloco
aberto, 14 botão e campo, 24 chip.

**Comportamento de app.**
- 4 abas fixas embaixo (Hoje, Agenda, Evolução, Programa), com área segura. Ajustes abre pelo
  ícone no topo de Hoje. No treino as abas somem e fica o dock
- cabeçalho de cada tela é `position:sticky`
- folha deslizante (`abrirFolha`) com alça, véu, arrastar para baixo fecha, Esc fecha.
  Confirmação é `confirmar(título, texto, botões)`
- botão voltar do Android: fecha a folha, depois sai do treino ou de Ajustes para Hoje
  (`guardaVoltar` mantém uma entrada no histórico enquanto há algo aberto)
- transição de tela de 200 ms, folha de 240 ms; `prefers-reduced-motion` desliga tudo
- alvo de toque de 48 px no mínimo; estado `:active` em tudo que se toca
- com o teclado aberto num campo de série, a barra de baixo some (`#app:has(.serie input:focus) #base`)
- com o dia resolvido (treino feito ou descanso), Hoje mostra o próximo treino da semana
- dentro do treino: um toque no ✓ registra a série com o que está no campo; a série ativa
  (a próxima a fazer, ou a que foi tocada) mostra os botões − e + embaixo; o descanso começa
  sozinho e aparece no dock com +30 s e Pular

**Texto.** Curto, direto, sem travessão, sem frase de efeito. Um botão diz o que acontece
("Encerrar treino", "Restaurar de um arquivo") e o aviso depois usa a mesma palavra.

**Ícone do app.** A anilha vermelha de frente sobre o grafite. `ferramentas/gerar-icones.js`
desenha os três PNG; o `<link rel=icon>` do `index.html` é o mesmo desenho em SVG.

## 12. Backlog

**[ALTO] Integrar a revisão do Massa 2027** quando chegar (seção 6, "Para receber um programa novo").

**[MÉDIO] Deload automático:** quando `semanaDe(hoje) % deload === 0`, exibir o programa com
metade das séries e RIR 4. Hoje o deload só está escrito nas regras.

**[MÉDIO] Cronômetro em tela cheia**, legível a 2 metros.

**[MÉDIO] Apagar uma sessão registrada por engano.** Hoje só dá para descartar sessão vazia.

**[BAIXO] Aderência por mês:** planejado × realizado.

**[BAIXO] `validar.js` ler o override de um backup** e auditar o volume do programa editado.

**[BAIXO] Tirar do `sw.js` a regra de cache das fontes do Google**, que não são mais usadas.

**[BAIXO] Modularizar** (fase 2).

## 13. Estado atual (já funciona)

**Veio da linhagem do repositório (as proteções):**
- carga do `localStorage` com quarentena de JSON corrompido e trava de gravação
- descanso persistido em `estado.desc`, recalculado do relógio ao reabrir; alarme agendado no
  WebAudio, vibração e notificação
- `wakeLock` da tela durante o treino
- service worker com versão em Ajustes e aviso de atualização
- backup em arquivo (baixar e restaurar) e em texto, com cópia de segurança antes de restaurar
- recorde por `e1rm()`; `segundaDe()` e âncora da semana
- nota do personal por semana (`estado.notas`, bloco `nota-sem`), que entra no relatório seguinte
- faixa de volume só para os nove músculos principais, pelo programa da semana

**Veio da versão nova:**
- programa Massa 2027, com extras; exercício `c0`
- abas Hoje / Agenda / Evolução / Programa; fita da semana; treino sugerido do dia
- "Não fiz" com motivo; trocar e adicionar exercício durante o treino
- semana programada editável; programa editável no app
- meta de carga por progressão dupla, já preenchida nos campos
- relógio da sessão, hora por série, resumo do treino com comparação com a última vez
- evolução por semana, mês e exercício, com histórico e gráfico por exercício
- avaliação por IA e sincronização com o banco quando roda dentro do Claude

**Novo na unificação:**
- migração para a versão 3 do dado; `exDaSessao()`; gravação imediata ao sair do app;
  duas instâncias abertas não se sobrescrevem
- fora do Claude: copiar relatório (compartilhar do sistema, área de transferência ou texto
  para copiar), colar a resposta do personal por semana e por mês
- botão voltar do Android; confirmações em folha; descarte de treino vazio
- interface e ícone redesenhados
