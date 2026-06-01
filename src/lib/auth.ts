import { supabase, isSupabaseConfigured } from './supabase';

export type StaffRole = 'admin' | 'staff';

export type StaffSession = {
  email: string;
  name: string;
  role: StaffRole;
};

type StaffProfileRow = { full_name: string | null; role: string | null };

type DemoStaffUser = StaffSession & {
  username: string;
  password: string;
};

const DEMO_STAFF_SESSION_KEY = 'zoshley-demo-staff-session';

const demoStaffUsers: DemoStaffUser[] = [
  { username: 'jireh', email: 'jireh@zoshleycoffee.com', password: 'jirehPass', name: 'Jireh', role: 'admin' },
  { username: 'rita', email: 'rita@zoshleycoffee.com', password: 'faithCart', name: 'Rita Bautista', role: 'admin' },
  { username: 'maria', email: 'maria@zoshley.com', password: 'staff123', name: 'Maria Santos', role: 'staff' },
  { username: 'juan', email: 'juan@zoshley.com', password: 'staff456', name: 'Juan dela Cruz', role: 'staff' },
];

export const getDemoSessionFromStorage = (): StaffSession | null => {
  try {
    const raw = window.localStorage.getItem(DEMO_STAFF_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StaffSession;
    if (data.email && data.name && (data.role === 'admin' || data.role === 'staff')) {
      return data;
    }
  } catch {
    return null;
  }
  return null;
};

const saveDemoSession = (session: StaffSession) => {
  window.localStorage.setItem(DEMO_STAFF_SESSION_KEY, JSON.stringify(session));
};

const clearDemoSession = () => {
  window.localStorage.removeItem(DEMO_STAFF_SESSION_KEY);
};

const isJirehAdminIdentity = (email: string, name?: string | null) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name?.trim().toLowerCase();
  return normalizedEmail === 'jireh@gmail.com' || normalizedEmail === 'jireh@zoshleycoffee.com' || normalizedName === 'jireh';
};

const findDemoStaffSession = (loginValue: string, password: string): StaffSession | null => {
  const normalized = loginValue.trim().toLowerCase();
  const user = demoStaffUsers.find(
    (item) =>
      (item.email.toLowerCase() === normalized || item.username.toLowerCase() === normalized) &&
      item.password === password,
  );
  if (!user) return null;
  return { email: user.email, name: user.name, role: user.role };
};

export const isConfigured = isSupabaseConfigured;

export async function signIn(loginValue: string, password: string): Promise<{ session: StaffSession | null; error?: string }> {
  const demoSession = findDemoStaffSession(loginValue, password);
  if (demoSession) {
    if (supabase) {
      await supabase.auth.signOut();
    }
    saveDemoSession(demoSession);
    return { session: demoSession };
  }

  if (!supabase) return { session: null, error: 'Supabase is not configured.' };

  let email = loginValue.trim();
  if (!email.includes('@')) {
    const { data, error } = await supabase.rpc('lookup_staff_email', { login_value: email });
    if (error || !data) {
      if (demoSession) {
        saveDemoSession(demoSession);
        return { session: demoSession };
      }
      return { session: null, error: 'Unknown username. Use the email or a registered username.' };
    }
    email = String(data);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (demoSession) {
      saveDemoSession(demoSession);
      return { session: demoSession };
    }
    return { session: null, error: error?.message ?? 'Sign in failed.' };
  }

  const profile = await getStaffProfile(data.user.id, data.user.email || email);
  if (!profile) {
    await supabase.auth.signOut();
    if (demoSession) {
      saveDemoSession(demoSession);
      return { session: demoSession };
    }
    return { session: null, error: 'This account is not allowed to access the staff console.' };
  }

  return { session: profile };
}

export async function signOut(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
  clearDemoSession();
}

export async function getStaffProfile(userId: string, emailFallback: string): Promise<StaffSession | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('full_name,role').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  const profile = data as StaffProfileRow;
  const role: StaffRole | null = profile.role === 'admin' || profile.role === 'staff' ? (profile.role as StaffRole) : null;
  if (!role) return null;

  const resolvedName = profile.full_name || emailFallback;
  const resolvedRole = isJirehAdminIdentity(emailFallback, resolvedName) ? 'admin' : role;

  return { email: emailFallback, name: resolvedName, role: resolvedRole };
}

export async function getCurrentStaffSession(): Promise<StaffSession | null> {
  const demoSession = getDemoSessionFromStorage();
  if (demoSession) {
    return demoSession;
  }

  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    return null;
  }
  const user = data.session.user;
  return getStaffProfile(user.id, user.email || '');
}

export function onAuthStateChange(cb: (event: string, session: any) => void) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => cb(event, session));
  return () => {
    data.subscription.unsubscribe();
  };
}
