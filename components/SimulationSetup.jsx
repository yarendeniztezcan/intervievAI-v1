import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Code, MessageSquare, Layers, ArrowRight, Briefcase } from 'lucide-react';

const SimulationSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') || 'coding';

  const [config, setConfig] = useState({
    questionCount: 10,
    codingCourses: [],
    verbalCourses: [],
    language: 'python',
    level: 'mid' // junior | mid | senior
  });

  const codingCourses = [
    { id: 'oop', name: 'Nesneye Yönelik Programlama' },
    { id: 'algorithms', name: 'Algoritma ve Veri Yapıları' },
    { id: 'programming', name: 'Programlama Dilleri' }
  ];

  const verbalCourses = [
    { id: 'datastructures', name: 'Veri Yapıları' },
    { id: 'architecture', name: 'Bilgisayar Mimarisi' },
    { id: 'os', name: 'İşletim Sistemleri' },
    { id: 'networks', name: 'Bilgisayar Ağları' },
    { id: 'logic', name: 'Mantıksal Devre Tasarımı' }
  ];

  const languages = [
    { id: 'python', name: 'Python' },
    { id: 'c', name: 'C' },
    { id: 'java', name: 'Java' }
  ];

  const levels = [
    { id: 'junior', name: 'Junior', desc: 'Temel mülakat soruları', color: 'border-green-500' },
    { id: 'mid', name: 'Mid-Level', desc: 'Orta seviye mülakat', color: 'border-blue-500' },
    { id: 'senior', name: 'Senior', desc: 'İleri seviye / zorlu', color: 'border-red-500' }
  ];

  const handleStart = () => {
    const queryParams = new URLSearchParams({
      type,
      count: config.questionCount,
      level: config.level,
      ...(type === 'coding' && { language: config.language }),
      ...(type === 'coding' && config.codingCourses.length > 0 && { courses: config.codingCourses.join(',') }),
      ...(type === 'verbal' && config.verbalCourses.length > 0 && { courses: config.verbalCourses.join(',') }),
      ...(type === 'mixed' && {
        codingCourses: config.codingCourses.join(','),
        verbalCourses: config.verbalCourses.join(',')
      })
    });

    const path = type === 'coding' ? '/coding' : type === 'verbal' ? '/verbal' : '/mixed';
    navigate(`${path}?${queryParams.toString()}`);
  };

  const toggleCourse = (courseId, courseType) => {
    const key = courseType === 'coding' ? 'codingCourses' : 'verbalCourses';
    setConfig(prev => ({
      ...prev,
      [key]: prev[key].includes(courseId)
        ? prev[key].filter(id => id !== courseId)
        : [...prev[key], courseId]
    }));
  };

  const isValid = () => {
    if (type === 'coding') return config.codingCourses.length > 0;
    if (type === 'verbal') return config.verbalCourses.length > 0;
    return config.codingCourses.length > 0 && config.verbalCourses.length > 0;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          {type === 'coding' && <Code className="text-blue-600" />}
          {type === 'verbal' && <MessageSquare className="text-green-600" />}
          {type === 'mixed' && <Layers className="text-purple-600" />}
          Simülasyon Ayarları
        </h2>

        {/* Seviye: interview-oriented question generation */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Briefcase size={16} /> Mülakat Seviyesi
          </label>
          <div className="grid grid-cols-3 gap-3">
            {levels.map(lvl => (
              <button
                key={lvl.id}
                onClick={() => setConfig({ ...config, level: lvl.id })}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  config.level === lvl.id
                    ? `${lvl.color} bg-gray-50`
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-sm">{lvl.name}</div>
                <div className="text-xs text-gray-500 mt-1">{lvl.desc}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Sorular gerçek mülakat tarzında üretilir; seviye zorluk ve senaryo karmaşıklığını belirler.
          </p>
        </div>

        {/* Soru Sayısı */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Soru Sayısı</label>
          <div className="flex gap-4">
            {[10, 15, 20].map(count => (
              <button
                key={count}
                onClick={() => setConfig({ ...config, questionCount: count })}
                className={`px-6 py-2 rounded-lg border-2 transition-colors ${
                  config.questionCount === count
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {count} Soru
              </button>
            ))}
          </div>
        </div>

        {/* Kod Dili (Sadece Kod ve Karma için) */}
        {(type === 'coding' || type === 'mixed') && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Programlama Dili</label>
            <div className="flex gap-4">
              {languages.map(lang => (
                <button
                  key={lang.id}
                  onClick={() => setConfig({ ...config, language: lang.id })}
                  className={`px-6 py-2 rounded-lg border-2 transition-colors ${
                    config.language === lang.id
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Kod Dersleri */}
        {(type === 'coding' || type === 'mixed') && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {type === 'mixed' ? 'Kod Dersleri (En az 1)' : 'Dersler (En az 1)'}
            </label>
            <div className="space-y-2">
              {codingCourses.map(course => (
                <label key={course.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.codingCourses.includes(course.id)}
                    onChange={() => toggleCourse(course.id, 'coding')}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>{course.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Sözel Dersleri */}
        {(type === 'verbal' || type === 'mixed') && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {type === 'mixed' ? 'Sözel Dersleri (En az 1)' : 'Dersler (En az 1)'}
            </label>
            <div className="space-y-2">
              {verbalCourses.map(course => (
                <label key={course.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.verbalCourses.includes(course.id)}
                    onChange={() => toggleCourse(course.id, 'verbal')}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>{course.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!isValid()}
          className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Simülasyona Başla
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default SimulationSetup;
