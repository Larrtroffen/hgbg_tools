#!/usr/bin/env bash
# pre-commit 包装：在 IDE 等环境下加载 nvm/fnm 找到 node，再跑 lint-staged
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 尝试加载 nvm（需 bash，sh 下 nvm 不生效）
if [ -f "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
  [ -f "$ROOT/.nvmrc" ] && (cd "$ROOT" && nvm use --silent 2>/dev/null || true)
fi
# 尝试加载 fnm
if [ -f "$HOME/.local/share/fnm/env" ]; then
  source "$HOME/.local/share/fnm/env" 2>/dev/null || true
fi
# 常见路径
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/*/bin:$PATH"

NODE=""
if command -v node >/dev/null 2>&1; then
  NODE="$(command -v node)"
fi
if [ -z "$NODE" ] && [ -d "$HOME/.nvm/versions/node" ]; then
  # nvm 已加载但 which 没找到时，用 .nvmrc 版本
  V="$(cat "$ROOT/.nvmrc" 2>/dev/null | tr -d ' \n')"
  if [ -n "$V" ] && [ -d "$HOME/.nvm/versions/node/v$V" ]; then
    NODE="$HOME/.nvm/versions/node/v$V/bin/node"
  fi
  [ -z "$NODE" ] && NODE="$(find "$HOME/.nvm/versions/node" -name node -type f 2>/dev/null | head -1)"
fi
if [ -z "$NODE" ]; then
  echo "pre-commit: node not found, skip lint-staged"
  exit 0
fi
exec "$NODE" "$ROOT/node_modules/lint-staged/bin/lint-staged.js"
