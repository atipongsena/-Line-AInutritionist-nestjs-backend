import { Metadata } from 'next'
import ClientPage from './client'

// ✅ เพิ่ม metadata สำหรับ SEO
export const metadata: Metadata = {
  title: 'AI Nutritionist - รายงานโภชนาการ',
  description: 'ดูรายงานโภชนาการแบบ real-time รายวัน รายสัปดาห์ และรายเดือน',
}

// ✅ ลบ generateStaticParams เพื่อให้ใช้ CSR
// export async function generateStaticParams() {
//   return [
//     { slug: [] },
//     { slug: ['daily'] },
//     { slug: ['weekly'] },
//     { slug: ['monthly'] },
//   ]
// }

// ✅ บังคับใช้ dynamic rendering (CSR) เพื่อ real-time data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ✅ Server Component ที่เรียก Client Component
export default function Page() {
  return <ClientPage />
}
