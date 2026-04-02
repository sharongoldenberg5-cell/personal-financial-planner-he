'use client';

import { useEffect, useRef } from 'react';
import { createClient } from './supabase-client';

const SYNC_KEY = 'financial-planner-last-sync';
const STORAGE_KEY = 'financial-planner-data';

export function useDataSync() {
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;

    async function syncOnLogin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const localData = localStorage.getItem(STORAGE_KEY);
      const hasLocalData = localData && JSON.parse(localData).profile;

      if (hasLocalData) {
        // Push localStorage to DB via API route
        try {
          const state = JSON.parse(localData!);
          await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: state.profile,
              assets: state.assets,
              liabilities: state.liabilities,
              goals: state.goals,
              retirementGoals: state.retirementGoals,
              recommendations: state.recommendations,
            }),
          });
          localStorage.setItem(SYNC_KEY, new Date().toISOString());
        } catch (e) {
          console.warn('[Sync] Push failed:', e);
        }
      }
    }

    syncOnLogin();
  }, []);
}
