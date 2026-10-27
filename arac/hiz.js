/* TırRota — TIR'a özel hız limitleri (OSM maxspeed:hgv) hücre dosyaları
 *
 * Uygulama bunu her rotada Overpass'e soruyordu; ücretsiz Overpass
 * sunucuları sık sık 504 / zaman aşımı veriyor (27 Ekim 2026 denetimi).
 * Ayda bir Geofabrik Türkiye özütünden üretip GitHub Pages'ten veriyoruz.
 *
 * Girdi : osmium export -f geojsonseq çıktısı (maxspeed:hgv taşıyan yollar)
 * Çıktı : hiz/<enlem*2>_<boylam*2>.json  — 0,5°'lik hücreler
 *         [[limit, [[enlem, boylam], ...]], ...]
 *         Bir yol değdiği her hücreye yazılır.
 *
 * kullanım: node hiz.js girdi.geojsonseq cikisKlasoru
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const [girdi, cikis] = process.argv.slice(2);
const hucre = {};
let yol = 0;

const rl = readline.createInterface({ input: fs.createReadStream(girdi) });
rl.on('line', satir => {
  satir = satir.replace(/^\x1e/, '').trim();
  if (!satir) return;
  let f;
  try { f = JSON.parse(satir); } catch (e) { return; }
  if (!f.geometry || f.geometry.type !== 'LineString') return;
  const limit = parseInt((f.properties || {})['maxspeed:hgv'], 10);
  if (!limit || limit < 5 || limit > 150) return;
  const pts = f.geometry.coordinates.map(c => [+c[1].toFixed(5), +c[0].toFixed(5)]);
  if (pts.length < 2) return;
  const kayit = [limit, pts];
  const anahtarlar = new Set(pts.map(p => Math.floor(p[0] * 2) + '_' + Math.floor(p[1] * 2)));
  anahtarlar.forEach(a => (hucre[a] = hucre[a] || []).push(kayit));
  yol++;
});
rl.on('close', () => {
  const klasor = path.join(cikis, 'hiz');
  fs.mkdirSync(klasor, { recursive: true });
  let bayt = 0;
  Object.keys(hucre).forEach(a => {
    const metin = JSON.stringify(hucre[a]);
    bayt += metin.length;
    fs.writeFileSync(path.join(klasor, a + '.json'), metin);
  });
  fs.writeFileSync(path.join(klasor, 'hucreler.json'), JSON.stringify(Object.keys(hucre)));
  console.log(yol + ' yol, ' + Object.keys(hucre).length + ' hücre, ' + Math.round(bayt / 1024) + ' KB');
});
