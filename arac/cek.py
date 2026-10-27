# TırRota — Overture Places'ten işletme kesiti
#
# Kullanım:
#   python cek.py <sürüm> <batı> <güney> <doğu> <kuzey> <çıktı.ndjson>
#   python cek.py 2026-10-21.0 28.2 39.6 30.1 40.7 bursa.ndjson
#
# Gerekli: pip install duckdb   (2.0+; eski "x -> ..." lambda yazımı reddediliyor)
# Sürüm listesi: https://stac.overturemaps.org/catalog.json ("latest")
#
# Lisans: kayıtların çoğu Meta/Microsoft (CDLA-Permissive-2.0), Foursquare
# (Apache-2.0), AllThePlaces (CC0). Haritada "© Overture Maps" atfı gerekir.

import duckdb, sys, time

surum = sys.argv[1]
w, s, e, n = map(float, sys.argv[2:6])
cikti = sys.argv[6]

c = duckdb.connect()
c.sql("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
# Yüzlerce parquet parçası okunuyor; tek bir SSL kopması tüm işi düşürüyordu
c.sql("SET http_retries=10; SET http_retry_wait_ms=2000; SET http_timeout=120000;")
t = time.time()
c.sql(f"""
COPY (
  SELECT id,
         round(bbox.xmin, 6) AS lon, round(bbox.ymin, 6) AS lat,
         names.primary AS ad,
         basic_category AS kat,
         taxonomy.primary AS tax,
         round(confidence, 2) AS guven,
         phones[1] AS tel,
         websites[1] AS web,
         addresses[1].freeform AS adres,
         addresses[1].postcode AS pk,          -- ilçe/il buradan (postakodu.json)
         addresses[1].locality AS yerlesim,
         addresses[1].region AS bolge,
         brand.names.primary AS marka
  FROM read_parquet('s3://overturemaps-us-west-2/release/{surum}/theme=places/type=place/*',
                    hive_partitioning=1)
  WHERE bbox.xmin BETWEEN {w} AND {e} AND bbox.ymin BETWEEN {s} AND {n}
    AND addresses[1].country = 'TR'
    AND coalesce(operating_status, 'open') = 'open'
    AND confidence >= 0.5            -- altı çoğunlukla kapanmış ya da yinelenmiş kayıt
    AND names.primary IS NOT NULL
) TO '{cikti}' (FORMAT json)
""")
adet = c.sql(f"SELECT count(*) FROM read_json('{cikti}')").fetchall()[0][0]
print('süre', round(time.time() - t), 'sn,', adet, 'kayıt')
