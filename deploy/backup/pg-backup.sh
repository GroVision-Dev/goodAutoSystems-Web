#!/usr/bin/env bash
# Optix DB 암호화 백업 (운영 서버 호스트에서 실행)
#
#   BACKUP_PASSPHRASE='...' ./deploy/backup/pg-backup.sh
#
# - docker compose의 db 컨테이너에서 pg_dump(custom 포맷) → AES-256 암호화 → BACKUP_DIR에 저장
# - BACKUP_RETENTION_DAYS(기본 14일)보다 오래된 백업은 삭제
# - 암호 문구(BACKUP_PASSPHRASE)는 서버 밖(비밀번호 관리자 등)에도 반드시 보관할 것. 잃어버리면 복구 불가
#
# 환경변수
#   BACKUP_PASSPHRASE      (필수) 백업 암호 문구
#   BACKUP_DIR             저장 위치 (기본 /var/backups/goodauto)
#   BACKUP_RETENTION_DAYS  보관 일수 (기본 14)
#   PROJECT_DIR            docker-compose.yml이 있는 경로 (기본: 이 스크립트 기준 ../..)
#   BACKUP_OFFSITE_CMD     (선택) 백업 완료 후 실행할 외부 보관 명령. 파일 경로가 $1로 전달된다
#                          예: BACKUP_OFFSITE_CMD='rclone copy "$1" remote:goodauto-backup/'
set -euo pipefail

: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE 환경변수를 설정하세요}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/goodauto}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
export BACKUP_PASSPHRASE

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/goodauto-$timestamp.dump.enc"
tmp="$out.partial"
trap 'rm -f "$tmp"' EXIT

cd "$PROJECT_DIR"

docker compose exec -T db pg_dump -U goodauto -d goodauto --format=custom \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$tmp"

if [[ ! -s "$tmp" ]]; then
  echo "[backup] 실패: 백업 파일이 비어 있습니다." >&2
  exit 1
fi

mv "$tmp" "$out"
chmod 600 "$out"
echo "[backup] 완료: $out ($(du -h "$out" | cut -f1))"

if [[ -n "${BACKUP_OFFSITE_CMD:-}" ]]; then
  bash -c "$BACKUP_OFFSITE_CMD" _ "$out"
  echo "[backup] 외부 보관 명령 실행 완료"
fi

deleted="$(find "$BACKUP_DIR" -maxdepth 1 -name 'goodauto-*.dump.enc' -type f -mtime "+$RETENTION_DAYS" -print -delete | wc -l)"
echo "[backup] ${RETENTION_DAYS}일 경과 백업 ${deleted}개 삭제"
