import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ccyphaoatigvkgktutsy.supabase.co'
const supabaseAnonKey = 'sb_publishable_mxjyYtYZAcoZNDhowb9J6A_5SsYn7tS'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)