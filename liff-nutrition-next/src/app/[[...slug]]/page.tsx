import { Metadata } from 'next'
import ClientPage from './client'

// ✅ เพิ่ม metadata สำหรับ SEO
export const metadata: Metadata = {
  title: 'AI Nutritionist - โปรไฟล์ผู้ใช้',
  description: 'จัดการโปรไฟล์และข้อมูลสุขภาพของคุณด้วย AI Nutritionist',
}

// ✅ ลบ generateStaticParams เพื่อให้ใช้ CSR
// export async function generateStaticParams() {
//   return [{ slug: [] }]
// }

// ✅ บังคับใช้ dynamic rendering (CSR)
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ✅ Server Component ที่เรียก Client Component
export default function Page() {
  return <ClientPage />
}
