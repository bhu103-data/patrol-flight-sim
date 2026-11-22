#!/usr/bin/env bash
# KhronosGroup official KTX Software 4.4.2 binary, Linux x86_64 CI only.
# SHA-256 verified from an actual successful PATROL CI download.
set -euo pipefail
URL="https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Linux-x86_64.tar.bz2"
EXPECTED="a8781bad05f9624edbf910b7f258cd0a4ba7d3e63b49ecc0a0ab440bf6a0a245"
curl --fail --location --retry 2 --max-time 100 "$URL" -o /tmp/patrol-ktx-4.4.2-linux.tar.bz2
echo "$EXPECTED  /tmp/patrol-ktx-4.4.2-linux.tar.bz2" | sha256sum --check -
mkdir -p /tmp/patrol-ktx-tools
tar -xjf /tmp/patrol-ktx-4.4.2-linux.tar.bz2 -C /tmp/patrol-ktx-tools
KTX_BIN="$(find /tmp/patrol-ktx-tools -type f -name ktx | head -n 1)"
test -n "$KTX_BIN"
chmod +x "$KTX_BIN"
export PATH="$(dirname "$KTX_BIN"):$PATH"
export LD_LIBRARY_PATH="$(find /tmp/patrol-ktx-tools -type f -name 'libktx.so*' -printf '%h\n' | head -n 1)"
ktx --version
# GITHUB_ENV persists PATH and LD_LIBRARY_PATH across job steps; local callers
# should instead source this script (". tools/nyc/install_ktx.sh").
if [[ -n "$GITHUB_ENV" ]]; then
  echo "PATH=$PATH" >> "$GITHUB_ENV"
  echo "LD_LIBRARY_PATH=$LD_LIBRARY_PATH" >> "$GITHUB_ENV"
fi
