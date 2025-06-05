import { Metadata } from 'next'
import ClientPage from './client'

// ✅ เพิ่ม metadata สำหรับ SEO
export const metadata: Metadata = {
  title: 'AI Nutritionist - Food Log',
  description: 'ดูและแก้ไขข้อมูลอาหารใน food log ของคุณ',
}

// ✅ ปิด generateStaticParams เพื่อให้ใช้ CSR (Client-Side Rendering)
// export async function generateStaticParams() {
//   return [
//     { logId: 'demo' }, // Demo food log
//   ]
// }

// ✅ Static generation + Client-side dynamic data fetching
export default function Page() {
  return <ClientPage />
}
