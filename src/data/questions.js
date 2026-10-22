const codingQuestions = [
  {
    id: 'legacy-coding-1',
    type: 'coding',
    category: 'algorithms',
    topic: 'Diziler',
    difficulty: 'easy',
    language: 'python',
    title: 'Dizideki Maksimum Kâr (Legacy)',
    description: 'Bir gün içindeki hisse fiyatlarını temsil eden tamsayı dizisinde, bir alım ve sonrasında bir satım yaparak elde edilebilecek maksimum kârı hesaplayan fonksiyon yazın.\n\nNot: Önce alım sonra satım yapılmalıdır.',
    starterCode: 'def max_profit(prices):\n    # kodunuzu yazın\n    pass\n\nif __name__ == "__main__":\n    prices = list(map(int, input().split()))\n    print(max_profit(prices))',
    testCases: [
      { input: '7 1 5 3 6 4', expected: '5' },
      { input: '7 6 4 3 1', expected: '0' }
    ],
    solution: 'def max_profit(prices):\n    min_price = float("inf")\n    best = 0\n    for p in prices:\n        if p < min_price:\n            min_price = p\n        elif p - min_price > best:\n            best = p - min_price\n    return best\n\n# Zaman: O(n), Bellek: O(1)\n\nif __name__ == "__main__":\n    prices = list(map(int, input().split()))\n    print(max_profit(prices))',
    hints: ['Şimdiye kadar görülen en düşük fiyatı izleyin.', 'Her adımda şu ana kadarki maksimum kârı güncelleyin.']
  }
];

const verbalQuestions = [
  {
    id: 'legacy-verbal-1',
    type: 'verbal',
    category: 'datastructures',
    topic: 'Hash Tabloları',
    difficulty: 'medium',
    title: 'Hash Çakışması (Legacy)',
    question: 'Hash tablosunda çakışma (collision) nedir? Gerçek bir projede çakışmaları çözmek için kullanabileceğiniz iki farklı stratejiyi açıklayın ve her birinin trade-off\'unu belirtin.',
    expectedAnswer: '1) İki farklı anahtarın aynı indekse düşmesi collision\'dır. 2) Zincirleme (chaining): her indekste linked list; ek bellek kullanır, load factor arttıkça arama O(n)\'e kötüleşebilir. 3) Açık adresleme (open addressing): boş slot aranır; önbellek verimliliği iyidir ama tablo dolunca performans çöker, silme işlemi zordur.',
    hints: ['Load factor kavramına değinin.', 'Silme işleminin iki stratejide de nasıl farklılaştığını düşünün.']
  }
];

module.exports = { codingQuestions, verbalQuestions };
