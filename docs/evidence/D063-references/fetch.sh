#!/bin/bash
# D063 reference fetch (2026-10-14): the 20 listing pages from the British Listed Buildings mirror (Historic England answers HTTP 403 to automated requests),
# and one NHLE open-data query for the same 20 List Entry numbers. Pages go to ./pages (not committed; verify.mjs records their SHA-256).
cd "$(dirname "$0")" && mkdir -p pages
IDS="1024866 1355243 1355260 1024813 1320114 1286182 1079481 1294346 1357436 1421847 1259806 1342037 1113172 1242617 1236752 1064659 1405570 1356370 1350342 1208630"
for n in $IDS; do curl -sSL --compressed -m 40 -o "pages/$n.html" -w "$n %{http_code} %{size_download}\n" "https://britishlistedbuildings.co.uk/10$n"; sleep 1; done
LIST=$(echo $IDS | tr ' ' ',')
curl -sSG -m 60 "https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer/0/query" \
  --data-urlencode "where=ListEntry IN ($LIST)" --data-urlencode "outFields=ListEntry,Name,Grade,ListDate,AmendDate,hyperlink" \
  --data-urlencode "returnGeometry=false" --data-urlencode "f=json" -o nhle.json
# then: node verify.mjs && node absent.mjs
