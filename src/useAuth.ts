import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './utils/supabase';

function clearSupabaseBrowserSession() {
  const stores = [window.localStorage, window.sessionStorage];
  for (const store of stores) {
    const keysToRemove: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (!key) continue;
      if (key.startsWith('sb-') || key.includes('supabase')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => store.removeItem(key));
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function clearInvalidSession() {
      await supabase.auth.signOut({ scope: 'local' });
      clearSupabaseBrowserSession();
      if (!isMounted) return;
      setSession(null);
    }

    async function validateSession(nextSession: Session | null) {
      if (!nextSession) {
        if (isMounted) setSession(null);
        return;
      }
      const { data, error } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (error || !data.user || data.user.id !== nextSession.user.id) {
        await clearInvalidSession();
        return;
      }
      setSession(nextSession);
    }

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (error) {
        setSession(null);
      } else {
        await validateSession(data.session);
      }
      setLoading(false);
    }

    loadSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      if (!nextSession) clearSupabaseBrowserSession();
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
