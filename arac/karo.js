/* TırRota — işletme karoları
   ==========================

   cek.py'nin ürettiği NDJSON'dan z14 vektör karoları (MVT) üretir.

     node isletme/karo.js <girdi.ndjson> <çıktı klasörü>
     node isletme/karo.js bursa.ndjson www/isletme

   Çıktı: <klasör>/14/<x>/<y>.pbf  — tek katman: "isletme"

   Neden yalnız z14: MapLibre z14 karosunu z15-z22'de büyüterek kullanır;
   Google da işletmeleri ancak sokak ölçeğinde gösteriyor. Alt zoomlarda
   karo üretmek dosya sayısını katlıyor, kazancı yok.

   Özellikler kısa adlı — her karoda binlerce kez yineleniyor:
     a  ad          g  grup (renk/simge)   k  Overture kategorisi
     s  sıra (küçük olan önce yerleşir)    t  telefon   w  web   d  adres
*/

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const geojsonVt = require('geojson-vt');
const vtpbf = require('vt-pbf');

const Z = 14;

/* Kategori → grup. Sıra önemli: ilk eşleşen kazanır
   ("gas_station" hem "station" hem "gas" içeriyor). */
const GRUPLAR = [
  ['yakit',   /gas_station|fuel|ev_charging|truck_stop/],
  ['arac',    /automotive|auto_|vehicle|car_|tire|truck|motorcycle|towing|parking/],
  ['market',  /food_and_beverage_store|convenience|grocery|supermarket|butcher|bakery|produce|liquor/],
  ['yemek',   /restaurant|eatery|cafe|coffee|bar$|^bar|pub|food_court|dessert|beverage_venue|tea_/],
  ['saglik',  /pharmacy|hospital|clinic|dental|doctor|medical|diagnostic|health|physician|veterinar/],
  ['konak',   /hotel|lodging|motel|hostel|guest_house|resort|camp/],
  ['finans',  /atm|bank|financial|exchange/],
  ['ibadet',  /worship|mosque|church|synagogue/],
  ['egitim',  /school|education|learning|campus|university|college|kindergarten/],
  ['kamu',    /government|community|police|post_office|fire_station|courthouse/],
  ['dogal',   /park|beach|mountain|plaza|forest|lake|garden|nature|river/],
  ['tarih',   /historic|museum|monument|landmark|attraction/],
  ['alisveris', /store|shop|mall|department|boutique|market/]
];
/* Şoför için önem: küçük olan önce yerleşir, çakışmada o kalır */
const ONEM = { yakit: 0, arac: 1, market: 2, yemek: 2, konak: 2, saglik: 2,
               finans: 3, alisveris: 3, ibadet: 4, kamu: 4, egitim: 5,
               tarih: 5, dogal: 6, hizmet: 6 };

function grupBul(kat, tax) {
  const k = (kat || '') + ' ' + (tax || '');
  for (const [g, re] of GRUPLAR) if (re.test(k)) return g;
  return 'hizmet';
}

async function main() {
  const [girdi, cikti] = process.argv.slice(2);
  if (!girdi || !cikti) { console.error('kullanım: node karo.js <girdi.ndjson> <klasör>'); process.exit(1); }

  /* Önce kayıtları karolara dağıt, sonra her karoyu AYRI işle.
     1,5 milyon noktayı tek geojson-vt dizinine vermek birkaç GB bellek
     istiyor; nokta verisinde komşu karoya taşma olmadığı için buna gerek yok. */
  const n = 1 << Z;
  const kovalar = new Map();
  let adet = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(girdi, 'utf8'), crlfDelay: Infinity });
  for await (const satir of rl) {
    if (!satir.trim()) continue;
    const r = JSON.parse(satir);
    const g = grupBul(r.kat, r.tax);
    /* sıra: grup önemi + güvensizlik; bilinen marka biraz öne */
    const s = ONEM[g] * 100 + Math.round((1 - r.guven) * 100) - (r.marka ? 30 : 0);
    const p = { a: r.ad, g: g, k: r.kat || r.tax || '', s: s };
    if (r.tel) p.t = r.tel;
    if (r.web) p.w = r.web;
    if (r.adres) p.d = r.adres;

    const x = Math.floor((r.lon + 180) / 360 * n);
    const rad = r.lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n);
    const a = x + '/' + y;
    if (!kovalar.has(a)) kovalar.set(a, []);
    kovalar.get(a).push({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: p });
    adet++;
  }
  console.log(adet + ' işletme okundu, ' + kovalar.size + ' karo');

  let bayt = 0, enBuyuk = 0, enKalabalik = 0;
  for (const [a, ozellikler] of kovalar) {
    const [x, y] = a.split('/').map(Number);
    enKalabalik = Math.max(enKalabalik, ozellikler.length);
    const idx = geojsonVt({ type: 'FeatureCollection', features: ozellikler },
      { maxZoom: Z, indexMaxZoom: 0, indexMaxPoints: 0, buffer: 0, tolerance: 0, extent: 4096 });
    const t = idx.getTile(Z, x, y);
    if (!t) continue;
    const buf = Buffer.from(vtpbf.fromGeojsonVt({ isletme: t }, { version: 2 }));
    const klasor = path.join(cikti, String(Z), String(x));
    fs.mkdirSync(klasor, { recursive: true });
    fs.writeFileSync(path.join(klasor, y + '.pbf'), buf);
    bayt += buf.length; enBuyuk = Math.max(enBuyuk, buf.length);
  }
  console.log('toplam ' + (bayt / 1048576).toFixed(1) + ' MB, en büyük karo ' +
              (enBuyuk / 1024).toFixed(0) + ' KB / ' + enKalabalik + ' işletme');
}

main();
