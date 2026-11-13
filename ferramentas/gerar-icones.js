/* Gera os PNG do manifest a partir do mesmo desenho do <link rel=icon>:
   uma anilha olímpica vermelha (o treino A, 25 kg) vista de frente, com o
   sulco, o miolo de aço e o furo, sobre o grafite do app.
   Sem dependência externa: PNG escrito na mão com zlib do próprio Node.
   Rodar: node ferramentas/gerar-icones.js                                  */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const FUNDO = [0x13, 0x14, 0x17];

/* a anilha em coordenadas 0..64, de fora para dentro: cada disco cobre o anterior */
const DISCOS = [
  { r:23.0, cor:[0xE5, 0x46, 0x3C] },      /* borracha vermelha */
  { r:21.4, cor:[0xC4, 0x3B, 0x33] },      /* aro externo, mais escuro */
  { r:20.2, cor:[0xE5, 0x46, 0x3C] },
  { r:16.0, cor:[0xBD, 0x38, 0x30] },      /* sulco */
  { r:13.0, cor:[0xE5, 0x46, 0x3C] },
  { r: 9.6, cor:[0x8E, 0x92, 0x98] },      /* borda do miolo */
  { r: 9.0, cor:[0xC9, 0xCC, 0xD1] },      /* miolo de aço */
  { r: 6.6, cor:[0xB4, 0xB8, 0xBE] },
  { r: 6.0, cor:[0xC9, 0xCC, 0xD1] },
  { r: 4.0, cor:[0x0C, 0x0D, 0x0F] }       /* furo */
];

const AA = 4;                                    /* supersampling por eixo */

/* cantos arredondados r=14 no espaço 0..64 */
function dentroDoFundo(px, py, lado){
  const r = 14 * lado / 64;
  const x = Math.min(px, lado-px), y = Math.min(py, lado-py);
  if(x < 0 || y < 0) return false;
  if(x >= r || y >= r) return true;
  return Math.hypot(r-x, r-y) <= r;
}

/* quadrado=true: sem canto arredondado (o Android recorta o ícone maskable) */
function desenhar(lado, escalaArte, quadrado){
  const buf = Buffer.alloc(lado * lado * 4);
  const esc = lado / 64;
  const centro = lado / 2;
  for(let y = 0; y < lado; y++){
    for(let x = 0; x < lado; x++){
      let fundo = 0; const acum = [0,0,0];
      for(let sy = 0; sy < AA; sy++) for(let sx = 0; sx < AA; sx++){
        const px = x + (sx + 0.5)/AA, py = y + (sy + 0.5)/AA;
        if(quadrado || dentroDoFundo(px, py, lado)) fundo++;
        /* leva o ponto para o espaço da arte, respeitando a zona segura */
        const ax = ((px - centro) / escalaArte + centro) / esc;
        const ay = ((py - centro) / escalaArte + centro) / esc;
        const d = Math.hypot(ax - 32, ay - 32);
        let cor = FUNDO;
        for(const disco of DISCOS) if(d <= disco.r) cor = disco.cor;
        acum[0] += cor[0]; acum[1] += cor[1]; acum[2] += cor[2];
      }
      const amostras = AA*AA;
      const p = (y*lado + x) * 4;
      if(fundo === 0){ buf[p+3] = 0; continue; }
      for(let c = 0; c < 3; c++) buf[p+c] = Math.round(acum[c] / amostras);
      buf[p+3] = Math.round(255 * fundo / amostras);
    }
  }
  return buf;
}

/* ---- PNG ---- */
const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for(let n = 0; n < 256; n++){
    let c = n;
    for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf){
  let c = -1;
  for(let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function bloco(tipo, dados){
  const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([tam, corpo, crc]);
}
function png(lado, rgba){
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const linhas = Buffer.alloc(lado * (lado*4 + 1));
  for(let y = 0; y < lado; y++){
    linhas[y * (lado*4 + 1)] = 0;                       /* filtro: nenhum */
    rgba.copy(linhas, y*(lado*4+1) + 1, y*lado*4, (y+1)*lado*4);
  }
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    bloco('IHDR', ihdr),
    bloco('IDAT', zlib.deflateSync(linhas, {level: 9})),
    bloco('IEND', Buffer.alloc(0))
  ]);
}

const destino = path.join(__dirname, '..', 'icones');
const saidas = [
  ['icone-192.png',           192, 1.00, false],
  ['icone-512.png',           512, 1.00, false],
  ['icone-mascara-512.png',   512, 0.90, true]    /* zona segura para o recorte do Android */
];
for(const [nome, lado, escala, quadrado] of saidas){
  const arq = path.join(destino, nome);
  fs.writeFileSync(arq, png(lado, desenhar(lado, escala, quadrado)));
  console.log('gravado', nome, fs.statSync(arq).size, 'bytes');
}
