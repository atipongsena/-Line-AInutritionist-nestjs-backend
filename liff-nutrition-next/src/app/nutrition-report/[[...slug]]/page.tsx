import { Metadata } from 'next'
import ClientPage from './client'

// ✅ เพิ่ม metadata สำหรับ SEO
export const metadata: Metadata = {
  title: 'AI Nutritionist - รายงานโภชนาการ',
  description: 'ดูรายงานโภชนาการแบบ real-time รายวัน รายสัปดาห์ และรายเดือน',
}

// ✅ ปิด generateStaticParams เพื่อให้ใช้ CSR (Client-Side Rendering)
// export async function generateStaticParams() {
//   return [
//     { slug: [] }, // /nutrition-report
//     { slug: ['daily'] }, // /nutrition-report/daily
//     { slug: ['weekly'] }, // /nutrition-report/weekly
//     { slug: ['monthly'] }, // /nutrition-report/monthly
//   ]
// }

// ✅ Static generation + Client-side real-time data fetching
export default function Page() {
  return <ClientPage />
}
