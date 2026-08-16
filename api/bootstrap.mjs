const developerMessages = [
  {
    id: "update-v19-2026-08-16",
    date: "16 августа 2026",
    title: "Испытания и синхронизация",
    intro: "Обновили старт приложения и добавили новую долгую цель.",
    items: [
      "При запуске игра автоматически синхронизирует серверные данные и проверяет обновление.",
      "Главное меню больше не показывает игровое поле перед открытием.",
      "Добавлено месячное испытание с крупной XP-наградой.",
      "Обычные расклады иногда могут оказаться естественно неразрешимыми.",
      "Нижняя навигация растянута равномерно по всей ширине.",
    ],
  },
];

export async function GET() {
  return new Response(JSON.stringify({
    ok: true,
    version: "v19",
    serverTime: Date.now(),
    developerMessages,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
