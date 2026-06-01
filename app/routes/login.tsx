import { useState } from 'react';
import { useNavigate } from 'react-router';
import { allUsernames, getUser, saveSession } from '../auth';

export default function LoginPage() {
  const [selected, setSelected] = useState('');
  const navigate = useNavigate();
  const names = allUsernames();
  const user = selected ? getUser(selected) : null;

  function handleContinue() {
    if (!user) return;
    saveSession(user);
    navigate(user.role === 'admin' ? '/admin' : '/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] flex items-start justify-center pt-20"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-[420px] bg-white border border-[#e8e8e4] rounded-2xl px-10 py-11 shadow-sm">
        <div className="text-xl font-semibold text-gray-900 mb-1 tracking-tight">
          📋 EDD Tracker
        </div>
        <div className="text-sm text-gray-400 mb-8">Select your profile to continue</div>

        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:border-gray-400 mb-4"
        >
          <option value="">— select —</option>
          {names.map(n => <option key={n}>{n}</option>)}
        </select>

        {user && (
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-semibold mx-auto mb-3">
              {user.avatar}
            </div>
            <div className="text-base font-semibold text-gray-900">{user.displayName}</div>
            <div className="text-xs uppercase tracking-widest text-gray-400 mt-1">
              {user.role === 'admin' ? 'Administrator' : 'Team Member'}
            </div>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!user}
          className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {user ? `Continue as ${user.displayName} →` : 'Select a profile'}
        </button>
      </div>
    </div>
  );
}