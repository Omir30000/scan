
import { createClient } from '@supabase/supabase-js';
import { RegistroProducao } from '../types';

const SUPABASE_URL = 'https://ezgnraljtezheoiqbfly.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GIsuUKO3XQ97q-9zbEJ2rw_B_p4HaeQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const saveRecord = async (data: RegistroProducao) => {
  const { error } = await supabase
    .from('registros_producao')
    .insert([data]);
  
  if (error) throw error;
  return true;
};
