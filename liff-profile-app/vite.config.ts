import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 3001,
      // ✅ Azure Static Web Apps จัดการ HTTPS อัตโนมัติ
      // ❌ ลบ development SSL configurations
      // https: จะใช้เฉพาะเมื่อจำเป็นใน development
    },
    define: {
      // Define environment variables to be available in the client-side code
      'import.meta.env.VITE_LIFF_ID': JSON.stringify(env.VITE_LIFF_ID),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        env.VITE_API_BASE_URL,
      ),
      // You can add other environment variables here as needed
    },
    build: {
      outDir: 'build', // Specify the output directory for the build
    },
  }
})
