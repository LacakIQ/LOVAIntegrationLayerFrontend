import { useCallback, useEffect, useState } from 'react';

export type DefaultCurrency = {
  id: number;
  currency_code: string;
  currency_name: string;
  symbol: string | null;
  decimal_places: number;
};

export function useDefaultCurrency() {
  const [currency, setCurrency] = useState<DefaultCurrency | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    // TODO: Replace this stub with a real call.
    // In DSS this was: supabase.rpc('get_my_default_currency')
    setLoading(true);
    setError(null);
    await new Promise((resolve) => setTimeout(resolve, 50));
    setCurrency(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { currency, loading, error, reload };
}
