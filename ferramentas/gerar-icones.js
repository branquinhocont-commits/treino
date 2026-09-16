/* Gera os PNG do manifest a partir do mesmo desenho do <link rel=icon>:
   barra branca com anilhas amarelas sobre o fundo --ground.
   Sem dependência externa — PNG escrito na mão com zlib do próprio Node.
   Rodar: node ferramentas/gerar-icones.js                                  */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const GROUND = [0x0B, 0x0D, 0x10];
const INK    = [0xF4, 0xF6, 0xF8];
const SINAL  = [0xFF, 0xD4, 0x47];

/* o ícone em coordenadas 0..64, igual ao SVG que já está no index.html */
const TRACOS = [
  { x1:14, y1:32, x2:50, y2:32, w:5, cor:INK   },
  { x1:16, y1:22, x2:16, y2:42, w:5, cor:INK   },
  { x1:48, y1:22, x2:48, y2:42, w:5, cor:INK   },
  { x1: 9, y1:26, x2: 9, y2:38, w:5, cor:SINAL },
  { x1:55, y1:26, x2:55, y2:38, w:5, cor:SINAL }
];

const AA = 3;                                    /* supersampling por eixo */

function distSeg(px, py, x1, y1, x2, y2){
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx*dx + dy*dy;
  let t = len2 ? ((px-x1)*dx + (py-y1)*dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t*dx, cy = y1 + t*dy;
  return Math.hypot(px-cx, py-cy);
}

/* cantos arredondados r=14 no espaço 0..64 */
function dentroDoFundo(px, py, lado){
  const r = 14 * lado / 64;
  const x = Math.min(px, lado-px), y = Math.min(py, lado-py);
  if(x < 0 || y < 0) return false;
  if(x >= r || y >= r) return true;
  return Math.hypot(r-x, r-y) <= r;
}

function desenhar(lado, escalaArte){
  const buf = Buffer.alloc(lado * lado * 4);
  const esc = lado / 64;
  const centro = lado / 2;
  for(let y = 0; y < lado; y++){
    for(let x = 0; x < lado; x++){
      let fundo = 0, acum = [0,0,0], cob = 0;
      for(let sy = 0; sy < AA; sy++) for(let sx = 0; sx < AA; sx++){
        const px = x + (sx + 0.5)/AA, py = y + (sy + 0.5)/AA;
        if(dentroDoFundo(px, py, lado)) fundo++;
        /* leva o ponto para o espaço da arte, respeitando a zona segura */
        const ax = ((px - centro) / escalaArte + centro) / esc;
        const ay = ((py - centro) / escalaArte + centro) / esc;
        for(const t of TRACOS){
          if(distSeg(ax, ay, t.x1, t.y1, t.x2, t.y2) <= t.w/2){
            acum[0] += t.cor[0]; acum[1] += t.cor[1]; acum[2] += t.cor[2];
            cob++; break;
          }
        }
      }
      const amostras = AA*AA;
      const alfaFundo = fundo / amostras;
      const p = (y*lado + x) * 4;
      if(alfaFundo === 0){ buf[p+3] = 0; continue; }
      const mistura = cob / amostras;
      const arte = cob ? [acum[0]/cob, acum[1]/cob, acum[2]/cob] : [0,0,0];
      for(let c = 0; c < 3; c++)
        buf[p+c] = Math.round(GROUND[c]*(1-mistura) + arte[c]*mistura);
      buf[p+3] = Math.round(255 * alfaFundo);
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
  ['icone-192.png',           192, 1.00],
  ['icone-512.png',           512, 1.00],
  ['icone-mascara-512.png',   512, 0.62]   /* zona segura de 20% para Android */
];
for(const [nome, lado, escala] of saidas){
  const arq = path.join(destino, nome);
  fs.writeFileSync(arq, png(lado, desenhar(lado, escala)));
  console.log('gravado', nome, fs.statSync(arq).size, 'bytes');
}
