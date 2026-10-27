# TırRota — işletme karoları

TırRota navigasyon uygulamasının haritada gösterdiği işletmelerin vektör karoları
(`14/<x>/<y>.pbf`, Mapbox Vector Tile, katman adı `isletme`).

Veri: [Overture Maps Foundation](https://overturemaps.org) Places teması —
Meta, Microsoft (CDLA-Permissive-2.0), Foursquare (Apache-2.0), AllThePlaces (CC0).
© Overture Maps

Üretim: TırRota deposundaki `isletme/cek.py` ve `isletme/karo.js`.

## Güncelleme

`.github/workflows/guncelle.yml` her ayın 27'sinde en son Overture sürümünü çekip
karoları yeniden üretir. Elle çalıştırmak için: **Actions → İşletme karoları → Run workflow**.
Depo geçmişi tek kayıtta tutulur (her ay yeni karolar eskisinin yerine geçer).
