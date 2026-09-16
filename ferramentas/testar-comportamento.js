/* Testes das duas correções críticas. Sintaxe boa não prova comportamento.
   Rodar: node ferramentas/testar-comportamento.js                          */
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
  /* ANTES de await: se a trava não existisse, um salvar() aqui já teria gravado vazio */
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

console.log('\n' + '─'.repeat(64));
if(falhas) console.log(`\x1b[31m${falhas} falha(s) de comportamento.\x1b[0m`);
else       console.log('\x1b[32mComportamento conferido.\x1b[0m');
process.exit(falhas ? 1 : 0);

})();
