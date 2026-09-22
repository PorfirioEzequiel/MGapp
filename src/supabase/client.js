// import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = 'https://plaglyjhbwmfmkssleie.supabase.co';
// const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWdseWpoYndtZm1rc3NsZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTg5NTIxOSwiZXhwIjoyMDQ3NDcxMjE5fQ._0eOYhlPsxThAx3lxkhxKfZ0Oz-_2uOtsrwpj-J1W7I';
// const supabase = createClient(supabaseUrl, supabaseKey);

// export default supabase;


import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Fetch wrapper con timeout de 15s para evitar requests colgados
const fetchWithTimeout = (url, opts = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  return fetch(url, { ...opts, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
});

// Cliente con service role exclusivamente para Storage/Mercado queries.
// storageKey distinto + sin sesión persistida para evitar deadlock de auth con el cliente principal.
export const supabaseStorage = createClient(
  supabaseUrl,
  process.env.REACT_APP_SUPABASE_SERVICE_KEY,
  {
    global: { fetch: fetchWithTimeout },
    auth: {
      storageKey:       'sb-storage-session',
      persistSession:   false,
      autoRefreshToken: false,
    },
  }
);

export default supabase;
