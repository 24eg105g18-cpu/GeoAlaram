import React from 'react';
import { Bell, MapPin, CheckCircle, Clock, Volume2, ShieldAlert } from 'lucide-react';
import { useTracking } from '../../context/TrackingContext';
import { formatDistance } from '../../utils/haversine';

export const AlarmTriggerModal = () => {
  const { triggeredAlarm, dismissAlarm, snoozeAlarm } = useTracking();

  if (!triggeredAlarm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-4 border-amber-400 overflow-hidden transform animate-scaleUp">
        {/* Top Warning Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 p-6 text-white text-center relative overflow-hidden">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur shadow-inner">
            <Bell className="w-9 h-9 text-white animate-bounce" />
          </div>
          <div className="flex items-center justify-center space-x-2 mb-1">
            <span className="inline-block px-3 py-1 rounded-full bg-white/25 text-white font-extrabold text-xs uppercase tracking-widest">
              Geofence Triggered!
            </span>
            {triggeredAlarm.isSimulation && (
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white text-navy-950 font-black text-[10px] uppercase tracking-wider shadow">
                Simulation Test
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            You Have Arrived!
          </h2>
          <p className="text-amber-100 text-xs mt-1">
            Approaching your destination. Prepare your belongings.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Alarm Name
                </span>
                <h3 className="text-lg font-bold text-navy-950">{triggeredAlarm.name}</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                Inside Radius
              </span>
            </div>

            <p className="text-xs text-slate-600 flex items-start pt-1">
              <MapPin className="w-4 h-4 text-rose-500 mr-1.5 flex-shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{triggeredAlarm.destinationName}</span>
            </p>

            <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                <span className="text-[10px] text-slate-400 block">Wake-up Radius</span>
                <span className="font-bold text-slate-800">{formatDistance(triggeredAlarm.radius)}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                <span className="text-[10px] text-slate-400 block">Current Distance</span>
                <span className="font-bold text-emerald-600">
                  {formatDistance(triggeredAlarm.currentDistance)}
                </span>
              </div>
            </div>

            {triggeredAlarm.notes && (
              <div className="mt-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60">
                <span className="font-bold text-amber-900 block text-[10px] uppercase">Notes</span>
                {triggeredAlarm.notes}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={dismissAlarm}
              className="flex-1 inline-flex items-center justify-center py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              <span>I Have Arrived (Dismiss)</span>
            </button>

            <button
              type="button"
              onClick={() => snoozeAlarm(triggeredAlarm._id)}
              className="inline-flex items-center justify-center py-3.5 px-5 rounded-xl font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Clock className="w-4 h-4 mr-1.5 text-slate-500" />
              <span>Snooze (5m)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlarmTriggerModal;
