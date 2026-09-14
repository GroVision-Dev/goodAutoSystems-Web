#!/usr/bin/env bash
# Optix DB 백업 복구 / 복구 테스트 (운영 서버 호스트에서 실행)
#
# 복구 테스트 (기본, 운영 DB는 건드리지 않음):
#   BACKUP_PASSPHRASE='...' ./deploy/backup/pg-restore.sh /var/backups/goodauto/goodauto-YYYYMMDD-HHMMSS.dump.enc
#   → 임시 DB(goodauto_restore_test)에 복원 → 회원·주문·청구서 건수 출력 → 임시 DB 삭제
#
# 실제 복구 (운영 DB 덮어쓰기 — 되돌릴 수 없음):
#   BACKUP_PASSPHRASE='...' ./deploy/backup/pg-restore.sh <백업파일> --target goodauto --yes-i-understand
#   → web 컨테이너를 멈추고 복원한 뒤 다시 기동한다
set -euo pipefail

usage() {
  echo "사용법: $0 <백업파일.dump.enc> [--target goodauto --yes-i-understand]" >&2
  exit 1
}

[[ $# -ge 1 ]] || usage
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE 환경변수를 설정하세요}"
export BACKUP_PASSPHRASE

file="$1"
shift
target="goodauto_restore_test"
confirmed="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) target="${2:-}"; shift 2 ;;
    --yes-i-understand) confirmed="true"; shift ;;
    *) usage ;;
  esac
done

[[ -f "$file" ]] || { echo "백업 파일이 없습니다: $file" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
cd "$PROJECT_DIR"

decrypt() {
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$file"
}

psql_count() {
  docker compose exec -T db psql -U goodauto -d "$1" -At -c \
    'SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Order") AS orders, (SELECT count(*) FROM "Invoice") AS invoices;'
}

if [[ "$target" == "goodauto_restore_test" ]]; then
  cleanup() {
    docker compose exec -T db dropdb -U goodauto --if-exists goodauto_restore_test >/dev/null 2>&1 || true
  }
  trap cleanup EXIT

  echo "[restore-test] 임시 DB에 복원: goodauto_restore_test"
  cleanup
  docker compose exec -T db createdb -U goodauto goodauto_restore_test
  decrypt | docker compose exec -T db pg_restore -U goodauto -d goodauto_restore_test --no-owner --exit-on-error

  echo "[restore-test] 복원본 건수 (회원|주문|청구서): $(psql_count goodauto_restore_test)"
  echo "[restore-test] 운영 DB 건수   (회원|주문|청구서): $(psql_count goodauto)"
  echo "[restore-test] 성공 — 임시 DB는 삭제됩니다."
  exit 0
fi

if [[ "$target" != "goodauto" ]]; then
  echo "--target은 goodauto만 지원합니다." >&2
  exit 1
fi
if [[ "$confirmed" != "true" ]]; then
  echo "운영 DB를 덮어씁니다. 계속하려면 --yes-i-understand 를 함께 지정하세요." >&2
  exit 1
fi

echo "[restore] web 컨테이너 중지"
docker compose stop web
echo "[restore] 운영 DB(goodauto)에 복원"
decrypt | docker compose exec -T db pg_restore -U goodauto -d goodauto --clean --if-exists --no-owner --single-transaction --exit-on-error
echo "[restore] 복원 후 건수 (회원|주문|청구서): $(psql_count goodauto)"
echo "[restore] web 컨테이너 기동"
docker compose start web
echo "[restore] 완료"
