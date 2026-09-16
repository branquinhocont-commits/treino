# Treino

App pessoal de registro de treino de musculação, com o programa embutido e auditoria
de volume semanal. PWA instalável, offline, sem servidor, sem conta, um usuário.

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

## Publicar no GitHub Pages

Suba tudo **menos** a pasta `ferramentas/`. O arquivo precisa se chamar `index.html`.
Depois de abrir no celular, confira em **Ajustes** se a versão instalada é a que você
acabou de carimbar.
