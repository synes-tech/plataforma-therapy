#!/bin/bash
# ============================================================
# Security Headers Validation Script
# Agente Segurança (6) - Section 5.2: Headers de Segurança
#
# Usage: ./tests/security/check-headers.sh https://your-domain.com
# ============================================================

URL=${1:-"http://localhost:5173"}
ERRORS=0

echo "🔒 Unithery — Security Headers Check"
echo "Target: $URL"
echo "=========================================="

check_header() {
  local header_name=$1
  local expected_value=$2
  local actual_value=$(curl -sI "$URL" | grep -i "^$header_name:" | cut -d' ' -f2- | tr -d '\r')

  if [ -z "$actual_value" ]; then
    echo "❌ MISSING: $header_name"
    ERRORS=$((ERRORS + 1))
  elif [ -n "$expected_value" ] && [[ "$actual_value" != *"$expected_value"* ]]; then
    echo "⚠️  MISMATCH: $header_name = $actual_value (expected: $expected_value)"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ $header_name: $actual_value"
  fi
}

# Critical headers
check_header "Strict-Transport-Security" "max-age="
check_header "X-Content-Type-Options" "nosniff"
check_header "X-Frame-Options" "DENY"
check_header "Content-Security-Policy" ""
check_header "Referrer-Policy" ""

# Check for leaked headers (should NOT be present)
server_header=$(curl -sI "$URL" | grep -i "^Server:" | cut -d' ' -f2- | tr -d '\r')
if [ -n "$server_header" ]; then
  echo "⚠️  Server header exposed: $server_header (consider removing)"
fi

x_powered=$(curl -sI "$URL" | grep -i "^X-Powered-By:" | cut -d' ' -f2- | tr -d '\r')
if [ -n "$x_powered" ]; then
  echo "❌ X-Powered-By header exposed: $x_powered (REMOVE THIS)"
  ERRORS=$((ERRORS + 1))
fi

echo "=========================================="
if [ $ERRORS -eq 0 ]; then
  echo "✅ All security headers OK"
  exit 0
else
  echo "❌ $ERRORS issues found"
  exit 1
fi
