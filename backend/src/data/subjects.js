// Ders / konu kataloğu (tek doğru kaynak).
// Kullanıcı "ders" seçer; AI ise o dersin alt konularından (topics) soru üretir.
// Yeni bir ders eklemek için ilgili nesneye bir kayıt eklemek yeterlidir; frontend
// listeyi /api/subjects üzerinden okur.

const CODING_SUBJECTS = {
  oop: {
    name: 'Nesneye Yönelik Programlama',
    topics: [
      'Sınıf ve nesne modelleme',
      'Kalıtım ve polimorfizm',
      'Arayüz ve soyutlama',
      'Kapsülleme',
      'Tasarım kalıpları (Strategy, Observer, Factory)',
      'Koleksiyonlar ve generic kullanımı'
    ]
  },
  algorithms: {
    name: 'Algoritma ve Veri Yapıları',
    topics: [
      'Diziler ve iki işaretçi tekniği',
      'String işleme',
      'Hash map ile sayma/arama',
      'Stack ve queue uygulamaları',
      'Sıralama ve ikili arama',
      'Özyineleme ve dinamik programlama',
      'Graf dolaşma (BFS/DFS)',
      'Ağaçlar'
    ]
  },
  programming: {
    name: 'Programlama Dilleri',
    topics: [
      'Metin girdisi işleme',
      'Hata yönetimi',
      'Fonksiyonel yaklaşımlar (map/filter/reduce)',
      'Bellek ve referans davranışı',
      'Standart kütüphane kullanımı'
    ]
  }
};

const VERBAL_SUBJECTS = {
  datastructures: {
    name: 'Veri Yapıları',
    topics: [
      'Hash tabloları ve çakışma çözümü',
      'Ağaç yapıları (BST, AVL, kırmızı-siyah)',
      'Heap ve öncelik kuyruğu',
      'Graf temsilleri ve kullanım yerleri',
      'Stack ve queue kullanım alanları',
      'Bağlı liste ve dizi karşılaştırması',
      'Trie ve B-tree',
      'LRU cache tasarımı',
      'Amortize analiz ve karmaşıklık'
    ]
  },
  architecture: {
    name: 'Bilgisayar Mimarisi ve Organizasyonu',
    topics: [
      'CPU komut çevrimi (fetch-decode-execute)',
      'Pipeline ve hazard türleri',
      'Cache hiyerarşisi, eşleme ve yazma politikaları',
      'RISC ve CISC karşılaştırması',
      'Adresleme modları',
      'Bellek hiyerarşisi ve yerellik prensibi',
      'Dallanma tahmini ve spekülatif yürütme',
      'Çok çekirdekli mimariler ve cache coherence',
      'Kesmeler, DMA ve G/Ç organizasyonu',
      'Kontrol birimi: hardwired ve mikroprogramlı',
      'Sayı sistemleri ve kayan nokta gösterimi',
      'Performans metrikleri ve Amdahl yasası'
    ]
  },
  os: {
    name: 'İşletim Sistemleri',
    topics: [
      'Süreç ve thread farkı, bağlam değiştirme',
      'CPU zamanlama algoritmaları',
      'Senkronizasyon: mutex, semafor, monitör',
      'Deadlock: koşullar, önleme ve tespit',
      'Sanal bellek ve sayfa değiştirme algoritmaları',
      'Bellek yönetimi: sayfalama, segmentasyon, fragmentation',
      'Dosya sistemleri ve inode yapısı',
      'Sistem çağrıları, kernel/user mod ve kesmeler',
      'Süreçler arası iletişim (IPC)',
      'Disk zamanlama ve G/Ç yönetimi'
    ]
  },
  networks: {
    name: 'Bilgisayar Ağları',
    topics: [
      'OSI ve TCP/IP katmanları',
      'TCP ve UDP farkları',
      'HTTP, HTTPS ve TLS',
      'DNS çözümleme',
      'IP adresleme, subnetting ve NAT',
      'Yönlendirme algoritmaları',
      'Akış ve tıkanıklık kontrolü',
      'Yük dengeleme, proxy ve CDN'
    ]
  },
  logic: {
    name: 'Mantıksal Devre Tasarımı',
    topics: [
      'Flip-flop türleri (SR, D, JK, T) ve kullanım amaçları',
      'Latch ile flip-flop farkı ve tetikleme biçimleri',
      'Senkron ve asenkron sayaçlar',
      'Register ve shift register uygulamaları',
      'Multiplexer, demultiplexer, decoder ve encoder',
      'Boolean cebiri ve Karnaugh haritası ile sadeleştirme',
      'Sonlu durum makineleri (Mealy ve Moore)',
      'Toplayıcılar, çıkarıcılar ve ALU tasarımı',
      'Kombinasyonel ve ardışıl devre farkı',
      'Setup/hold süresi ve metastability',
      'Hazard ve glitch',
      'Bellek elemanları (ROM, SRAM, PLA, FPGA LUT)'
    ]
  }
};

const SUBJECTS = { coding: CODING_SUBJECTS, verbal: VERBAL_SUBJECTS };

function getSubject(type, id) {
  return (SUBJECTS[type] && SUBJECTS[type][id]) || null;
}

// Eski kayıtlarda konu alanı ders kimliğiyle aynı olabilir (ör. "logic"); okunur ada çevirir.
function getSubjectName(id) {
  return (CODING_SUBJECTS[id] || VERBAL_SUBJECTS[id] || {}).name || id;
}

function listSubjects() {
  const toList = (obj) => Object.entries(obj).map(([id, s]) => ({ id, name: s.name, topics: s.topics }));
  return { coding: toList(CODING_SUBJECTS), verbal: toList(VERBAL_SUBJECTS) };
}

// Bir ders için n adet konu seçer: en az kullanılan konular önce gelir, eşitlikte rastgele.
function pickTopics(subject, n, usedCounts = {}, rand = Math.random) {
  const ranked = subject.topics
    .map((topic) => ({ topic, used: usedCounts[topic] || 0, tie: rand() }))
    .sort((a, b) => a.used - b.used || a.tie - b.tie)
    .map((x) => x.topic);
  return Array.from({ length: n }, (_, i) => ranked[i % ranked.length]);
}

module.exports = { getSubject, getSubjectName, listSubjects, pickTopics };
