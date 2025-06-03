import { Metadata } from 'next'
import ClientPage from './client'

// ✅ เพิ่ม metadata สำหรับ SEO
export const metadata: Metadata = {
  title: 'AI Nutritionist - โปรไฟล์ผู้ใช้',
  description: 'จัดการโปรไฟล์และข้อมูลสุขภาพของคุณด้วย AI Nutritionist',
}

// ✅ ใช้ generateStaticParams สำหรับ static export แต่ client จะ handle dynamics
export async function generateStaticParams() {
  return [
    { slug: [] }, // Root path for profile
  ]
}

// ✅ Static generation + Client-side dynamics
export default function Page() {
  return <ClientPage />
}
