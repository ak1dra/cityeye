import { useState } from 'react';
import { verifyCompletion } from '../api';

const VERDICT_CFG = {
  VERIFIED:   { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', iconBg: 'bg-green-100', icon: '\u2713', label: 'AI: Проблема устранена' },
  SUSPICIOUS: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', iconBg: 'bg-amber-100', icon: '?',     label: 'AI: Требует проверки' },
  NOT_FIXED:  { bg: 'bg-red-50',   border: 'border-red-300',   text: 'text-red-700',   iconBg: 'bg-red-100',   icon: '\u2717', label: 'AI: Проблема не устранена' },
  LOADING:    { bg: 'bg-sky-50',   border: 'border-sky-300',   text: 'text-sky-700',   iconBg: 'bg-sky-100',   icon: '\u25CB', label: 'AI проверяет фото...' },
};

export function VerifyBadge({ beforeUrl, afterUrl, type, description, existingVerdict }) {
  const [result, setResult] = useState(existingVerdict || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runVerify() {
    if (!beforeUrl || !afterUrl) return;
    setLoading(true);
    setError(null);
    try {
      const data = await verifyCompletion({ before_url: beforeUrl, after_url: afterUrl, type, description });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!beforeUrl || !afterUrl) return null;

  if (error && !result && !loading) {
    return (
      <div className="border-[1.5px] border-rose-200 bg-rose-50 rounded-xl px-3.5 py-2.5 text-[13px]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-rose-100 text-rose-700 text-sm font-extrabold">!</span>
          <span className="font-bold text-rose-700">Ошибка проверки</span>
        </div>
        <p className="text-rose-600 text-xs leading-relaxed">{error}</p>
        <button
          onClick={runVerify}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold hover:bg-rose-200 transition-colors"
        >
          Повторить проверку
        </button>
      </div>
    );
  }

  if (!result && !loading) {
    return (
      <button
        onClick={runVerify}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold hover:scale-[1.03] transition-transform"
      >
        <span className="text-[15px]">&#129302;</span>
        AI Verify: сравнить до/после
      </button>
    );
  }

  const v = loading ? VERDICT_CFG.LOADING : (VERDICT_CFG[result?.verdict] || VERDICT_CFG.SUSPICIOUS);

  return (
    <div className={`${v.bg} border-[1.5px] ${v.border} rounded-xl px-3.5 py-2.5 text-[13px]`}>
      <div className={`flex items-center gap-2 ${result?.reasoning ? 'mb-1.5' : ''}`}>
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${v.iconBg} ${v.text} text-sm font-extrabold ${loading ? 'animate-spin' : ''}`}>
          {v.icon}
        </span>
        <span className={`font-bold ${v.text}`}>{v.label}</span>
        {result?.confidence > 0 && (
          <span className={`ml-auto text-xs font-extrabold ${v.text}`}>{result.confidence}%</span>
        )}
      </div>
      {result?.reasoning && (
        <p className="text-slate-600 text-xs leading-relaxed mt-1">{result.reasoning}</p>
      )}
      {result?.changes_detected && (
        <p className="text-slate-500 text-[11px] mt-1 italic">Изменения: {result.changes_detected}</p>
      )}
    </div>
  );
}
