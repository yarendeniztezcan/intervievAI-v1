import React from 'react';
import { Link } from 'react-router-dom';
import { Code, MessageSquare, Layers, Brain, Target, TrendingUp } from 'lucide-react';
import { isAuthenticated } from '../utils/auth';

const Home = () => {
  const authenticated = isAuthenticated();

  const simulationTypes = [
    {
      type: 'coding',
      title: 'Kod Simülasyonu',
      description: 'Algoritma ve veri yapıları sorularını kodlayarak çözün. Python, C veya Java seçenekleriyle.',
      icon: Code,
      color: 'bg-blue-600',
      path: '/setup?type=coding'
    },
    {
      type: 'verbal',
      title: 'Sözel Simülasyon',
      description: 'Mantıksal devre tasarımı, işletim sistemleri, bilgisayar mimarisi ve organizasyonu gibi konularda yazarak cevapladığın sözel sorular. Yanlışta doğru cevap gösterilir.',
      icon: MessageSquare,
      color: 'bg-green-600',
      path: '/setup?type=verbal'
    },
    {
      type: 'mixed',
      title: 'Karma Simülasyon',
      description: 'Tek ekranda iki bölüm: solda kod soruları, sağda sözel sorular. Her bölüm için soru sayısını ve dersleri ayrı seçersin.',
      icon: Layers,
      color: 'bg-purple-600',
      path: '/setup?type=mixed'
    }
  ];

  const features = [
    { icon: Brain, title: 'AI Destekli', desc: 'Yapay zeka analizi ve benzer soru üretimi' },
    { icon: Target, title: 'Akıllı Puanlama', desc: 'Doğru, yarım ve yanlış puanlama sistemi' },
    { icon: TrendingUp, title: 'İlerleme Takibi', desc: 'Performansınızı ve zayıf noktalarınızı görün' }
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl text-white">
        <h1 className="text-5xl font-bold mb-4">InterviewAI</h1>
        <p className="text-xl mb-8 max-w-2xl mx-auto">
          AI destekli mülakat hazırlık platformu ile kodlama ve sözel mülakatlara hazırlanın.
        </p>
        {!authenticated ? (
          <div className="flex justify-center gap-4">
            <Link to="/register" className="btn-primary text-lg px-8 py-3 bg-white text-blue-600 hover:bg-gray-100">
              Kayıt Ol
            </Link>
            <Link to="/login" className="btn-secondary text-lg px-8 py-3 bg-transparent border-2 border-white text-white hover:bg-white/20">
              Giriş Yap
            </Link>
          </div>
        ) : (
          <Link to="/setup" className="btn-primary text-lg px-8 py-3">
            Simülasyona Başla
          </Link>
        )}
      </section>

      {/* Simulation Types */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-8">Simülasyon Türleri</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {simulationTypes.map((sim) => {
            const Icon = sim.icon;
            return (
              <Link
                key={sim.type}
                to={sim.path}
                className="card hover:shadow-lg transition-shadow group"
              >
                <div className={`w-14 h-14 ${sim.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{sim.title}</h3>
                <p className="text-gray-600">{sim.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section className="card">
        <h2 className="text-2xl font-bold text-center mb-8">Neden InterviewAI?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Home;