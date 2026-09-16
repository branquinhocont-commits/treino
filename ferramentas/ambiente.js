/* Carrega o JS do index.html num ambiente de mentira, para os validadores
   poderem inspecionar EX / NIVEIS / MUSC / ICO sem navegador.             */
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');

function extrairJS(){
  const html = fs.readFileSync(ARQ, 'utf8');
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
      id, tagName:'DIV', className:'', textContent:'', value:'', files:null,
      style:new Proxy({}, {get:()=> '', set:()=> true}),
      dataset:{}, children:[],
      classList:{add(){},remove(){},toggle(){},contains(){return false}},
      appendChild(c){ el.children.push(c); return c; },
      removeChild(){}, remove(){}, focus(){}, blur(){}, select(){}, click(){},
      scrollIntoView(){}, addEventListener(){}, removeEventListener(){},
      setAttribute(){}, removeAttribute(){}, hasAttribute(){ return true; },
      getAttribute(){ return null; },
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
    querySelector(){ return fazEl('?'); },
    querySelectorAll(){ return []; },
    addEventListener(){}, removeEventListener(){},
    body: fazEl('body'),
    visibilityState: 'visible'
  };
  return { doc, escrito };
}

function carregarApp({ rodar = false, semente = null } = {}){
  let js = extrairJS();
  const { doc, escrito } = criarDOM();

  const armazem = semente ? Object.assign({}, semente) : {};
  const janela = {
    storage: null,
    AudioContext: null, webkitAudioContext: null,
    scrollTo(){}, addEventListener(){},
    matchMedia(){ return {matches:false, addEventListener(){}}; }
  };

  /* devolve tudo o que os validadores precisam ver */
  js = js.replace(/\bcarregar\(\);\s*$/, rodar ? 'var __pronto = carregar();' : 'var __pronto = null;');
  js += '\n;return {EX,NIVEIS,MUSC,ALT,ICO,NOMES,PRINCIPAIS,ACESSORIOS,FAIXAS,'
      + 'estado,desenho,cadeia,segundaDe,semanaDe,e1rm,statsDe,render,carregar,iso,hoje,pronto:__pronto};';

  const fn = new Function(
    'document','window','localStorage','navigator','location','setTimeout',
    'clearTimeout','setInterval','clearInterval','Notification','Blob','URL','FileReader',
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
    function(){ return { readAsText(){}, onload:null }; }
  );

  return { ...api, escrito, armazem, janela, doc };
}

module.exports = { carregarApp, extrairJS };
