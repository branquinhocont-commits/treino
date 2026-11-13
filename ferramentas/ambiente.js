/* Carrega o JS do index.html num ambiente de mentira, para os validadores
   poderem inspecionar dados e comportamento sem navegador.

   carregarApp({ rodar, semente, agora, claude })
     rodar   : true chama carregar() e devolve a promessa em .pronto
     semente : { chave: texto } que já está no localStorage de mentira
     agora   : Date ou timestamp. Congela o relógio do app (new Date(), Date.now()),
               para os testes que dependem do dia da semana. Mude com app.relogio.t
     claude  : objeto que vira window.claude (para testar o modo "dentro do Claude") */
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');

function lerHTML(){ return fs.readFileSync(ARQ, 'utf8'); }
function extrairJS(){
  const html = lerHTML();
  const i = html.indexOf('<script>'), f = html.lastIndexOf('</script>');
  if(i < 0 || f < 0) throw new Error('não achei o bloco <script> no index.html');
  return html.slice(i + 8, f);
}

/* DOM de mentira: tudo o que o app tocar responde alguma coisa, e o que ele
   escrever em innerHTML fica registrado para o teste de render conferir.   */
function criarDOM(){
  const escrito = {};
  const fazEl = (id) => {
    const el = {
      id, tagName:'DIV', className:'', textContent:'', value:'', files:null, hidden:false, disabled:false,
      style:new Proxy({}, {get:()=> '', set:()=> true}),
      dataset:{}, children:[], firstChild:null,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},
      appendChild(c){ el.children.push(c); return c; },
      insertBefore(c){ el.children.unshift(c); return c; },
      removeChild(){}, remove(){}, focus(){}, blur(){}, select(){}, click(){},
      scrollIntoView(){}, addEventListener(){}, removeEventListener(){},
      setAttribute(){}, removeAttribute(){}, hasAttribute(){ return true; },
      getAttribute(){ return null; }, matches(){ return false; },
      querySelector(){ return fazEl('?'); },
      querySelectorAll(){ return []; },
      closest(){ return fazEl('?'); }
    };
    Object.defineProperty(el, 'innerHTML', {
      get(){ return escrito[id] || ''; },
      set(v){ escrito[id] = String(v); }
    });
    return el;
  };
  const cache = {};
  const doc = {
    getElementById(id){ return cache[id] || (cache[id] = fazEl(id)); },
    createElement(t){ const e = fazEl('novo:'+t); e.tagName = String(t).toUpperCase(); return e; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    addEventListener(){}, removeEventListener(){},
    body: fazEl('body'),
    visibilityState: 'visible', hidden:false
  };
  return { doc, escrito };
}

/* o que os validadores podem ver do app */
const EXPOSTO = ['EX','NIVEIS','MUSC','ALT','ICO','NOMES','PRINCIPAIS','ACESSORIOS','FAIXAS','CHAVE','VERSAO_DADOS',
  'estado','desenho','cadeia','corpo','segundaDe','semanaDe','semanaDatas','e1rm','statsDe','statsSemana','statsMes','render','carregar',
  'iso','hoje','ACOES','metaDe','sugerido','sugestao','diasDe','editavel','exValidos','agendaDe','volumePlanejado','exDaSessao',
  'sessoes','sessoesDe','atual','contaSessao','resumo','gravaLinha','passoDe','passoPara','melhorMarca','migrarVersao','normaliza',
  'aplicarBackup','lerBackup','textoRelatorio','textoMes','temClaude','restante','descansoAtivo','proximaSerie','corDia',
  'abrirDia','abrirEditor','escolherEx','comoFazer','histEx','duracao','notaDe','entregarTexto','dadoResgatado','nivelDaSemana'];

function carregarApp({ rodar = false, semente = null, agora = null, claude = null } = {}){
  let js = extrairJS();
  const { doc, escrito } = criarDOM();

  const armazem = semente ? Object.assign({}, semente) : {};
  const janela = {
    storage: null, claude,
    AudioContext: null, webkitAudioContext: null,
    scrollTo(){}, addEventListener(){}, removeEventListener(){},
    matchMedia(){ return {matches:false, addEventListener(){}}; }
  };

  const relogio = { t: agora == null ? null : +new Date(agora) };
  const DataFalsa = class extends Date {
    constructor(...a){ if(a.length || relogio.t == null) super(...a); else super(relogio.t); }
    static now(){ return relogio.t == null ? Date.now() : relogio.t; }
  };

  if(!/\bcarregar\(\);\s*$/.test(js)) throw new Error('o script do index.html não termina em carregar();');
  js = js.replace(/\bcarregar\(\);\s*$/, rodar ? 'var __pronto = carregar();' : 'var __pronto = null;');
  js += '\n;return {' + EXPOSTO.map(n => `get ${n}(){ return ${n}; }`).join(',') + ', pronto:__pronto};';

  const fn = new Function(
    'document','window','localStorage','navigator','location','setTimeout',
    'clearTimeout','setInterval','clearInterval','Notification','Blob','URL','FileReader','Date',
    js
  );

  const api = fn(
    doc, janela,
    { getItem:c=> (c in armazem? armazem[c] : null), setItem:(c,v)=>{armazem[c]=String(v);}, removeItem:c=>{delete armazem[c];} },
    { vibrate(){}, storage:{ persist:async()=>true, persisted:async()=>true }, serviceWorker:undefined },
    { protocol:'file:', reload(){} },
    (f)=>{ if(typeof f==='function') f(); return 0; },   /* setTimeout roda na hora */
    ()=>{}, ()=>0, ()=>{},
    undefined,
    function(){ return {}; },
    { createObjectURL:()=> 'blob:x', revokeObjectURL(){} },
    function(){ return { readAsText(){}, onload:null }; },
    DataFalsa
  );

  /* a série como o app a vê na tela: o bastante para gravaLinha() e ACOES.ok() */
  const linhaFalsa = (ex, i, kg, reps, feita = false) => {
    const row = { dataset:{ ex, i:String(i) },
      classList:{ contains:c=> c==='feita' ? feita : false, add(){}, remove(){}, toggle(){} },
      querySelector:q=> ({ value: q.includes('kg') ? String(kg) : String(reps) }),
      querySelectorAll:()=> [] };
    return row;
  };
  const marcar = (ex, i, kg, reps) => api.ACOES.ok({}, { closest:()=> linhaFalsa(ex, i, kg, reps, false) });

  return Object.defineProperties({ escrito, armazem, janela, doc, relogio, linhaFalsa, marcar },
    Object.getOwnPropertyDescriptors(api));
}

module.exports = { carregarApp, extrairJS, lerHTML };
