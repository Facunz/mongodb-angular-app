// Importa la función para crear cliente de Supabase
import { createClient } from '@supabase/supabase-js';
// Configuración de Supabase con URL y clave anónima del proyecto
const SUPABASE_URL = 'https://pihwdxrshvassqcrmafz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpaHdkeHJzaHZhc3NxY3JtYWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNTU4NDMsImV4cCI6MjA3MTgzMTg0M30.xWtVWRVzNmnexQOh7AeoX0-ZyyAGTydM8ktDWOzGk74';
// Cliente de Supabase configurado para evitar problemas con Navigator LockManager
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: {
		persistSession: false,    // No persiste la sesión en localStorage
		autoRefreshToken: false,  // No renueva automáticamente el token
	},
	realtime: {
		params: {
			eventsPerSecond: 2,     // Limita a 2 eventos por segundo para mejorrendimiento
		},
	},
});
