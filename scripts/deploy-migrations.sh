#!/bin/bash
# ============================================================
# Unithery — Apply All Migrations to Remote
# Usage: ./scripts/deploy-migrations.sh
# ============================================================

set -e

echo "🗃️  Applying migrations to remote database..."
supabase db push

echo ""
echo "✅ All migrations applied!"
echo ""
echo "Migrations applied:"
ls -1 supabase/migrations/*.sql | while read f; do
  echo "  ✓ $(basename $f)"
done
