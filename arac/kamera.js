/* TırRota — Türkiye sabit hız kameraları (OSM highway=speed_camera)
 *
 * Uygulamaya bir kez gömülmüş 1.413 kameralık liste hiç güncellenmiyordu;
 * yeni kurulan kameralar uyarılmıyordu (27 Ekim 2026). Ayda bir Geofabrik
 * Türkiye özütünden üretilip GitHub Pages'ten veriliyor; telefon indirir,
 * gömülü liste internetsiz durum için yedek kalır.
 *
 * Girdi : osmium export -f geojsonseq (nokta) çıktısı
 * Çıktı : kamera/kameralar.json  { "s": "<tarih>", "k": [[enlem, boylam, sınır, tırSınırı], ...] }
 *         sınır 0 = kayıtta yok (gömülü listeyle aynı biçim)
 *
 * kullanım: node kamera.js girdi.geojsonseq cikisKlasoru
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const [girdi, cikis] = process.argv.slice(2);
const sinir = v => {
  const n = parseInt(String(v || '').trim(), 10);
  return (n >= 5 && n <= 150 && !/mph/i.test(String(v))) ? n : 0;
};

const kayit = [];
const gorulen = new Set();
const rl = readline.createInterface({ input: fs.createReadStream(girdi) });
rl.on('line', satir => {
  satir = satir.replace(/^\x1e/, '').trim();
  if (!satir) return;
  let f;
  try { f = JSON.parse(satir); } catch (e) { return; }
  if (!f.geometry || f.geometry.type !== 'Point') return;
  const p = f.properties || {};
  if (p.highway !== 'speed_camera') return;
  const lat = +f.geometry.coordinates[1].toFixed(5), lon = +f.geometry.coordinates[0].toFixed(5);
  const a = lat + ',' + lon;
  if (gorulen.has(a)) return;
  gorulen.add(a);
  kayit.push([lat, lon, sinir(p.maxspeed), sinir(p['maxspeed:hgv'])]);
});
rl.on('close', () => {
  const klasor = path.join(cikis, 'kamera');
  fs.mkdirSync(klasor, { recursive: true });
  kayit.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  fs.writeFileSync(path.join(klasor, 'kameralar.json'),
    JSON.stringify({ s: new Date().toISOString().slice(0, 10), k: kayit }));
  console.log(kayit.length + ' kamera');
});
