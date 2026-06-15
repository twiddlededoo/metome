import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/hooks/cleanup-uploads')({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

          // Find sessions uploaded more than 15 minutes ago
          const { data: sessions, error } = await supabaseAdmin
            .from('upload_sessions')
            .select('session_id')
            .not('uploaded_at', 'is', null)
            .lt('uploaded_at', cutoff);

          if (error) {
            console.error('cleanup-uploads: query error', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
          }

          let removedFiles = 0;
          let removedSessions = 0;

          for (const s of sessions ?? []) {
            try {
              const { data: list } = await supabaseAdmin.storage
                .from('encrypted-uploads')
                .list(s.session_id);
              if (list && list.length) {
                const paths = list.map((o) => `${s.session_id}/${o.name}`);
                await supabaseAdmin.storage.from('encrypted-uploads').remove(paths);
                removedFiles += paths.length;
              }
            } catch (e) {
              console.warn('cleanup-uploads: storage cleanup failed for', s.session_id, e);
            }
            const { error: delErr } = await supabaseAdmin
              .from('upload_sessions')
              .delete()
              .eq('session_id', s.session_id);
            if (!delErr) removedSessions++;
          }

          return new Response(
            JSON.stringify({ success: true, removedSessions, removedFiles, cutoff }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        } catch (e: any) {
          console.error('cleanup-uploads: unexpected error', e);
          return new Response(JSON.stringify({ error: e?.message ?? 'unknown' }), { status: 500 });
        }
      },
    },
  },
});
