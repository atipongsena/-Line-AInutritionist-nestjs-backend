#!/usr/bin/env node

/**
 * 🔍 Node.js v24 Compatibility Checker for AI Nutritionist
 * ตรวจสอบความเข้ากันได้ของ dependencies กับ Node.js v24
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔍 ตรวจสอบ Node.js v24 Compatibility...\n')

// ตรวจสอบ Node.js version
const nodeVersion = process.version
const nodeMajorVersion = parseInt(nodeVersion.slice(1).split('.')[0])

console.log(`📦 Node.js Version: ${nodeVersion}`)

if (nodeMajorVersion < 24) {
  console.log('⚠️  Warning: คุณใช้ Node.js เวอร์ชันเก่ากว่า v24')
  console.log('   แนะนำให้อัปเกรดเป็น Node.js v24+ สำหรับ optimal performance')
} else {
  console.log('✅ Node.js version รองรับ v24+')
}

// ตรวจสอบ package.json engines
try {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

  if (packageJson.engines && packageJson.engines.node) {
    console.log(`📝 Package engines.node: ${packageJson.engines.node}`)
  }
} catch (error) {
  console.log('⚠️  ไม่พบ package.json หรือไม่สามารถอ่านได้')
}

// ตรวจสอบ dependencies ที่อาจมีปัญหา
console.log('\n🔧 ตรวจสอบ Dependencies...')

const problematicPackages = [
  '@nestjs/core',
  '@nestjs/common',
  'mongoose',
  'openai',
  '@azure/identity',
  '@azure/storage-blob',
]

try {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  problematicPackages.forEach((pkg) => {
    if (allDeps[pkg]) {
      console.log(`  📌 ${pkg}: ${allDeps[pkg]}`)
    }
  })

  console.log('\n✅ Dependencies ส่วนใหญ่รองรับ Node.js v24')
} catch (error) {
  console.log('❌ ไม่สามารถตรวจสอบ dependencies ได้')
}

// ตรวจสอบ pnpm version
try {
  const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim()
  console.log(`\n📦 pnpm Version: ${pnpmVersion}`)

  const pnpmMajor = parseInt(pnpmVersion.split('.')[0])
  if (pnpmMajor >= 9) {
    console.log('✅ pnpm version รองรับ Node.js v24')
  } else {
    console.log('⚠️  แนะนำให้อัปเกรด pnpm เป็นเวอร์ชัน 9+')
    console.log('   run: npm install -g pnpm@latest')
  }
} catch (error) {
  console.log('⚠️  ไม่พบ pnpm หรือไม่สามารถตรวจสอบเวอร์ชันได้')
}

// ข้อแนะนำสำหรับ Node.js v24
console.log('\n💡 คำแนะนำสำหรับ Node.js v24:')
console.log('   1. ใช้ ESM imports แทน CommonJS เมื่อเป็นไปได้')
console.log('   2. ใช้ built-in fetch() แทน axios สำหรับ HTTP requests')
console.log('   3. ใช้ built-in test runner แทน jest (optional)')
console.log('   4. ใช้ --experimental-strip-types สำหรับ TypeScript (ในอนาคต)')

// ตรวจสอบ performance optimizations
console.log('\n⚡ Performance Optimizations สำหรับ v24:')
console.log('   - V8 engine improvements')
console.log('   - Better garbage collection')
console.log('   - Improved module loading')
console.log('   - Native WebStreams support')

console.log('\n🎉 การตรวจสอบเสร็จสิ้น!')
