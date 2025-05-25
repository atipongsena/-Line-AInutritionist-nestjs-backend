#!/bin/bash

# สคริปต์แก้ไข linter issues อัตโนมัติ
echo "🔧 กำลังแก้ไข linter issues..."

# แก้ไข ESLint issues ที่สามารถแก้ไขอัตโนมัติได้
echo "📝 แก้ไข ESLint formatting..."
npx eslint src --ext .ts,.tsx --fix

# แก้ไข Prettier formatting
echo "💅 แก้ไข Prettier formatting..."
npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,scss,md}"

# ตรวจสอบ TypeScript
echo "🔍 ตรวจสอบ TypeScript..."
npx tsc --noEmit

echo "✅ เสร็จสิ้น! กรุณาตรวจสอบผลลัพธ์"
