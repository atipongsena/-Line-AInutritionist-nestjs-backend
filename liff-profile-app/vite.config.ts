import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import fs from 'node:fs'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  let httpsConfig: { key: Buffer; cert: Buffer } | undefined = undefined

  // Check if HTTPS is enabled and cert files are specified and exist
  if (env.HTTPS === 'true' && env.SSL_KEY_FILE && env.SSL_CRT_FILE) {
    const keyPath = path.resolve(process.cwd(), env.SSL_KEY_FILE)
    const certPath = path.resolve(process.cwd(), env.SSL_CRT_FILE)

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      console.log(`[HTTPS] Using SSL certificate: ${certPath}`)
      console.log(`[HTTPS] Using SSL key: ${keyPath}`)
      httpsConfig = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    } else {
      console.warn(
        `[HTTPS] SSL_KEY_FILE or SSL_CRT_FILE specified, but files not found.`,
      )
      console.warn(
        `[HTTPS] Key path: ${keyPath} (exists: ${fs.existsSync(keyPath)})`,
      )
      console.warn(
        `[HTTPS] Cert path: ${certPath} (exists: ${fs.existsSync(certPath)})`,
      )
      console.warn(
        "[HTTPS] Falling back to Vite's default self-signed certificate.",
      )
      // Fallback to Vite's self-signed if files are missing but HTTPS is true
      // To use Vite's built-in, set https: {} or https: true.
      // For explicit fallback here, we can let it be undefined and Vite will use its default if top-level server.https is not false.
      // However, to be more explicit for this fallback path:
      // httpsConfig = {}; // This would enable Vite's self-signed cert explicitly here
    }
  } else if (env.HTTPS === 'true') {
    console.log(
      "[HTTPS] HTTPS=true, but SSL_KEY_FILE or SSL_CRT_FILE not specified. Using Vite's default self-signed certificate.",
    )
    // httpsConfig = {}; // Vite's self-signed
  }

  return {
    plugins: [react()],
    server: {
      port: 3001,
      https: env.HTTPS === 'true' ? httpsConfig || {} : undefined,
      // This should satisfy the type checker expecting an object.
      // Comment out or remove old manual https configurations if they existed
      // hmr: {
      //   protocol: 'wss',
      //   host: 'localhost',
      //   port: 3000,
      // },
      // If you had specific key/cert files, they are no longer needed here
      // for Vite's basic HTTPS.
      // https: {
      //   key: fs.readFileSync('./certs/localhost-key.pem'),
      //   cert: fs.readFileSync('./certs/localhost.pem'),
      // },
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
    // optimizeDeps: {
    //   include: ['@mui/material/Tooltip', '@emotion/styled', '@mui/material/Unstable_Grid2'],
    // },
  }
})
