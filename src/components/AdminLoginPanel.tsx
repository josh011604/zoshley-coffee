import React from 'react';

type StaffRole = 'admin' | 'staff';

type LoginForm = {
  login: string;
  password: string;
};

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
};

type AdminLoginPanelProps = {
  selectedLoginRole: StaffRole | null;
  loginForm: LoginForm;
  error: string;
  loading: boolean;
  staffList: StaffRow[];
  onRoleSelect: (role: StaffRole) => void;
  onLoginFormChange: (field: keyof LoginForm, value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onChooseOtherRole: () => void;
};

const AdminLoginPanel: React.FC<AdminLoginPanelProps> = ({
  selectedLoginRole,
  loginForm,
  error,
  loading,
  staffList,
  onRoleSelect,
  onLoginFormChange,
  onSubmit,
  onReset,
  onChooseOtherRole,
}) => {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
      <h2 className="font-display text-3xl text-cream">
        {selectedLoginRole ? `Sign in as ${selectedLoginRole === 'admin' ? 'Admin' : 'Staff'}` : 'Choose your access role'}
      </h2>
      <p className="mt-2 text-sm text-cream/70">
        {selectedLoginRole ? 'Enter your credentials to access the right dashboard.' : 'Select an admin or staff account to continue.'}
      </p>

      {!selectedLoginRole ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onRoleSelect('admin')}
            className="rounded-[1.75rem] border border-white/10 bg-black/20 p-6 text-left transition hover:border-gold/30"
          >
            <p className="text-sm uppercase tracking-[0.3em] text-cream/45">Admin</p>
            <h3 className="mt-4 text-2xl font-semibold text-cream">Admin dashboard access</h3>
            <p className="mt-3 text-sm text-cream/70">Full site control with orders, inventory, staff, and metrics.</p>
          </button>
          <button
            type="button"
            onClick={() => onRoleSelect('staff')}
            className="rounded-[1.75rem] border border-white/10 bg-black/20 p-6 text-left transition hover:border-gold/30"
          >
            <p className="text-sm uppercase tracking-[0.3em] text-cream/45">Staff</p>
            <h3 className="mt-4 text-2xl font-semibold text-cream">Staff dashboard access</h3>
            <p className="mt-3 text-sm text-cream/70">Team management and operational tools for staff users.</p>
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="mt-6 space-y-4"
        >
          {error ? <div className="rounded-2xl bg-red-600/20 p-4 text-sm text-red-100">{error}</div> : null}

          <label className="block text-sm text-cream/70">
            <span className="font-semibold text-cream">Username or email</span>
            <input
              value={loginForm.login}
              onChange={(e) => onLoginFormChange('login', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none focus:border-gold/60"
            />
          </label>

          <label className="block text-sm text-cream/70">
            <span className="font-semibold text-cream">Password</span>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => onLoginFormChange('password', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none focus:border-gold/60"
            />
          </label>

          {staffList.filter((account) => account.role === selectedLoginRole).length ? (
            <div className="rounded-3xl border border-white/10 bg-black/10 p-4 text-sm text-cream/70">
              <p className="font-semibold text-cream">Suggested {selectedLoginRole} accounts</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {staffList
                  .filter((account) => account.role === selectedLoginRole)
                  .map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => onLoginFormChange('login', account.email)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm text-cream transition hover:border-gold/30"
                    >
                      <p className="font-semibold text-cream">{account.name}</p>
                      <p className="text-cream/60">{account.email}</p>
                    </button>
                  ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-gold px-5 py-3 font-semibold text-coffee-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" onClick={onReset} className="rounded-full border border-white/10 px-5 py-3 text-sm text-cream/70">
              Reset
            </button>
            <button type="button" onClick={onChooseOtherRole} className="rounded-full border border-white/10 px-5 py-3 text-sm text-cream/70">
              Choose another role
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

export default AdminLoginPanel;
