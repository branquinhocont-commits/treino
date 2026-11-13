/* Service worker do Treino.
   Trocado de cache-first puro (que congelava o app na primeira versão
   instalada, para sempre) para estratégia por tipo de recurso.

   VERSAO é carimbada por ferramentas/publicar.js. Trocar de versão
   invalida todo o cache antigo no activate.                              */
const VERSAO = 'v2026-11-13-01';
const CACHE  = 'treino-' + VERSAO;

const CASCA = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-mascara-512.png'
];

/* fontes do Google: imutáveis por URL, cache-first é seguro e desejável */
const FONTES = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      /* addAll é tudo-ou-nada; um 404 em qualquer item abortava a instalação */
      .then(c => Promise.all(CASCA.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(
        nomes.filter(n => n.startsWith('treino-') && n !== CACHE)
             .map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/* o app pergunta a versão para mostrar em Ajustes */
self.addEventListener('message', e => {
  if(e.data === 'versao' && e.source) e.source.postMessage({versao: VERSAO});
});

function ehDocumento(req){
  return req.mode === 'navigate' ||
         (req.headers.get('accept') || '').includes('text/html');
}

/* rede primeiro, com teto de 3,5 s, caindo para o cache.
   É o que faz uma correção publicada chegar ao celular.                   */
async function redePrimeiro(req){
  const cache = await caches.open(CACHE);
  try{
    const controle = new AbortController();
    const estouro = setTimeout(() => controle.abort(), 3500);
    const res = await fetch(req, {signal: controle.signal});
    clearTimeout(estouro);
    if(res && res.ok) cache.put(req, res.clone());
    return res;
  }catch(e){
    const guardado = await cache.match(req) || await cache.match('./index.html');
    if(guardado) return guardado;
    throw e;
  }
}

/* devolve o cache na hora e atualiza por trás para a próxima abertura */
async function cacheERevalida(req){
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(req);
  const rede = fetch(req).then(res => {
    if(res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return guardado || rede || fetch(req);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  const mesmaOrigem = url.origin === location.origin;

  if(ehDocumento(req)){ e.respondWith(redePrimeiro(req)); return; }
  if(mesmaOrigem || FONTES.test(req.url)){ e.respondWith(cacheERevalida(req)); return; }
  /* qualquer outra origem passa direto, sem entrar no cache */
});
