'use client';

import { useEffect, useRef } from 'react';
import { createClient } from './supabase-client';
import { dbPullAllData, dbPushAllData } from './db-actions';

const SYNC_KEY = 'financial-planner-last-sync';
const STORAGE_KEY = 'financial-planner-data';

export function useDataSync() {
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;

    const supabase = createClient();

    async function syncOnLogin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const lastSync = localStorage.getItem(SYNC_KEY);
      const localData = localStorage.getItem(STORAGE_KEY);
      const hasLocalData = localData && JSON.parse(localData).profile;

      if (!lastSync && hasLocalData) {
        // First time with DB + existing localStorage data → push to DB
        console.log('[Sync] Pushing localStorage to DB...');
        const state = JSON.parse(localData!);
        await dbPushAllData({
          profile: state.profile,
          assets: state.assets,
          liabilities: state.liabilities,
          goals: state.goals,
          retirementGoals: state.retirementGoals,
          recommendations: state.recommendations,
          mortgageReports: state.mortgageReports,
          mislakaReports: state.mislakaReports,
          bankAccounts: state.bankAccounts,
          creditCards: state.creditCards,
        });
        localStorage.setItem(SYNC_KEY, new Date().toISOString());
        console.log('[Sync] Push complete');
      } else if (!lastSync || !hasLocalData) {
        // No local data or first sync → pull from DB
        console.log('[Sync] Pulling from DB...');
        const dbData = await dbPullAllData();
        if (dbData && dbData.profile) {
          const currentState = localData ? JSON.parse(localData) : {};
          const newState = {
            ...currentState,
            profile: dbData.profile,
            assets: dbData.assets?.length ? dbData.assets : currentState.assets || [],
            liabilities: dbData.liabilities?.length ? dbData.liabilities : currentState.liabilities || [],
            goals: dbData.goals?.length ? dbData.goals : currentState.goals || [],
            retirementGoals: dbData.retirementGoals || currentState.retirementGoals || null,
            recommendations: dbData.recommendations?.length ? dbData.recommendations : currentState.recommendations || [],
            mortgageReports: dbData.mortgageReports?.length ? dbData.mortgageReports : currentState.mortgageReports || [],
            mislakaReports: dbData.mislakaReports?.length ? dbData.mislakaReports : currentState.mislakaReports || [],
            bankAccounts: dbData.bankAccounts?.length ? dbData.bankAccounts : currentState.bankAccounts || [],
            creditCards: dbData.creditCards?.length ? dbData.creditCards : currentState.creditCards || [],
            pensionData: dbData.pensionData?.length ? dbData.pensionData : currentState.pensionData || [],
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
          localStorage.setItem(SYNC_KEY, new Date().toISOString());
          console.log('[Sync] Pull complete - reloading...');
          window.location.reload();
        }
      }
    }

    syncOnLogin();
  }, []);
}
