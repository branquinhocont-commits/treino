# HANDOFF — App de treino para celular (projeto pessoal, Guilherme)

> A seção **1** é o prompt para colar no agente do VS Code.
> O resto fica no repositório como referência.
> Premissa que manda em tudo: **Android primeiro e custo zero**. Nada aqui exige cartão
> de crédito até a fase 3, que é opcional.

---

## 1. PROMPT INICIAL

```
Você vai transformar um app de treino de musculação, hoje um único arquivo HTML já
funcionando, em um app de celular instalável — mantendo custo zero.

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

Comece pela FASE 1 da seção 4. Entregue cada fase funcionando antes de começar a próxima.
Ao fim de cada tarefa, rode as validações da seção 9.
```

---

## 2. O que é o app

Registrador de treino **com o programa embutido**. Hevy, Strong e similares são cadernos
vazios: você digita o que fez. Aqui o programa vem pronto, baseado em literatura de
hipertrofia, e o app audita sozinho o volume semanal por grupo muscular.

Três coisas que nenhum concorrente faz junto:
- programa periodizado pronto, em 3 níveis + um modo de academia alternativa
- volume semanal por músculo comparado com a faixa da literatura
- relatório de texto da semana e do mês, feito para ser colado num LLM que faz o papel de personal

Não vai para loja pública por enquanto. É uso próprio.

## 3. Plataforma e o que custa o quê

Preços verificados em setembro de 2026.

| Caminho | Custo | Instala na tela inicial | Notificação | Timer com app fechado | Veredito |
|---|---|---|---|---|---|
| **PWA no GitHub Pages** | **R$ 0** | sim (Adicionar à tela inicial) | web push exige servidor | não confiável | **FASE 1 — começar aqui** |
| **Capacitor → APK sideload** | **R$ 0** | sim, app nativo | local, sem servidor | sim | **FASE 2 — o salto que importa** |
| Google Play (conta pessoal) | US$ 25 uma vez | sim | idem | idem | FASE 3, opcional |
| App Store / iOS | US$ 99 por ano | — | — | — | **não fazer** |
| Expo / React Native | grátis (30 builds/mês no plano Free) | — | — | — | exigiria reescrever tudo |

Detalhes que decidem:

- Google Play cobra **US$ 25 uma única vez**, sem renovação — mas contas pessoais novas passam
  por verificação de identidade e pela exigência de **teste fechado com 12 testadores por 14
  dias** antes de publicar. Para um app de uso próprio, é burocracia sem retorno: o sideload
  do APK resolve o mesmo problema de graça.
- Apple cobra **US$ 99 por ano** e não existe caminho gratuito. Fora de escopo.
- Expo/EAS tem plano Free real (30 builds por mês), mas exigiria reescrever o app em React
  Native, incluindo os 40 desenhos articulados. Custo em tempo altíssimo, ganho nenhum.
- Capacitor embrulha o HTML atual num app Android nativo **sem reescrever nada**, e libera
  notificação local, wake lock e sistema de arquivos — exatamente o que falta hoje.

**Conclusão: PWA agora, Capacitor em seguida, loja só se um dia fizer sentido.**

## 4. Fases

### FASE 1 — PWA instalável (R$ 0)

- `manifest.webmanifest` com `display: standalone`, nome, cor de tema e ícones 192/512
  (gerar a partir do SVG que já está no `<link rel=icon>`)
- Service worker com precache de tudo (HTML, ícones, fontes), cache-first e fallback para o
  app shell. Já existe um `sw.js` básico: acrescente versionamento de cache e limpeza dos
  antigos no `activate`
- Hospedar em **GitHub Pages** ou **Cloudflare Pages** (grátis, sem cartão). O arquivo precisa
  se chamar `index.html`
- **Wake Lock API** para a tela não apagar durante o treino, com try/catch e novo request no
  `visibilitychange`
- **Timer baseado em timestamp**: guardar o horário de início do descanso e recalcular o
  restante ao voltar ao app. Com a tela apagada, `setInterval` congela
- Embutir as fontes woff2 no precache — hoje vêm do Google Fonts e, offline na primeira
  abertura, o app cai no fallback de sistema
- Aceite: instala pelo Chrome, abre sem barra do navegador, funciona em modo avião, e o
  cronômetro continua certo depois de 2 minutos com a tela bloqueada

### FASE 2 — Capacitor / APK Android (R$ 0)

- `npm i @capacitor/core @capacitor/cli && npx cap init && npx cap add android`
- Build local no Android Studio (grátis), APK assinado com keystore próprio (grátis)
- Instalação por sideload: transferir o APK e autorizar "instalar apps desconhecidos"
- Plugins gratuitos que mudam a experiência:
  - `@capacitor/local-notifications` — fim do descanso com o app em segundo plano, lembrete
    no dia agendado, aviso de fechamento de semana
  - `@capacitor/haptics` — vibração melhor que a da web
  - `@capacitor/filesystem` + `@capacitor/share` — backup como arquivo `.json` de verdade
  - `@capacitor/preferences` — armazenamento nativo, entra como primeiro nível da cascata
  - `@capacitor/keep-awake` — alternativa ao Wake Lock
- Aceite: APK instala, notificação de descanso chega com a tela apagada, backup exporta
  arquivo, app abre offline

### FASE 3 — opcional (US$ 25 uma vez)
Google Play em teste fechado ou aberto. Só vale se outras pessoas forem usar.

### O que **não** fazer em nenhuma fase
Backend, login, sincronização em nuvem, analytics, assinatura, loja de exercícios. Custa
dinheiro, tempo ou privacidade e não resolve nada do que dói hoje. Se um dia precisar
sincronizar dois aparelhos, os caminhos gratuitos são Supabase, Cloudflare D1 ou Firebase —
mas só depois da fase 2 rodando há meses.

## 5. Organização do código

Hoje: um `index.html` de ~96 KB com tudo dentro. Funciona, mas já está difícil de editar.

Alvo da fase 1, sem mudar uma linha de lógica:

```
/src
  index.html          shell + links dos assets
  /css/app.css        tokens e componentes (seção 11)
  /js/dados/
      exercicios.js   EX, MUSC, ALT
      icones.js       ICO + desenho() + corpo()
      programas.js    NIVEIS
  /js/estado.js       modelo, migração, adaptador de disco
  /js/telas/          agenda.js, treino.js, semana.js, ajustes.js
  /js/app.js          roteamento das abas, timer, barra de contexto
/public
  manifest.webmanifest, icons/, fonts/, sw.js
```

Build com **Vite** (grátis, praticamente sem config) só para juntar os módulos e gerar o
`dist/` que vai para o Pages e para o Capacitor. **Sem TypeScript agora**: converter 2.000
linhas dá trabalho e não resolve nenhum bug atual. Se for fazer, depois da fase 2, arquivo
por arquivo.

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
  inicio:  '2026-09-01',                   // base do número da semana
  ses:     { '2026-09-12#1': { id, data, nivel, dia:'A', ts, fim:ts|null } },
  reg:     { '2026-09-12#1|a1|0': { kg:'22.5', reps:'8', ok:true, pr:false } },
  checkin: { 2: { sono:'7 a 8h', energia:'boa', dor:'nenhuma' } }
}
```

- id de sessão = `AAAA-MM-DD#n` — o `#n` permite dois treinos no mesmo dia
- chave de registro = `idSessão|idExercício|índiceDaSérie`
- número da semana = `floor((data − inicio) / 7 dias) + 1`
- houve um formato antigo de 5 partes (`nivel|semana|dia|ex|serie`); `migrar()` converte.
  **Mantenha a função** — existem dados reais nesse formato
- na fase 2, trocar o adaptador de disco por `@capacitor/preferences` mantendo a mesma cascata
  de fallback (seção 10, item 1)

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
O validador simula as rotações e reprova se a extremidade for para o lado errado, andar menos
de 3,5 unidades ou sair do quadro. Rode sempre que criar ou alterar um desenho.

## 8. Conteúdo de treino

Regras e fontes completas em `hipertrofia-pratica.skill`. No app:

- `EX` — 40 exercícios: nome, equipamento, dica de execução
- `MUSC` — `[[alvo],[auxiliares]]` por exercício
- `ALT` — o que fazer quando o aparelho está ocupado
- `NIVEIS` — 4 programas:

| Programa | Dias | Séries/músculo/semana | RIR | Deload |
|---|---|---|---|---|
| Iniciante | 3 corpo inteiro | 8–12 | 3 | nenhum nas 12 primeiras |
| Intermediário | 5 | 12–20 | 1–2 | semana 7 |
| Avançado | 6 (PPL 2×) | 14–22 | 0–2 | semana 6 |
| Academia do prédio | 2 avulsos | — | 1–2 | — |

Invariantes: série do músculo alvo conta 1, auxiliar conta 0,5; exercício `opt:true` fica fora
da conta. **Toda mudança em `NIVEIS` exige reauditar o volume** — já houve três rodadas de
correção em que quadríceps, panturrilha e tríceps ficaram abaixo da faixa.

## 9. Validação

Sem framework de teste. Três checagens em Node e uma manual.

**a) Sintaxe e carregamento**
```bash
node -e "
const s=require('fs').readFileSync('index.html','utf8');
new Function(s.split('<script>')[1].split('</scr'+'ipt>')[0].replace('carregar();',''));
console.log('JS ok');"
```
Depois da modularização, trocar por `node --check` em cada arquivo de `/src/js`.

**b) Auditoria de volume** — soma séries por músculo em cada programa e compara com a faixa;
reprova se algum dos nove grupos principais ficar fora.

**c) Direção do movimento** — aplica as rotações aninhadas de dentro para fora, compara a
posição final da extremidade com a inicial, reprova por sentido errado, curso menor que 3,5
unidades ou ponto fora do viewBox.

**d) Render em DOM falso** — stub de `document`, `window` e `localStorage`; roda o app e
confere que cabeçalho, abas, calendário e cards saem preenchidos.

Teste manual obrigatório da fase 1: modo avião, tela bloqueada por 2 minutos, voltar e conferir
o cronômetro.

## 10. Armadilhas já pagas (não repetir)

1. **`window.storage` existe mas falha** em alguns visualizadores, e **`localStorage` lança
   SecurityError** em iframe sem same-origin. A cascata de três níveis resolve. Não simplifique.
2. **`setInterval` congela** com a tela apagada. Timer precisa ser por timestamp.
3. **O arquivo precisa se chamar `index.html`** no Pages. Nomes versionados foram usados só
   no desenvolvimento, para não colidir com downloads antigos no celular.
4. **`str.replace` sem contador** em scripts de patch: um comentário existia no CSS e no JS e
   o CSS inteiro foi duplicado para dentro do `<script>`.
5. **Passo do botão +/− precisa ser proporcional** (2,5 / 5 / 10 kg conforme a carga) e aceitar
   segurar para acelerar. Com passo fixo, chegar a 200 kg dava 80 toques.
6. **Nunca usar imagem de exercício de terceiros.** Posters de Pinterest, EvolutionFit e
   QuickFit são protegidos, e bancos gratuitos não têm demonstração exercício a exercício.
7. **Alvo de toque mínimo de 46 px.** O uso é com uma mão só, e a mão está suada.

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
legível de relance, um único acento de cor reservado ao que está acontecendo agora. Sem cartão
arredondado repetido: exercícios separados por linha fina.

Navegação: 4 abas fixas na base (Agenda, Treino, Semana, Ajustes) e, acima delas, uma barra de
contexto que alterna entre "próxima série" e cronômetro de descanso.

## 12. Backlog depois das fases

**[ALTO] Notificações locais** (só na fase 2): fim do descanso com app fechado, lembrete no dia
agendado, aviso de fechamento de semana.

**[ALTO] Editar o programa pelo app.** Hoje `NIVEIS` é fixo no código. Permitir trocar exercício,
séries, reps, RIR e descanso, salvando como override em `estado.custom[nivel][dia]` sem perder
o programa base. A auditoria de volume precisa rodar sobre base + override.

**[ALTO] Gráfico de progressão por exercício.** Carga ao longo das semanas, SVG puro, dentro do
card expandido.

**[MÉDIO] Backup como arquivo.** Hoje é copiar e colar JSON. Fase 1: `Blob` + `<a download>`.
Fase 2: Filesystem + Share.

**[MÉDIO] Cronômetro em tela cheia**, legível a 2 metros, um toque para pular.

**[MÉDIO] Troca rápida de exercício na sessão**, usando `ALT`, com histórico separado.

**[BAIXO] Deload automático:** quando `semanaDe(hoje) % deload === 0`, exibir o programa com
metade das séries e RIR 4 em vez de só avisar.

**[BAIXO] Aderência por mês:** planejado × realizado.

**[IDEIA] Importar a resposta do personal:** colar o retorno do LLM e guardar como nota da semana.

## 13. Estado atual (já funciona)

- Calendário mensal; toque no dia escolhe o treino, com o próximo da sequência sugerido; dois ou
  mais treinos no mesmo dia; reabrir treino anterior
- 40 exercícios com desenho animado articulado, mapa muscular frente/costas e link de vídeo
- Registro por série com carga sugerida (repete a série anterior ou a última vez)
- Recorde pessoal, cronômetro de descanso com vibração, encerramento com resumo (séries,
  tonelagem, recordes, o que ficou pra trás)
- Aba Semana: volume por músculo contra a faixa, comparação com a semana anterior por exercício,
  check-in de sono/disposição/dor, relatório de texto da semana e do mês
- 4 programas com histórico separado, backup por JSON, migração do formato antigo
