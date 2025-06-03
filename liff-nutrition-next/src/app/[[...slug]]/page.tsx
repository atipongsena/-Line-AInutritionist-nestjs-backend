// Import main App component from client.tsx
import App from './client'

// This is a catch-all route page.
// It ensures that all paths are handled by the client-side React application initially.
export function generateStaticParams() {
  // Required for static export if you have dynamic segments,
  // for a pure SPA-like setup, returning an empty slug for the root is common.
  return [{ slug: [''] }]
}

export default function Page() {
  // This Server Component will render the ClientComponent,
  // which will then take over rendering the rest of the application client-side.
  return <App />
}
