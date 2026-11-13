/* Os quatro testes da seção 9 do HANDOFF: integridade dos dados, volume por
   músculo, movimento dos pictogramas e render de todas as telas.
   Rodar: node ferramentas/validar.js                                       */
const { carregarApp, lerHTML } = require('./ambiente.js');

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
  if(!FAIXAS.m27 || FAIXAS.m27[0] !== 10 || FAIXAS.m27[1] !== 20) erro('a faixa do m27 tem de ser 10–20');
  for(const nv of Object.keys(NIVEIS)){
    if(!(nv in FAIXAS)) erro(`${nv} não tem entrada em FAIXAS (use null se for complemento)`);
    const N = NIVEIS[nv];
    ['nome','plano','regras'].forEach(c => { if(typeof N[c] !== 'string' || !N[c]) erro(`${nv}: falta o campo ${c}`); });
    if(!Array.isArray(N.dias) || !N.dias.length){ erro(`${nv}: sem dias`); continue; }
    const idsDia = N.dias.map(d => d.id);
    if(new Set(idsDia).size !== idsDia.length) erro(`${nv}: id de dia repetido`);
    N.dias.forEach(d => { const v = {}; d.ex.forEach(p => { if(v[p.id]) erro(`${nv} ${d.id}: ${p.id} aparece duas vezes`); v[p.id] = 1;
      if(!(p.s > 0 && p.s <= 10) || !p.reps || !p.rir || !(p.desc > 0)) erro(`${nv} ${d.id}: ${p.id} com prescrição incompleta`); }); });
    if(N.agenda) Object.entries(N.agenda).forEach(([w, id]) => { if(!(+w >= 0 && +w <= 6) || !idsDia.includes(id)) erro(`${nv}: agenda padrão aponta para ${w}→${id}`); });
    const mus = {};
    /* dia com extra:true é bônus: fica fora da auditoria */
    NIVEIS[nv].dias.filter(d => !d.extra).forEach(d => d.ex.forEach(p => {
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
  const fs = require('fs'), path = require('path');
  const CHAVE = 'treino-bluefit-v1';
  const txt = h => String(h).replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  try{
    const vivo = carregarApp({ rodar:true, agora:new Date(2026, 10, 12, 18, 30) });   /* quinta */
    await vivo.pronto;                          /* carregar() é assíncrono */
    const tela = () => vivo.escrito['tela'] || '';
    const abas = vivo.escrito['abas'] || '';
    const nAbas = (abas.match(/data-a="aba"/g) || []).length;
    if(tela().length < 300) erro('a tela inicial saiu vazia');   else ok(`tela inicial com ${tela().length} caracteres`);
    if(nAbas !== 4)         erro(`esperava 4 abas, saíram ${nAbas}`); else ok('quatro abas montadas: '+txt(abas));
    if(vivo.estado.aba !== 'hoje') erro('o app vazio não abriu na aba Hoje'); else ok('abre em Hoje');
    if(!/Começar treino/.test(tela())) erro('Hoje não mostra o botão de começar no dia com treino programado');
    else ok('Hoje mostra o treino do dia e o botão de começar');
    if(!/class="fita"/.test(tela())) erro('Hoje sem a fita da semana'); else ok('fita da semana presente');

    /* todas as abas, não só a inicial: um erro em uma tela só aparece quando
       alguém toca nela, ou seja, na academia                                 */
    const passa = (nome, fn, min = 200, alvo = 'tela') => {
      try{
        vivo.escrito[alvo] = '';
        fn();
        const saiu = vivo.escrito[alvo] || '';
        if(saiu.length < min) erro(`${nome} renderizou quase nada (${saiu.length} caracteres)`);
        else if(/undefined|NaN|\[object/.test(txt(saiu))) erro(`${nome} tem "undefined", "NaN" ou "[object" no texto: ${(txt(saiu).match(/.{0,30}(undefined|NaN|\[object).{0,20}/)||[''])[0]}`);
        else ok(`${nome} renderiza (${saiu.length} caracteres)`);
      }catch(e){ erro(`${nome} estourou: ${e.message}`); }
    };
    const A = vivo.ACOES;
    const varrer = rot => {
      passa(rot+'aba Hoje', () => A.aba({v:'hoje'}));
      passa(rot+'aba Agenda', () => A.aba({v:'agenda'}));
      passa(rot+'Agenda, mês anterior', () => A.mes({d:'-1'}));
      A.mes({d:'1'});
      passa(rot+'aba Evolução, semana', () => { A.aba({v:'evolucao'}); A.evo({v:'semana'}); });
      passa(rot+'Evolução, semana anterior', () => A.sem({d:'-1'}));
      passa(rot+'Evolução, mês', () => A.evo({v:'mes'}));
      passa(rot+'Evolução, exercícios', () => A.evo({v:'ex'}), 40);
      A.evo({v:'semana'});
      passa(rot+'aba Programa', () => A.aba({v:'programa'}));
      passa(rot+'Programa, treino aberto', () => A.pdia({dia:vivo.diasDe(vivo.estado.nivel)[0].id}));
      passa(rot+'Ajustes', () => A.aba({v:'ajustes'}));
      const d0 = vivo.diasDe(vivo.estado.nivel)[0];
      passa(rot+'folha: escolher treino do dia', () => vivo.abrirDia(vivo.hoje()), 200, 'folha');
      passa(rot+'folha: dia com todos os programas', () => vivo.abrirDia(vivo.hoje(), true), 200, 'folha');
      passa(rot+'folha: dia futuro', () => vivo.abrirDia('2026-11-20'), 100, 'folha');
      passa(rot+'folha: editor de exercício', () => vivo.abrirEditor(vivo.estado.nivel, d0.id, 0), 200, 'folha');
      passa(rot+'folha: escolher exercício', () => vivo.escolherEx(vivo.estado.nivel, d0.id, null), 200, 'folha');
      passa(rot+'folha: trocar exercício', () => vivo.escolherEx(vivo.estado.nivel, d0.id, d0.ex[0].id), 200, 'folha');
      passa(rot+'folha: como fazer', () => vivo.comoFazer(d0.ex[0].id), 200, 'folha');
      passa(rot+'folha: programas', () => A.progs(), 200, 'folha');
      passa(rot+'folha: regras', () => A.regras(), 200, 'folha');
      passa(rot+'folha: dia da semana', () => A.dsem({w:'3'}), 200, 'folha');
      passa(rot+'folha: backup em texto', () => A.bkpTexto(), 100, 'folha');
      A.fechar();
    };
    varrer('');
    for(const nv of Object.keys(NIVEIS)){
      passa(`programa ${nv}: Hoje + Programa`, () => { vivo.estado.nivel = nv; A.aba({v:'hoje'}); const h = tela(); A.aba({v:'programa'}); vivo.escrito['tela'] = h + tela(); });
      /* todos os exercícios de todos os dias desenham card de treino */
      for(const d of vivo.diasDe(nv)){
        passa(`programa ${nv}, treino ${d.id} em andamento`, () => {
          A.comecar({n:nv, dia:d.id});
          let acum = '';
          d.ex.forEach(p => { vivo.estado.aberto = p.id; vivo.render(); acum += tela(); });
          if(!/class="serie/.test(acum)) throw new Error('nenhuma linha de série desenhada');
          const s = vivo.atual(); A.descartar();
          if(vivo.estado.ses[s.id]) throw new Error('sessão vazia não foi descartada');
          vivo.escrito['tela'] = acum;
        }, 1000);
      }
    }
    vivo.estado.nivel = 'm27';

    /* um treino inteiro: começar, registrar, "não fiz", descanso, encerrar, resumo */
    try{
      A.comecar({n:'m27', dia:'C'});
      const s = vivo.atual(), dia = vivo.diasDe('m27').find(d => d.id === 'C');
      const p0 = dia.ex[0], p1 = dia.ex[1];
      if(!/class="thead/.test(tela()) || !/class="serie/.test(tela())) erro('a tela de treino não desenhou cabeçalho e séries');
      else ok('treino em andamento: cabeçalho, exercício aberto e séries');
      vivo.marcar(p0.id, 0, '27,5', 8);
      const r = vivo.estado.reg[`${s.id}|${p0.id}|0`];
      if(!r || !r.ok || r.kg !== '27.5' || r.reps !== '8') erro('um toque no ✓ não registrou a série (ou a vírgula decimal se perdeu): '+JSON.stringify(r));
      else ok('✓ registra a série e aceita vírgula decimal (27,5 → 27.5)');
      if(!/role="timer"/.test(vivo.escrito['dock'] || '')) erro('o descanso não apareceu na barra depois do ✓');
      else ok('descanso aparece na barra depois do ✓: '+txt(vivo.escrito['dock']).slice(0,60));
      A.pular({ex:p1.id});
      if(!/Aparelho ocupado/.test(vivo.escrito['folha'] || '')) erro('a folha "Não fiz" não listou os motivos');
      A.motivo({ex:p1.id, m:'aparelho ocupado'});
      if(vivo.estado.pulo[`${s.id}|${p1.id}`] !== 'aparelho ocupado') erro('"Não fiz" não gravou o motivo');
      else ok('"Não fiz" grava o motivo');
      A.encerrar({});
      if(vivo.atual().fim) erro('encerrou sem confirmar, faltando séries');
      else if(!/Encerrar agora/.test(vivo.escrito['folha'] || '')) erro('a confirmação de encerrar não apareceu na folha');
      else ok('encerrar com séries faltando pede confirmação dentro da página');
      A.encerrar({sim:'1'});
      const res = tela();
      if(!vivo.atual().fim) erro('o treino não foi encerrado');
      else if(!/toneladas/.test(res) || !/recorde/.test(res) || !/Contra a última vez/.test(res) || !/Não fiz: aparelho ocupado/.test(res)) erro('o resumo saiu incompleto: '+txt(res).slice(0,200));
      else ok('resumo: duração, séries, toneladas, recordes, comparação e o que ficou de fora');
      A.aba({v:'hoje'});
      if(!/Feito hoje/.test(tela())) erro('Hoje não mostra o treino feito'); else ok('Hoje mostra o treino já feito');
      varrer('com histórico: ');
      vivo.estado.notas = {};
      vivo.estado.notas[String(vivo.semanaDe(vivo.hoje()))] = {texto:'suba 2,5 kg no supino', ts:Date.now()};
      A.aba({v:'evolucao'}); A.evo({v:'semana'});
      const semana = tela();
      if(!/vbar/.test(semana)) erro('a Evolução não desenhou nenhuma barra de volume com sessão registrada');
      else ok('Evolução desenha volume com sessão registrada');
      if(!/nota-sem/.test(semana) || !/suba 2,5 kg no supino/.test(semana)) erro('o bloco da resposta do personal não apareceu');
      else ok('bloco da resposta do personal presente, com a nota guardada');
      passa('folha: histórico de um exercício', () => A.exHist({ex:p0.id}), 200, 'folha');
      A.fechar();
    }catch(e){ erro('o roteiro de treino estourou: '+e.message); }
  }catch(e){
    erro('o app estourou ao carregar: '+e.message);
  }

  /* o dado no formato antigo (o que está no celular) tem de abrir e desenhar tudo */
  for(const arq of ['dado-antigo.json', 'backup-real.json']){
    const cam = path.join(__dirname, arq);
    if(!fs.existsSync(cam)){ if(arq === 'backup-real.json') ok('backup-real.json não está na pasta (é opcional e nunca vai para o git)'); continue; }
    try{
      const app = carregarApp({ rodar:true, semente:{ [CHAVE]: fs.readFileSync(cam, 'utf8') }, agora:new Date(2026, 10, 12, 18, 30) });
      await app.pronto;
      let total = 0;
      ['hoje','agenda','evolucao','programa','ajustes'].forEach(a => { app.ACOES.aba({v:a}); total += (app.escrito['tela']||'').length; });
      ['semana','mes','ex'].forEach(v => { app.estado.aba = 'evolucao'; app.ACOES.evo({v}); total += app.escrito['tela'].length; });
      app.estado.mes = '2026-10'; app.estado.aba = 'agenda'; app.render();
      if(!/class="cel[^"]* tem/.test(app.escrito['tela'])) erro(`${arq}: o calendário de outubro não marcou nenhum treino`);
      app.sessoes().forEach(s => { app.ACOES.abrir({s:s.id}); total += app.escrito['tela'].length; if(/undefined|NaN/.test(txt(app.escrito['tela']))) throw new Error('undefined/NaN na sessão '+s.id); });
      ok(`${arq}: todas as telas e as ${app.sessoes().length} sessões antigas desenham (${total} caracteres)`);
    }catch(e){ erro(`${arq}: estourou ao desenhar: ${e.message}`); }
  }

  /* ============ e) regras do arquivo ============ */
  tit('e) Regras do arquivo único');
  {
    const html = lerHTML();
    const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const semComentario = js.replace(/\/\*[\s\S]*?\*\//g, '');
    const proibidos = semComentario.match(/(^|[^.\w$])(alert|confirm|prompt)\s*\(/g);
    if(proibidos) erro('o app usa alert/confirm/prompt: '+proibidos.join(' ')); else ok('sem alert, confirm ou prompt');
    if(/<script[^>]+src=/i.test(html)) erro('há <script src>: o app é arquivo único, sem CDN'); else ok('nenhum script externo');
    if(/fonts\.(googleapis|gstatic)|<link[^>]+stylesheet/i.test(html)) erro('há folha de estilo ou fonte externa'); else ok('nenhuma fonte ou estilo externo');
    if(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket/.test(semComentario)) erro('há chamada de rede no app'); else ok('nenhuma chamada de rede em runtime');
    if(!/color-scheme:\s*dark/.test(html) || !/<meta name="color-scheme" content="dark">/.test(html)) erro('falta declarar color-scheme dark (CSS e meta)'); else ok('tema escuro declarado em :root e na meta');
    if(/prefers-color-scheme:\s*light|data-theme/.test(html)) erro('sobrou bloco de tema claro'); else ok('sem bloco de tema claro');
    if(/#app\s+button\s*\{/.test(html)) erro('voltou a regra "#app button{...}", que anula o estilo dos botões por especificidade'); else ok('sem regra "#app button" anulando botões');
    if(!/prefers-reduced-motion/.test(html)) erro('falta respeitar prefers-reduced-motion'); else ok('prefers-reduced-motion respeitado');
    const tamanho = Buffer.byteLength(html);
    ok(`index.html com ${(tamanho/1024).toFixed(0)} KB`);
  }

  /* ============ veredito ============ */
  console.log('\n' + '─'.repeat(64));
  if(falhas) console.log(`\x1b[31m${falhas} falha(s)\x1b[0m` + (avisos?` e ${avisos} aviso(s)`:'') + '. Não publique assim.');
  else       console.log(`\x1b[32mTudo passou\x1b[0m` + (avisos?`, com ${avisos} aviso(s) para ler.`:'.'));
  process.exit(falhas ? 1 : 0);
})();
