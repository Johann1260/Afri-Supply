import React from 'react';
import { ShieldWarning, Warning } from '@phosphor-icons/react';
import { useLocale } from '../../context/LocaleContext';
import { formatDate } from '../../lib/utils';

const BypassTab = ({ attempts, loading }) => {
  const { t } = useLocale();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-bold text-slate-900 flex-1">{t('admin.bypass')}</h2>
        {attempts.length > 0 && (
          <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
            {attempts.length} détectée{attempts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Warning className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" weight="fill" />
        <p className="text-sm text-amber-800">
          <strong>Moteur anti-bypass actif.</strong> Tout message contenant un numéro, email,
          lien ou phrase de contournement est bloqué et enregistré ici pour audit.
        </p>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : attempts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <ShieldWarning className="w-12 h-12 mx-auto text-green-400 mb-3" weight="fill" />
          <p className="font-semibold text-slate-600">{t('admin.no_attempts')}</p>
          <p className="text-sm text-slate-400 mt-1">Tous les utilisateurs respectent les règles de la plateforme.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((a, i) => (
            <div key={a.id || i} className="bg-white border border-red-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded uppercase tracking-wide">
                  {(a.reason || 'bypass').replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-400">{formatDate(a.created_at)}</span>
                {a.channel && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                    {a.channel === 'ws_bypass' ? 'WebSocket' : 'REST'}
                  </span>
                )}
              </div>
              <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-3">
                <p className="text-sm text-slate-700 font-mono break-all leading-relaxed">{a.original_content}</p>
              </div>
              <div className="flex gap-6 text-xs text-slate-400">
                <span>Expéditeur : <span className="font-semibold text-slate-600 font-mono">{a.user_id?.slice(0, 8).toUpperCase()}</span></span>
                <span>Destinataire : <span className="font-semibold text-slate-600 font-mono">{a.target_id?.slice(0, 8).toUpperCase()}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BypassTab;
