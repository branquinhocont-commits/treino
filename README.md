# Treino

App pessoal de treino de musculação: programa embutido (Massa 2027), meta de carga já
preenchida em cada série, descanso automático e volume semanal por músculo. PWA instalável,
offline, sem servidor, sem conta, um usuário. Um arquivo só (`index.html`), sem build.

Leia o **[HANDOFF.md](HANDOFF.md)** antes de mexer em qualquer coisa.

## Rodar

Abra `index.html` no Chrome. Para instalar no celular é preciso servir por HTTP
(o service worker não roda em `file:`):

```bash
python -m http.server 8080      # e abra http://<ip-da-maquina>:8080
```

## Antes de publicar

```bash
node ferramentas/publicar.js
```

Roda os validadores e os testes de comportamento, e só então carimba uma versão nova
no `sw.js`. Sem versão nova, o celular continua com o app antigo.

Para rodar só os testes, sem carimbar:

```bash
node ferramentas/validar.js
node ferramentas/testar-comportamento.js
```

`ferramentas/backup-real.json` (cópia do dado do celular, usada no teste de migração) está no
`.gitignore` e não deve ser publicada. Sem ela os testes rodam sobre `dado-antigo.json`, que
é sintético.

## Publicar no GitHub Pages

Suba tudo **menos** a pasta `ferramentas/`. O arquivo precisa se chamar `index.html`.
Depois de abrir no celular, confira em **Ajustes** se a versão instalada é a que você
acabou de carimbar.
