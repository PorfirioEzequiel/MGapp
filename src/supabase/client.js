import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plaglyjhbwmfmkssleie.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWdseWpoYndtZm1rc3NsZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTg5NTIxOSwiZXhwIjoyMDQ3NDcxMjE5fQ._0eOYhlPsxThAx3lxkhxKfZ0Oz-_2uOtsrwpj-J1W7I';
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;