/* Carimba uma versão nova no service worker e só libera se tudo passar.
   O cache é invalidado pelo nome da versão — sem isto, o aparelho fica
   preso na versão que já tem.
   Rodar: node ferramentas/publicar.js                                     */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const SW = path.join(raiz, 'sw.js');

function carimbo(){
  const d = new Date();
  const dia = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const sw = fs.readFileSync(SW, 'utf8');
  const atual = (sw.match(/const VERSAO = '([^']+)'/) || [])[1] || '';
  let n = 1;
  if(atual.startsWith('v'+dia)) n = parseInt(atual.slice(-2), 10) + 1;
  return `v${dia}-${String(n).padStart(2,'0')}`;
}

function rodar(script){
  console.log(`\n\x1b[1m▸ ${script}\x1b[0m`);
  execFileSync(process.execPath, [path.join(__dirname, script)], {stdio:'inherit'});
}

try{
  rodar('validar.js');
  rodar('testar-comportamento.js');
}catch(e){
  console.log('\n\x1b[31mAlgum teste reprovou. Nada foi carimbado.\x1b[0m');
  process.exit(1);
}

const nova = carimbo();
const sw = fs.readFileSync(SW, 'utf8').replace(/const VERSAO = '[^']*'/, `const VERSAO = '${nova}'`);
fs.writeFileSync(SW, sw);

const faltando = ['index.html','sw.js','manifest.webmanifest',
                  'icones/icone-192.png','icones/icone-512.png','icones/icone-mascara-512.png']
  .filter(f => !fs.existsSync(path.join(raiz, f)));

console.log('\n' + '─'.repeat(64));
if(faltando.length){
  console.log('\x1b[31mFaltam arquivos para publicar:\x1b[0m ' + faltando.join(', '));
  process.exit(1);
}
console.log(`\x1b[32mPronto para publicar como ${nova}.\x1b[0m`);
console.log('Suba a pasta inteira (sem .git e sem ferramentas/) para o GitHub Pages.');
console.log('No celular, a versão aparece em Ajustes — confira que virou ' + nova + '.');
