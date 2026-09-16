/* Os quatro testes da seção 9 do HANDOFF, agora como arquivo de verdade.
   Rodar: node ferramentas/validar.js                                       */
const { carregarApp } = require('./ambiente.js');

let falhas = 0, avisos = 0;
const tit = t => console.log('\n\x1b[1m'+t+'\x1b[0m');
const ok   = m => console.log('  \x1b[32mok\x1b[0m    '+m);
const erro = m => { falhas++; console.log('  \x1b[31mFALHA\x1b[0m '+m); };
const nota = m => { avisos++; console.log('  \x1b[33maviso\x1b[0m '+m); };

const app = carregarApp();
const { EX, NIVEIS, MUSC, ALT, ICO, NOMES, PRINCIPAIS, ACESSORIOS, FAIXAS } = app;

/* ============ a) integridade dos dados ============ */
tit('a) Integridade dos dados de exercício');
{
  const ids = Object.keys(EX);
  const faltando = (tabela, nome) => ids.filter(k => !tabela[k])
    .forEach(k => erro(`${k} existe em EX mas não em ${nome}`));
  faltando(MUSC,'MUSC'); faltando(ICO,'ICO'); faltando(ALT,'ALT');
  Object.keys(MUSC).filter(k=>!EX[k]).forEach(k=> erro(`${k} está em MUSC e não em EX`));

  const usados = new Set();
  Object.values(NIVEIS).forEach(n => n.dias.forEach(d => d.ex.forEach(p => usados.add(p.id))));
  [...usados].filter(k => !EX[k]).forEach(k => erro(`programa usa ${k}, que não existe em EX`));
  const orfaos = ids.filter(k => !usados.has(k));
  if(orfaos.length) nota('definido e nunca usado por nenhum programa: '+orfaos.join(', '));

  const musculosValidos = new Set(Object.keys(NOMES));
  Object.entries(MUSC).forEach(([k,[alvo,aux]]) => {
    [...alvo,...aux].filter(m=>!musculosValidos.has(m))
      .forEach(m => erro(`${k} aponta para o músculo desconhecido "${m}"`));
    if(!alvo.length) erro(`${k} não tem músculo alvo`);
  });

  const cobertos = new Set([...PRINCIPAIS, ...ACESSORIOS]);
  [...musculosValidos].filter(m=>!cobertos.has(m))
    .forEach(m => erro(`"${m}" não está nem em PRINCIPAIS nem em ACESSORIOS — não aparece em lugar nenhum`));

  if(!falhas) ok(`${ids.length} exercícios, cruzados em EX / MUSC / ICO / ALT sem órfão`);
}

/* ============ b) auditoria de volume ============ */
tit('b) Volume semanal por músculo alvo × faixa do programa');
{
  for(const nv of Object.keys(NIVEIS)){
    const mus = {};
    NIVEIS[nv].dias.forEach(d => d.ex.forEach(p => {
      if(p.opt) return;
      const [alvo,aux] = MUSC[p.id];
      alvo.forEach(m => mus[m] = (mus[m]||0) + p.s);
      aux .forEach(m => mus[m] = (mus[m]||0) + p.s*0.5);
    }));
    const f = FAIXAS[nv];
    if(!f){ ok(`${nv.padEnd(7)} sem faixa por definição (complemento, não programa)`); continue; }
    const fora = PRINCIPAIS.filter(m => !mus[m] || mus[m] < f[0] || mus[m] > f[1]);
    if(fora.length) fora.forEach(m =>
      erro(`${nv}: ${NOMES[m]} tem ${mus[m]||0} séries, fora da faixa ${f[0]}–${f[1]}`));
    else ok(`${nv.padEnd(7)} nove grupos principais dentro de ${f[0]}–${f[1]}`);

    ACESSORIOS.filter(m => mus[m] && f && mus[m] >= f[0]).forEach(m =>
      nota(`${nv}: ${NOMES[m]} chegou a ${mus[m]} séries — talvez mereça virar principal`));
  }
}

/* ============ c) direção, curso e enquadramento do desenho ============ */
tit('c) Movimento dos pictogramas articulados');
{
  const rad = g => g*Math.PI/180;
  const gira = (p, pivo, graus) => {
    const a = rad(graus), dx = p[0]-pivo[0], dy = p[1]-pivo[1];
    return [pivo[0] + dx*Math.cos(a) - dy*Math.sin(a),
            pivo[1] + dx*Math.sin(a) + dy*Math.cos(a)];
  };
  /* nós da raiz até a ponta */
  const cadeiaDe = c => { const l=[]; let n=c; while(n){ l.push(n); n=n.f; } return l; };
  /* o SVG aplica o transform do pai sobre tudo que está dentro:
     de dentro para fora.                                              */
  const mover = (nos, ponto) => {
    let p = ponto;
    for(let i = nos.length-1; i >= 0; i--){
      const n = nos[i];
      if(n.p) p = gira(p, n.p, n.r || 0);
      else    p = [p[0] + (n.dx||0), p[1] + (n.dy||0)];
    }
    return p;
  };
  const rumo = (a,b) => {
    const dx=b[0]-a[0], dy=b[1]-a[1], partes=[];
    if(Math.abs(dy)>1) partes.push(dy<0 ? 'sobe' : 'desce');
    if(Math.abs(dx)>1) partes.push(dx<0 ? 'para a esquerda' : 'para a direita');
    return partes.join(' e ') || 'praticamente parado';
  };

  const CURSO_MIN = 3.5;
  const relatorio = [];
  for(const [id, I] of Object.entries(ICO)){
    if(!I.ch || !I.ch.length){ erro(`${id} (${EX[id].nome}) não tem cadeia articulada`); continue; }
    I.ch.forEach((raiz, k) => {
      const nos = cadeiaDe(raiz);
      const ultimo = nos[nos.length-1];
      const segs = ultimo.s || [];
      const rot = `${id}#${k+1}`;
      /* Nó sem segmento e sem junta é uma peça do aparelho que translada —
         a almofada do joelho da panturrilha sentada, por exemplo. O curso é
         o próprio deslocamento, e não há ponta de membro para enquadrar.   */
      if(!segs.length){
        if(ultimo.p){ erro(`${rot}: junta articulada sem nenhum segmento para girar`); return; }
        const d = Math.hypot(ultimo.dx||0, ultimo.dy||0);
        if(d < CURSO_MIN) erro(`${rot} (${EX[id].nome}): peça do aparelho translada só ${d.toFixed(1)} un`);
        else relatorio.push(`${rot.padEnd(8)} ${EX[id].nome.slice(0,34).padEnd(35)} ${d.toFixed(1).padStart(5)} un  ${rumo([0,0],[ultimo.dx||0, ultimo.dy||0])} (peça do aparelho)`);
        return;
      }
      const ponta = segs[segs.length-1].slice(2);      /* [x2,y2] */
      const fim = mover(nos, ponta);
      const curso = Math.hypot(fim[0]-ponta[0], fim[1]-ponta[1]);
      if(curso < CURSO_MIN)
        erro(`${rot} (${EX[id].nome}): a ponta anda só ${curso.toFixed(1)} un — mínimo ${CURSO_MIN}`);
      else if(fim[0] < 0 || fim[0] > 64 || fim[1] < 0 || fim[1] > 64)
        erro(`${rot} (${EX[id].nome}): a ponta sai do quadro em ${fim.map(v=>v.toFixed(1)).join(', ')}`);
      else
        relatorio.push(`${rot.padEnd(8)} ${EX[id].nome.slice(0,34).padEnd(35)} ${curso.toFixed(1).padStart(5)} un  ${rumo(ponta,fim)}`);
    });
  }
  ok(`${relatorio.length} cadeias com curso ≥ ${CURSO_MIN} un e ponta dentro do quadro`);
  if(process.argv.includes('--movimento')){
    console.log('\n  cadeia   exercício                            curso  sentido');
    relatorio.forEach(l => console.log('  '+l));
    console.log('\n  (o sentido é informativo: confira uma vez que cada um bate com o gesto real)');
  }
}

/* ============ d) render num DOM de mentira ============ */
tit('d) Render do app num DOM falso');
(async () => {
  try{
    const vivo = carregarApp({ rodar:true });
    await vivo.pronto;                          /* carregar() é assíncrono */
    const cab  = vivo.escrito['cabecalho'] || '';
    const tela = vivo.escrito['tela'] || '';
    const abas = vivo.doc.getElementById('abas').children.length;
    if(cab.length  <  20) erro('o cabeçalho saiu vazio');          else ok('cabeçalho preenchido');
    if(tela.length < 100) erro('a tela principal saiu vazia');     else ok(`tela principal com ${tela.length} caracteres`);
    if(abas !== 4)        erro(`esperava 4 abas, saíram ${abas}`); else ok('quatro abas montadas');
    if(!/cal|dia|treino/i.test(tela)) nota('a primeira tela não parece a agenda');

    /* As quatro abas, não só a inicial: um erro em telaSemana ou telaAjustes
       só aparece quando alguém toca nelas — ou seja, na academia.          */
    for(const aba of ['agenda','treino','volume','ajustes']){
      try{
        vivo.estado.aba = aba;
        vivo.render();
        const saiu = vivo.escrito['tela'] || '';
        if(saiu.length < 60) erro(`aba "${aba}" renderizou quase nada (${saiu.length} caracteres)`);
        else ok(`aba "${aba}" renderiza (${saiu.length} caracteres)`);
      }catch(e){
        erro(`aba "${aba}" estourou: ${e.message}`);
      }
    }

    /* Com uma sessão registrada, a aba Semana passa pelo caminho que conta
       volume, compara com a semana anterior e monta a nota — o trecho mais
       mexido e o que menos aparece num teste de tela vazia.                */
    try{
      const s = {id:'2026-09-15#1', data:'2026-09-15', nivel:'int', dia:'A', ts:Date.now(), fim:Date.now()};
      vivo.estado.ses[s.id] = s;
      const primeiro = vivo.NIVEIS.int.dias[0].ex[0];
      vivo.estado.reg[`${s.id}|${primeiro.id}|0`] = {kg:'60', reps:'8', ok:true, pr:false};
      vivo.estado.notas = {1:{texto:'suba 2,5 kg no supino', ts:Date.now()}};
      vivo.estado.aba = 'volume'; vivo.estado.semVer = null;
      vivo.render();
      const semana = vivo.escrito['tela'] || '';
      if(!/vbar/.test(semana)) erro('a aba Semana não desenhou nenhuma barra de volume com sessão registrada');
      else ok('aba Semana desenha volume com sessão registrada');
      if(!/nota-sem/.test(semana)) erro('o bloco da resposta do personal não apareceu');
      else ok('bloco da resposta do personal presente');
    }catch(e){
      erro('a aba Semana estourou com sessão registrada: '+e.message);
    }
  }catch(e){
    erro('o app estourou ao carregar: '+e.message);
  }

  /* ============ veredito ============ */
  console.log('\n' + '─'.repeat(64));
  if(falhas) console.log(`\x1b[31m${falhas} falha(s)\x1b[0m` + (avisos?` e ${avisos} aviso(s)`:'') + '. Não publique assim.');
  else       console.log(`\x1b[32mTudo passou\x1b[0m` + (avisos?` — ${avisos} aviso(s) para ler.`:'.'));
  process.exit(falhas ? 1 : 0);
})();
