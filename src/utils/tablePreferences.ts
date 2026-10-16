import { supabase } from './supabase'

export type ColumnStickinessMap = Record<string, 'left' | 'right' | null>

export type TablePreferencesRow = {
  id: number
  user_id: string
  table_key: string
  column_visibility: Record<string, boolean>
  column_order: string[]
  column_stickiness: ColumnStickinessMap
  page_size: number | null
  sort_state: unknown
  filter_state: unknown
}

export async function loadTablePreferences(tableKey: string, userId: string | null) {
  if (!userId) return { row: null as TablePreferencesRow | null, userId: null as string | null }

  const { data, error } = await supabase
    .from('user_table_preferences')
    .select('id, user_id, table_key, column_visibility, column_order, column_stickiness, page_size, sort_state, filter_state')
    .eq('user_id', userId)
    .eq('table_key', tableKey)
    .maybeSingle()

  if (error) return { row: null as TablePreferencesRow | null, userId }
  return { row: (data as TablePreferencesRow | null) ?? null, userId }
}

export async function upsertTablePreferences(
  userId: string | null,
  tableKey: string,
  patch: Partial<Pick<TablePreferencesRow, 'column_visibility' | 'column_order' | 'column_stickiness' | 'page_size' | 'sort_state' | 'filter_state'>>,
) {
  if (!userId) return { error: new Error('Not authenticated') }

  const { error } = await supabase.from('user_table_preferences').upsert(
    {
      user_id: userId,
      table_key: tableKey,
      ...patch,
    },
    { onConflict: 'user_id,table_key' },
  )

  return { error: error ?? null }
}
