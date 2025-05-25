#!/bin/bash

echo "🔧 Starting LIFF Frontend Linter Fixes..."

# Change to liff-profile-app directory
cd "$(dirname "$0")/.." || exit 1

echo "📂 Current directory: $(pwd)"

# 1. Fix line endings with prettier
echo "🔄 Fixing line endings with Prettier..."
npx prettier --write "src/**/*.{ts,tsx,js,jsx}" --log-level error

# 2. Run ESLint with auto-fix
echo "🔍 Running ESLint auto-fix..."
npx eslint "src/**/*.{ts,tsx}" --fix --max-warnings 0 || echo "⚠️ Some ESLint errors could not be auto-fixed"

# 3. TypeScript type check
echo "📝 Running TypeScript type check..."
npx tsc --noEmit --skipLibCheck

# 4. Check for unused exports
echo "🧹 Checking for unused exports..."
npx ts-unused-exports tsconfig.json --showLineNumber || echo "ℹ️ ts-unused-exports not available"

echo "✅ Linter fixes completed!"
echo ""
echo "📋 Manual fixes may still be needed for:"
echo "  - Complex TypeScript errors"
echo "  - Logic errors in useEffect dependencies"
echo "  - Component prop type mismatches"
echo ""
echo "🔄 Run 'npm run build' to verify all fixes work correctly" 