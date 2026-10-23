import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Code, MessageSquare, Layers, ArrowRight, Briefcase, Check, Loader2, Mic } from 'lucide-react';
import api, { errorMessage } from '../utils/api';

const COUNTS = [3, 5, 10, 15, 20];

const LANGUAGES = [
  { id: 'python', name: 'Python' },
  { id: 'c', name: 'C' },
  { id: 'java', name: 'Java' }
];

const LEVELS = [
  { id: 'junior', name: 'Junior', desc: 'Temel mülakat soruları', color: 'border-green-500' },
  { id: 'mid', name: 'Mid-Level', desc: 'Orta seviye mülakat', color: 'border-blue-500' },
  { id: 'senior', name: 'Senior', desc: 'İleri seviye / zorlu', color: 'border-red-500' }
];

const TYPES = [
  { id: 'coding', name: 'Kod', desc: 'Yalnızca kod soruları', icon: Code, active: 'border-blue-600 bg-blue-50 text-blue-700' },
  { id: 'verbal', name: 'Sözel', desc: 'Yazarak cevapla', icon: MessageSquare, active: 'border-green-600 bg-green-50 text-green-700' },
  { id: 'voice', name: 'Sözlü', desc: 'Konuşarak cevapla', icon: Mic, active: 'border-orange-500 bg-orange-50 text-orange-700' },
  { id: 'mixed', name: 'Karma', desc: 'Sol: kod • Sağ: sözel', icon: Layers, active: 'border-purple-600 bg-purple-50 text-purple-700' }
];

const CountPicker = ({ value, onChange, accent }) => (
  <div className="flex gap-2 flex-wrap">
    {COUNTS.map((count) => (
      <button
        key={count}
        type="button"
        onClick={() => onChange(count)}
        className={`px-4 py-2 rounded-lg border-2 transition-colors cursor-pointer ${
          value === count ? accent : 'border-gray-200 hover:border-gray-400'
        }`}
      >
        {count} Soru
      </button>
    ))}
  </div>
);

const SectionCard = ({ icon: Icon, color, title, children }) => (
  <div className="card space-y-6">
    <h3 className="text-lg font-bold flex items-center gap-2">
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </span>
      {title}
    </h3>
    {children}
  </div>
);

const SimulationSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requested = searchParams.get('type');
  const [type, setType] = useState(TYPES.some((t) => t.id === requested) ? requested : 'mixed');

  const [subjects, setSubjects] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [config, setConfig] = useState({
    level: 'mid',
    language: 'python',
    codingCount: 5,
    verbalCount: 5,
    codingCourses: [],
    verbalCourses: []
  });

  useEffect(() => {
    api.get('/api/subjects')
      .then((r) => setSubjects(r.data))
      .catch((e) => setLoadError(errorMessage(e, 'Ders listesi alınamadı. Backend çalışıyor mu?')));
  }, []);

  const hasCoding = type === 'coding' || type === 'mixed';
  const isVoice = type === 'voice';
  const hasVerbal = type === 'verbal' || isVoice || type === 'mixed';

  const set = (patch) => setConfig((prev) => ({ ...prev, ...patch }));
  const toggle = (key, id) =>
    set({ [key]: config[key].includes(id) ? config[key].filter((x) => x !== id) : [...config[key], id] });

  const isValid =
    (!hasCoding || config.codingCourses.length > 0) && (!hasVerbal || config.verbalCourses.length > 0);

  const total = (hasCoding ? config.codingCount : 0) + (hasVerbal ? config.verbalCount : 0);

  const handleStart = () => {
    const params = new URLSearchParams({ type, level: config.level });
    if (hasCoding) {
      params.set('language', config.language);
      params.set('codingCount', config.codingCount);
      params.set('codingCourses', config.codingCourses.join(','));
    }
    if (hasVerbal) {
      params.set('verbalCount', config.verbalCount);
      params.set('verbalCourses', config.verbalCourses.join(','));
    }
    navigate(`/simulation?${params.toString()}`);
  };

  const allVerbalSelected = subjects && config.verbalCourses.length === subjects.verbal.length;

  return (
    <div className={`mx-auto space-y-6 ${type === 'mixed' ? 'max-w-5xl' : 'max-w-2xl'}`}>
      <h2 className="text-2xl font-bold">Simülasyon Ayarları</h2>

      {/* Simülasyon türü */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`p-3 rounded-xl border-2 text-left transition-colors bg-white cursor-pointer ${
                type === t.id ? t.active : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <div className="font-semibold flex items-center gap-2"><Icon size={18} /> {t.name}</div>
              <div className="text-xs text-gray-500 mt-1">{t.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Seviye */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Briefcase size={16} /> Mülakat Seviyesi
        </label>
        <div className="grid grid-cols-3 gap-3">
          {LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              onClick={() => set({ level: lvl.id })}
              className={`p-3 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                config.level === lvl.id ? `${lvl.color} bg-gray-50` : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-sm">{lvl.name}</div>
              <div className="text-xs text-gray-500 mt-1">{lvl.desc}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Sorular gerçek mülakat tarzında üretilir; seviye zorluğu ve soru tarzını belirler.
        </p>
      </div>

      {loadError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{loadError}</div>}
      {!subjects && !loadError && (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" /></div>
      )}

      {subjects && (
        <div className={`grid gap-6 items-start ${type === 'mixed' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {hasCoding && (
            <SectionCard icon={Code} color="bg-blue-600" title="Kod Soruları (sol taraf)">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Soru Sayısı</label>
                <CountPicker value={config.codingCount} onChange={(v) => set({ codingCount: v })} accent="border-blue-600 bg-blue-50 text-blue-600" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Programlama Dili</label>
                <div className="flex gap-2 flex-wrap">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => set({ language: lang.id })}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors cursor-pointer ${
                        config.language === lang.id ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dersler (en az 1)</label>
                <div className="space-y-2">
                  {subjects.coding.map((course) => (
                    <label key={course.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.codingCourses.includes(course.id)}
                        onChange={() => toggle('codingCourses', course.id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>{course.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}

          {hasVerbal && (
            <SectionCard
              icon={isVoice ? Mic : MessageSquare}
              color={isVoice ? 'bg-orange-500' : 'bg-green-600'}
              title={isVoice ? 'Sözlü Sorular (sesli)' : 'Sözel Sorular (sağ taraf)'}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Soru Sayısı</label>
                <CountPicker
                  value={config.verbalCount}
                  onChange={(v) => set({ verbalCount: v })}
                  accent={isVoice ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-green-600 bg-green-50 text-green-700'}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Konu / Ders (en az 1)</label>
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:underline cursor-pointer"
                    onClick={() => set({ verbalCourses: allVerbalSelected ? [] : subjects.verbal.map((s) => s.id) })}
                  >
                    {allVerbalSelected ? 'Seçimi temizle' : 'Tümünü seç'}
                  </button>
                </div>
                <div className="space-y-2">
                  {subjects.verbal.map((course) => {
                    const selected = config.verbalCourses.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => toggle('verbalCourses', course.id)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors flex items-start gap-3 cursor-pointer ${
                          selected ? (isVoice ? 'border-orange-500 bg-orange-50' : 'border-green-600 bg-green-50') : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <span className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center ${
                          selected ? (isVoice ? 'bg-orange-500 border-orange-500' : 'bg-green-600 border-green-600') : 'border-gray-300'
                        }`}>
                          {selected && <Check size={14} className="text-white" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{course.name}</span>
                          <span className="block text-xs text-gray-500 truncate">
                            {course.topics.length} konu: {course.topics.slice(0, 3).join(' • ')}…
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Sorular yalnızca seçtiğin derslerin konularından üretilir.
                  {isVoice && ' Sözlü simülasyonda AI soruyu sesli sorar, sen mikrofonla cevaplarsın; mikrofon izni gerekir.'}
                </p>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={!isValid || !subjects}
        className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        Simülasyona Başla ({total} soru)
        <ArrowRight size={20} />
      </button>
      {!isValid && subjects && (
        <p className="text-center text-sm text-gray-500 -mt-3">
          {hasCoding && config.codingCourses.length === 0 && 'Kod bölümü için en az bir ders seçin. '}
          {hasVerbal && config.verbalCourses.length === 0 && 'Sözel bölüm için en az bir ders seçin.'}
        </p>
      )}
    </div>
  );
};

export default SimulationSetup;
