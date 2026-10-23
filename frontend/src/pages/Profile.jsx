import React, { useState, useEffect } from 'react';
import { Trophy, Target, TrendingUp, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const TYPE_LABELS = { coding: 'Kod', verbal: 'Sözel', voice: 'Sözlü', mixed: 'Karma' };

const Profile = () => {
  const [stats, setStats] = useState({
    totalSimulations: 0,
    totalQuestions: 0,
    averageScore: 0,
    bestScore: 0,
    weakTopics: []
  });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const response = await api.get('/api/users/profile');
      setStats(response.data.stats);
      setHistory(response.data.history || []);
      setLoading(false);
    } catch (error) {
      console.error('Profil verisi alınamadı:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold">Profilim</h2>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card text-center">
          <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">{stats.totalSimulations}</div>
          <div className="text-sm text-gray-600">Toplam Simülasyon</div>
        </div>
        <div className="card text-center">
          <Target className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">{stats.totalQuestions}</div>
          <div className="text-sm text-gray-600">Çözülen Soru</div>
        </div>
        <div className="card text-center">
          <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">%{stats.averageScore}</div>
          <div className="text-sm text-gray-600">Ortalama Başarı</div>
        </div>
        <div className="card text-center">
          <Trophy className="w-8 h-8 text-purple-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">%{stats.bestScore}</div>
          <div className="text-sm text-gray-600">En İyi Skor</div>
        </div>
      </div>

      {/* Weak Topics */}
      {stats.weakTopics?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Geliştirilmesi Gereken Konular</h3>
          <div className="flex flex-wrap gap-2">
            {stats.weakTopics.map((topic, i) => (
              <span key={i} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <button onClick={() => navigate('/redo?status=correct')} className="card text-left hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3"><CheckCircle className="text-green-600" /><div><h3 className="font-semibold">Doğru Soruları Tekrar Et</h3><p className="text-sm text-gray-600">Geçmişte doğru cevapladığın soruları yeniden çöz.</p></div></div>
        </button>
        <button onClick={() => navigate('/redo?status=incorrect')} className="card text-left hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3"><XCircle className="text-red-600" /><div><h3 className="font-semibold">Yanlış Soruları Tekrar Et</h3><p className="text-sm text-gray-600">Geçmişte yanlış cevapladığın sorulara dön.</p></div></div>
        </button>
      </div>

      {/* History */}
      <div className="card">
        <h3 className="font-semibold mb-4">Simülasyon Geçmişi</h3>
        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{TYPE_LABELS[item.type] || item.type} Simülasyon</div>
                  <div className="text-sm text-gray-600">
                    {item.questionCount} soru • {new Date(item.date).toLocaleDateString('tr-TR')}
                  </div>
                </div>
                <div className={`font-semibold ${
                  item.score >= 70 ? 'text-green-600' :
                  item.score >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  %{item.score}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-4">Henüz simülasyon kaydı yok.</p>
        )}
      </div>
    </div>
  );
};

export default Profile;