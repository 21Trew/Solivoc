/* Game constants and progression definitions. */
let BANK = [];
const SAVE_KEY = "worditaire-state-v10";
const OLD_SAVE_KEY = "assoc-klondike-v7";
const PROFILE_KEY = "worditaire-profile-v6";
const PREV_PROFILE_KEY = "worditaire-profile-v5";
const LEGACY_PROFILE_KEYS = ["worditaire-profile-v4", "worditaire-profile-v3", "worditaire-profile-v2"];
const ANALYTICS_KEY = "worditaire-analytics-v1";
const RECENT_KEY = "assoc-recent-categories-v2";
const MAX_CARD_WORD_LEN = 10,
  MAX_CARD_TITLE_LEN = 24;

const AVATAR_EMOJIS = [
  "🙂", "😎", "🤩", "🥳", "🤓", "🤠", "🫠", "😈",
  "🦊", "🐼", "🐸", "🦉", "🐙", "🦄", "🐯", "🐧",
  "🌙", "⭐", "🔥", "❄️", "🌸", "🍀", "⚡", "🌈",
  "🎯", "🎮", "🧩", "🏆", "🚀", "💎", "🎧", "🍕"
];

const RANK_XP_BASE = 100;
const RANK_XP_GROWTH = 1.1;
// Exact economy: rank 1→2 costs 100 XP, every next promotion costs
// 10% more than the PREVIOUS rounded promotion cost.
const RANK_XP_COSTS = [RANK_XP_BASE];
const RANK_XP_THRESHOLDS = [0];
function xpNeededForRankUp(rank) {
  rank = Math.max(1, Math.floor(+rank || 1));
  while (RANK_XP_COSTS.length < rank) {
    RANK_XP_COSTS.push(Math.max(RANK_XP_BASE, Math.round(RANK_XP_COSTS.at(-1) * RANK_XP_GROWTH)));
  }
  return RANK_XP_COSTS[rank - 1];
}
function xpThresholdForRank(rank) {
  rank = Math.max(1, Math.floor(+rank || 1));
  while (RANK_XP_THRESHOLDS.length < rank) {
    const currentRank = RANK_XP_THRESHOLDS.length;
    RANK_XP_THRESHOLDS.push(RANK_XP_THRESHOLDS.at(-1) + xpNeededForRankUp(currentRank));
  }
  return RANK_XP_THRESHOLDS[rank - 1];
}
function rankLevelFromXp(value) {
  const xp = Math.max(0, +value || 0);
  let rank = 1;
  while (xp >= xpThresholdForRank(rank + 1) && rank < 500) rank++;
  return rank;
}

const RANK_AVATAR_REWARDS = [
  "🧠","🕵️","🧙","🧑‍🚀","🤖","👑","🦁","🐲","🦅","🦋","🌋","🌌","🪐","🧿","🎭","🗿","🦖","🐉","🛸","⚜️",
  "🐺","🦝","🦥","🦦","🦚","🦜","🦩","🐬","🦈","🐋","🐘","🦒","🦏","🐆","🐻‍❄️","🦬","🦌","🐏","🦘","🦡",
  "🪄","🔮","🧪","⚗️","🧬","🛰️","🔭","🧭","🗺️","🏛️","🏰","🗼","🌉","⛩️","🎡","🎢","🎪","🎨","🎬","🎻",
  "🎷","🥁","🎸","🎹","🪕","🏹","🤺","🏄","🧗","🚴","⛷️","🏂","🏎️","⛵","🚁","🚂","🚜","🛶","🏕️","🌠",
  "☄️","🌊","🏔️","🌲","🌵","🪴","🍄","🪸","🦪","🐚","🪶","🪬","🧶","🪡","🧵","🧱","🪵","⚙️","🧲","💡"
];
function rankRewardAvatar(level) {
  return level >= 2 ? (RANK_AVATAR_REWARDS[level - 2] || null) : null;
}
const LOGIN_REWARD_DEFS = [
  { days: 30, id: "visits30", emoji: "📅", title: "30 дней" },
  { days: 50, id: "visits50", emoji: "🧭", title: "50 дней" },
  { days: 100, id: "visits100", emoji: "🏛️", title: "100 дней" },
  { days: 180, id: "visits180", emoji: "🌳", title: "Полгода" },
  { days: 365, id: "visits365", emoji: "🏅", title: "Год вместе" },
];
function availableAvatarEmojis(p = typeof profile !== "undefined" ? profile : null) {
  const level = rankLevelFromXp(+p?.xp || 0),
    loginRewards = LOGIN_REWARD_DEFS.filter((r) => (p?.retention?.totalOpenDays || 0) >= r.days).map((r) => r.emoji);
  return [...new Set([...AVATAR_EMOJIS, ...RANK_AVATAR_REWARDS.slice(0, Math.max(0, level - 1)), ...loginRewards])];
}

const ASSOCIATION_COLLECTION_DEFS = [
  {
    id: "animals", name: "Животные", icon: "🦊", desc: "Собирай животных по среде и типу",
    categories: [
      { id: "farm", title: "Ферма", cards: [["🐄","Корова"],["🐖","Свинья"],["🐔","Курица"],["🐑","Овца"],["🐐","Коза"],["🐎","Лошадь"]] },
      { id: "africa", title: "Африка", cards: [["🦁","Лев"],["🐘","Слон"],["🦒","Жираф"],["🦓","Зебра"],["🦏","Носорог"],["🐆","Леопард"]] },
      { id: "forest", title: "Лес", cards: [["🦊","Лиса"],["🐻","Медведь"],["🐺","Волк"],["🦌","Олень"],["🐿️","Белка"],["🦉","Сова"]] },
      { id: "ocean", title: "Океан", cards: [["🐬","Дельфин"],["🐳","Кит"],["🦈","Акула"],["🐙","Осьминог"],["🦀","Краб"],["🐠","Рыба"]] },
      { id: "birds", title: "Птицы", cards: [["🦅","Орёл"],["🦆","Утка"],["🦜","Попугай"],["🦢","Лебедь"],["🦩","Фламинго"],["🐧","Пингвин"]] },
      { id: "insects", title: "Насекомые", cards: [["🐝","Пчела"],["🦋","Бабочка"],["🐞","Божья коровка"],["🦗","Кузнечик"],["🪲","Жук"],["🐜","Муравей"]] },
    ],
  },
  {
    id: "nature", name: "Природа", icon: "🌿", desc: "Погода, растения и природные явления",
    categories: [
      { id: "weather", title: "Погода", cards: [["☀️","Солнце"],["🌧️","Дождь"],["⛈️","Гроза"],["🌨️","Снег"],["🌪️","Торнадо"],["🌈","Радуга"]] },
      { id: "flowers", title: "Цветы", cards: [["🌹","Роза"],["🌷","Тюльпан"],["🌻","Подсолнух"],["🌸","Сакура"],["🪻","Гиацинт"],["🌺","Гибискус"]] },
      { id: "plants", title: "Растения", cards: [["🌵","Кактус"],["🌴","Пальма"],["🌲","Ель"],["🌳","Дерево"],["🎋","Бамбук"],["🍀","Клевер"]] },
      { id: "mountains", title: "Горы", cards: [["⛰️","Гора"],["🏔️","Снежная вершина"],["🌋","Вулкан"],["🪨","Скала"],["🧗","Скалолаз"],["🏞️","Нацпарк"]] },
      { id: "water", title: "Вода", cards: [["🌊","Волна"],["💧","Капля"],["🧊","Лёд"],["🏝️","Остров"],["⛲","Фонтан"],["🚣","Лодка"]] },
      { id: "night", title: "Ночь", cards: [["🌙","Луна"],["⭐","Звезда"],["🌌","Млечный путь"],["☄️","Комета"],["🌠","Падающая звезда"],["🌑","Новолуние"]] },
    ],
  },
  {
    id: "food", name: "Еда", icon: "🍕", desc: "Продукты и блюда по понятным ассоциациям",
    categories: [
      { id: "breakfast", title: "Завтрак", cards: [["🍳","Яичница"],["🥞","Блины"],["🥐","Круассан"],["☕","Кофе"],["🥣","Каша"],["🍞","Хлеб"]] },
      { id: "fruit", title: "Фрукты", cards: [["🍎","Яблоко"],["🍌","Банан"],["🍓","Клубника"],["🍇","Виноград"],["🍉","Арбуз"],["🍍","Ананас"]] },
      { id: "vegetables", title: "Овощи", cards: [["🥕","Морковь"],["🥦","Брокколи"],["🌽","Кукуруза"],["🍅","Помидор"],["🥒","Огурец"],["🫑","Перец"]] },
      { id: "fastfood", title: "Фастфуд", cards: [["🍔","Бургер"],["🍟","Картофель фри"],["🍕","Пицца"],["🌭","Хот-дог"],["🌮","Тако"],["🥤","Газировка"]] },
      { id: "sweets", title: "Сладкое", cards: [["🍰","Торт"],["🧁","Кекс"],["🍩","Пончик"],["🍪","Печенье"],["🍫","Шоколад"],["🍬","Конфета"]] },
      { id: "asia", title: "Азиатская кухня", cards: [["🍣","Суши"],["🍜","Лапша"],["🍚","Рис"],["🥟","Пельмени"],["🍱","Бенто"],["🥢","Палочки"]] },
    ],
  },
  {
    id: "space", name: "Космос", icon: "🚀", desc: "Объекты, техника и явления космоса",
    categories: [
      { id: "flight", title: "Полёт", cards: [["🚀","Ракета"],["🛰️","Спутник"],["🛸","НЛО"],["👨‍🚀","Астронавт"],["🌌","Космос"],["🔭","Телескоп"]] },
      { id: "earth", title: "Земля", cards: [["🌍","Планета"],["🗺️","Карта мира"],["🧭","Компас"],["🌊","Океан"],["☁️","Атмосфера"],["🛰️","Орбита"]] },
      { id: "moon", title: "Луна", cards: [["🌕","Полнолуние"],["🌙","Серп"],["👨‍🚀","Астронавт"],["🚀","Полёт"],["🔭","Наблюдение"],["🛰️","Спутник"]] },
      { id: "stars", title: "Звёзды", cards: [["⭐","Звезда"],["🌟","Яркая звезда"],["✨","Сияние"],["🌠","Падающая звезда"],["☄️","Комета"],["💫","Орбита"]] },
      { id: "science", title: "Наука", cards: [["🧪","Пробирка"],["🔬","Микроскоп"],["🧬","ДНК"],["⚛️","Атом"],["📡","Антенна"],["🖥️","Компьютер"]] },
      { id: "future", title: "Будущее", cards: [["🤖","Робот"],["👽","Инопланетянин"],["🦾","Протез"],["🔋","Батарея"],["💡","Идея"],["🕶️","Технологии"]] },
    ],
  },
  {
    id: "emotions", name: "Эмоции", icon: "😎", desc: "Определи эмоцию по выражению лица",
    categories: [
      { id: "joy", title: "Радость", cards: [["😀","Улыбка"],["😂","Смех"],["🎉","Праздник"],["🥳","Веселье"],["🏆","Победа"],["☀️","Хороший день"]] },
      { id: "sad", title: "Грусть", cards: [["😢","Слеза"],["🌧️","Дождь"],["💔","Разбитое сердце"],["🥀","Увядший цветок"],["☔","Пасмурно"],["😞","Печаль"]] },
      { id: "anger", title: "Злость", cards: [["😠","Сердитость"],["💢","Гнев"],["🔥","Вспышка"],["👿","Злой"],["👊","Удар"],["🌋","Вулкан"]] },
      { id: "fear", title: "Страх", cards: [["😱","Ужас"],["👻","Призрак"],["🌑","Темнота"],["🕷️","Паук"],["⚡","Внезапность"],["🫣","Прячется"]] },
      { id: "love", title: "Любовь", cards: [["❤️","Сердце"],["💐","Цветы"],["💍","Кольцо"],["😘","Поцелуй"],["💌","Письмо"],["🥰","Нежность"]] },
      { id: "tired", title: "Усталость", cards: [["😴","Сон"],["🥱","Зевок"],["💤","Дремота"],["🛏️","Кровать"],["☕","Нужен кофе"],["🔋","Мало энергии"]] },
    ],
  },
  {
    id: "transport", name: "Транспорт", icon: "🚗", desc: "Транспорт по назначению, среде и типу",
    categories: [
      { id: "city", title: "Город", cards: [["🚕","Такси"],["🚌","Автобус"],["🚎","Троллейбус"],["🚋","Трамвай"],["🚇","Метро"],["🚲","Велосипед"]] },
      { id: "road", title: "Дорога", cards: [["🚗","Автомобиль"],["🛣️","Шоссе"],["🚦","Светофор"],["⛽","Заправка"],["🅿️","Парковка"],["🚧","Ремонт"]] },
      { id: "air", title: "Воздух", cards: [["✈️","Самолёт"],["🛩️","Лёгкий самолёт"],["🚁","Вертолёт"],["🛫","Взлёт"],["🪂","Парашют"],["🎈","Воздушный шар"]] },
      { id: "sea", title: "Море", cards: [["🚢","Корабль"],["⛴️","Паром"],["🛳️","Лайнер"],["⛵","Яхта"],["🚤","Катер"],["🛶","Каноэ"]] },
      { id: "rail", title: "Рельсы", cards: [["🚂","Паровоз"],["🚉","Станция"],["🛤️","Путь"],["🎫","Билет"],["🚦","Сигнал"],["🧳","Багаж"]] },
      { id: "service", title: "Службы", cards: [["🚑","Скорая"],["🚒","Пожарная"],["🚓","Полиция"],["🚔","Патруль"],["🚐","Фургон"],["🚜","Трактор"]] },
    ],
  },
  {
    id: "home", name: "Дом", icon: "🏠", desc: "Комнаты, вещи и домашние занятия",
    categories: [
      { id: "kitchen", title: "Кухня", cards: [["🍳","Сковорода"],["🥣","Миска"],["🔪","Нож"],["🥄","Ложка"],["🫖","Чайник"],["🧂","Соль"]] },
      { id: "bedroom", title: "Спальня", cards: [["🛏️","Кровать"],["🛌","Сон"],["⏰","Будильник"],["🪞","Зеркало"],["👕","Одежда"],["💡","Лампа"]] },
      { id: "bathroom", title: "Ванная", cards: [["🛁","Ванна"],["🚿","Душ"],["🧼","Мыло"],["🪥","Щётка"],["🧴","Шампунь"],["🧻","Бумага"]] },
      { id: "cleaning", title: "Уборка", cards: [["🧹","Веник"],["🧽","Губка"],["🪣","Ведро"],["🧺","Корзина"],["🧤","Перчатки"],["🫧","Пена"]] },
      { id: "office", title: "Работа", cards: [["💻","Ноутбук"],["🖥️","Монитор"],["⌨️","Клавиатура"],["🖱️","Мышь"],["📝","Запись"],["📎","Скрепка"]] },
      { id: "repair", title: "Ремонт", cards: [["🔨","Молоток"],["🪛","Отвёртка"],["🔧","Ключ"],["🪚","Пила"],["🧰","Инструменты"],["🪜","Лестница"]] },
    ],
  },
  {
    id: "sports", name: "Спорт", icon: "⚽", desc: "Виды спорта, инвентарь и соревнования",
    categories: [
      { id: "ball", title: "Мяч", cards: [["⚽","Футбол"],["🏀","Баскетбол"],["🏐","Волейбол"],["🏈","Регби"],["⚾","Бейсбол"],["🎾","Теннис"]] },
      { id: "winter", title: "Зимний спорт", cards: [["⛷️","Лыжи"],["🏂","Сноуборд"],["⛸️","Коньки"],["🥌","Кёрлинг"],["🏒","Хоккей"],["🛷","Сани"]] },
      { id: "water", title: "Водный", cards: [["🏊","Плавание"],["🏄","Сёрфинг"],["🚣","Гребля"],["🤽","Водное поло"],["🛶","Каяк"],["⛵","Парус"]] },
      { id: "fight", title: "Борьба", cards: [["🥊","Бокс"],["🥋","Кимоно"],["🤼","Борьба"],["🤺","Фехтование"],["🏋️","Штанга"],["💪","Сила"]] },
      { id: "track", title: "Стадион", cards: [["🏃","Бег"],["🏃‍♀️","Забег"],["🥇","Медаль"],["🏟️","Стадион"],["⏱️","Секундомер"],["🏆","Кубок"]] },
      { id: "target", title: "Точность", cards: [["🏹","Лук"],["🎯","Мишень"],["🎳","Боулинг"],["⛳","Гольф"],["🎱","Бильярд"],["🥏","Фрисби"]] },
    ],
  },
  {
    id: "travel", name: "Путешествия", icon: "🧳", desc: "Отпуск, дорога и места вокруг света",
    categories: [
      { id: "beach", title: "Пляж", cards: [["🏖️","Пляж"],["🏝️","Остров"],["🌴","Пальма"],["👙","Купальник"],["🩴","Шлёпанцы"],["⛱️","Зонт"]] },
      { id: "camping", title: "Поход", cards: [["⛺","Палатка"],["🥾","Ботинок"],["🎒","Рюкзак"],["🔥","Костёр"],["🧭","Компас"],["🏕️","Кемпинг"]] },
      { id: "hotel", title: "Отель", cards: [["🏨","Отель"],["🛎️","Звонок"],["🧳","Чемодан"],["🛏️","Номер"],["🔑","Ключ"],["🧾","Счёт"]] },
      { id: "airport", title: "Аэропорт", cards: [["🛫","Вылет"],["🛬","Посадка"],["🎫","Билет"],["🛂","Паспортный контроль"],["🧳","Багаж"],["🛃","Таможня"]] },
      { id: "city", title: "Туризм", cards: [["🗺️","Карта"],["📸","Фото"],["🏛️","Музей"],["🗽","Достопримечательность"],["🚶","Прогулка"],["🧭","Навигация"]] },
      { id: "mountain", title: "Высота", cards: [["🏔️","Горы"],["🚡","Канатка"],["🧗","Скалолаз"],["🥾","Треккинг"],["🌲","Лес"],["🏞️","Парк"]] },
    ],
  },
  {
    id: "celebration", name: "Праздники", icon: "🎉", desc: "Праздники, подарки и яркие события",
    categories: [
      { id: "birthday", title: "День рождения", cards: [["🎂","Торт"],["🎁","Подарок"],["🎈","Шар"],["🥳","Праздник"],["🕯️","Свеча"],["🎉","Конфетти"]] },
      { id: "newyear", title: "Новый год", cards: [["🎄","Ёлка"],["🎅","Санта"],["❄️","Снег"],["🎁","Подарок"],["🥂","Бокалы"],["✨","Огни"]] },
      { id: "halloween", title: "Хэллоуин", cards: [["🎃","Тыква"],["👻","Призрак"],["🧙","Ведьма"],["🦇","Летучая мышь"],["🍬","Сладости"],["🕸️","Паутина"]] },
      { id: "wedding", title: "Свадьба", cards: [["💍","Кольцо"],["💐","Букет"],["👰","Невеста"],["🤵","Жених"],["🥂","Тост"],["❤️","Любовь"]] },
      { id: "party", title: "Вечеринка", cards: [["🎶","Музыка"],["💃","Танец"],["🪩","Диско"],["🥳","Веселье"],["🍹","Коктейль"],["🎊","Конфетти"]] },
      { id: "victory", title: "Победа", cards: [["🏆","Кубок"],["🥇","Золото"],["🎖️","Награда"],["👏","Аплодисменты"],["🎉","Праздник"],["🔥","Триумф"]] },
    ],
  },
];


ASSOCIATION_COLLECTION_DEFS.push(
  {
    id: "music", name: "Музыка", icon: "🎵", desc: "Инструменты, жанры и всё вокруг музыки",
    categories: [
      { id: "strings", title: "Струны", cards: [["🎸","Гитара"],["🎻","Скрипка"],["🪕","Банджо"],["🎼","Ноты"],["🎵","Мелодия"],["🎶","Музыка"]] },
      { id: "keys", title: "Клавиши", cards: [["🎹","Пианино"],["🎼","Партитура"],["🎵","Нота"],["👨‍🎤","Музыкант"],["🎧","Наушники"],["🎶","Мелодия"]] },
      { id: "rhythm", title: "Ритм", cards: [["🥁","Барабан"],["🪘","Тамтам"],["👏","Хлопок"],["💃","Танец"],["🕺","Танцор"],["🎶","Ритм"]] },
      { id: "concert", title: "Концерт", cards: [["🎤","Микрофон"],["🎟️","Билет"],["🎫","Пропуск"],["🤘","Рок"],["🪩","Сцена"],["👏","Аплодисменты"]] },
      { id: "studio", title: "Студия", cards: [["🎙️","Запись"],["🎚️","Микшер"],["🎛️","Пульт"],["🎧","Наушники"],["💻","Компьютер"],["🔊","Монитор"]] },
      { id: "orchestra", title: "Оркестр", cards: [["🎻","Скрипка"],["🎺","Труба"],["🎷","Саксофон"],["🥁","Ударные"],["🪈","Флейта"],["👨‍🎼","Дирижёр"]] },
    ],
  },
  {
    id: "cinema", name: "Кино", icon: "🎬", desc: "Жанры, съёмки и атмосфера кино",
    categories: [
      { id: "screen", title: "Кинотеатр", cards: [["🎬","Кино"],["🍿","Попкорн"],["🎟️","Билет"],["📽️","Проектор"],["🎞️","Плёнка"],["🪑","Кресло"]] },
      { id: "horror", title: "Ужасы", cards: [["👻","Призрак"],["🧟","Зомби"],["🧛","Вампир"],["🔪","Нож"],["🌑","Темнота"],["😱","Крик"]] },
      { id: "comedy", title: "Комедия", cards: [["😂","Смех"],["🤣","Хохот"],["🤡","Клоун"],["🎭","Театр"],["🍌","Гэг"],["😜","Шутка"]] },
      { id: "romance", title: "Романтика", cards: [["❤️","Любовь"],["💐","Букет"],["💋","Поцелуй"],["🌹","Роза"],["💌","Письмо"],["🥂","Свидание"]] },
      { id: "action", title: "Боевик", cards: [["💥","Взрыв"],["🚁","Погоня"],["🏎️","Скорость"],["🕶️","Герой"],["🔥","Огонь"],["🎯","Цель"]] },
      { id: "cartoon", title: "Мультфильм", cards: [["🐭","Герой"],["🌈","Краски"],["✨","Магия"],["🏰","Замок"],["🧚","Фея"],["🎨","Рисунок"]] },
    ],
  },
  {
    id: "school", name: "Школа", icon: "🎓", desc: "Учёба, предметы и школьная жизнь",
    categories: [
      { id: "class", title: "Урок", cards: [["🏫","Школа"],["🧑‍🏫","Учитель"],["🪑","Парта"],["📚","Учебники"],["✏️","Карандаш"],["📝","Тетрадь"]] },
      { id: "math", title: "Математика", cards: [["➕","Сложение"],["➖","Вычитание"],["✖️","Умножение"],["➗","Деление"],["📐","Угольник"],["🧮","Счёты"]] },
      { id: "science2", title: "Физика", cards: [["⚛️","Атом"],["🧲","Магнит"],["💡","Свет"],["🔋","Энергия"],["📏","Измерение"],["🧪","Опыт"]] },
      { id: "writing", title: "Письмо", cards: [["✍️","Писать"],["🖊️","Ручка"],["✏️","Карандаш"],["📓","Тетрадь"],["🔤","Буквы"],["📖","Текст"]] },
      { id: "geo", title: "География", cards: [["🌍","Земля"],["🗺️","Карта"],["🧭","Компас"],["🏔️","Горы"],["🌊","Океан"],["🏳️","Страны"]] },
      { id: "graduation", title: "Выпуск", cards: [["🎓","Диплом"],["📜","Грамота"],["🎉","Праздник"],["🏫","Школа"],["📸","Фото"],["🥳","Выпускной"]] },
    ],
  },
  {
    id: "tech", name: "Техника", icon: "💻", desc: "Гаджеты, интернет и цифровая жизнь",
    categories: [
      { id: "phone", title: "Смартфон", cards: [["📱","Телефон"],["🔋","Батарея"],["📶","Сеть"],["📸","Камера"],["💬","Чат"],["🔔","Уведомление"]] },
      { id: "computer", title: "Компьютер", cards: [["🖥️","Монитор"],["⌨️","Клавиатура"],["🖱️","Мышь"],["💾","Диск"],["🧠","Процессор"],["🔌","Питание"]] },
      { id: "internet", title: "Интернет", cards: [["🌐","Сеть"],["📡","Антенна"],["📶","Wi-Fi"],["🔗","Ссылка"],["☁️","Облако"],["🔒","Безопасность"]] },
      { id: "gaming", title: "Гейминг", cards: [["🎮","Геймпад"],["🕹️","Джойстик"],["🎧","Гарнитура"],["🏆","Победа"],["👾","Аркада"],["🖥️","Экран"]] },
      { id: "charge", title: "Зарядка", cards: [["🔋","Батарея"],["⚡","Энергия"],["🔌","Розетка"],["🪫","Разряд"],["📱","Телефон"],["💡","Питание"]] },
      { id: "smarthome", title: "Умный дом", cards: [["🏠","Дом"],["💡","Лампа"],["🔊","Колонка"],["📱","Управление"],["🌡️","Термостат"],["📷","Камера"]] },
    ],
  },
  {
    id: "health", name: "Здоровье", icon: "🩺", desc: "Медицина, забота о себе и самочувствие",
    categories: [
      { id: "doctor", title: "Врач", cards: [["🧑‍⚕️","Доктор"],["🩺","Стетоскоп"],["🏥","Больница"],["💉","Укол"],["🩹","Пластырь"],["📋","Карта"]] },
      { id: "teeth", title: "Зубы", cards: [["🦷","Зуб"],["🪥","Щётка"],["🧴","Паста"],["😁","Улыбка"],["🧑‍⚕️","Стоматолог"],["💧","Полоскание"]] },
      { id: "medicine", title: "Лекарства", cards: [["💊","Таблетка"],["🧴","Сироп"],["💉","Инъекция"],["🩹","Пластырь"],["🌡️","Температура"],["📄","Рецепт"]] },
      { id: "fitness", title: "Фитнес", cards: [["🏋️","Тренировка"],["💪","Сила"],["🏃","Бег"],["🧘","Йога"],["🥤","Вода"],["⌚","Пульс"]] },
      { id: "sleep", title: "Сон", cards: [["😴","Спать"],["🛏️","Кровать"],["🌙","Ночь"],["💤","Сон"],["⏰","Будильник"],["🛌","Отдых"]] },
      { id: "firstaid", title: "Первая помощь", cards: [["🩹","Пластырь"],["🩺","Помощь"],["🚑","Скорая"],["🧊","Холод"],["🧤","Перчатки"],["📞","Вызов"]] },
    ],
  },
  {
    id: "citylife", name: "Город", icon: "🏙️", desc: "Места, службы и повседневная городская жизнь",
    categories: [
      { id: "street", title: "Улица", cards: [["🚦","Светофор"],["🚶","Пешеход"],["🚗","Машина"],["🛣️","Дорога"],["🏢","Дом"],["🚏","Остановка"]] },
      { id: "park", title: "Парк", cards: [["🌳","Дерево"],["🌿","Зелень"],["🪑","Скамейка"],["🚲","Велосипед"],["🐕","Собака"],["⛲","Фонтан"]] },
      { id: "cafe", title: "Кафе", cards: [["☕","Кофе"],["🥐","Круассан"],["🍰","Десерт"],["🧾","Счёт"],["🪑","Столик"],["🥄","Ложка"]] },
      { id: "mall", title: "Торговый центр", cards: [["🛍️","Покупки"],["👕","Одежда"],["👟","Обувь"],["💳","Оплата"],["🛒","Тележка"],["🏬","Магазин"]] },
      { id: "station", title: "Вокзал", cards: [["🚉","Станция"],["🚆","Поезд"],["🎫","Билет"],["🧳","Багаж"],["🕐","Время"],["📢","Объявление"]] },
      { id: "build", title: "Стройка", cards: [["🏗️","Кран"],["👷","Рабочий"],["🧱","Кирпич"],["🔨","Молоток"],["🚧","Ограждение"],["🏢","Здание"]] },
    ],
  },
  {
    id: "fantasy", name: "Фэнтези", icon: "🧙", desc: "Магия, герои и сказочные приключения",
    categories: [
      { id: "magic", title: "Магия", cards: [["🪄","Палочка"],["✨","Заклинание"],["🧙","Маг"],["📜","Свиток"],["🔮","Шар"],["🧪","Зелье"]] },
      { id: "dragon", title: "Дракон", cards: [["🐉","Дракон"],["🔥","Огонь"],["🏰","Замок"],["🗡️","Меч"],["🛡️","Щит"],["💎","Сокровище"]] },
      { id: "knight", title: "Рыцарь", cards: [["🛡️","Щит"],["⚔️","Мечи"],["🏰","Замок"],["🐎","Конь"],["👑","Король"],["🏆","Турнир"]] },
      { id: "fairy", title: "Фея", cards: [["🧚","Фея"],["✨","Пыльца"],["🌸","Цветы"],["🪄","Волшебство"],["🦋","Бабочка"],["🌈","Радуга"]] },
      { id: "pirate", title: "Пират", cards: [["🏴‍☠️","Флаг"],["⚓","Якорь"],["🦜","Попугай"],["🗺️","Карта"],["💰","Золото"],["⛵","Корабль"]] },
      { id: "treasure", title: "Клад", cards: [["💎","Алмаз"],["🪙","Монета"],["🗝️","Ключ"],["📦","Сундук"],["🗺️","Карта"],["🏝️","Остров"]] },
    ],
  },
  {
    id: "jobs", name: "Профессии", icon: "🧑‍💼", desc: "Кто чем занимается и что использует в работе",
    categories: [
      { id: "medic", title: "Медик", cards: [["🧑‍⚕️","Врач"],["🩺","Стетоскоп"],["💉","Укол"],["🏥","Больница"],["💊","Лекарство"],["🚑","Скорая"]] },
      { id: "builder", title: "Строитель", cards: [["👷","Каска"],["🔨","Молоток"],["🧱","Кирпич"],["🏗️","Кран"],["📐","Чертёж"],["🪜","Лестница"]] },
      { id: "cook", title: "Повар", cards: [["👨‍🍳","Повар"],["🔪","Нож"],["🍳","Сковорода"],["🥘","Блюдо"],["🧂","Специи"],["🔥","Плита"]] },
      { id: "police", title: "Полиция", cards: [["👮","Офицер"],["🚓","Машина"],["🚨","Сирена"],["📻","Рация"],["🛡️","Защита"],["🚔","Патруль"]] },
      { id: "artist", title: "Художник", cards: [["🎨","Палитра"],["🖌️","Кисть"],["🖼️","Картина"],["✏️","Эскиз"],["🌈","Цвет"],["👨‍🎨","Мастер"]] },
      { id: "astronaut", title: "Космонавт", cards: [["👨‍🚀","Скафандр"],["🚀","Ракета"],["🌍","Земля"],["🌌","Космос"],["🛰️","Спутник"],["⭐","Звезда"]] },
    ],
  },
  {
    id: "times", name: "Времена", icon: "🍂", desc: "Сезоны, время суток и характерные признаки",
    categories: [
      { id: "spring", title: "Весна", cards: [["🌷","Тюльпан"],["🌱","Росток"],["🌦️","Дождь"],["🐦","Птицы"],["🌸","Цветение"],["☀️","Тепло"]] },
      { id: "summer", title: "Лето", cards: [["☀️","Солнце"],["🏖️","Пляж"],["🍉","Арбуз"],["🕶️","Очки"],["🌴","Пальма"],["🩴","Шлёпанцы"]] },
      { id: "autumn", title: "Осень", cards: [["🍂","Листья"],["🌧️","Дождь"],["☂️","Зонт"],["🎃","Тыква"],["🌰","Каштан"],["🧥","Куртка"]] },
      { id: "winter2", title: "Зима", cards: [["❄️","Снег"],["⛄","Снеговик"],["🧣","Шарф"],["🧤","Перчатки"],["🛷","Сани"],["☕","Горячее"]] },
      { id: "morning", title: "Утро", cards: [["🌅","Рассвет"],["☕","Кофе"],["⏰","Будильник"],["🪥","Щётка"],["🥣","Завтрак"],["📰","Новости"]] },
      { id: "evening", title: "Вечер", cards: [["🌇","Закат"],["🛋️","Диван"],["📺","Телевизор"],["🍵","Чай"],["🌙","Луна"],["💡","Лампа"]] },
    ],
  },
  {
    id: "shopping", name: "Покупки", icon: "🛍️", desc: "Магазины, товары и способы оплаты",
    categories: [
      { id: "clothes", title: "Одежда", cards: [["👕","Футболка"],["👖","Джинсы"],["🧥","Куртка"],["👗","Платье"],["🧢","Кепка"],["🧦","Носки"]] },
      { id: "shoes", title: "Обувь", cards: [["👟","Кроссовки"],["👞","Туфли"],["🥾","Ботинки"],["👢","Сапоги"],["🩴","Шлёпанцы"],["👠","Каблук"]] },
      { id: "beauty", title: "Красота", cards: [["💄","Помада"],["💅","Маникюр"],["🧴","Крем"],["🪞","Зеркало"],["🧼","Уход"],["🪮","Расчёска"]] },
      { id: "gadgets", title: "Гаджеты", cards: [["📱","Телефон"],["⌚","Часы"],["🎧","Наушники"],["💻","Ноутбук"],["📷","Камера"],["🔋","Пауэрбанк"]] },
      { id: "grocery", title: "Продукты", cards: [["🥛","Молоко"],["🍞","Хлеб"],["🥚","Яйца"],["🍎","Фрукты"],["🥕","Овощи"],["🧀","Сыр"]] },
      { id: "payment", title: "Оплата", cards: [["💳","Карта"],["💵","Наличные"],["🧾","Чек"],["📱","Телефон"],["🏧","Банкомат"],["🛒","Корзина"]] },
    ],
  },
  {
    id: "hobbies", name: "Хобби", icon: "🎨", desc: "Чем приятно заниматься в свободное время",
    categories: [
      { id: "photo", title: "Фото", cards: [["📷","Камера"],["📸","Снимок"],["🌄","Пейзаж"],["🤳","Селфи"],["🖼️","Галерея"],["💡","Свет"]] },
      { id: "garden", title: "Сад", cards: [["🌱","Росток"],["🌷","Цветок"],["🪴","Горшок"],["💧","Полив"],["🧤","Перчатки"],["🌿","Зелень"]] },
      { id: "fishing", title: "Рыбалка", cards: [["🎣","Удочка"],["🐟","Рыба"],["🪱","Наживка"],["🛶","Лодка"],["🌊","Вода"],["🧺","Улов"]] },
      { id: "craft", title: "Рукоделие", cards: [["🧶","Пряжа"],["🪡","Игла"],["✂️","Ножницы"],["🧵","Нить"],["🧷","Булавка"],["🎀","Декор"]] },
      { id: "reading", title: "Чтение", cards: [["📚","Книги"],["📖","Читать"],["🔖","Закладка"],["☕","Чай"],["🛋️","Кресло"],["💡","Лампа"]] },
      { id: "baking", title: "Выпечка", cards: [["🧁","Кекс"],["🍪","Печенье"],["🥧","Пирог"],["🧈","Масло"],["🥚","Яйцо"],["🔥","Духовка"]] },
    ],
  },
  {
    id: "games", name: "Игры", icon: "🎮", desc: "Настольные, цифровые и логические игры",
    categories: [
      { id: "chess", title: "Шахматы", cards: [["♟️","Пешка"],["♞","Конь"],["♜","Ладья"],["♛","Ферзь"],["♚","Король"],["🏁","Партия"]] },
      { id: "cards", title: "Карты", cards: [["♠️","Пики"],["♥️","Червы"],["♦️","Бубны"],["♣️","Трефы"],["🃏","Джокер"],["🎴","Колода"]] },
      { id: "arcade", title: "Аркада", cards: [["👾","Монстр"],["🕹️","Автомат"],["🎯","Очки"],["💥","Эффект"],["⭐","Бонус"],["🏆","Рекорд"]] },
      { id: "board", title: "Настолки", cards: [["🎲","Кубик"],["🧩","Фишки"],["🗺️","Поле"],["🏠","Клетка"],["👥","Игроки"],["🏆","Победа"]] },
      { id: "console", title: "Консоль", cards: [["🎮","Геймпад"],["📺","Экран"],["🎧","Гарнитура"],["💾","Сохранение"],["🏆","Ачивка"],["🕹️","Игра"]] },
      { id: "puzzle", title: "Головоломка", cards: [["🧩","Пазл"],["💡","Идея"],["🔐","Замок"],["🔢","Числа"],["🧠","Логика"],["❓","Задача"]] },
    ],
  },
  {
    id: "world", name: "Мир", icon: "🌍", desc: "Регионы, символы и известные места мира",
    categories: [
      { id: "europe", title: "Европа", cards: [["🇫🇷","Франция"],["🇮🇹","Италия"],["🇩🇪","Германия"],["🇪🇸","Испания"],["🏰","Замки"],["🚆","Поезда"]] },
      { id: "asia2", title: "Континент Азия", cards: [["🇯🇵","Япония"],["🇨🇳","Китай"],["🇰🇷","Корея"],["🍜","Лапша"],["🏯","Храм"],["🌸","Сакура"]] },
      { id: "america", title: "Америка", cards: [["🇺🇸","США"],["🗽","Статуя"],["🏙️","Город"],["🌵","Пустыня"],["🏈","Футбол"],["🍔","Бургер"]] },
      { id: "africa2", title: "Континент Африка", cards: [["🌍","Материк"],["🦁","Лев"],["🐘","Слон"],["🌴","Пальма"],["☀️","Жара"],["🏜️","Пустыня"]] },
      { id: "islands", title: "Острова", cards: [["🏝️","Остров"],["🌴","Пальма"],["🌊","Океан"],["🐚","Ракушка"],["⛵","Лодка"],["☀️","Солнце"]] },
      { id: "monuments", title: "Памятники", cards: [["🗼","Башня"],["🗽","Статуя"],["🏛️","Храм"],["🏰","Замок"],["🕌","Мечеть"],["⛩️","Ворота"]] },
    ],
  },
  {
    id: "safety", name: "Безопасность", icon: "🛡️", desc: "Сигналы, помощь и правила безопасности",
    categories: [
      { id: "fire", title: "Пожар", cards: [["🔥","Огонь"],["🧯","Огнетушитель"],["🚒","Пожарные"],["🚨","Тревога"],["💨","Дым"],["🚪","Выход"]] },
      { id: "rescue", title: "Спасение", cards: [["🛟","Круг"],["🚑","Скорая"],["🆘","SOS"],["📞","Звонок"],["🧑‍🚒","Спасатель"],["⛑️","Шлем"]] },
      { id: "warning", title: "Опасность", cards: [["⚠️","Внимание"],["🚫","Запрет"],["☢️","Радиация"],["☣️","Биориск"],["❗","Важно"],["🔺","Сигнал"]] },
      { id: "traffic", title: "ПДД", cards: [["🚦","Светофор"],["🛑","Стоп"],["🚸","Переход"],["🚧","Ремонт"],["⚠️","Знак"],["🚗","Авто"]] },
      { id: "cyber", title: "Кибербезопасность", cards: [["🔒","Пароль"],["🛡️","Защита"],["🔑","Ключ"],["💻","Компьютер"],["📧","Почта"],["⚠️","Фишинг"]] },
      { id: "home-safe", title: "Безопасность дома", cards: [["🔐","Замок"],["📷","Камера"],["🚪","Дверь"],["🔔","Сигнал"],["🔥","Датчик"],["📱","Контроль"]] },
    ],
  },
  {
    id: "events", name: "События", icon: "🎪", desc: "Яркие события, встречи и большие впечатления",
    categories: [
      { id: "wedding2", title: "Свадебный день", cards: [["💍","Кольцо"],["👰","Невеста"],["🤵","Жених"],["💐","Букет"],["🥂","Тост"],["🎂","Торт"]] },
      { id: "festival", title: "Фестиваль", cards: [["🎪","Фестиваль"],["🎶","Музыка"],["🎟️","Билет"],["🎨","Искусство"],["🌈","Краски"],["🎉","Праздник"]] },
      { id: "circus", title: "Цирк", cards: [["🎪","Шатёр"],["🤡","Клоун"],["🎠","Карусель"],["🎈","Шары"],["🪄","Фокус"],["👏","Аплодисменты"]] },
      { id: "concert2", title: "Шоу", cards: [["🎤","Певец"],["🎸","Гитара"],["🎧","Звук"],["💡","Свет"],["🎟️","Билет"],["👏","Зрители"]] },
      { id: "vacation", title: "Отпуск", cards: [["🏖️","Пляж"],["🧳","Чемодан"],["✈️","Самолёт"],["📸","Фото"],["🕶️","Очки"],["🍹","Коктейль"]] },
      { id: "meetup", title: "Встреча", cards: [["👥","Друзья"],["☕","Кофе"],["💬","Разговор"],["📍","Место"],["📅","Дата"],["😊","Радость"]] },
    ],
  }
);

function associationCollectionById(id) {
  return ASSOCIATION_COLLECTION_DEFS.find((x) => x.id === id) || ASSOCIATION_COLLECTION_DEFS[0];
}
function associationCollectionCategories(id) {
  const collection = associationCollectionById(id);
  return collection.categories.map((cat) => ({
    id: `visual:${collection.id}:${cat.id}`,
    title: cat.title,
    visual: true,
    visualCollection: collection.id,
    visualCollectionName: collection.name,
    difficulty: 2,
    words: cat.cards.map(([emoji]) => emoji),
    visualLabels: Object.fromEntries(cat.cards),
  }));
}
function allAssociationCategories() {
  return ASSOCIATION_COLLECTION_DEFS.flatMap((collection) => associationCollectionCategories(collection.id));
}
function visualCategoryById(id) {
  if (!String(id || "").startsWith("visual:")) return null;
  const [, collectionId, categoryId] = String(id).split(":");
  const collection = ASSOCIATION_COLLECTION_DEFS.find((x) => x.id === collectionId);
  const category = collection?.categories.find((x) => x.id === categoryId);
  return collection && category ? { collection, category, id: `visual:${collection.id}:${category.id}` } : null;
}
function normalizeCardSourceMode(value) {
  return ["words", "pictures", "all"].includes(value) ? value : "all";
}
function visualDiscoveredIds(p = typeof profile !== "undefined" ? profile : null) {
  const ids = new Set(Array.isArray(p?.visualDiscovered) ? p.visualDiscovered : []);
  for (const collection of ASSOCIATION_COLLECTION_DEFS) {
    const completed = p?.associationCollections?.[collection.id]?.completedCategories || [];
    completed.forEach((id) => ids.add(id));
  }
  return ids;
}
function visualDiscoveredCategoryCount(p = typeof profile !== "undefined" ? profile : null) {
  return visualDiscoveredIds(p).size;
}
function totalVisualCategoryCount() {
  return ASSOCIATION_COLLECTION_DEFS.reduce((n, collection) => n + collection.categories.length, 0);
}
function associationCollectionProgress(id, p = typeof profile !== "undefined" ? profile : null) {
  const collection = associationCollectionById(id), raw = p?.associationCollections?.[collection.id] || {};
  const completed = Array.isArray(raw.completedCategories) ? raw.completedCategories : [];
  return {
    plays: +raw.plays || 0,
    wins: +raw.wins || 0,
    completedCategories: completed,
    completed: completed.filter((catId) => collection.categories.some((c) => `visual:${collection.id}:${c.id}` === catId)).length,
    total: collection.categories.length,
  };
}

const CHAPTER_SIZE = 10;
const CHAPTER_NAMES = [
  "Первые связи",
  "Знакомые миры",
  "Переплетения",
  "Тонкие намёки",
  "Большой словарь",
  "Мастер ассоциаций",
  "Скрытые смыслы",
  "Словесный лабиринт",
  "Точные связи",
  "Эрудит",
  "Большая энциклопедия",
  "За гранью очевидного",
];

function chapterStarsForProfile(p, number) {
  const start = (number - 1) * CHAPTER_SIZE + 1;
  return Array.from({ length: CHAPTER_SIZE }, (_, i) => +(p.starsByLevel?.[start + i] || 0));
}
function completedChapterCount(p) {
  const maxChapter = Math.max(1, Math.ceil(Math.max(1, +(p.currentLevel || 1) - 1) / CHAPTER_SIZE));
  let count = 0;
  for (let n = 1; n <= maxChapter; n++) if (chapterStarsForProfile(p, n).every((x) => x > 0)) count++;
  return count;
}
function perfectChapterCount(p) {
  const maxChapter = Math.max(1, Math.ceil(Math.max(1, +(p.currentLevel || 1) - 1) / CHAPTER_SIZE));
  let count = 0;
  for (let n = 1; n <= maxChapter; n++) if (chapterStarsForProfile(p, n).every((x) => x === 3)) count++;
  return count;
}
function discoveredCategoryCount(p) {
  if (!BANK.length) return new Set(p.discovered || []).size;
  const available = new Set(BANK.map((c) => c.id));
  return new Set((p.discovered || []).filter((id) => available.has(id))).size;
}
function hasDiscoveredAllCategories(p) {
  if (!BANK.length) return false;
  const discovered = new Set(p.discovered || []);
  return BANK.every((c) => discovered.has(c.id));
}

const SPECIAL_LEVELS = [
  { id: "no-hints", icon: "◈", title: "Без подсказок", desc: "Подсказки отключены", offset: 5, noHints: true },
  { id: "precise", icon: "◇", title: "Точный расклад", desc: "Доступна только 1 отмена", offset: 10, maxUndos: 1 },
  { id: "one-recycle", icon: "↻", title: "Одна прокрутка", desc: "Колоду можно вернуть только один раз", offset: 15, maxRecycles: 1 },
  { id: "big-mix", icon: "✦", title: "Большая коллекция", desc: "Больше категорий и слов", offset: 20, bigMix: true },
];

const THEME_DEFS = [
  { id: "violet", name: "Фиолетовая", stars: 0 },
  { id: "ocean", name: "Океан", stars: 30 },
  { id: "sunset", name: "Закат", stars: 75 },
  { id: "paper", name: "Бумага", stars: 100 },
  { id: "aurora", name: "Сияние", stars: 150 },
  { id: "neon", name: "Неон", stars: 225 },
  { id: "forest", name: "Лес", stars: 300 },
  { id: "frost", name: "Иней", stars: 375 },
  { id: "candy", name: "Конфетная", stars: 450 },
  { id: "midnight", name: "Полночь", stars: 550 },
  { id: "gold", name: "Золото", stars: 700 },
  { id: "galaxy", name: "Галактика", stars: 1000 },
];
const CARD_BACK_DEFS = [
  { id: "classic", name: "Классика", desc: "Базовая рубашка", minAchievements: 0 },
  { id: "prism", name: "Призма", desc: "За 4 достижения", minAchievements: 4 },
  { id: "constellation", name: "Созвездия", desc: "За 8 достижений", minAchievements: 8 },
  { id: "trophy", name: "Трофей", desc: "За 12 достижений", minAchievements: 12 },
  { id: "mosaic", name: "Мозаика", desc: "За 16 достижений", minAchievements: 16 },
  { id: "velvet", name: "Бархат", desc: "За 20 достижений", minAchievements: 20 },
  { id: "glacier", name: "Ледник", desc: "За 24 достижения", minAchievements: 24 },
  { id: "lotus", name: "Бамбук", desc: "За 28 достижений", minAchievements: 28 },
  { id: "duelist", name: "Дуэлянт", desc: "За 10 побед в дуэлях", achievement: "duelWins10", rare: true },
  { id: "anniversary", name: "Годовщина", desc: "За 365 дней в игре", achievement: "visits365", rare: true },
  { id: "crown", name: "Корона", desc: "За идеальную главу", achievement: "chapterPerfect1", rare: true },
  { id: "ember", name: "Пламя", desc: "За серию 30 дней", achievement: "streak30", rare: true },
  { id: "master", name: "Мастер", desc: "За комбо ×10", achievement: "combo10", rare: true },
  { id: "atlas", name: "Атлас", desc: "За всю коллекцию категорий", achievement: "collectorAll", rare: true },
  { id: "chronicle", name: "Хроника", desc: "За 100 ежедневных раскладов", achievement: "daily100", rare: true },
  { id: "phoenix", name: "Феникс", desc: "За 25 особых уровней", achievement: "special25", rare: true },
  { id: "legend", name: "Легенда", desc: "За 3 идеальные главы", achievement: "chapterPerfect3", rare: true },
  { id: "obsidian", name: "Обсидиан", desc: "За 5 идеальных глав", achievement: "chapterPerfect5", rare: true },
];
const ACHIEVEMENTS = [
  {
    id: "first",
    icon: "✦",
    title: "Первый расклад",
    desc: "Пройти 1 уровень",
    test: (p) => p.stats.levelsCompleted >= 1,
  },
  {
    id: "ten",
    icon: "10",
    title: "Вошёл во вкус",
    desc: "Пройти 10 уровней",
    test: (p) => p.stats.levelsCompleted >= 10,
  },
  {
    id: "fifty",
    icon: "50",
    title: "Словасьянсер",
    desc: "Пройти 50 уровней",
    test: (p) => p.stats.levelsCompleted >= 50,
  },
  {
    id: "hundred",
    icon: "★",
    title: "Мастер ассоциаций",
    desc: "Пройти 100 уровней",
    test: (p) => p.stats.levelsCompleted >= 100,
  },
  {
    id: "clean",
    icon: "★★★",
    title: "Чистая работа",
    desc: "Получить 3 звезды",
    test: (p) => p.stats.tripleStarWins >= 1,
  },
  {
    id: "perfect10",
    icon: "♛",
    title: "Перфекционист",
    desc: "10 уровней на 3 звезды",
    test: (p) => p.stats.tripleStarWins >= 10,
  },
  {
    id: "nohint",
    icon: "?",
    title: "Самостоятельный",
    desc: "20 побед без подсказок",
    test: (p) => p.stats.noHintWins >= 20,
  },
  {
    id: "noundo",
    icon: "↶",
    title: "Без возврата",
    desc: "20 побед без отмен",
    test: (p) => p.stats.noUndoWins >= 20,
  },
  { id: "discover25", icon: "▦25", title: "Первые открытия", desc: "Открыть 25 разных категорий", test: (p) => discoveredCategoryCount(p) >= 25 },
  { id: "discover50", icon: "▦50", title: "Исследователь", desc: "Открыть 50 разных категорий", test: (p) => discoveredCategoryCount(p) >= 50 },
  { id: "discover75", icon: "▦75", title: "Знаток ассоциаций", desc: "Открыть 75 разных категорий", test: (p) => discoveredCategoryCount(p) >= 75 },
  {
    id: "collector",
    icon: "▦100",
    title: "Коллекционер",
    desc: "Открыть 100 разных категорий",
    test: (p) => discoveredCategoryCount(p) >= 100,
  },
  {
    id: "encyclopedia",
    icon: "▦125",
    title: "Энциклопедия",
    desc: "Открыть 125 разных категорий",
    test: (p) => discoveredCategoryCount(p) >= 125,
  },
  {
    id: "daily",
    icon: "☀",
    title: "Доброе утро",
    desc: "Пройти ежедневный расклад",
    test: (p) => p.stats.dailyCompleted >= 1,
  },
  { id: "combo5", icon: "×5", title: "На волне", desc: "Сделать комбо ×5", test: (p) => (p.stats.maxDragCombo || 0) >= 5 },
  { id: "special5", icon: "◆", title: "Особый случай", desc: "Пройти 5 особых уровней", test: (p) => (p.stats.specialCompleted || 0) >= 5 },
  { id: "chapter1", icon: "Ⅰ", title: "Первая глава", desc: "Полностью пройти 1 главу", test: (p) => completedChapterCount(p) >= 1 },
  { id: "chapter3", icon: "Ⅲ", title: "Книжный червь", desc: "Полностью пройти 3 главы", test: (p) => completedChapterCount(p) >= 3 },
  { id: "chapter5", icon: "Ⅴ", title: "Большая история", desc: "Полностью пройти 5 глав", test: (p) => completedChapterCount(p) >= 5 },
  { id: "chapterPerfect1", icon: "♛", title: "Идеальная глава", desc: "Получить 30/30 ★ в одной главе", rare: true, test: (p) => perfectChapterCount(p) >= 1 },
  { id: "chapterPerfect3", icon: "♛", title: "Безупречный путь", desc: "Получить 30/30 ★ в трёх главах", rare: true, test: (p) => perfectChapterCount(p) >= 3 },
  { id: "chapterPerfect5", icon: "✦", title: "Легенда Словасьянса", desc: "Получить 30/30 ★ в пяти главах", rare: true, test: (p) => perfectChapterCount(p) >= 5 },
  { id: "streak7", icon: "🔥", title: "Привычка", desc: "Серия 7 дней", test: (p) => p.daily.bestStreak >= 7 },
  {
    id: "streak30",
    icon: "🔥",
    title: "Постоянство",
    desc: "Серия 30 дней",
    test: (p) => p.daily.bestStreak >= 30,
  },
  { id: "twentyfive", icon: "25", title: "Уверенный старт", desc: "Пройти 25 уровней", test: (p) => p.stats.levelsCompleted >= 25 },
  { id: "twofifty", icon: "250", title: "Длинная дистанция", desc: "Пройти 250 уровней", test: (p) => p.stats.levelsCompleted >= 250 },
  { id: "fivehundred", icon: "500", title: "Неостановимый", desc: "Пройти 500 уровней", rare: true, test: (p) => p.stats.levelsCompleted >= 500 },
  { id: "perfect25", icon: "★25", title: "Четверть сотни", desc: "25 уровней на 3 звезды", test: (p) => p.stats.tripleStarWins >= 25 },
  { id: "perfect50", icon: "★50", title: "Безупречная форма", desc: "50 уровней на 3 звезды", test: (p) => p.stats.tripleStarWins >= 50 },
  { id: "perfect100", icon: "★100", title: "Золотой стандарт", desc: "100 уровней на 3 звезды", rare: true, test: (p) => p.stats.tripleStarWins >= 100 },
  { id: "nohint50", icon: "?50", title: "Своя голова", desc: "50 побед без подсказок", test: (p) => p.stats.noHintWins >= 50 },
  { id: "nohint100", icon: "?100", title: "Без подсказок", desc: "100 побед без подсказок", rare: true, test: (p) => p.stats.noHintWins >= 100 },
  { id: "noundo50", icon: "↶50", title: "Без оглядки", desc: "50 побед без отмен", test: (p) => p.stats.noUndoWins >= 50 },
  { id: "noundo100", icon: "↶100", title: "Только вперёд", desc: "100 побед без отмен", rare: true, test: (p) => p.stats.noUndoWins >= 100 },
  { id: "collectorAll", icon: "▦✓", title: "Полная коллекция", desc: "Открыть все категории", rare: true, test: (p) => hasDiscoveredAllCategories(p) },
  { id: "games100", icon: "100", title: "Сотня партий", desc: "Сыграть 100 партий", test: (p) => (p.stats.gamesPlayed || 0) >= 100 },
  { id: "daily7", icon: "☀7", title: "Ежедневная неделя", desc: "Пройти 7 ежедневных раскладов", test: (p) => p.stats.dailyCompleted >= 7 },
  { id: "daily30", icon: "☀30", title: "Ежедневный месяц", desc: "Пройти 30 ежедневных раскладов", test: (p) => p.stats.dailyCompleted >= 30 },
  { id: "daily100", icon: "☀100", title: "Ритуал", desc: "Пройти 100 ежедневных раскладов", rare: true, test: (p) => p.stats.dailyCompleted >= 100 },
  { id: "combo3", icon: "×3", title: "Точная рука", desc: "Сделать ручное комбо ×3", test: (p) => (p.stats.maxDragCombo || 0) >= 3 },
  { id: "combo10", icon: "×10", title: "Мастер движений", desc: "Сделать ручное комбо ×10", rare: true, test: (p) => (p.stats.maxDragCombo || 0) >= 10 },
  { id: "special10", icon: "◆10", title: "Любитель испытаний", desc: "Пройти 10 особых уровней", test: (p) => (p.stats.specialCompleted || 0) >= 10 },
  { id: "special25", icon: "◆25", title: "Испытатель", desc: "Пройти 25 особых уровней", rare: true, test: (p) => (p.stats.specialCompleted || 0) >= 25 },
];
const DEFAULT_STATS = {
  levelsCompleted: 0,
  gamesPlayed: 0,
  categoriesCompleted: 0,
  tripleStarWins: 0,
  noHintWins: 0,
  noUndoWins: 0,
  hints: 0,
  undos: 0,
  autoMoves: 0,
  stockDraws: 0,
  restarts: 0,
  dailyCompleted: 0,
  maxCombo: 0,
  maxDragCombo: 0,
  deadlocks: 0,
  specialCompleted: 0,
  weeklyCompleted: 0,
  challengesCompleted: 0,
  calmCompleted: 0,
  collectionGamesCompleted: 0,
  bestMarathon: 0,
  totalMoves: 0,
  personalRecords: 0,
  masteredCategories: 0,
  masteredPictureCategories: 0,
  chapterFinalsCompleted: 0,
  bonusObjectivesCompleted: 0,
  seriesWins: 0,
  duelMatches: 0,
  duelWins: 0,
  duelLosses: 0,
  duelDraws: 0,
};

const WEEKLY_DEFS = [
  { id: "stars", icon: "★", title: "Звёздная неделя", desc: "Заработать 45 звёзд с понедельника по воскресенье", metric: "stars", goal: 45, rewardXp: 450 },
  { id: "noHints", icon: "?", title: "Своя голова", desc: "Пройти 15 партий без подсказок за неделю", metric: "noHintWins", goal: 15, rewardXp: 480 },
  { id: "perfect", icon: "★★★", title: "Идеальная неделя", desc: "Закрыть 12 раскладов на 3 звезды", metric: "tripleStarWins", goal: 12, rewardXp: 520 },
  { id: "categories", icon: "▦", title: "Собиратель", desc: "Собрать 90 категорий за неделю", metric: "categoriesCompleted", goal: 90, rewardXp: 460 },
];

const EFFECT_DEFS = [
  { id: "spark", name: "Искры", desc: "Базовый эффект", minAchievements: 0 },
  { id: "confetti", name: "Конфетти", desc: "За 8 достижений", minAchievements: 8 },
  { id: "petals", name: "Лепестки", desc: "За идеальную главу", achievement: "chapterPerfect1" },
  { id: "comet", name: "Кометы", desc: "За ручное комбо ×10", achievement: "combo10", rare: true },
  { id: "aurora", name: "Сияние", desc: "За 3 недельных испытания", minWeekly: 3, rare: true },
  { id: "legend", name: "Легенда", desc: "За 5 идеальных глав", achievement: "chapterPerfect5", rare: true },
  { id: "duel", name: "Искры дуэли", desc: "За 25 побед в дуэлях", achievement: "duelWins25", rare: true },
];

const FRAME_DEFS = [
  { id: "none", name: "Без рамки", chapter: 0, hue: 250 },
  { id: "chapter1", name: "Первые связи", chapter: 1, hue: 258 },
  { id: "chapter2", name: "Знакомые миры", chapter: 2, hue: 195 },
  { id: "chapter3", name: "Переплетения", chapter: 3, hue: 335 },
  { id: "chapter4", name: "Тонкие намёки", chapter: 4, hue: 145 },
  { id: "chapter5", name: "Большой словарь", chapter: 5, hue: 42 },
  { id: "chapter6", name: "Мастер ассоциаций", chapter: 6, hue: 285 },
  { id: "chapter7", name: "Скрытые смыслы", chapter: 7, hue: 12 },
  { id: "chapter8", name: "Словесный лабиринт", chapter: 8, hue: 174 },
  { id: "chapter9", name: "Точные связи", chapter: 9, hue: 220 },
  { id: "chapter10", name: "Эрудит", chapter: 10, hue: 55 },
  { id: "chapter11", name: "Большая энциклопедия", chapter: 11, hue: 316 },
  { id: "chapter12", name: "За гранью очевидного", chapter: 12, hue: 105 },
];

const TITLE_DEFS = [
  { id: "player", name: "Игрок", icon: "◇" },
  { id: "rank-linker", name: "Связист", icon: "⌁", minXp: xpThresholdForRank(5) },
  { id: "rank-associator", name: "Ассоциатор", icon: "✦", minXp: xpThresholdForRank(10) },
  { id: "rank-researcher", name: "Исследователь", icon: "◎", minXp: xpThresholdForRank(20) },
  { id: "rank-erudite", name: "Эрудит", icon: "▦", minXp: xpThresholdForRank(30) },
  { id: "rank-master", name: "Мастер", icon: "★", minXp: xpThresholdForRank(40) },
  { id: "rank-archivist", name: "Архивариус", icon: "♜", minXp: xpThresholdForRank(50) },
  { id: "rank-legend", name: "Легенда", icon: "♛", minXp: xpThresholdForRank(75) },
  { id: "collector", name: "Коллекционер", icon: "▦", achievement: "collector" },
  { id: "perfectionist", name: "Перфекционист", icon: "★", achievement: "perfect10" },
  { id: "hand", name: "Мастер движений", icon: "×", achievement: "combo10" },
  { id: "explorer", name: "Исследователь", icon: "◎", achievement: "discover75" },
  { id: "legend", name: "Легенда", icon: "✦", achievement: "chapterPerfect5" },
];

function achievementTitleDef(a) {
  return a ? { id: `achievement:${a.id}`, name: a.title, icon: a.icon || "★", achievement: a.id } : null;
}
function titleDefById(id) {
  const fixed = TITLE_DEFS.find((x) => x.id === id);
  if (fixed) return fixed;
  if (String(id || "").startsWith("achievement:")) {
    const achievement = ACHIEVEMENTS.find((a) => a.id === String(id).slice(12));
    return achievementTitleDef(achievement);
  }
  return null;
}
function availableTitleDefs(p) {
  const result = [], seen = new Set();
  const add = (def) => { if (def && !seen.has(def.name)) { seen.add(def.name); result.push(def); } };
  add(TITLE_DEFS[0]);
  TITLE_DEFS.slice(1).forEach((def) => { if ((!def.achievement || p?.achievements?.includes(def.achievement)) && (!def.minXp || (+p?.xp || 0) >= def.minXp)) add(def); });
  (p?.achievements || []).forEach((id) => add(achievementTitleDef(ACHIEVEMENTS.find((a) => a.id === id))));
  return result;
}

ACHIEVEMENTS.push(
  { id: "weekly1", icon: "W1", title: "Новая традиция", desc: "Выполнить недельное испытание", test: (p) => (p.stats.weeklyCompleted || 0) >= 1 },
  { id: "weekly10", icon: "W10", title: "Десять недель", desc: "Выполнить 10 недельных испытаний", rare: true, test: (p) => (p.stats.weeklyCompleted || 0) >= 10 },
  { id: "moves1000", icon: "↯", title: "Тысяча ходов", desc: "Сделать 1000 ходов", test: (p) => (p.stats.totalMoves || 0) >= 1000 },
  { id: "records10", icon: "↯10", title: "Лучше себя", desc: "Установить 10 личных рекордов", test: (p) => (p.stats.personalRecords || 0) >= 10 },
  { id: "challenge1", icon: "⚔", title: "Дуэль принята", desc: "Завершить дуэль по коду", test: (p) => (p.stats.challengesCompleted || 0) >= 1 },
  { id: "challenge25", icon: "⚔25", title: "Опытный соперник", desc: "Завершить 25 дуэлей по коду", rare: true, test: (p) => (p.stats.challengesCompleted || 0) >= 25 },
  { id: "calm10", icon: "☁", title: "Внутренний дзен", desc: "Пройти 10 раскладов в режиме «Дзен»", test: (p) => (p.stats.calmCompleted || 0) >= 10 },
  { id: "marathon5", icon: "∞5", title: "На дистанции", desc: "Пройти 5 идеальных раскладов подряд в марафоне", test: (p) => (p.stats.bestMarathon || 0) >= 5 },
  { id: "marathon15", icon: "∞15", title: "Марафонец", desc: "Пройти 15 идеальных раскладов подряд", rare: true, test: (p) => (p.stats.bestMarathon || 0) >= 15 },
);

ACHIEVEMENTS.push(
  { id: "mastery10", icon: "✦10", title: "Знаток категорий", desc: "Полностью изучить 10 категорий", test: (p) => (p.stats.masteredCategories || 0) >= 10 },
  { id: "mastery50", icon: "✦50", title: "Словарь в голове", desc: "Полностью изучить 50 категорий", rare: true, test: (p) => (p.stats.masteredCategories || 0) >= 50 },
  { id: "final1", icon: "◆Ⅰ", title: "Финалист", desc: "Пройти финал главы", test: (p) => (p.stats.chapterFinalsCompleted || 0) >= 1 },
  { id: "final6", icon: "◆Ⅵ", title: "Покоритель глав", desc: "Пройти 6 финалов глав", rare: true, test: (p) => (p.stats.chapterFinalsCompleted || 0) >= 6 },
  { id: "bonus10", icon: "+10", title: "Сверх плана", desc: "Выполнить 10 бонусных целей", test: (p) => (p.stats.bonusObjectivesCompleted || 0) >= 10 },
  { id: "series3", icon: "⚔3", title: "Серийный победитель", desc: "Выиграть 3 серии дуэлей", rare: true, test: (p) => (p.stats.seriesWins || 0) >= 3 },
);

ACHIEVEMENTS.push(
  { id: "visits30", icon: "📅", title: "Месяц вместе", desc: "Заходить в игру в 30 разных дней", test: (p) => (p.retention?.totalOpenDays || 0) >= 30 },
  { id: "visits50", icon: "🧭", title: "Частый гость", desc: "Заходить в игру в 50 разных дней", test: (p) => (p.retention?.totalOpenDays || 0) >= 50 },
  { id: "visits100", icon: "💯", title: "Сто дней", desc: "Заходить в игру в 100 разных дней", rare: true, test: (p) => (p.retention?.totalOpenDays || 0) >= 100 },
  { id: "visits180", icon: "🌳", title: "Полгода вместе", desc: "Заходить в игру в 180 разных дней", rare: true, test: (p) => (p.retention?.totalOpenDays || 0) >= 180 },
  { id: "visits365", icon: "🏅", title: "Год Словасьянса", desc: "Заходить в игру в 365 разных дней", rare: true, test: (p) => (p.retention?.totalOpenDays || 0) >= 365 },
  { id: "duel1", icon: "⚔", title: "Первая дуэль", desc: "Завершить первую дуэль", test: (p) => (p.stats.duelMatches || 0) >= 1 },
  { id: "duelWin1", icon: "🥇", title: "Первая победа", desc: "Победить в дуэли", test: (p) => (p.stats.duelWins || 0) >= 1 },
  { id: "duelWins5", icon: "⚔5", title: "На хорошем счету", desc: "Победить в 5 дуэлях", test: (p) => (p.stats.duelWins || 0) >= 5 },
  { id: "duelWins10", icon: "⚔10", title: "Дуэлянт", desc: "Победить в 10 дуэлях", rare: true, test: (p) => (p.stats.duelWins || 0) >= 10 },
  { id: "duelWins25", icon: "👑", title: "Чемпион дуэлей", desc: "Победить в 25 дуэлях", rare: true, test: (p) => (p.stats.duelWins || 0) >= 25 },
);

function achievementProgressData(a, p = profile) {
  const map = {
    first:[p.stats.levelsCompleted,1], ten:[p.stats.levelsCompleted,10], twentyfive:[p.stats.levelsCompleted,25], fifty:[p.stats.levelsCompleted,50], hundred:[p.stats.levelsCompleted,100], twofifty:[p.stats.levelsCompleted,250], fivehundred:[p.stats.levelsCompleted,500],
    clean:[p.stats.tripleStarWins,1], perfect10:[p.stats.tripleStarWins,10], perfect25:[p.stats.tripleStarWins,25], perfect50:[p.stats.tripleStarWins,50], perfect100:[p.stats.tripleStarWins,100],
    nohint:[p.stats.noHintWins,20], nohint50:[p.stats.noHintWins,50], nohint100:[p.stats.noHintWins,100],
    noundo:[p.stats.noUndoWins,20], noundo50:[p.stats.noUndoWins,50], noundo100:[p.stats.noUndoWins,100],
    discover25:[discoveredCategoryCount(p),25], discover50:[discoveredCategoryCount(p),50], discover75:[discoveredCategoryCount(p),75], collector:[discoveredCategoryCount(p),100], encyclopedia:[discoveredCategoryCount(p),125], collectorAll:[discoveredCategoryCount(p), Math.max(1, BANK.length)],
    daily:[p.stats.dailyCompleted,1], daily7:[p.stats.dailyCompleted,7], daily30:[p.stats.dailyCompleted,30], daily100:[p.stats.dailyCompleted,100],
    combo3:[p.stats.maxDragCombo||0,3], combo5:[p.stats.maxDragCombo||0,5], combo10:[p.stats.maxDragCombo||0,10],
    special5:[p.stats.specialCompleted||0,5], special10:[p.stats.specialCompleted||0,10], special25:[p.stats.specialCompleted||0,25],
    chapter1:[completedChapterCount(p),1], chapter3:[completedChapterCount(p),3], chapter5:[completedChapterCount(p),5],
    chapterPerfect1:[perfectChapterCount(p),1], chapterPerfect3:[perfectChapterCount(p),3], chapterPerfect5:[perfectChapterCount(p),5],
    streak7:[p.daily.bestStreak||0,7], streak30:[p.daily.bestStreak||0,30], games100:[p.stats.gamesPlayed||0,100],
    weekly1:[p.stats.weeklyCompleted||0,1], weekly10:[p.stats.weeklyCompleted||0,10], moves1000:[p.stats.totalMoves||0,1000], records10:[p.stats.personalRecords||0,10],
    challenge1:[p.stats.challengesCompleted||0,1], challenge25:[p.stats.challengesCompleted||0,25], calm10:[p.stats.calmCompleted||0,10], marathon5:[p.stats.bestMarathon||0,5], marathon15:[p.stats.bestMarathon||0,15],
    mastery10:[p.stats.masteredCategories||0,10], mastery50:[p.stats.masteredCategories||0,50], final1:[p.stats.chapterFinalsCompleted||0,1], final6:[p.stats.chapterFinalsCompleted||0,6], bonus10:[p.stats.bonusObjectivesCompleted||0,10], series3:[p.stats.seriesWins||0,3],
    visits30:[p.retention?.totalOpenDays||0,30], visits50:[p.retention?.totalOpenDays||0,50], visits100:[p.retention?.totalOpenDays||0,100], visits180:[p.retention?.totalOpenDays||0,180], visits365:[p.retention?.totalOpenDays||0,365],
    duel1:[p.stats.duelMatches||0,1], duelWin1:[p.stats.duelWins||0,1], duelWins5:[p.stats.duelWins||0,5], duelWins10:[p.stats.duelWins||0,10], duelWins25:[p.stats.duelWins||0,25],
  };
  const pair = map[a.id];
  if (!pair) return null;
  return { value: Math.min(pair[1], Math.max(0, +pair[0] || 0)), goal: pair[1] };
}

