import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/debug-env')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            hasUrl: !!process.env.SUPABASE_URL,
            hasService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            hasPub: !!process.env.SUPABASE_PUBLISHABLE_KEY,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      },
    },
  },
});
