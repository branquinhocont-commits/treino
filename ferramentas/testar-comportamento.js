/* Testes de comportamento: o que sintaxe boa não prova.
   Rodar: node ferramentas/testar-comportamento.js [--backup caminho.json]
   O teste 6 roda sobre ferramentas/dado-antigo.json (sintético, no formato do
   repositório antigo) e, se existir, sobre o backup real: --backup, a variável
   TREINO_BACKUP ou ferramentas/backup-real.json (que nunca vai para o git).  */
const fs = require('fs');
const path = require('path');
const { carregarApp } = require('./ambiente.js');

let falhas = 0;
const ok   = m => console.log('  \x1b[32mok\x1b[0m    '+m);
const erro = m => { falhas++; console.log('  \x1b[31mFALHA\x1b[0m '+m); };
const tit  = t => console.log('\n\x1b[1m'+t+'\x1b[0m');
const CHAVE = 'treino-bluefit-v1';

(async () => {

/* ---- 1. JSON corrompido não pode virar apagamento ---- */
tit('1) Backup corrompido é posto em quarentena, não sobrescrito');
{
  const ruim = '{"reg":{"2026-09-01#1|a1|0":{"kg":"60","reps":"8","ok":tru';  /* truncado */
  const app = carregarApp({ rodar:true, semente:{ [CHAVE]: ruim } });
  await app.pronto;
  const chaves = Object.keys(app.armazem);
  const quarentena = chaves.filter(c => c.startsWith(CHAVE+'.quebrado.'));

  if(!quarentena.length) erro('não guardou cópia do dado corrompido');
  else if(app.armazem[quarentena[0]] !== ruim) erro('a cópia guardada não é byte a byte o original');
  else ok('cópia crua preservada em '+quarentena[0].replace(/\d+$/,'<carimbo>'));

  /* o app segue funcionando, mas sem fingir que os dados eram vazios */
  if(!app.escrito['tela']) erro('o app não conseguiu abrir depois da corrupção');
  else ok('o app abriu mesmo assim, em vez de travar');
}

/* ---- 2. nada é gravado antes da leitura confirmar ---- */
tit('2) A trava de gravação impede escrever antes de ler');
{
  const bom = JSON.stringify({ nivel:'int', reg:{'2026-09-01#1|a1|0':{kg:'60',reps:'8',ok:true}},
                               ses:{'2026-09-01#1':{id:'2026-09-01#1',data:'2026-09-01',nivel:'int',dia:'A',ts:1,fim:1}},
                               inicio:'2026-08-31' });
  const app = carregarApp({ rodar:true, semente:{ [CHAVE]: bom } });
  /* ANTES de await: um toque na tela enquanto a leitura não terminou chama
     salvar(). Sem a trava, isso gravaria o estado vazio por cima do disco.  */
  app.ACOES.evo({v:'mes'});
  const meio = app.armazem[CHAVE];
  await app.pronto;
  const depois = JSON.parse(app.armazem[CHAVE]);

  if(meio !== bom) erro('o disco foi alterado antes de carregar() terminar');
  else ok('disco intacto durante a carga');
  if(Object.keys(depois.reg).length !== 1) erro('o registro existente sumiu no caminho');
  else ok('o registro que estava no disco sobreviveu');
}

/* ---- 3. o descanso sobrevive a fechar e reabrir o app ---- */
tit('3) O descanso é retomado depois de fechar o app');
{
  const fim = Date.now() + 47000;                       /* 47 s à frente */
  const comDescanso = JSON.stringify({
    nivel:'int', reg:{}, ses:{}, inicio:'2026-08-31',
    desc:{ fim, nome:'Remada curvada', avisou:false }
  });
  const app = carregarApp({ rodar:true, semente:{ [CHAVE]: comDescanso } });
  await app.pronto;
  const restante = Math.ceil((app.estado.desc.fim - Date.now())/1000);
  if(!app.estado.desc) erro('o descanso foi perdido na recarga');
  else if(restante < 40 || restante > 48) erro('o restante saiu errado: '+restante+' s');
  else ok(`descanso retomado com ${restante} s — recalculado do relógio, não de um contador`);

  /* um descanso vencido há muito tempo tem de ser descartado */
  const velho = JSON.stringify({ nivel:'int', reg:{}, ses:{}, inicio:'2026-08-31',
    desc:{ fim: Date.now() - 600000, nome:'x', avisou:true } });
  const app2 = carregarApp({ rodar:true, semente:{ [CHAVE]: velho } });
  await app2.pronto;
  if(app2.estado.desc) erro('descanso vencido há 10 min continuou ativo');
  else ok('descanso vencido há muito tempo foi descartado');
}

/* ---- 4. recorde deixa de premiar carga alta com pouca repetição ---- */
tit('4) Recorde considera repetição');
{
  const app = carregarApp();
  const pesado = app.e1rm(20, 5);     /* 20 kg x 5  */
  const volume = app.e1rm(18, 12);    /* 18 kg x 12 */
  if(volume > pesado) ok(`18 kg × 12 (${volume.toFixed(1)}) supera 20 kg × 5 (${pesado.toFixed(1)}), como deve`);
  else erro('a série de mais repetições continua perdendo para a mais pesada');
  if(app.e1rm(50, 0) === 50) ok('série sem repetição anotada cai de volta para a carga');
  else erro('série sem repetição anotada dá resultado estranho');
}

/* ---- 5. a semana começa na segunda ---- */
tit('5) Âncora da semana');
{
  const app = carregarApp();
  const casos = [['2026-09-15','2026-09-14'], ['2026-09-14','2026-09-14'],
                 ['2026-09-13','2026-09-07'], ['2026-09-20','2026-09-14']];
  let bom = true;
  casos.forEach(([entra, sai]) => {
    const r = app.segundaDe(entra);
    if(r !== sai){ bom = false; erro(`segundaDe(${entra}) deu ${r}, esperava ${sai}`); }
  });
  if(bom) ok('segunda, terça, domingo e o domingo seguinte caem na segunda certa');
}

/* ---- 6. o dado antigo abre no app novo sem perder nada ---- */
tit('6) Migração do dado antigo para a versão 3');
{
  const arg = process.argv.indexOf('--backup');
  const real = (arg > 0 && process.argv[arg+1]) || process.env.TREINO_BACKUP || path.join(__dirname, 'backup-real.json');
  const casos = [['dado-antigo.json (sintético)', path.join(__dirname, 'dado-antigo.json')]];
  if(fs.existsSync(real)) casos.push(['backup real ('+path.basename(real)+')', real]);
  else console.log('  \x1b[33maviso\x1b[0m backup real não encontrado: rodando só no dado sintético');

  for(const [nome, cam] of casos){
    const bruto = fs.readFileSync(cam, 'utf8'), antes = JSON.parse(bruto);
    if(antes.versao) { erro(nome+': o arquivo já tem versão, não serve para testar a migração'); continue; }
    const app = carregarApp({ rodar:true, semente:{ [CHAVE]: bruto } });
    await app.pronto;
    const e = app.estado, noDisco = JSON.parse(app.armazem[CHAVE]);

    const sesFaltando = Object.keys(antes.ses).filter(id => !e.ses[id] || !noDisco.ses[id]);
    const sesMudou = Object.keys(antes.ses).filter(id => e.ses[id] && ['id','data','nivel','dia','ts','fim'].some(c => e.ses[id][c] !== antes.ses[id][c]));
    const regFaltando = Object.keys(antes.reg).filter(c => !e.reg[c] || !noDisco.reg[c]);
    const regMudou = Object.keys(antes.reg).filter(c => e.reg[c] && JSON.stringify(e.reg[c]) !== JSON.stringify(antes.reg[c]));
    if(sesFaltando.length) erro(`${nome}: sessões perdidas: ${sesFaltando.join(', ')}`);
    else if(sesMudou.length) erro(`${nome}: sessões alteradas: ${sesMudou.join(', ')}`);
    else ok(`${nome}: ${Object.keys(antes.ses).length} sessões, todas no estado e no disco, sem alteração`);
    if(regFaltando.length) erro(`${nome}: séries perdidas: ${regFaltando.slice(0,5).join(', ')}`);
    else if(regMudou.length) erro(`${nome}: séries alteradas: ${regMudou.slice(0,5).join(', ')}`);
    else ok(`${nome}: ${Object.keys(antes.reg).length} registros de série idênticos, ${Object.values(antes.reg).filter(r=>r.ok).length} feitas`);
    if(Object.keys(e.ses).length !== Object.keys(antes.ses).length || Object.keys(e.reg).length !== Object.keys(antes.reg).length)
      erro(`${nome}: a migração criou sessão ou série que não existia`);

    if(e.nivel !== 'm27' || e.versao !== 3 || noDisco.nivel !== 'm27' || noDisco.versao !== 3) erro(`${nome}: esperava nivel m27 e versao 3, veio ${e.nivel} / ${e.versao}`);
    else ok(`${nome}: programa em uso virou m27 e a versão 3 foi gravada (era "${antes.nivel}")`);
    const niveis = [...new Set(Object.values(e.ses).map(s => s.nivel))];
    if(niveis.some(n => !app.NIVEIS[n])) erro(`${nome}: o histórico aponta para um programa que não existe mais: ${niveis}`);
    else ok(`${nome}: os programas do histórico (${niveis.join(', ')}) continuam existindo`);
    const novos = ['pulo','agenda','aval','checkin','notas'].filter(c => !e[c] || typeof e[c] !== 'object');
    if(novos.length || !e.custom || !e.custom.dias) erro(`${nome}: campos novos não normalizados: ${novos}`);
    else ok(`${nome}: campos novos criados (pulo, agenda, custom, aval, checkin, notas)`);
    if(e.inicio !== antes.inicio) erro(`${nome}: a âncora da semana mudou de ${antes.inicio} para ${e.inicio}`);
    else ok(`${nome}: âncora da semana preservada (${e.inicio})`);

    /* uma vez só: quem escolher outro programa depois não é empurrado de volta */
    const depois = JSON.parse(app.armazem[CHAVE]); depois.nivel = antes.nivel;
    const app2 = carregarApp({ rodar:true, semente:{ [CHAVE]: JSON.stringify(depois) } });
    await app2.pronto;
    if(app2.estado.nivel !== antes.nivel) erro(`${nome}: a migração rodou de novo e trocou o programa escolhido`);
    else ok(`${nome}: segunda abertura não migra de novo (programa escolhido depois continua "${antes.nivel}")`);
    if(Object.keys(app2.estado.reg).length !== Object.keys(antes.reg).length) erro(`${nome}: a segunda abertura perdeu séries`);

    /* as contas batem com o dado cru */
    const cargaCrua = Math.round(Object.values(antes.reg).filter(r=>r.ok).reduce((n,r)=> n+(parseFloat(r.kg)||0)*(parseFloat(r.reps)||0), 0));
    const st = app.statsDe(app.sessoes());
    if(st.feitas !== Object.values(antes.reg).filter(r=>r.ok).length || st.carga !== cargaCrua) erro(`${nome}: as estatísticas não batem: ${st.feitas} séries / ${st.carga} kg contra ${cargaCrua} kg no dado cru`);
    else ok(`${nome}: estatísticas batem com o dado cru (${st.feitas} séries, ${st.carga.toLocaleString('pt-BR')} kg)`);
  }
}

/* ---- 7. meta de carga por progressão dupla ---- */
tit('7) metaDe(): progressão dupla');
{
  const app = carregarApp({ rodar:true, agora:new Date(2026, 10, 11, 12, 0) });
  await app.pronto;
  const e = app.estado;
  const sessao = (id, data, sets) => { e.ses[id] = {id, data, nivel:'m27', dia:'A', ts:+new Date(data+'T10:00:00'), ini:null, fim:1};
    Object.entries(sets).forEach(([ex, lista]) => lista.forEach(([kg, reps], i) => { e.reg[`${id}|${ex}|${i}`] = {kg:String(kg), reps:String(reps), ok:true, pr:false}; })); };
  const A = app.diasDe('m27').find(d => d.id === 'A');
  /* prescrição fixa de 6–8: o teste confere a regra de progressão, não a faixa que o programa usa hoje */
  const A1 = {id:'a1', s:4, reps:'6–8', rir:'2', desc:180};
  const p = id => id === 'a1' ? A1 : A.ex.find(x => x.id === id);
  const igual = (m, kg, reps, sobe, rot) => {
    if(!m || m.kg !== kg || m.reps !== reps || m.sobe !== sobe) erro(`${rot}: esperava ${kg} kg × ${reps}${sobe?' subindo':''}, veio ${m ? m.kg+' × '+m.reps+(m.sobe?' subindo':'') : 'null'}`);
    else ok(`${rot}: ${kg} kg × ${reps}${sobe?' (sobe a carga)':''}`);
  };
  if(app.metaDe(p('a1')) !== null) erro('sem histórico, metaDe devia devolver null'); else ok('sem histórico não há meta (primeira vez)');

  /* a1: supino, 4 × 6–8, músculo grande */
  sessao('2026-11-02#1', '2026-11-02', { a1:[[30,8],[30,8],[30,8],[30,7]] });
  igual(app.metaDe(p('a1')), 30, 8, false, 'uma série abaixo do topo da faixa: mesma carga, busca o topo');
  sessao('2026-11-03#1', '2026-11-03', { a1:[[30,6],[30,6],[30,5]] });
  igual(app.metaDe(p('a1')), 30, 7, false, 'melhor série com 6 de 6–8: mesma carga, uma repetição a mais');
  sessao('2026-11-04#1', '2026-11-04', { a1:[[30,8],[30,8],[30,8],[30,8]] });
  igual(app.metaDe(p('a1')), 35, 6, true, 'topo da faixa em todas, músculo grande: +5 kg e volta ao piso');
  sessao('2026-11-05#1', '2026-11-05', { a1:[[32.5,8],[30,8],[30,8]] });
  igual(app.metaDe(p('a1')), 32.5, 8, false, 'só uma série na carga mais alta: ainda não sobe');
  sessao('2026-11-06#1', '2026-11-06', { a1:[[30,4],[30,3]] });
  igual(app.metaDe(p('a1')), 30, 6, false, 'abaixo do piso: mesma carga, meta no piso da faixa');
  /* a5: elevação lateral, 3 × 12–20, músculo pequeno */
  sessao('2026-11-07#1', '2026-11-07', { a5:[[25,20],[25,20],[25,20]], a1:[[15,8],[15,8],[15,8],[15,8]] });
  igual(app.metaDe(p('a5')), 27.5, 12, true, 'músculo pequeno (ombro): sobe 2,5 kg');
  igual(app.metaDe(p('a1')), 17.5, 6, true, 'carga abaixo de 20 kg: sobe 2,5 kg mesmo em músculo grande');
  const m = app.metaDe(p('a1'), '2026-11-07#1');
  igual(m, 30, 6, false, 'ignorando a sessão em andamento, olha a anterior');

  /* o campo já vem preenchido com a meta, e a série seguinte copia a anterior */
  app.ACOES.comecar({n:'m27', dia:'A'});
  const s = app.atual();
  if(app.sugestao(p('a1'), 0, 'kg', s) !== '17.5' || app.sugestao(p('a1'), 0, 'reps', s) !== '6') erro('a primeira série não veio preenchida com a meta');
  else ok('a primeira série vem preenchida com a meta');
  app.marcar('a1', 0, '20', 7);
  if(app.sugestao(p('a1'), 1, 'kg', s) !== '20' || app.sugestao(p('a1'), 1, 'reps', s) !== '7') erro('a segunda série não copiou a primeira');
  else ok('a série seguinte copia o que foi feito na anterior');
  if(!/value="20"/.test(app.escrito['tela']) ) erro('o campo da tela não mostra a carga sugerida');
}

/* ---- 8. o que fazer hoje ---- */
tit('8) sugerido(): o treino do dia');
{
  /* quarta, 11/11/2026. Semana padrão do m27: seg A, ter B, qui C, sex D */
  const app = carregarApp({ rodar:true, agora:new Date(2026, 10, 11, 12, 0) });
  await app.pronto;
  const e = app.estado, A = app.ACOES;
  const ag = app.agendaDe('m27');
  if(JSON.stringify(ag) !== JSON.stringify({1:'A',2:'B',4:'C',5:'D'})) erro('semana padrão do m27 inesperada: '+JSON.stringify(ag));
  else ok('semana padrão: seg A, ter B, qui C, sex D (extras de fora)');
  const quer = (tipo, dia, rot) => { const g = app.sugerido();
    if(g.tipo !== tipo || (dia !== undefined && (g.dia ? g.dia.id : null) !== dia)) erro(`${rot}: esperava ${tipo} ${dia}, veio ${g.tipo} ${g.dia && g.dia.id}`);
    else ok(`${rot}: ${tipo}${g.dia ? ' '+g.dia.id : ''}`); return g; };
  const g1 = quer('reposicao', 'A', 'quarta sem treino programado, segunda e terça em branco');
  if(g1.de !== '2026-11-09') erro('a reposição não disse de que dia ficou');
  const feito = (data, dia) => { A.comecar({n:'m27', dia, d:data}); const s = app.atual(), p = app.diasDe('m27').find(d=>d.id===dia).ex[0];
    e.reg[`${s.id}|${p.id}|0`] = {kg:'20', reps:'8', ok:true, pr:false}; s.fim = s.ts + 1; e.atual = null; e.aba = 'hoje'; };
  feito('2026-11-09', 'A');
  quer('reposicao', 'B', 'segunda feita, terça em branco');
  feito('2026-11-10', 'B');
  quer('descanso', 'E1', 'semana em dia numa quarta: descanso, oferecendo o extra');
  A.setDsem({w:'3', dia:'C'});
  quer('plano', 'C', 'depois de mover o C para quarta na semana programada');
  if(e.agenda.m27[4]) erro('mover o treino de dia deixou o C em dois dias'); else ok('mover o treino tira do dia antigo');
  A.comecar({n:'m27', dia:'C'});
  e.aba = 'hoje';
  quer('plano', 'C', 'sessão aberta mas sem série nenhuma ainda');
  app.marcar(app.diasDe('m27').find(d=>d.id==='C').ex[0].id, 0, '30', 8);
  quer('aberta', 'C', 'com a primeira série registrada');
  A.encerrar({sim:'1'});
  quer('feito', 'C', 'depois de encerrar');
  app.relogio.t = +new Date(2026, 10, 14, 9, 0);          /* sábado: quinta ficou sem treino, sexta tinha o D */
  quer('reposicao', 'D', 'sábado com o D de sexta em branco');
  A.setDsem({w:'5', dia:''});
  quer('descanso', 'E1', 'tirando o D da semana, sábado vira descanso');
  e.nivel = 'ini';
  const gi = app.sugerido();
  if(gi.tipo !== 'reposicao' || gi.nivel !== 'ini') erro('trocar de programa não trocou a sugestão'); else ok('a sugestão segue o programa em uso ('+gi.dia.id+' do iniciante)');
  /* estrutura pronta para um programa trazer a própria semana padrão */
  app.NIVEIS.m27.agenda = {2:'A', 4:'B', 6:'C', 0:'D'};
  delete e.agenda.m27;
  if(JSON.stringify(app.agendaDe('m27')) !== JSON.stringify({2:'A',4:'B',6:'C',0:'D'})) erro('agendaDe ignorou a agenda padrão do programa');
  else ok('NIVEIS[programa].agenda, quando existe, vira a semana padrão');
}

/* ---- 9. editar o programa ---- */
tit('9) Edição do programa');
{
  const app = carregarApp({ rodar:true, agora:new Date(2026, 10, 11, 12, 0) });
  await app.pronto;
  const e = app.estado, A = app.ACOES;
  const base = JSON.stringify(app.NIVEIS);
  const exA = () => app.diasDe('m27').find(d => d.id === 'A').ex;
  const s0 = exA()[0].s, v0 = app.volumePlanejado('m27'), id0 = exA()[0].id, alvo0 = app.MUSC[id0][0][0];

  A.edS({n:'m27', dia:'A', i:'0', d:'1'});
  if(exA()[0].s !== s0+1) erro('mais uma série não apareceu no programa efetivo'); else ok(`séries de ${id0}: ${s0} → ${s0+1}`);
  if(app.volumePlanejado('m27')[alvo0] !== v0[alvo0]+1) erro('o volume planejado não acompanhou a edição'); else ok(`volume de ${alvo0} recalculado: ${v0[alvo0]} → ${v0[alvo0]+1}`);
  if(!app.diasDe('m27').find(d=>d.id==='A').editado) erro('o dia não foi marcado como editado'); else ok('o dia fica marcado como editado');
  if(JSON.stringify(app.NIVEIS) !== base) erro('a edição alterou o programa base (NIVEIS)'); else ok('o programa base no código não é tocado');
  if(!JSON.parse(app.armazem[CHAVE]).custom.dias['m27|A']) erro('a edição não foi gravada no disco'); else ok('edição gravada em estado.custom.dias["m27|A"]');

  A.edR({n:'m27', dia:'A', i:'0', v:'8–10'}); A.edRir({n:'m27', dia:'A', i:'0', v:'1'}); A.edD({n:'m27', dia:'A', i:'0', d:'15'});
  const x = exA()[0];
  if(x.reps !== '8–10' || x.rir !== '1' || x.desc !== 195) erro('repetições, RIR ou descanso não foram editados: '+JSON.stringify(x)); else ok('repetições, RIR e descanso editáveis');
  for(let n=0;n<20;n++) A.edS({n:'m27', dia:'A', i:'0', d:'1'});
  for(let n=0;n<30;n++) A.edD({n:'m27', dia:'A', i:'0', d:'15'});
  if(exA()[0].s !== 10 || exA()[0].desc !== 300) erro('séries ou descanso passaram do teto'); else ok('teto de 10 séries e 5 min de descanso');

  const segundo = exA()[1].id;
  A.edMove({n:'m27', dia:'A', i:'0', d:'1'});
  if(exA()[0].id !== segundo || exA()[1].id !== id0) erro('descer o exercício não trocou a ordem'); else ok('ordem dos exercícios editável');
  const n0 = exA().length;
  A.addEx({n:'m27', dia:'A'}); A.pick({n:'m27', dia:'A', de:'', novo:'d6'});
  if(exA().length !== n0+1 || exA()[n0].id !== 'd6') erro('adicionar exercício não funcionou'); else ok('adicionar exercício');
  A.trocar({n:'m27', dia:'A', ex:'d6'}); A.pick({n:'m27', dia:'A', de:'d6', novo:'b6'});
  if(exA()[n0].id !== 'b6' || exA().some(p => p.id === 'd6')) erro('trocar exercício não funcionou'); else ok('trocar exercício mantém séries e posição');
  A.edDel({n:'m27', dia:'A', i:String(n0)});
  if(exA().length !== n0+1) erro('remover apagou sem confirmar'); else if(!/Remover/.test(app.escrito['folha']||'')) erro('remover não pediu confirmação'); else ok('remover pede confirmação dentro da página');
  A.edDel({n:'m27', dia:'A', i:String(n0), sim:'1'});
  if(exA().length !== n0) erro('remover confirmado não removeu'); else ok('remover confirmado tira o exercício');

  /* lixo no override (vindo da nuvem ou de backup editado à mão) não derruba o treino */
  e.custom.dias['m27|B'] = [{id:'naoexiste', s:3}, {id:'c2', s:0}, {id:'c2', s:3, reps:'<b>8</b>', rir:'2', desc:90}, {id:'c2', s:4}, null];
  const B = app.diasDe('m27').find(d => d.id === 'B').ex;
  if(B.length !== 1 || B[0].id !== 'c2' || /</.test(B[0].reps)) erro('override inválido não foi filtrado: '+JSON.stringify(B)); else ok('entrada inválida, duplicada ou com HTML é filtrada');
  e.custom.dias['m27|B'] = [{id:'naoexiste', s:3}];
  if(app.diasDe('m27').find(d => d.id === 'B').ex.length !== app.NIVEIS.m27.dias[1].ex.length) erro('override sem nenhum exercício válido devia cair no programa base'); else ok('override sem nada válido cai de volta no programa base');
  delete e.custom.dias['m27|B'];

  /* série registrada não some quando o exercício sai do programa */
  A.comecar({n:'m27', dia:'A'});
  const s = app.atual(), saindo = exA()[0].id;
  app.marcar(saindo, 0, '40', 8); app.marcar(saindo, 1, '40', 8);
  A.trocar({n:'m27', dia:'A', ex:saindo}); A.pick({n:'m27', dia:'A', de:saindo, novo:'d4'});
  const lista = app.exDaSessao(s), fora = lista.find(p => p.id === saindo);
  if(!fora || !fora.fora || fora.s !== 2) erro('as séries do exercício trocado sumiram da sessão');
  else if(app.resumo(s).feitas !== 2 || app.contaSessao(s).ok !== 2) erro('as séries do exercício trocado saíram das contas');
  else ok('séries já feitas de um exercício trocado continuam na sessão e nas contas');

  A.restaurar({dia:'A'});
  if(!e.custom.dias['m27|A']) ok('desfazer edições pede confirmação'); else {}
  A.restaurar({dia:'A', sim:'1'});
  if(e.custom.dias['m27|A'] || JSON.stringify(exA()) !== JSON.stringify(app.NIVEIS.m27.dias[0].ex)) erro('desfazer edições não devolveu o treino original'); else ok('desfazer edições devolve o treino original');
  if(JSON.stringify(app.NIVEIS) !== base) erro('alguma edição vazou para o programa base'); else ok('programa base intacto depois de tudo');
}

/* ---- 10. dentro do treino ---- */
tit('10) Registro de série, recorde e descanso');
{
  const app = carregarApp({ rodar:true, agora:new Date(2026, 10, 12, 18, 0) });
  await app.pronto;
  const e = app.estado, A = app.ACOES;
  e.ses['2026-11-05#1'] = {id:'2026-11-05#1', data:'2026-11-05', nivel:'m27', dia:'C', ts:1, fim:2};
  e.reg['2026-11-05#1|d4|0'] = {kg:'20', reps:'5', ok:true, pr:false};
  A.comecar({n:'m27', dia:'C'});
  const s = app.atual(), p = app.diasDe('m27').find(d=>d.id==='C').ex.find(x=>x.id==='d4');
  app.marcar('d4', 0, '18', 12);
  const r = e.reg[`${s.id}|d4|0`];
  const d = e.desc, noDisco = JSON.parse(app.armazem[CHAVE]).desc;     /* logo depois do primeiro ✓ */
  if(!r.pr) erro('18 kg × 12 depois de 20 kg × 5 devia ser recorde (1RM estimado maior)'); else ok('recorde por 1RM estimado: 18 kg × 12 bate 20 kg × 5');
  app.marcar('d4', 1, '20', 5);
  if(e.reg[`${s.id}|d4|1`].pr) erro('20 kg × 5 marcou recorde só por ter mais carga'); else ok('mais carga com menos repetição não é recorde');
  if(!s.ini || !r.t) erro('a sessão não marcou a hora de início nem a da série'); else ok('relógio da sessão: s.ini e t por série');

  if(!d || Math.abs(d.fim - (app.relogio.t + p.desc*1000)) > 50) erro('o descanso não foi iniciado com a duração do exercício');
  else if(!noDisco || noDisco.fim !== d.fim) erro('o descanso não foi gravado no disco');
  else ok(`descanso de ${p.desc} s iniciado e gravado como instante em estado.desc`);
  A.pularDesc(); app.marcar('d4', 2, '18', 10);
  app.relogio.t += 100000;
  if(app.restante() !== p.desc - 100) erro('o restante não é recalculado do relógio: '+app.restante()); else ok('100 s depois, restam '+app.restante()+' s (recalculado do relógio)');
  A.mais30();
  if(app.restante() !== p.desc - 70) erro('+30 s não somou'); else ok('+30 s soma ao descanso em curso');
  A.pularDesc();
  if(e.desc !== null || JSON.parse(app.armazem[CHAVE]).desc !== null) erro('pular não encerrou o descanso'); else ok('pular encerra o descanso');

  /* desmarcar */
  A.ok({}, { closest:()=> app.linhaFalsa('d4', 1, '20', 5, true) });
  if(e.reg[`${s.id}|d4|1`].ok) erro('tocar de novo no ✓ não desmarcou'); else ok('tocar de novo no ✓ desmarca a série');

  /* passo proporcional */
  const passos = [[0,2.5],[27.5,2.5],[30,5],[95,5],[100,10],[140,10]];
  if(passos.some(([v,q]) => app.passoDe(v) !== q)) erro('passo do botão + fora do padrão 2,5 / 5 / 10'); else ok('passo do + proporcional: 2,5 até 30 kg, 5 até 100 kg, 10 acima');
  if(app.passoPara(30,-1) !== 2.5 || app.passoPara(100,-1) !== 5 || app.passoPara(30,1) !== 5) erro('descendo de 30 kg o passo devia ser 2,5'); else ok('descendo de 30 kg o − usa o passo da faixa de baixo (30 → 27,5)');

  /* treino vazio pode ser descartado; com série, nunca */
  A.encerrar({sim:'1'});
  const comSerie = s.id;
  A.comecar({n:'m27', dia:'D'});
  const vazia = app.atual().id;
  A.encerrar({});
  if(!/Sair sem registrar/.test(app.escrito['folha']||'')) erro('encerrar treino vazio não ofereceu sair sem registrar'); else ok('treino sem série oferece sair sem registrar');
  A.descartar();
  if(e.ses[vazia]) erro('a sessão vazia não foi descartada'); else ok('sessão vazia descartada');
  e.atual = comSerie; A.descartar();
  if(!e.ses[comSerie]) erro('descartar apagou uma sessão com série registrada'); else ok('descartar nunca apaga sessão com série');
}

/* ---- 11. PWA × dentro do Claude ---- */
tit('11) Fora do Claude (PWA) e dentro do Claude');
{
  const pwa = carregarApp({ rodar:true, agora:new Date(2026, 10, 12, 18, 0) });
  await pwa.pronto;
  const ver = (app, aba) => { app.ACOES.aba({v:aba}); return app.escrito['tela']; };
  const evo = ver(pwa, 'evolucao'), aj = ver(pwa, 'ajustes');
  if(pwa.temClaude()) erro('temClaude() verdadeiro sem window.claude');
  if(/Pedir avaliação/.test(evo) || /Nuvem/.test(aj)) erro('o PWA mostra coisa que depende do Claude'); else ok('PWA esconde nuvem e "Pedir avaliação"');
  if(!/Copiar relatório para o Claude/.test(evo) || !/Colar a resposta do personal/.test(evo)) erro('o PWA não mostra copiar relatório e colar resposta'); else ok('PWA mostra "Copiar relatório para o Claude" e "Colar a resposta do personal"');
  if(!/Baixar arquivo de backup/.test(aj) || !/Restaurar de um arquivo/.test(aj) || !/Versão/.test(aj)) erro('Ajustes do PWA sem backup em arquivo ou versão'); else ok('Ajustes: baixar e restaurar backup em arquivo, versão do app');

  /* sem share e sem clipboard, o relatório aparece para copiar à mão */
  await pwa.entregarTexto('RELATÓRIO X', 'Relatório', 'copiado');
  if(!/RELATÓRIO X/.test(pwa.escrito['folha']||'')) erro('sem share nem clipboard, o texto não foi mostrado'); else ok('sem share nem clipboard, mostra o texto para copiar');

  /* colar a resposta: guarda na semana e entra no relatório da seguinte */
  const sem = pwa.semanaDe(pwa.hoje());
  pwa.estado.aba = 'evolucao'; pwa.ACOES.evo({v:'semana'});
  pwa.ACOES.colar({k:'S'+sem});
  pwa.doc.getElementById('notaTxt').value = 'Suba 2,5 kg no supino <b>já</b>';
  pwa.ACOES.guardarNota({k:'S'+sem});
  const n = pwa.estado.notas[String(sem)];
  if(!n || n.texto !== 'Suba 2,5 kg no supino <b>já</b>' || !n.ts) erro('a resposta colada não foi guardada em estado.notas[semana]');
  else ok(`resposta guardada em estado.notas[${sem}]`);
  if(!/nota-sem/.test(pwa.escrito['tela']) || !/Suba 2,5 kg no supino &lt;b&gt;já/.test(pwa.escrito['tela'])) erro('a resposta não aparece na tela (ou apareceu sem escapar o HTML)');
  else ok('resposta exibida no bloco nota-sem, com HTML escapado');
  if(!/O QUE VOCÊ RECOMENDOU NA SEMANA/.test(pwa.textoRelatorio(sem+1)) || !/Suba 2,5 kg/.test(pwa.textoRelatorio(sem+1))) erro('o relatório da semana seguinte não leva a resposta anterior');
  else ok('o relatório da semana seguinte sai com a resposta dentro');
  pwa.ACOES.evo({v:'mes'}); pwa.ACOES.colar({k:'M2026-11'});
  pwa.doc.getElementById('notaTxt').value = 'fechamento'; pwa.ACOES.guardarNota({k:'M2026-11'});
  if(!pwa.estado.notas['M2026-11']) erro('a resposta do mês não foi guardada'); else ok('resposta do mês guardada em estado.notas["M2026-11"]');

  /* dentro do Claude: banco falso */
  const banco = {};
  const mk = p => ({ async get(){ const d = banco[p]; return {id:p.split('/').pop(), exists:!!d, data:()=>d}; }, async set(v){ banco[p] = JSON.parse(JSON.stringify(v)); } });
  const db = { doc:mk, collection:c => ({ limit(){ return this; }, async get(){ return {docs:Object.keys(banco).filter(k2=>k2.startsWith(c+'/')).map(k2=>({id:k2, exists:true, data:()=>banco[k2]}))}; }, doc:id => mk(c+'/'+id) }) };
  const dentro = carregarApp({ rodar:true, agora:new Date(2026, 10, 12, 18, 0), claude:{ use:async n => n === 'db' ? db : null },
                               semente:{ [CHAVE]: fs.readFileSync(path.join(__dirname, 'dado-antigo.json'), 'utf8') } });
  await dentro.pronto;
  await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
  for(let n=0; n<50 && !banco['app/meta']; n++) await new Promise(r => setImmediate(r));
  const evo2 = ver(dentro, 'evolucao'), aj2 = ver(dentro, 'ajustes');
  if(!dentro.temClaude() || !/Pedir avaliação/.test(evo2) || !/Nuvem/.test(aj2)) erro('dentro do Claude faltou nuvem ou "Pedir avaliação"'); else ok('dentro do Claude: status de nuvem e "Pedir avaliação"');
  const subiu = Object.keys(banco).filter(k2 => k2.startsWith('sessoes/')).length;
  if(subiu !== Object.keys(dentro.estado.ses).length || !banco['app/meta'] || banco['app/meta'].nivel !== 'm27') erro(`a nuvem recebeu ${subiu} sessões de ${Object.keys(dentro.estado.ses).length}`);
  else ok(`dentro do Claude as ${subiu} sessões sobem para o banco, com o programa m27`);
}

/* ---- 12. backup ---- */
tit('12) Restaurar backup');
{
  const app = carregarApp({ rodar:true, agora:new Date(2026, 10, 12, 18, 0) });
  await app.pronto;
  app.ACOES.comecar({n:'m27', dia:'A'}); app.marcar('a1', 0, '30', 8);
  const meu = JSON.stringify(app.estado);
  const antigo = fs.readFileSync(path.join(__dirname, 'dado-antigo.json'), 'utf8');
  if(app.aplicarBackup('{"isto não é json') !== false || app.aplicarBackup('{"ses":{}}') !== false || app.aplicarBackup('[1,2]') !== false) erro('backup inválido foi aceito');
  else if(Object.keys(app.estado.reg).length !== 1) erro('backup inválido mexeu no estado');
  else ok('conteúdo inválido é recusado sem tocar no estado');
  app.aplicarBackup(antigo);
  const guarda = Object.keys(app.armazem).filter(c => c.startsWith(CHAVE+'.antes-de-restaurar.'));
  if(!guarda.length || JSON.parse(app.armazem[guarda[0]]).reg[Object.keys(JSON.parse(meu).reg)[0]] === undefined) erro('o estado anterior não foi guardado antes de restaurar');
  else ok('estado anterior guardado em '+guarda[0].replace(/\d+$/,'<carimbo>'));
  const a = JSON.parse(antigo);
  if(Object.keys(app.estado.reg).length !== Object.keys(a.reg).length || app.estado.versao !== 3 || app.estado.nivel !== 'm27') erro('o backup antigo não foi restaurado e migrado');
  else ok('backup no formato antigo é restaurado e migrado para a versão 3');
  if(JSON.parse(app.armazem[CHAVE]).versao !== 3) erro('a restauração não foi gravada'); else ok('restauração gravada no disco');
  const volta = app.aplicarBackup(app.armazem[guarda[0]]);
  if(!volta || Object.keys(app.estado.reg).length !== 1) erro('não deu para voltar ao estado guardado'); else ok('a cópia de segurança restaura de volta');
}

console.log('\n' + '─'.repeat(64));
if(falhas) console.log(`\x1b[31m${falhas} falha(s) de comportamento.\x1b[0m`);
else       console.log('\x1b[32mComportamento conferido.\x1b[0m');
process.exit(falhas ? 1 : 0);

})();
