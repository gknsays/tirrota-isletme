/* TırRota — işletme arama dizini
   ==============================

   cek.py'nin NDJSON'undan ADLA ARAMA için bölge dosyaları üretir.

     node isletme/dizin.js <girdi.ndjson> <çıktı klasörü> [sürüm]
     -> <klasör>/ara/<z>/<x>/<y>.json  ve  <klasör>/ara/liste.json

   Neden ayrı: z14 karoları yalnız ekrandaki alanı taşıyor; şoför ise
   "Bim Depo Kestel" yazıp 40 km ötedeki depoyu arıyor. Telefon bulunduğu
   bölgenin dosyasını bir kez indirip saklıyor, aradığı yoksa komşulara bakıyor.

   Bölgeler UYARLANIR: z9 (~70 km) ile başlar, dosya 1,2 MB'ı geçerse dört
   parçaya bölünür (z10, z11, …). Bursa şehri z9'da 5 MB çıkıyordu; İstanbul
   bunun katları. Hangi bölgenin hangi zoomda olduğu liste.json'da.

   Biçim (kısa tutuldu, GitHub Pages gzip'liyor):
     liste.json  { "s": "<sürüm>", "b": ["9/297/193", "10/595/386", ...] }
     bölge       { "k": [[ad, enlem, boylam, kategori, "sokak, İlçe/İl"], ...] }
*/

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ILK_Z = 9, SON_Z = 13;
/* posta kodu → [ilçe, il] (turkey-neighbourhoods, MIT, PTT verisi) */
const POSTA = JSON.parse(fs.readFileSync(path.join(__dirname, 'postakodu.json'), 'utf8'));
const AZAMI_BAYT = 1.2 * 1048576;

function karo(lat, lon, z) {
  const n = 1 << z;
  const x = Math.floor((lon + 180) / 360 * n);
  const r = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  return [x, y];
}

async function main() {
  const [girdi, cikti, surum] = process.argv.slice(2);
  if (!girdi || !cikti) { console.error('kullanım: node dizin.js <girdi.ndjson> <klasör> [sürüm]'); process.exit(1); }

  const kayitlar = [];
  const rl = readline.createInterface({ input: fs.createReadStream(girdi, 'utf8'), crlfDelay: Infinity });
  for await (const satir of rl) {
    if (!satir.trim()) continue;
    const r = JSON.parse(satir);
    /* Adresten yalnız son iki parça (mahalle, ilçe) — şubeleri ayırt etmeye
       yetiyor. Tam adres ve telefon dosyayı iki katına çıkarıyordu; onlar
       haritadaki z14 karosunda zaten var. */
    const parca = String(r.adres || '').split(',').map(s => s.trim())
      .filter(s => s && !/^türkiye$/i.test(s) && !/^\d{5}$/.test(s));
    /* "İlçe/İl" — şoför aynı adlı yerleri ancak böyle ayırt ediyor
       (27 Ekim 2026). Posta kodu varsa PTT tablosundan kesin; yoksa
       Overture'un yerleşim/bölge alanı. */
    const pk = String(r.pk || '').trim();
    const pi = POSTA[pk];
    const yer = pi ? pi[0] + '/' + pi[1]
      : [r.yerlesim, r.bolge].filter(x => x && !/^TR-/i.test(x)).filter((x, i, a) => a.indexOf(x) === i).join('/');
    const sokak = parca.length ? parca[0] : '';
    kayitlar.push([r.ad, +r.lat.toFixed(5), +r.lon.toFixed(5), r.kat || r.tax || '',
                   [sokak, yer].filter(Boolean).join(', ')]);
  }

  const bolgeler = [];
  let bayt = 0, enBuyuk = 0;
  const yaz = (z, x, y, k) => {
    const metin = JSON.stringify({ k: k });
    if (metin.length > AZAMI_BAYT && z < SON_Z) {
      const alt = new Map();
      for (const r of k) {
        const a = karo(r[1], r[2], z + 1).join('/');
        if (!alt.has(a)) alt.set(a, []);
        alt.get(a).push(r);
      }
      for (const [a, kk] of alt) { const [ax, ay] = a.split('/').map(Number); yaz(z + 1, ax, ay, kk); }
      return;
    }
    const klasor = path.join(cikti, 'ara', String(z), String(x));
    fs.mkdirSync(klasor, { recursive: true });
    fs.writeFileSync(path.join(klasor, y + '.json'), metin);
    bolgeler.push(z + '/' + x + '/' + y);
    bayt += metin.length; enBuyuk = Math.max(enBuyuk, metin.length);
  };

  const ilk = new Map();
  for (const r of kayitlar) {
    const a = karo(r[1], r[2], ILK_Z).join('/');
    if (!ilk.has(a)) ilk.set(a, []);
    ilk.get(a).push(r);
  }
  for (const [a, k] of ilk) { const [x, y] = a.split('/').map(Number); yaz(ILK_Z, x, y, k); }

  fs.writeFileSync(path.join(cikti, 'ara', 'liste.json'), JSON.stringify({ s: surum || '', b: bolgeler.sort() }));
  console.log(kayitlar.length + ' işletme, ' + bolgeler.length + ' bölge, toplam ' + (bayt / 1048576).toFixed(1) +
              ' MB, en büyük ' + (enBuyuk / 1048576).toFixed(2) + ' MB');
}

main();
