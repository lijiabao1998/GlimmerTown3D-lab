#!/bin/bash
# D064 reference fetch (2026-10-14, lead's own re-fetch): the candidate listing pages from the British Listed Buildings mirror
# (Historic England answers HTTP 403 to automated requests) and one NHLE open-data query for the same List Entry numbers.
# Pages go to ./pages (git-ignored; verify.mjs records their SHA-256). IDs come from claims.json.
cd "$(dirname "$0")" && mkdir -p pages
IDS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('claims.json','utf8')).candidates.map(c=>c.nhle).join(' '))")
for n in $IDS; do curl -sSL --compressed -m 40 -o "pages/$n.html" -w "$n %{http_code} %{size_download}\n" "https://britishlistedbuildings.co.uk/10$n"; sleep 1; done
LIST=$(echo $IDS | tr ' ' ',')
curl -sSG -m 60 "https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer/0/query" \
  --data-urlencode "where=ListEntry IN ($LIST)" --data-urlencode "outFields=ListEntry,Name,Grade,ListDate,AmendDate,hyperlink" \
  --data-urlencode "returnGeometry=false" --data-urlencode "f=json" -o nhle.json
# then: node verify.mjs && node absent.mjs
