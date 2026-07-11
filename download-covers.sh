#!/usr/bin/env bash
# Downloads a cover for every book into covers/<index>.jpg using only reachable hosts:
#   - covers.openlibrary.org (book covers by ISBN)   -> for known books
#   - Wikimedia Commons (themed images by category)  -> fallback for everything else
set -u
mkdir -p covers

# --- curated ISBNs (index -> ISBN). Misses fall back to a themed image, so guesses are safe. ---
declare -A ISBN=(
  [2]=9781449373320   [3]=9781492040347   [4]=9780321125217   [5]=9780984782857
  [6]=9781449313890   [7]=9780131480056   [8]=9781449316693   [9]=9780321637734
  [11]=9780387310732  [13]=9780471056690  [16]=9780262012430  [17]=9780073327532
  [18]=9780134444284  [20]=9780136053583  [22]=9780201180756  [23]=9780131687288
  [24]=9780133361650  [28]=9780073383095  [29]=9780072899054  [30]=9780201558029
  [33]=9780070430433  [34]=9780073383897  [35]=9781575865577  [37]=9780824779153
  [38]=9780521457613  [55]=9780130422323
)

# --- Wikimedia search term per category ---
declare -A TERM=(
  [sysdesign]="data center servers" [coding]="source code screen" [softeng]="software architecture diagram"
  [systems]="linux operating system" [ml]="artificial neural network" [crypto]="network security"
  [graphics]="3d computer graphics rendering" [image]="digital image processing" [discrete]="graph theory mathematics"
  [theory]="finite automaton diagram" [wireless]="cellular network antenna" [web]="world wide web internet" [code]="computer terminal code"
)
declare -A CNT   # per-category round-robin counter

build_pool() {  # $1 = cat ; writes covers/.pool_$1.txt (list of image URLs)
  local cat="$1" f="covers/.pool_$1.txt"
  [ -s "$f" ] && return 0
  local term="${TERM[$cat]:-computer science}"
  curl -sG "https://commons.wikimedia.org/w/api.php" \
    --data-urlencode "action=query" --data-urlencode "generator=search" \
    --data-urlencode "gsrsearch=$term" --data-urlencode "gsrnamespace=6" \
    --data-urlencode "gsrlimit=16" --data-urlencode "prop=imageinfo" \
    --data-urlencode "iiprop=url" --data-urlencode "iiurlwidth=800" \
    --data-urlencode "format=json" --data-urlencode "origin=*" \
  | python -c "import sys,json,re
d=json.load(sys.stdin)
pages=(d.get('query') or {}).get('pages') or {}
ok=re.compile(r'\.(jpe?g|png|webp|svg)\$',re.I)
for p in pages.values():
    ii=p.get('imageinfo')
    if ii and ii[0].get('thumburl') and ok.search(p.get('title','')):
        print(ii[0]['thumburl'])" > "$f" 2>/dev/null
}

valid() { [ "$(stat -c%s "$1" 2>/dev/null || echo 0)" -gt 2000 ]; }

themed() {  # $1 = index, $2 = cat ; tries successive pool URLs until one is a valid image
  local i="$1" cat="$2" f="covers/.pool_$2.txt"
  build_pool "$cat"
  [ -s "$f" ] || { echo "  [$i] no themed image for $cat"; return 1; }
  local total tries=0 n url
  total=$(wc -l < "$f")
  while [ $tries -lt $total ]; do
    n=$(( ${CNT[$cat]:-0} % total + 1 )); CNT[$cat]=$(( ${CNT[$cat]:-0} + 1 )); tries=$((tries+1))
    url=$(sed -n "${n}p" "$f")
    curl -sL -o "covers/$i.jpg" "$url"
    if valid "covers/$i.jpg"; then echo "  [$i] themed  ($cat)"; return 0; fi
    rm -f "covers/$i.jpg"
  done
  echo "  [$i] themed FAILED ($cat)"; return 1
}

book=0; topic=0; miss=0
while IFS=$'\t' read -r i cat; do
  [ -z "$i" ] && continue
  isbn="${ISBN[$i]:-}"
  if [ -n "$isbn" ]; then
    curl -sL -o "covers/$i.jpg" "https://covers.openlibrary.org/b/isbn/$isbn-L.jpg?default=false"
    if valid "covers/$i.jpg"; then echo "  [$i] BOOK   ($isbn)"; book=$((book+1)); continue; fi
    rm -f "covers/$i.jpg"
  fi
  if themed "$i" "$cat"; then topic=$((topic+1)); else miss=$((miss+1)); fi
done < <(node emit-cats.mjs)

rm -f covers/.pool_*.txt
echo ""
echo "Done: $book book covers, $topic themed images, $miss without image."
ls covers/*.jpg 2>/dev/null | wc -l | xargs echo "Total cover files:"
