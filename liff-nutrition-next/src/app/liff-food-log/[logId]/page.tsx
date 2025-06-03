import { Metadata } from 'next'
import ClientPage from './client'

// ✅ เพิ่ม metadata สำหรับ SEO
export const metadata: Metadata = {
  title: 'AI Nutritionist - Food Log',
  description: 'ดูและแก้ไขข้อมูลอาหารใน food log ของคุณ',
}

// ✅ ลบ generateStaticParams เพื่อให้ใช้ CSR
// export async function generateStaticParams() {
//   return [{ logId: 'demo' }]
// }

// ✅ บังคับใช้ dynamic rendering (CSR) สำหรับ dynamic data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ✅ Server Component ที่เรียก Client Component
export default function Page() {
  return <ClientPage />
}
