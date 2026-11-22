'use strict';

const obsidian = require('obsidian');
const {
  Plugin,
  PluginSettingTab,
  Setting,
  ItemView,
  Notice,
  Modal,
  TFile,
  TFolder,
  Platform,
  moment,
  requestUrl,
} = obsidian;

/* ════════════════════════════════════════════════════════════════
   ✦ HERMES DASHBOARD — constants & helpers
   ════════════════════════════════════════════════════════════════ */

const VIEW_TYPE_HERMES_DASHBOARD = 'agentic-dashboard-view';

const DEFAULT_SETTINGS = {
  openOnStartup: true,
  journalFolder: 'Journal',
  inboxFolder: 'Inbox',
  meetingsFolder: 'Meetings',
  videoPath: '',
  posterPath: '',
  posterPhonePath: '',
  linkNotes: false,
  dashboardNote: '',
  tasksCap: 18,
  refreshSeconds: 60,
  weatherEnabled: false,
  weatherCity: '',
  weatherUnits: 'metric',
};

const CAPTURE_TYPES = [
  { label: 'Thought 💭', slug: 'thought' },
  { label: 'Idea 💡', slug: 'idea' },
  { label: 'Reflection 🌙', slug: 'reflection' },
  { label: 'To watch 📺', slug: 'to-watch' },
  { label: 'Book 📚', slug: 'book' },
  { label: 'Article 📰', slug: 'article' },
];

// Broader capture types open a structured form instead of the one-liner input
const RICH_CAPTURE_SLUGS = ['reflection', 'to-watch', 'book'];

// Basmilius Meteocons (filled, animated SVG) — https://github.com/basmilius/weather-icons (MIT)
const WEATHER_ICONS = {
  "clear-day": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"150\" x2=\"234\" y1=\"119.2\" y2=\"264.8\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#fbbf24\"/><stop offset=\".5\" stop-color=\"#fbbf24\"/><stop offset=\"1\" stop-color=\"#f59e0b\"/></linearGradient><symbol id=\"b\" viewBox=\"0 0 384 384\"><circle cx=\"192\" cy=\"192\" r=\"84\" fill=\"url(#a)\" stroke=\"#f8af18\" stroke-miterlimit=\"10\" stroke-width=\"6\"/><path fill=\"none\" stroke=\"#fbbf24\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"24\" d=\"M192 61.7V12m0 360v-49.7m92.2-222.5 35-35M64.8 319.2l35.1-35.1m0-184.4-35-35m254.5 254.5-35.1-35.1M61.7 192H12m360 0h-49.7\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 192 192; 45 192 192\"/></path></symbol></defs><use xlink:href=\"#b\" width=\"384\" height=\"384\" transform=\"translate(64 64)\"/></svg>",
  "partly-cloudy-day": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><symbol id=\"d\" viewBox=\"0 0 196 196\"><circle cx=\"98\" cy=\"98\" r=\"40\" fill=\"url(#b)\" stroke=\"#f8af18\" stroke-miterlimit=\"10\" stroke-width=\"4\"/><path fill=\"none\" stroke=\"#fbbf24\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"12\" d=\"M98 31.4V6m0 184v-25.4M145.1 51l18-17.9M33 163l18-17.9M51 51 33 33m130.1 130.1-18-18M6 98h25.4M190 98h-25.4\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 98 98; 45 98 98\"/></path></symbol><symbol id=\"e\" viewBox=\"0 0 350 222\"><path fill=\"url(#a)\" stroke=\"#e6effc\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"c\" viewBox=\"0 0 363 258\"><use xlink:href=\"#d\" width=\"196\" height=\"196\"/><use xlink:href=\"#e\" width=\"350\" height=\"222\" transform=\"translate(13 36)\"/></symbol><linearGradient id=\"a\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f3f7fe\"/><stop offset=\".5\" stop-color=\"#f3f7fe\"/><stop offset=\"1\" stop-color=\"#deeafb\"/></linearGradient><linearGradient id=\"b\" x1=\"78\" x2=\"118\" y1=\"63.4\" y2=\"132.7\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#fbbf24\"/><stop offset=\".5\" stop-color=\"#fbbf24\"/><stop offset=\"1\" stop-color=\"#f59e0b\"/></linearGradient></defs><use xlink:href=\"#c\" width=\"363\" height=\"258\" transform=\"translate(68 109)\"/></svg>",
  "overcast": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><symbol id=\"d\" viewBox=\"0 0 200.3 126.1\"><path fill=\"url(#b)\" stroke=\"#848b98\" stroke-miterlimit=\"10\" d=\"M.5 93.2a32.4 32.4 0 0032.4 32.4h129.8v-.1l2.3.1a34.8 34.8 0 006.5-68.9 32.4 32.4 0 00-48.5-33 48.6 48.6 0 00-88.6 37.1h-1.5A32.4 32.4 0 00.5 93.1Z\"/></symbol><symbol id=\"e\" viewBox=\"0 0 350 222\"><path fill=\"url(#a)\" stroke=\"#e6effc\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"c\" overflow=\"visible\" viewBox=\"0 0 398 222\"><use xlink:href=\"#d\" width=\"200.3\" height=\"126.1\" transform=\"translate(198 27)\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"translate\" values=\"-9 0; 9 0; -9 0\"/></use><use xlink:href=\"#e\" width=\"350\" height=\"222\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"translate\" values=\"-18 0; 18 0; -18 0\"/></use></symbol><linearGradient id=\"a\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f3f7fe\"/><stop offset=\".5\" stop-color=\"#f3f7fe\"/><stop offset=\"1\" stop-color=\"#deeafb\"/></linearGradient><linearGradient id=\"b\" x1=\"52.7\" x2=\"133.4\" y1=\"9.6\" y2=\"149.3\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#9ca3af\"/><stop offset=\".5\" stop-color=\"#9ca3af\"/><stop offset=\"1\" stop-color=\"#6b7280\"/></linearGradient></defs><use xlink:href=\"#c\" width=\"398\" height=\"222\" transform=\"translate(68.84 145)\"/></svg>",
  "fog": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f3f7fe\"/><stop offset=\".5\" stop-color=\"#f3f7fe\"/><stop offset=\"1\" stop-color=\"#deeafb\"/></linearGradient><linearGradient id=\"b\" x1=\"96\" x2=\"168\" y1=\"-2.4\" y2=\"122.3\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#d4d7dd\"/><stop offset=\".5\" stop-color=\"#d4d7dd\"/><stop offset=\"1\" stop-color=\"#bec1c6\"/></linearGradient><linearGradient xlink:href=\"#b\" id=\"c\" x2=\"168\" y1=\"-50.4\" y2=\"74.3\"/><symbol id=\"d\" viewBox=\"0 0 350 222\"><path fill=\"url(#a)\" stroke=\"#e6effc\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"e\" overflow=\"visible\" viewBox=\"0 0 264 72\"><path fill=\"none\" stroke=\"url(#b)\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"24\" d=\"M12 60h240\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"translate\" values=\"-24 0; 24 0; -24 0\"/></path><path fill=\"none\" stroke=\"url(#c)\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"24\" d=\"M12 12h240\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"translate\" values=\"24 0; -24 0; 24 0\"/></path></symbol></defs><use xlink:href=\"#d\" width=\"350\" height=\"222\" transform=\"translate(81 145)\"/><use xlink:href=\"#e\" width=\"264\" height=\"72\" transform=\"translate(124 402)\"/></svg>",
  "drizzle": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f3f7fe\"/><stop offset=\".5\" stop-color=\"#f3f7fe\"/><stop offset=\"1\" stop-color=\"#deeafb\"/></linearGradient><linearGradient id=\"b\" x1=\"1314.8\" x2=\"1324.2\" y1=\"-739.9\" y2=\"-715.3\" gradientTransform=\"rotate(-9 7682.04 6929.539)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b65ed\"/><stop offset=\".5\" stop-color=\"#0a5ad4\"/><stop offset=\"1\" stop-color=\"#0950bc\"/></linearGradient><linearGradient xlink:href=\"#b\" id=\"c\" x1=\"1370.1\" x2=\"1379.5\" y1=\"-731.1\" y2=\"-706.5\"/><linearGradient xlink:href=\"#b\" id=\"d\" x1=\"1425.4\" x2=\"1434.9\" y1=\"-722.4\" y2=\"-697.8\"/><symbol id=\"e\" viewBox=\"0 0 350 222\"><path fill=\"url(#a)\" stroke=\"#e6effc\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol></defs><use xlink:href=\"#e\" width=\"350\" height=\"222\" transform=\"translate(81 145)\"/><path fill=\"url(#b)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M200 376a8 8 0 01-8-8v-12a8 8 0 0116 0v12a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x1\" additive=\"sum\" attributeName=\"transform\" begin=\"0s; x1.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" type=\"translate\" values=\"0 -32; 0 -32; 0 120;\"/><animate id=\"y1\" attributeName=\"opacity\" begin=\"0s; y1.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#c)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M256 376a8 8 0 01-8-8v-12a8 8 0 0116 0v12a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x2\" additive=\"sum\" attributeName=\"transform\" begin=\"1.34s; x2.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" type=\"translate\" values=\"0 -32; 0 -32; 0 120;\"/><animate id=\"y2\" attributeName=\"opacity\" begin=\"1.34s; y2.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#d)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M312 376a8 8 0 01-8-8v-12a8 8 0 0116 0v12a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x3\" additive=\"sum\" attributeName=\"transform\" begin=\".67s; x3.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" type=\"translate\" values=\"0 -32; 0 -32; 0 120;\"/><animate id=\"y3\" attributeName=\"opacity\" begin=\".67s; y3.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path></svg>",
  "extreme-drizzle": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"52.7\" x2=\"133.4\" y1=\"9.6\" y2=\"149.3\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#9ca3af\"/><stop offset=\".5\" stop-color=\"#9ca3af\"/><stop offset=\"1\" stop-color=\"#6b7280\"/></linearGradient><linearGradient id=\"b\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#6b7280\"/><stop offset=\".5\" stop-color=\"#6b7280\"/><stop offset=\"1\" stop-color=\"#4b5563\"/></linearGradient><linearGradient id=\"c\" x1=\"1198.7\" x2=\"1208.1\" y1=\"735.6\" y2=\"760.2\" gradientTransform=\"rotate(-9 -1750.027 6929.574)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b65ed\"/><stop offset=\".5\" stop-color=\"#0a5ad4\"/><stop offset=\"1\" stop-color=\"#0950bc\"/></linearGradient><linearGradient xlink:href=\"#c\" id=\"d\" x1=\"1254\" x2=\"1263.4\" y1=\"744.4\" y2=\"769\"/><linearGradient xlink:href=\"#c\" id=\"e\" x1=\"1309.3\" x2=\"1318.7\" y1=\"753.1\" y2=\"777.8\"/><symbol id=\"g\" viewBox=\"0 0 200.3 126.1\"><path fill=\"url(#a)\" stroke=\"#848b98\" stroke-miterlimit=\"10\" d=\"M.5 93.2a32.4 32.4 0 0032.4 32.4h129.8v-.1l2.3.1a34.8 34.8 0 006.5-68.9 32.4 32.4 0 00-48.5-33 48.6 48.6 0 00-88.6 37.1h-1.5A32.4 32.4 0 00.5 93.1Z\"/></symbol><symbol id=\"h\" viewBox=\"0 0 350 222\"><path fill=\"url(#b)\" stroke=\"#5b6472\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"f\" overflow=\"visible\" viewBox=\"0 0 398 222\"><use xlink:href=\"#g\" width=\"200.3\" height=\"126.1\" transform=\"translate(198 27)\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"translate\" values=\"-9 0; 9 0; -9 0\"/></use><use xlink:href=\"#h\" width=\"350\" height=\"222\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"translate\" values=\"-18 0; 18 0; -18 0\"/></use></symbol></defs><use xlink:href=\"#f\" width=\"398\" height=\"222\" transform=\"translate(68.84 145)\"/><path fill=\"url(#c)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M200 376a8 8 0 01-8-8v-12a8 8 0 0116 0v12a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x1\" additive=\"sum\" attributeName=\"transform\" begin=\"0s; x1.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" type=\"translate\" values=\"0 -32; 0 -32; 0 120;\"/><animate id=\"y1\" attributeName=\"opacity\" begin=\"0s; y1.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#d)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M256 376a8 8 0 01-8-8v-12a8 8 0 0116 0v12a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x2\" additive=\"sum\" attributeName=\"transform\" begin=\"1.34s; x2.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" type=\"translate\" values=\"0 -32; 0 -32; 0 120;\"/><animate id=\"y2\" attributeName=\"opacity\" begin=\"1.34s; y2.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#e)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M312 376a8 8 0 01-8-8v-12a8 8 0 0116 0v12a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x3\" additive=\"sum\" attributeName=\"transform\" begin=\".67s; x3.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" type=\"translate\" values=\"0 -32; 0 -32; 0 120;\"/><animate id=\"y3\" attributeName=\"opacity\" begin=\".67s; y3.end+1s\" dur=\"1s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path></svg>",
  "rain": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f3f7fe\"/><stop offset=\".5\" stop-color=\"#f3f7fe\"/><stop offset=\"1\" stop-color=\"#deeafb\"/></linearGradient><linearGradient id=\"b\" x1=\"1381.3\" x2=\"1399.5\" y1=\"-1144.7\" y2=\"-1097.4\" gradientTransform=\"rotate(-9 8002.567 8233.063)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b65ed\"/><stop offset=\".5\" stop-color=\"#0a5ad4\"/><stop offset=\"1\" stop-color=\"#0950bc\"/></linearGradient><linearGradient xlink:href=\"#b\" id=\"c\" x1=\"1436.7\" x2=\"1454.9\" y1=\"-1137\" y2=\"-1089.7\" gradientTransform=\"rotate(-9 8009.537 8233.037)\"/><linearGradient xlink:href=\"#b\" id=\"d\" x1=\"1492.1\" x2=\"1510.3\" y1=\"-1129.3\" y2=\"-1082.1\" gradientTransform=\"rotate(-9 8016.566 8233.078)\"/><symbol id=\"e\" viewBox=\"0 0 350 222\"><path fill=\"url(#a)\" stroke=\"#e6effc\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"f\" overflow=\"visible\" viewBox=\"0 0 129 57\"><path fill=\"url(#b)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M8.5 56.5a8 8 0 01-8-8v-40a8 8 0 0116 0v40a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x1\" additive=\"sum\" attributeName=\"transform\" begin=\"0s; x1.end+.33s\" dur=\".67s\" type=\"translate\" values=\"0 -60; 0 60\"/><animate id=\"y1\" attributeName=\"opacity\" begin=\"0s; y1.end+.33s\" dur=\".67s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#c)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M64.5 56.5a8 8 0 01-8-8v-40a8 8 0 0116 0v40a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x2\" additive=\"sum\" attributeName=\"transform\" begin=\".33s; x2.end+.33s\" dur=\".67s\" type=\"translate\" values=\"0 -60; 0 60\"/><animate id=\"y2\" attributeName=\"opacity\" begin=\".33s; y2.end+.33s\" dur=\".67s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#d)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M120.5 56.5a8 8 0 01-8-8v-40a8 8 0 0116 0v40a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x3\" additive=\"sum\" attributeName=\"transform\" begin=\"-.33s; x3.end+.33s\" dur=\".67s\" type=\"translate\" values=\"0 -60; 0 60\"/><animate id=\"y3\" attributeName=\"opacity\" begin=\"-.33s; y3.end+.33s\" dur=\".67s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path></symbol></defs><use xlink:href=\"#e\" width=\"350\" height=\"222\" transform=\"translate(81 145)\"/><use xlink:href=\"#f\" width=\"129\" height=\"57\" transform=\"translate(191.5 343.5)\"/></svg>",
  "extreme-rain": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"52.7\" x2=\"133.4\" y1=\"9.6\" y2=\"149.3\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#9ca3af\"/><stop offset=\".5\" stop-color=\"#9ca3af\"/><stop offset=\"1\" stop-color=\"#6b7280\"/></linearGradient><linearGradient id=\"b\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#6b7280\"/><stop offset=\".5\" stop-color=\"#6b7280\"/><stop offset=\"1\" stop-color=\"#4b5563\"/></linearGradient><linearGradient id=\"c\" x1=\"1381.3\" x2=\"1399.5\" y1=\"-1144.7\" y2=\"-1097.4\" gradientTransform=\"rotate(-9 8002.567 8233.063)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b65ed\"/><stop offset=\".5\" stop-color=\"#0a5ad4\"/><stop offset=\"1\" stop-color=\"#0950bc\"/></linearGradient><linearGradient xlink:href=\"#c\" id=\"d\" x1=\"1436.7\" x2=\"1454.9\" y1=\"-1137\" y2=\"-1089.7\" gradientTransform=\"rotate(-9 8009.537 8233.037)\"/><linearGradient xlink:href=\"#c\" id=\"e\" x1=\"1492.1\" x2=\"1510.3\" y1=\"-1129.3\" y2=\"-1082.1\" gradientTransform=\"rotate(-9 8016.566 8233.078)\"/><symbol id=\"g\" viewBox=\"0 0 200.3 126.1\"><path fill=\"url(#a)\" stroke=\"#848b98\" stroke-miterlimit=\"10\" d=\"M.5 93.2a32.4 32.4 0 0032.4 32.4h129.8v-.1l2.3.1a34.8 34.8 0 006.5-68.9 32.4 32.4 0 00-48.5-33 48.6 48.6 0 00-88.6 37.1h-1.5A32.4 32.4 0 00.5 93.1Z\"/></symbol><symbol id=\"h\" viewBox=\"0 0 350 222\"><path fill=\"url(#b)\" stroke=\"#5b6472\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"f\" overflow=\"visible\" viewBox=\"0 0 398 222\"><use xlink:href=\"#g\" width=\"200.3\" height=\"126.1\" transform=\"translate(198 27)\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"translate\" values=\"-9 0; 9 0; -9 0\"/></use><use xlink:href=\"#h\" width=\"350\" height=\"222\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"translate\" values=\"-18 0; 18 0; -18 0\"/></use></symbol><symbol id=\"i\" overflow=\"visible\" viewBox=\"0 0 129 57\"><path fill=\"url(#c)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M8.5 56.5a8 8 0 01-8-8v-40a8 8 0 0116 0v40a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x1\" additive=\"sum\" attributeName=\"transform\" begin=\"0s; x1.end+.33s\" dur=\".67s\" type=\"translate\" values=\"0 -60; 0 60\"/><animate id=\"y1\" attributeName=\"opacity\" begin=\"0s; y1.end+.33s\" dur=\".67s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#d)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M64.5 56.5a8 8 0 01-8-8v-40a8 8 0 0116 0v40a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x2\" additive=\"sum\" attributeName=\"transform\" begin=\".33s; x2.end+.33s\" dur=\".67s\" type=\"translate\" values=\"0 -60; 0 60\"/><animate id=\"y2\" attributeName=\"opacity\" begin=\".33s; y2.end+.33s\" dur=\".67s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#e)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M120.5 56.5a8 8 0 01-8-8v-40a8 8 0 0116 0v40a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x3\" additive=\"sum\" attributeName=\"transform\" begin=\"-.33s; x3.end+.33s\" dur=\".67s\" type=\"translate\" values=\"0 -60; 0 60\"/><animate id=\"y3\" attributeName=\"opacity\" begin=\"-.33s; y3.end+.33s\" dur=\".67s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path></symbol></defs><use xlink:href=\"#f\" width=\"398\" height=\"222\" transform=\"translate(68.84 145)\"/><use xlink:href=\"#i\" width=\"129\" height=\"57\" transform=\"translate(191.5 343.5)\"/></svg>",
  "snow": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f3f7fe\"/><stop offset=\".5\" stop-color=\"#f3f7fe\"/><stop offset=\"1\" stop-color=\"#deeafb\"/></linearGradient><linearGradient id=\"b\" x1=\"11.4\" x2=\"32.8\" y1=\"5.9\" y2=\"43.1\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#86c3db\"/><stop offset=\".5\" stop-color=\"#86c3db\"/><stop offset=\"1\" stop-color=\"#5eafcf\"/></linearGradient><linearGradient xlink:href=\"#b\" id=\"c\" x1=\"67.4\" x2=\"88.8\" y1=\"5.9\" y2=\"43.1\"/><linearGradient xlink:href=\"#b\" id=\"d\" x1=\"123.4\" x2=\"144.8\" y1=\"5.9\" y2=\"43.1\"/><symbol id=\"e\" viewBox=\"0 0 350 222\"><path fill=\"url(#a)\" stroke=\"#e6effc\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"f\" overflow=\"visible\" viewBox=\"0 0 156.2 49\"><g><path fill=\"url(#b)\" stroke=\"#86c3db\" stroke-miterlimit=\"10\" d=\"m41.7 31-5.8-3.3a13.7 13.7 0 000-6.5l5.8-3.2a4 4 0 001.5-5.5 4 4 0 00-5.6-1.5l-5.8 3.3a13.6 13.6 0 00-2.6-2 13.8 13.8 0 00-3-1.3V4.5a4 4 0 00-8.1 0v6.6a14.3 14.3 0 00-5.7 3.2L6.6 11A4 4 0 001 12.5 4 4 0 002.5 18l5.8 3.3a13.7 13.7 0 000 6.5L2.5 31A4 4 0 001 36.5a4 4 0 003.5 2 4 4 0 002-.5l5.8-3.3a13.6 13.6 0 002.6 2 13.8 13.8 0 003 1.2v6.6a4 4 0 008.2 0v-6.6a14.2 14.2 0 005.6-3.2l6 3.3a4 4 0 002 .5 4 4 0 003.4-2 4 4 0 00-1.4-5.5ZM19 29.7a6 6 0 01-2.3-8.2 6.1 6.1 0 015.3-3 6.2 6.2 0 013 .8 6 6 0 012.2 8.2 6.1 6.1 0 01-8.2 2.2Z\" opacity=\"0\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 24 24; 360 24 24\"/><animate id=\"t1\" attributeName=\"opacity\" begin=\"0s; t1.end+1s\" dur=\"2s\" keyTimes=\"0; .17; .83; 1\" values=\"0; 1; 1; 0\"/></path><animateTransform id=\"s1\" additive=\"sum\" attributeName=\"transform\" begin=\"0s; s1.end+1s\" dur=\"2s\" type=\"translate\" values=\"0 -36; 0 92;\"/></g><g><path fill=\"url(#c)\" stroke=\"#86c3db\" stroke-miterlimit=\"10\" d=\"m97.7 31-5.8-3.3a13.7 13.7 0 000-6.5l5.8-3.2a4 4 0 001.5-5.5 4 4 0 00-5.6-1.5l-5.8 3.3a13.6 13.6 0 00-2.6-2 13.8 13.8 0 00-3-1.3V4.5a4 4 0 00-8.1 0v6.6a14.3 14.3 0 00-5.7 3.2L62.6 11a4 4 0 00-5.6 1.5 4 4 0 001.5 5.5l5.8 3.3a13.7 13.7 0 000 6.5L58.5 31a4 4 0 00-1.5 5.5 4 4 0 003.5 2 4 4 0 002-.5l5.8-3.3a13.6 13.6 0 002.7 2 13.8 13.8 0 003 1.2v6.6a4 4 0 008 0v-6.6a14.2 14.2 0 005.7-3.2l6 3.3a4 4 0 002 .5 4 4 0 003.4-2 4 4 0 00-1.4-5.5ZM75 29.7a6 6 0 01-2.3-8.2 6.1 6.1 0 015.3-3 6.2 6.2 0 013 .8 6 6 0 012.2 8.2 6.1 6.1 0 01-8.2 2.2Z\" opacity=\"0\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 80 24; 360 80 24\"/><animate id=\"t2\" attributeName=\"opacity\" begin=\"-.83s; t2.end+1s\" dur=\"2s\" keyTimes=\"0; .17; .83; 1\" values=\"0; 1; 1; 0\"/></path><animateTransform id=\"s2\" additive=\"sum\" attributeName=\"transform\" begin=\"-.83s; s2.end+1s\" dur=\"2s\" type=\"translate\" values=\"0 -36; 0 92;\"/></g><g><path fill=\"url(#d)\" stroke=\"#86c3db\" stroke-miterlimit=\"10\" d=\"m153.7 31-5.8-3.3a13.7 13.7 0 000-6.5l5.8-3.2a4 4 0 001.5-5.5 4 4 0 00-5.6-1.5l-5.8 3.3a13.6 13.6 0 00-2.6-2 13.8 13.8 0 00-3-1.3V4.5a4 4 0 00-8.1 0v6.6a14.3 14.3 0 00-5.7 3.2l-5.8-3.3a4 4 0 00-5.6 1.5 4 4 0 001.5 5.5l5.8 3.3a13.7 13.7 0 000 6.5l-5.8 3.2a4 4 0 00-1.5 5.5 4 4 0 003.5 2 4 4 0 002-.5l5.8-3.3a13.6 13.6 0 002.7 2 13.8 13.8 0 003 1.2v6.6a4 4 0 008 0v-6.6a14.2 14.2 0 005.7-3.2l5.8 3.3a4 4 0 002 .5 4 4 0 003.5-2 4 4 0 00-1.3-5.5ZM131 29.7a6 6 0 01-2.3-8.2 6.1 6.1 0 015.3-3 6.2 6.2 0 013 .8 6 6 0 012.2 8.2 6.1 6.1 0 01-8.2 2.2Z\" opacity=\"0\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 136 24; 360 136 24\"/><animate id=\"t3\" attributeName=\"opacity\" begin=\".83s; t3.end+1s\" dur=\"2s\" keyTimes=\"0; .17; .83; 1\" values=\"0; 1; 1; 0\"/></path><animateTransform id=\"s3\" additive=\"sum\" attributeName=\"transform\" begin=\".83s; s3.end+1s\" dur=\"2s\" type=\"translate\" values=\"0 -36; 0 92;\"/></g></symbol></defs><use xlink:href=\"#e\" width=\"350\" height=\"222\" transform=\"translate(81 145)\"/><use xlink:href=\"#f\" width=\"156.2\" height=\"49\" transform=\"translate(177.9 337.5)\"/></svg>",
  "extreme-snow": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"52.7\" x2=\"133.4\" y1=\"9.6\" y2=\"149.3\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#9ca3af\"/><stop offset=\".5\" stop-color=\"#9ca3af\"/><stop offset=\"1\" stop-color=\"#6b7280\"/></linearGradient><linearGradient id=\"b\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#6b7280\"/><stop offset=\".5\" stop-color=\"#6b7280\"/><stop offset=\"1\" stop-color=\"#4b5563\"/></linearGradient><linearGradient id=\"c\" x1=\"11.4\" x2=\"32.8\" y1=\"5.9\" y2=\"43.1\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#86c3db\"/><stop offset=\".5\" stop-color=\"#86c3db\"/><stop offset=\"1\" stop-color=\"#5eafcf\"/></linearGradient><linearGradient xlink:href=\"#c\" id=\"d\" x1=\"67.4\" x2=\"88.8\" y1=\"5.9\" y2=\"43.1\"/><linearGradient xlink:href=\"#c\" id=\"e\" x1=\"123.4\" x2=\"144.8\" y1=\"5.9\" y2=\"43.1\"/><symbol id=\"g\" viewBox=\"0 0 200.3 126.1\"><path fill=\"url(#a)\" stroke=\"#848b98\" stroke-miterlimit=\"10\" d=\"M.5 93.2a32.4 32.4 0 0032.4 32.4h129.8v-.1l2.3.1a34.8 34.8 0 006.5-68.9 32.4 32.4 0 00-48.5-33 48.6 48.6 0 00-88.6 37.1h-1.5A32.4 32.4 0 00.5 93.1Z\"/></symbol><symbol id=\"h\" viewBox=\"0 0 350 222\"><path fill=\"url(#b)\" stroke=\"#5b6472\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"f\" overflow=\"visible\" viewBox=\"0 0 398 222\"><use xlink:href=\"#g\" width=\"200.3\" height=\"126.1\" transform=\"translate(198 27)\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"translate\" values=\"-9 0; 9 0; -9 0\"/></use><use xlink:href=\"#h\" width=\"350\" height=\"222\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"translate\" values=\"-18 0; 18 0; -18 0\"/></use></symbol><symbol id=\"i\" overflow=\"visible\" viewBox=\"0 0 156.2 49\"><g><path fill=\"url(#c)\" stroke=\"#86c3db\" stroke-miterlimit=\"10\" d=\"m41.7 31-5.8-3.3a13.7 13.7 0 000-6.5l5.8-3.2a4 4 0 001.5-5.5 4 4 0 00-5.6-1.5l-5.8 3.3a13.6 13.6 0 00-2.6-2 13.8 13.8 0 00-3-1.3V4.5a4 4 0 00-8.1 0v6.6a14.3 14.3 0 00-5.7 3.2L6.6 11A4 4 0 001 12.5 4 4 0 002.5 18l5.8 3.3a13.7 13.7 0 000 6.5L2.5 31A4 4 0 001 36.5a4 4 0 003.5 2 4 4 0 002-.5l5.8-3.3a13.6 13.6 0 002.6 2 13.8 13.8 0 003 1.2v6.6a4 4 0 008.2 0v-6.6a14.2 14.2 0 005.6-3.2l6 3.3a4 4 0 002 .5 4 4 0 003.4-2 4 4 0 00-1.4-5.5ZM19 29.7a6 6 0 01-2.3-8.2 6.1 6.1 0 015.3-3 6.2 6.2 0 013 .8 6 6 0 012.2 8.2 6.1 6.1 0 01-8.2 2.2Z\" opacity=\"0\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 24 24; 360 24 24\"/><animate id=\"t1\" attributeName=\"opacity\" begin=\"0s; t1.end+1s\" dur=\"2s\" keyTimes=\"0; .17; .83; 1\" values=\"0; 1; 1; 0\"/></path><animateTransform id=\"s1\" additive=\"sum\" attributeName=\"transform\" begin=\"0s; s1.end+1s\" dur=\"2s\" type=\"translate\" values=\"0 -36; 0 92;\"/></g><g><path fill=\"url(#d)\" stroke=\"#86c3db\" stroke-miterlimit=\"10\" d=\"m97.7 31-5.8-3.3a13.7 13.7 0 000-6.5l5.8-3.2a4 4 0 001.5-5.5 4 4 0 00-5.6-1.5l-5.8 3.3a13.6 13.6 0 00-2.6-2 13.8 13.8 0 00-3-1.3V4.5a4 4 0 00-8.1 0v6.6a14.3 14.3 0 00-5.7 3.2L62.6 11a4 4 0 00-5.6 1.5 4 4 0 001.5 5.5l5.8 3.3a13.7 13.7 0 000 6.5L58.5 31a4 4 0 00-1.5 5.5 4 4 0 003.5 2 4 4 0 002-.5l5.8-3.3a13.6 13.6 0 002.7 2 13.8 13.8 0 003 1.2v6.6a4 4 0 008 0v-6.6a14.2 14.2 0 005.7-3.2l6 3.3a4 4 0 002 .5 4 4 0 003.4-2 4 4 0 00-1.4-5.5ZM75 29.7a6 6 0 01-2.3-8.2 6.1 6.1 0 015.3-3 6.2 6.2 0 013 .8 6 6 0 012.2 8.2 6.1 6.1 0 01-8.2 2.2Z\" opacity=\"0\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 80 24; 360 80 24\"/><animate id=\"t2\" attributeName=\"opacity\" begin=\"-.83s; t2.end+1s\" dur=\"2s\" keyTimes=\"0; .17; .83; 1\" values=\"0; 1; 1; 0\"/></path><animateTransform id=\"s2\" additive=\"sum\" attributeName=\"transform\" begin=\"-.83s; s2.end+1s\" dur=\"2s\" type=\"translate\" values=\"0 -36; 0 92;\"/></g><g><path fill=\"url(#e)\" stroke=\"#86c3db\" stroke-miterlimit=\"10\" d=\"m153.7 31-5.8-3.3a13.7 13.7 0 000-6.5l5.8-3.2a4 4 0 001.5-5.5 4 4 0 00-5.6-1.5l-5.8 3.3a13.6 13.6 0 00-2.6-2 13.8 13.8 0 00-3-1.3V4.5a4 4 0 00-8.1 0v6.6a14.3 14.3 0 00-5.7 3.2l-5.8-3.3a4 4 0 00-5.6 1.5 4 4 0 001.5 5.5l5.8 3.3a13.7 13.7 0 000 6.5l-5.8 3.2a4 4 0 00-1.5 5.5 4 4 0 003.5 2 4 4 0 002-.5l5.8-3.3a13.6 13.6 0 002.7 2 13.8 13.8 0 003 1.2v6.6a4 4 0 008 0v-6.6a14.2 14.2 0 005.7-3.2l5.8 3.3a4 4 0 002 .5 4 4 0 003.5-2 4 4 0 00-1.3-5.5ZM131 29.7a6 6 0 01-2.3-8.2 6.1 6.1 0 015.3-3 6.2 6.2 0 013 .8 6 6 0 012.2 8.2 6.1 6.1 0 01-8.2 2.2Z\" opacity=\"0\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 136 24; 360 136 24\"/><animate id=\"t3\" attributeName=\"opacity\" begin=\".83s; t3.end+1s\" dur=\"2s\" keyTimes=\"0; .17; .83; 1\" values=\"0; 1; 1; 0\"/></path><animateTransform id=\"s3\" additive=\"sum\" attributeName=\"transform\" begin=\".83s; s3.end+1s\" dur=\"2s\" type=\"translate\" values=\"0 -36; 0 92;\"/></g></symbol></defs><use xlink:href=\"#f\" width=\"398\" height=\"222\" transform=\"translate(68.84 145)\"/><use xlink:href=\"#i\" width=\"156.2\" height=\"49\" transform=\"translate(177.9 337.5)\"/></svg>",
  "sleet": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f3f7fe\"/><stop offset=\".5\" stop-color=\"#f3f7fe\"/><stop offset=\"1\" stop-color=\"#deeafb\"/></linearGradient><linearGradient id=\"b\" x1=\"1399.3\" x2=\"1408.7\" y1=\"-1137.3\" y2=\"-1112.7\" gradientTransform=\"rotate(-9 8016.182 8229.021)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b65ed\"/><stop offset=\".5\" stop-color=\"#0a5ad4\"/><stop offset=\"1\" stop-color=\"#0950bc\"/></linearGradient><linearGradient xlink:href=\"#b\" id=\"c\" x1=\"1454.6\" x2=\"1464\" y1=\"-1128.6\" y2=\"-1104\"/><linearGradient xlink:href=\"#b\" id=\"d\" x1=\"1509.9\" x2=\"1519.3\" y1=\"-1119.8\" y2=\"-1095.2\"/><linearGradient id=\"e\" x1=\"11.4\" x2=\"32.8\" y1=\"5.9\" y2=\"43.1\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#86c3db\"/><stop offset=\".5\" stop-color=\"#86c3db\"/><stop offset=\"1\" stop-color=\"#5eafcf\"/></linearGradient><linearGradient xlink:href=\"#e\" id=\"f\" x1=\"67.4\" x2=\"88.8\" y1=\"5.9\" y2=\"43.1\"/><linearGradient xlink:href=\"#e\" id=\"g\" x1=\"123.4\" x2=\"144.8\" y1=\"5.9\" y2=\"43.1\"/><symbol id=\"h\" viewBox=\"0 0 350 222\"><path fill=\"url(#a)\" stroke=\"#e6effc\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"j\" overflow=\"visible\" viewBox=\"0 0 156.2 49\"><g><path fill=\"url(#e)\" stroke=\"#86c3db\" stroke-miterlimit=\"10\" d=\"m41.7 31-5.8-3.3a13.7 13.7 0 000-6.5l5.8-3.2a4 4 0 001.5-5.5 4 4 0 00-5.6-1.5l-5.8 3.3a13.6 13.6 0 00-2.6-2 13.8 13.8 0 00-3-1.3V4.5a4 4 0 00-8.1 0v6.6a14.3 14.3 0 00-5.7 3.2L6.6 11A4 4 0 001 12.5 4 4 0 002.5 18l5.8 3.3a13.7 13.7 0 000 6.5L2.5 31A4 4 0 001 36.5a4 4 0 003.5 2 4 4 0 002-.5l5.8-3.3a13.6 13.6 0 002.6 2 13.8 13.8 0 003 1.2v6.6a4 4 0 008.2 0v-6.6a14.2 14.2 0 005.6-3.2l6 3.3a4 4 0 002 .5 4 4 0 003.4-2 4 4 0 00-1.4-5.5ZM19 29.7a6 6 0 01-2.3-8.2 6.1 6.1 0 015.3-3 6.2 6.2 0 013 .8 6 6 0 012.2 8.2 6.1 6.1 0 01-8.2 2.2Z\" opacity=\"0\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 24 24; 360 24 24\"/><animate id=\"t1\" attributeName=\"opacity\" begin=\"0s; t1.end+1s\" dur=\"2s\" keyTimes=\"0; .17; .83; 1\" values=\"0; 1; 1; 0\"/></path><animateTransform id=\"s1\" additive=\"sum\" attributeName=\"transform\" begin=\"0s; s1.end+1s\" dur=\"2s\" type=\"translate\" values=\"0 -36; 0 92;\"/></g><g><path fill=\"url(#f)\" stroke=\"#86c3db\" stroke-miterlimit=\"10\" d=\"m97.7 31-5.8-3.3a13.7 13.7 0 000-6.5l5.8-3.2a4 4 0 001.5-5.5 4 4 0 00-5.6-1.5l-5.8 3.3a13.6 13.6 0 00-2.6-2 13.8 13.8 0 00-3-1.3V4.5a4 4 0 00-8.1 0v6.6a14.3 14.3 0 00-5.7 3.2L62.6 11a4 4 0 00-5.6 1.5 4 4 0 001.5 5.5l5.8 3.3a13.7 13.7 0 000 6.5L58.5 31a4 4 0 00-1.5 5.5 4 4 0 003.5 2 4 4 0 002-.5l5.8-3.3a13.6 13.6 0 002.7 2 13.8 13.8 0 003 1.2v6.6a4 4 0 008 0v-6.6a14.2 14.2 0 005.7-3.2l6 3.3a4 4 0 002 .5 4 4 0 003.4-2 4 4 0 00-1.4-5.5ZM75 29.7a6 6 0 01-2.3-8.2 6.1 6.1 0 015.3-3 6.2 6.2 0 013 .8 6 6 0 012.2 8.2 6.1 6.1 0 01-8.2 2.2Z\" opacity=\"0\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 80 24; 360 80 24\"/><animate id=\"t2\" attributeName=\"opacity\" begin=\"-.83s; t2.end+1s\" dur=\"2s\" keyTimes=\"0; .17; .83; 1\" values=\"0; 1; 1; 0\"/></path><animateTransform id=\"s2\" additive=\"sum\" attributeName=\"transform\" begin=\"-.83s; s2.end+1s\" dur=\"2s\" type=\"translate\" values=\"0 -36; 0 92;\"/></g><g><path fill=\"url(#g)\" stroke=\"#86c3db\" stroke-miterlimit=\"10\" d=\"m153.7 31-5.8-3.3a13.7 13.7 0 000-6.5l5.8-3.2a4 4 0 001.5-5.5 4 4 0 00-5.6-1.5l-5.8 3.3a13.6 13.6 0 00-2.6-2 13.8 13.8 0 00-3-1.3V4.5a4 4 0 00-8.1 0v6.6a14.3 14.3 0 00-5.7 3.2l-5.8-3.3a4 4 0 00-5.6 1.5 4 4 0 001.5 5.5l5.8 3.3a13.7 13.7 0 000 6.5l-5.8 3.2a4 4 0 00-1.5 5.5 4 4 0 003.5 2 4 4 0 002-.5l5.8-3.3a13.6 13.6 0 002.7 2 13.8 13.8 0 003 1.2v6.6a4 4 0 008 0v-6.6a14.2 14.2 0 005.7-3.2l5.8 3.3a4 4 0 002 .5 4 4 0 003.5-2 4 4 0 00-1.3-5.5ZM131 29.7a6 6 0 01-2.3-8.2 6.1 6.1 0 015.3-3 6.2 6.2 0 013 .8 6 6 0 012.2 8.2 6.1 6.1 0 01-8.2 2.2Z\" opacity=\"0\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"0 136 24; 360 136 24\"/><animate id=\"t3\" attributeName=\"opacity\" begin=\".83s; t3.end+1s\" dur=\"2s\" keyTimes=\"0; .17; .83; 1\" values=\"0; 1; 1; 0\"/></path><animateTransform id=\"s3\" additive=\"sum\" attributeName=\"transform\" begin=\".83s; s3.end+1s\" dur=\"2s\" type=\"translate\" values=\"0 -36; 0 92;\"/></g></symbol><symbol id=\"i\" overflow=\"visible\" viewBox=\"0 0 112 12\"><path fill=\"url(#b)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M8 12a4 4 0 01-4-4V4a4 4 0 018 0v4a4 4 0 01-4 4Z\" opacity=\"0\"><animateTransform id=\"x1\" additive=\"sum\" attributeName=\"transform\" begin=\"0s; x1.end+.5s\" dur=\"1s\" type=\"translate\" values=\"0 -12; 0 36\"/><animate id=\"y1\" attributeName=\"opacity\" begin=\"0s; y1.end+.5s\" dur=\"1s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#c)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M56 12a4 4 0 01-4-4V4a4 4 0 018 0v4a4 4 0 01-4 4Z\" opacity=\"0\"><animateTransform id=\"x2\" additive=\"sum\" attributeName=\"transform\" begin=\".67s; x2.end+.5s\" dur=\"1s\" type=\"translate\" values=\"0 -12; 0 36\"/><animate id=\"y2\" attributeName=\"opacity\" begin=\".67s; y2.end+.5s\" dur=\"1s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#d)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M104 12a4 4 0 01-4-4V4a4 4 0 018 0v4a4 4 0 01-4 4Z\" opacity=\"0\"><animateTransform id=\"x3\" additive=\"sum\" attributeName=\"transform\" begin=\".34s; x3.end+.5s\" dur=\"1s\" type=\"translate\" values=\"0 -12; 0 36\"/><animate id=\"y3\" attributeName=\"opacity\" begin=\".34s; y3.end+.5s\" dur=\"1s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path></symbol></defs><use xlink:href=\"#h\" width=\"350\" height=\"222\" transform=\"translate(81 145)\"/><use xlink:href=\"#j\" width=\"156.2\" height=\"49\" transform=\"translate(177.9 337.5)\"/><use xlink:href=\"#i\" width=\"112\" height=\"12\" transform=\"translate(200 373.5)\"/></svg>",
  "thunderstorms": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f3f7fe\"/><stop offset=\".5\" stop-color=\"#f3f7fe\"/><stop offset=\"1\" stop-color=\"#deeafb\"/></linearGradient><linearGradient id=\"b\" x1=\"8.7\" x2=\"80.9\" y1=\"17.1\" y2=\"142.1\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f7b23b\"/><stop offset=\".5\" stop-color=\"#f7b23b\"/><stop offset=\"1\" stop-color=\"#f59e0b\"/></linearGradient><symbol id=\"c\" viewBox=\"0 0 350 222\"><path fill=\"url(#a)\" stroke=\"#e6effc\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"d\" viewBox=\"0 0 102.7 186.8\"><path fill=\"url(#b)\" stroke=\"#f6a823\" stroke-miterlimit=\"10\" stroke-width=\"4\" d=\"m34.8 2-32 96h32l-16 80 80-112h-48l32-64h-48z\"><animate id=\"x1\" attributeName=\"opacity\" begin=\"0s; x1.end+.67s\" dur=\"1.33s\" keyTimes=\"0; .38; .5; .63; .75; .86; .94; 1\" values=\"1; 1; 0; 1; 0; 1; 0; 1\"/></path></symbol></defs><use xlink:href=\"#c\" width=\"350\" height=\"222\" transform=\"translate(81 145)\"/><use xlink:href=\"#d\" width=\"102.7\" height=\"186.7\" transform=\"translate(205.23 291)\"/></svg>",
  "thunderstorms-rain": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f3f7fe\"/><stop offset=\".5\" stop-color=\"#f3f7fe\"/><stop offset=\"1\" stop-color=\"#deeafb\"/></linearGradient><linearGradient id=\"b\" x1=\"8.7\" x2=\"80.9\" y1=\"17.1\" y2=\"142.1\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f7b23b\"/><stop offset=\".5\" stop-color=\"#f7b23b\"/><stop offset=\"1\" stop-color=\"#f59e0b\"/></linearGradient><linearGradient id=\"c\" x1=\"1381.3\" x2=\"1399.5\" y1=\"-1144.7\" y2=\"-1097.4\" gradientTransform=\"rotate(-9 8002.567 8233.063)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b65ed\"/><stop offset=\".5\" stop-color=\"#0a5ad4\"/><stop offset=\"1\" stop-color=\"#0950bc\"/></linearGradient><linearGradient xlink:href=\"#c\" id=\"d\" x1=\"1436.7\" x2=\"1454.9\" y1=\"-1137\" y2=\"-1089.7\" gradientTransform=\"rotate(-9 8009.537 8233.037)\"/><linearGradient xlink:href=\"#c\" id=\"e\" x1=\"1492.1\" x2=\"1510.3\" y1=\"-1129.3\" y2=\"-1082.1\" gradientTransform=\"rotate(-9 8016.566 8233.078)\"/><symbol id=\"f\" viewBox=\"0 0 350 222\"><path fill=\"url(#a)\" stroke=\"#e6effc\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"g\" overflow=\"visible\" viewBox=\"0 0 129 57\"><path fill=\"url(#c)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M8.5 56.5a8 8 0 01-8-8v-40a8 8 0 0116 0v40a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x1\" additive=\"sum\" attributeName=\"transform\" begin=\"0s; x1.end+.33s\" dur=\".67s\" type=\"translate\" values=\"0 -60; 0 60\"/><animate id=\"y1\" attributeName=\"opacity\" begin=\"0s; y1.end+.33s\" dur=\".67s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#d)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M64.5 56.5a8 8 0 01-8-8v-40a8 8 0 0116 0v40a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x2\" additive=\"sum\" attributeName=\"transform\" begin=\".33s; x2.end+.33s\" dur=\".67s\" type=\"translate\" values=\"0 -60; 0 60\"/><animate id=\"y2\" attributeName=\"opacity\" begin=\".33s; y2.end+.33s\" dur=\".67s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path><path fill=\"url(#e)\" stroke=\"#0a5ad4\" stroke-miterlimit=\"10\" d=\"M120.5 56.5a8 8 0 01-8-8v-40a8 8 0 0116 0v40a8 8 0 01-8 8Z\" opacity=\"0\"><animateTransform id=\"x3\" additive=\"sum\" attributeName=\"transform\" begin=\"-.33s; x3.end+.33s\" dur=\".67s\" type=\"translate\" values=\"0 -60; 0 60\"/><animate id=\"y3\" attributeName=\"opacity\" begin=\"-.33s; y3.end+.33s\" dur=\".67s\" keyTimes=\"0; .25; 1\" values=\"0; 1; 0\"/></path></symbol><symbol id=\"h\" viewBox=\"0 0 102.7 186.8\"><path fill=\"url(#b)\" stroke=\"#f6a823\" stroke-miterlimit=\"10\" stroke-width=\"4\" d=\"m34.8 2-32 96h32l-16 80 80-112h-48l32-64h-48z\"><animate id=\"x1\" attributeName=\"opacity\" begin=\"0s; x1.end+.67s\" dur=\"1.33s\" keyTimes=\"0; .38; .5; .63; .75; .86; .94; 1\" values=\"1; 1; 0; 1; 0; 1; 0; 1\"/></path></symbol></defs><use xlink:href=\"#f\" width=\"350\" height=\"222\" transform=\"translate(81 145)\"/><use xlink:href=\"#g\" width=\"129\" height=\"57\" transform=\"translate(191.5 343.5)\"/><use xlink:href=\"#h\" width=\"102.7\" height=\"186.7\" transform=\"translate(205.23 291)\"/></svg>",
  "clear-night": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"a\" x1=\"54.3\" x2=\"187.2\" y1=\"29\" y2=\"259.1\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#86c3db\"/><stop offset=\".5\" stop-color=\"#86c3db\"/><stop offset=\"1\" stop-color=\"#5eafcf\"/></linearGradient><symbol id=\"b\" overflow=\"visible\" viewBox=\"0 0 270 270\"><path fill=\"url(#a)\" stroke=\"#72b9d5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"6\" d=\"M252.3 168.6A133.4 133.4 0 01118 36.2 130.5 130.5 0 01122.5 3 133 133 0 003 134.6C3 207.7 63 267 137.2 267c62.5 0 114.8-42.2 129.8-99.2a135.6 135.6 0 01-14.8.8Z\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"-15 135 135; 9 135 135; -15 135 135\"/></path></symbol></defs><use xlink:href=\"#b\" width=\"270\" height=\"270\" transform=\"translate(121 121)\"/></svg>",
  "partly-cloudy-night": "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 512 512\"><defs><symbol id=\"d\" viewBox=\"0 0 172 172\"><path fill=\"url(#b)\" stroke=\"#72b9d5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"4\" d=\"M160.6 107.4a84.8 84.8 0 01-85.4-84.3A83.3 83.3 0 0178 2 84.7 84.7 0 002 85.7 84.8 84.8 0 0087.4 170a85.2 85.2 0 0082.6-63.1 88 88 0 01-9.4.5Z\"><animateTransform additive=\"sum\" attributeName=\"transform\" dur=\"6s\" repeatCount=\"indefinite\" type=\"rotate\" values=\"-15 86 86; 9 86 86; -15 86 86\"/></path></symbol><symbol id=\"e\" viewBox=\"0 0 350 222\"><path fill=\"url(#a)\" stroke=\"#e6effc\" stroke-miterlimit=\"10\" stroke-width=\"6\" d=\"m291 107-2.5.1A83.9 83.9 0 00135.6 43 56 56 0 0051 91a56.6 56.6 0 00.8 9A60 60 0 0063 219l4-.2v.2h224a56 56 0 000-112Z\"/></symbol><symbol id=\"c\" viewBox=\"0 0 351 246\"><use xlink:href=\"#d\" width=\"172\" height=\"172\"/><use xlink:href=\"#e\" width=\"350\" height=\"222\" transform=\"translate(1 24)\"/></symbol><linearGradient id=\"a\" x1=\"99.5\" x2=\"232.6\" y1=\"30.7\" y2=\"261.4\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f3f7fe\"/><stop offset=\".5\" stop-color=\"#f3f7fe\"/><stop offset=\"1\" stop-color=\"#deeafb\"/></linearGradient><linearGradient id=\"b\" x1=\"34.7\" x2=\"119.2\" y1=\"18.6\" y2=\"165\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#86c3db\"/><stop offset=\".5\" stop-color=\"#86c3db\"/><stop offset=\"1\" stop-color=\"#5eafcf\"/></linearGradient></defs><use xlink:href=\"#c\" width=\"351\" height=\"246\" transform=\"translate(80 121)\"/></svg>",
  "not-available": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path fill=\"#374251\" d=\"M174.6 264.7v-62.3h27.7v107.2H174l-37.2-62v62H109V202.3h27.9Zm68.8 44.9h-27.1l44.6-107.3H288Zm159.6 0h-29.7l-6-18.3h-36.2l-6 18.3h-29.5l39.1-107.3h29.7ZM342.7 256l-4.8 14.6h22.8l-4.9-14.6-6.6-22.4Z\"/></svg>",
};

// Open-Meteo WMO weather codes → icon + label
const WEATHER_CODES = {
  0: { icon: "clear-day", night: "clear-night", label: "Clear" },
  1: { icon: "clear-day", night: "clear-night", label: "Mostly clear" },
  2: { icon: "partly-cloudy-day", night: "partly-cloudy-night", label: "Partly cloudy" },
  3: { icon: "overcast", label: "Overcast" },
  45: { icon: "fog", label: "Fog" },
  48: { icon: "fog", label: "Freezing fog" },
  51: { icon: "drizzle", label: "Light drizzle" },
  53: { icon: "drizzle", label: "Drizzle" },
  55: { icon: "extreme-drizzle", label: "Dense drizzle" },
  56: { icon: "drizzle", label: "Freezing drizzle" },
  57: { icon: "extreme-drizzle", label: "Freezing drizzle" },
  61: { icon: "rain", label: "Light rain" },
  63: { icon: "rain", label: "Rain" },
  65: { icon: "extreme-rain", label: "Heavy rain" },
  66: { icon: "sleet", label: "Freezing rain" },
  67: { icon: "sleet", label: "Freezing rain" },
  71: { icon: "snow", label: "Light snow" },
  73: { icon: "snow", label: "Snow" },
  75: { icon: "extreme-snow", label: "Heavy snow" },
  77: { icon: "snow", label: "Snow grains" },
  80: { icon: "rain", label: "Light showers" },
  81: { icon: "rain", label: "Showers" },
  82: { icon: "extreme-rain", label: "Violent showers" },
  85: { icon: "snow", label: "Snow showers" },
  86: { icon: "extreme-snow", label: "Snow showers" },
  95: { icon: "thunderstorms", label: "Thunderstorm" },
  96: { icon: "thunderstorms-rain", label: "Thunderstorm with hail" },
  99: { icon: "thunderstorms-rain", label: "Thunderstorm with hail" },
};
const RICH_CAPTURE_FIELDS = {
  reflection: [
    { key: 'context', label: 'Context', placeholder: 'What triggered this reflection…', rows: 3 },
    { key: 'takeaway', label: 'Takeaway', placeholder: 'The lesson or insight…', rows: 3 },
  ],
  'to-watch': [
    { key: 'source', label: 'Link / where', placeholder: 'URL or platform…', rows: 2 },
    { key: 'body', label: 'Notes', placeholder: 'Why it looks interesting…', rows: 3 },
  ],
  book: [
    { key: 'author', label: 'Author', placeholder: 'Author name…', rows: 2 },
    { key: 'status', label: 'Status', kind: 'select', options: ['want-to-read', 'reading', 'finished'] },
    { key: 'body', label: 'Notes', placeholder: 'Why you want it / thoughts…', rows: 3 },
  ],
};

const DUE_EMOJI_RE = /[📅⏳🛫]\s*(\d{4}-\d{2}-\d{2})/;
const TASK_LINE_RE = /^(\s*)(?:[-*]|\d+\.) \[([ xX-])\] ?(.*)$/;

function pad2(n) { return String(n).padStart(2, '0'); }

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isoWeek(d) {
  // ISO-8601 week number (weeks start Monday; week 1 contains the first Thursday)
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // Sun -> 7
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function sanitizeName(s) {
  return String(s || '').replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim();
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'thought';
}

// Strip wiki links ([[a|b]] -> b, [[a]] -> a) and trailing task emoji metadata
// (dates, done/cancelled stamps). Keeps priorities and recurrence rules visible.
function cleanTaskText(raw) {
  let t = String(raw || '');
  t = t.replace(/\[\[[^\]]*\|([^\]]*)\]\]/g, '$1');
  t = t.replace(/\[\[([^\]]*)\]\]/g, '$1');
  const META = /(?:\s+[📅⏳🛫➕✅❌]\s*\d{4}-\d{2}-\d{2})+$/;
  let prev;
  do { prev = t; t = t.replace(META, ''); } while (t !== prev);
  return t.replace(/\s+$/, '');
}

function dueDateOf(lineText) {
  const m = DUE_EMOJI_RE.exec(String(lineText || ''));
  return m ? m[1] : null;
}

function scheduledDateOf(lineText) {
  const m = /⏳\s*(\d{4}-\d{2}-\d{2})/.exec(String(lineText || ''));
  return m ? m[1] : null;
}

function startDateOf(lineText) {
  const m = /🛫\s*(\d{4}-\d{2}-\d{2})/.exec(String(lineText || ''));
  return m ? m[1] : null;
}

const DONE_DATE_RE = /✅\s*\d{4}-\d{2}-\d{2}/;
const CANCELLED_DATE_RE = /❌\s*\d{4}-\d{2}-\d{2}/;

function priorityOf(text) {
  const t = String(text || '');
  if (t.includes('⏫')) return 'high';
  if (t.includes('🔼')) return 'medium';
  if (t.includes('🔽') || t.includes('⏬')) return 'low';
  return null;
}

function priorityRank(p) {
  if (p === 'high') return 0;
  if (p === 'medium') return 1;
  if (p === 'low') return 2;
  return 3;
}

/* ── task line parsing / rebuilding ─────────────────────────── */

const TASK_RECURRENCE_RE = /🔁\s*([^📅⏳🛫➕✅❌]+)/;

/** Split a task body into editable parts (text, priority, dates, recurrence). */
function splitTaskBody(body) {
  const src = String(body || '');
  const date = (re) => {
    const m = re.exec(src);
    return m ? m[1] : '';
  };
  const recM = TASK_RECURRENCE_RE.exec(src);
  return {
    text: src
      .replace(/[🛫⏳📅➕✅❌]\s*\d{4}-\d{2}-\d{2}/g, '')
      .replace(/🔁\s*[^📅⏳🛫➕✅❌]+/g, '')
      .replace(/[⏫🔼🔽⏬]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
    priority: priorityOf(src),
    recurrence: recM ? recM[1].replace(/[⏫🔼🔽⏬]/g, '').replace(/\s+/g, ' ').trim() : '',
    start: date(/🛫\s*(\d{4}-\d{2}-\d{2})/),
    scheduled: date(/⏳\s*(\d{4}-\d{2}-\d{2})/),
    due: date(/📅\s*(\d{4}-\d{2}-\d{2})/),
    created: date(/➕\s*(\d{4}-\d{2}-\d{2})/),
    done: date(/✅\s*(\d{4}-\d{2}-\d{2})/),
    cancelled: date(/❌\s*(\d{4}-\d{2}-\d{2})/),
  };
}

/** Rebuild a Tasks-compatible checkbox line from parts. */
function buildTaskLine(indent, status, parts) {
  const bits = [];
  if (parts.text) bits.push(parts.text);
  if (parts.priority === 'high') bits.push('⏫');
  else if (parts.priority === 'medium') bits.push('🔼');
  else if (parts.priority === 'low') bits.push('🔽');
  if (parts.recurrence) bits.push(`🔁 ${parts.recurrence}`);
  if (parts.start) bits.push(`🛫 ${parts.start}`);
  if (parts.scheduled) bits.push(`⏳ ${parts.scheduled}`);
  if (parts.due) bits.push(`📅 ${parts.due}`);
  if (parts.created) bits.push(`➕ ${parts.created}`);
  if (parts.done) bits.push(`✅ ${parts.done}`);
  if (parts.cancelled) bits.push(`❌ ${parts.cancelled}`);
  return `${indent}- [${status}] ${bits.join(' ')}`.replace(/\s+$/, '');
}

/** Index of the first line after a YAML frontmatter block (0 when there is none). */
function frontmatterEnd(lines) {
  if (!lines.length || lines[0].trim() !== '---') return 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return i + 1;
  }
  return 0;
}

/* ── recurrence (Tasks-compatible subset) ────────────────────── */

const WEEKDAY_NAMES = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// Parse `🔁 <rule>` from a task body. Supports the common subset:
//   every day / week / month / year, every N days|weeks|months|years,
//   every weekday, every week on Sunday[, Monday…], every Sunday[, Monday…],
//   any rule with a trailing `when done`.
// Unsupported rules return null (completion simply adds no new occurrence).
function parseRecurrence(body) {
  const m = /🔁\s*([^📅⏳🛫➕✅❌]+)/.exec(String(body || ''));
  if (!m) return null;
  let rule = m[1].trim();
  if (!rule) return null;
  let whenDone = false;
  rule = rule.replace(/,?\s*when\s+done\s*/i, () => { whenDone = true; return ' '; }).trim();
  if (!rule) return null;
  let mm;
  if ((mm = /^every\s+weekday$/i.exec(rule))) {
    return { rule, whenDone, kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] };
  }
  if ((mm = /^every\s+(?:week\s+on\s+)?((?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s*,\s*(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))*)$/i.exec(rule))) {
    return { rule, whenDone, kind: 'weekdays', weekdays: mm[1].split(/\s*,\s*/).map((s) => WEEKDAY_NAMES[s.toLowerCase()]) };
  }
  if ((mm = /^every\s+(?:(\d+)\s+)?(day|week|month|year)s?$/i.exec(rule))) {
    return { rule, whenDone, kind: 'interval', n: mm[1] ? parseInt(mm[1], 10) : 1, unit: mm[2].toLowerCase() };
  }
  return null;
}

function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

function addMonthsClamp(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return ymd(d);
}

function computeNextRecurrence(rec, base) {
  if (rec.kind === 'interval') {
    if (rec.unit === 'day') return shiftDate(base, rec.n);
    if (rec.unit === 'week') return shiftDate(base, 7 * rec.n);
    if (rec.unit === 'month') return addMonthsClamp(base, rec.n);
    return addMonthsClamp(base, 12 * rec.n);
  }
  const b = new Date(`${base}T00:00:00`).getDay();
  for (let i = 1; i <= 7; i++) {
    if (rec.weekdays.includes((b + i) % 7)) return shiftDate(base, i);
  }
  return null;
}

function fromNow(ts) {
  const diff = Date.now() - ts;
  const min = 60 * 1000, hour = 60 * min, day = 24 * hour;
  if (diff < min) return 'just now';
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ts).toISOString().slice(0, 10);
}

/* ════════════════════════════════════════════════════════════════
   ✦ Dashboard view
   ════════════════════════════════════════════════════════════════ */

class HermesDashboardView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.settings = plugin.settings;
    this.calOffset = 0;      // months away from the current month
    this.captureMode = null; // null | '__task' | capture slug
    this.activeChip = null;  // slug when plain capture is active
    this._calendarNotes = new Set();
  }

  getViewType() { return VIEW_TYPE_HERMES_DASHBOARD; }
  getDisplayText() { return 'Agentic dashboard'; }
  getIcon() { return 'sparkles'; }

  async onOpen() {
    this.root = this.contentEl.createDiv({ cls: 'hermes-dashboard hd-root' });
    await this.renderAll();
    this.registerInterval(window.setInterval(() => this.tickClock(), 1000));
    this.tickClock();
  }

  onClose() {
    this.root = null;
  }

  /* ---------- data collection (replaces the Dataview queries) ---------- */

  async collectData() {
    const s = this.settings;
    const app = this.app;
    const now = new Date();
    const today = ymd(now);
    const dailyPath = `${s.journalFolder}/${today}.md`;

    const data = {
      today,
      dailyPath,
      dailyExists: !!app.vault.getAbstractFileByPath(dailyPath),
      todayTasks: [],   // open tasks from today's daily
      dueTasks: [],     // open, due <= today, from other files
      openCount: 0,
      doneCount: 0,
      noteCount: 0,
      modifiedCount: 0,
      meetings: [],     // meetings dated today
      meetingCount: 0,
      recent: [],
      inbox: [],
      inboxAll: [],     // every inbox note (for the at-a-glance reveal)
      inboxCount: 0,
      tasksAll: [],     // every open due task (for the at-a-glance reveal)
      doneList: [],     // done tasks (for the at-a-glance reveal)
      modified: [],     // files modified in the last 7 days (for the reveal)
    };

    const inboxFolder = app.vault.getAbstractFileByPath(s.inboxFolder);
    const meetingsFolder = app.vault.getAbstractFileByPath(s.meetingsFolder);
    const inboxIsFolder = inboxFolder instanceof TFolder;
    const meetingsIsFolder = meetingsFolder instanceof TFolder;

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const files = app.vault.getMarkdownFiles();
    data.noteCount = files.length;

    const inInbox = (f) => inboxIsFolder && f.path.startsWith(s.inboxFolder + '/');
    const inMeetings = (f) => meetingsIsFolder && f.path.startsWith(s.meetingsFolder + '/');

    const inboxFiles = [];
    const recentFiles = [];

    for (const f of files) {
      if (f.stat.mtime >= weekAgo) { data.modifiedCount++; data.modified.push({ path: f.path, title: f.basename, mtime: f.stat.mtime }); }
      if (inInbox(f)) inboxFiles.push(f);
      recentFiles.push(f);

      const cache = app.metadataCache.getFileCache(f);
      if (cache && cache.listItems && cache.listItems.length) {
        let text;
        try { text = await app.vault.cachedRead(f); } catch (e) { continue; }
        const lines = text.split('\n');
        for (const li of cache.listItems) {
          if (!li.task) continue;
          const line = lines[li.position.start.line] || '';
          const m = TASK_LINE_RE.exec(line);
          if (!m) continue;
          const isCancelled = m[2] === '-';
          const isDone = m[2] === 'x' || m[2] === 'X';
          const raw = m[3];
          if (isCancelled) continue; // cancelled: neither open nor done
          if (isDone) { data.doneCount++; data.doneList.push({ path: f.path, base: f.basename, raw }); continue; }
          data.openCount++;

          const daily = f.path === dailyPath;
          const due = daily ? null : dueDateOf(line);
          data.tasksAll.push({
            path: f.path, line, raw, due, daily, done: false,
            base: f.basename,
          });

          if (daily) {
            data.todayTasks.push({
              path: f.path, line, raw, due: null, done: false,
              base: f.basename,
            });
          } else if (due && due <= today) {
            data.dueTasks.push({
              path: f.path, line, raw, due, done: false,
              base: f.basename,
            });
          }
        }
      }

      if (inMeetings(f) && cache && cache.frontmatter) {
        const fm = cache.frontmatter;
        const fmd = typeof fm.date === 'string' ? fm.date : null;
        if (fmd === today) {
          data.meetings.push({
            path: f.path,
            title: f.basename,
            time: typeof fm.time === 'string' ? fm.time : null,
          });
        }
      }
    }

    // dedupe by path+raw, sort: overdue first, then today's daily tasks, then rest
    const seen = new Set();
    const allTasks = [];
    for (const t of data.todayTasks.concat(data.dueTasks)) {
      const key = t.path + '::' + t.line;
      if (seen.has(key)) continue;
      seen.add(key);
      allTasks.push(t);
    }
    allTasks.sort((a, b) => {
      const da = a.due || '9999-99-99';
      const db = b.due || '9999-99-99';
      if (da !== db) return da < db ? -1 : 1;
      const pa = priorityRank(priorityOf(a.raw)) - priorityRank(priorityOf(b.raw));
      if (pa !== 0) return pa;
      return a.raw.localeCompare(b.raw);
    });
    data.tasks = allTasks.slice(0, Math.max(1, s.tasksCap));
    data.tasksCount = allTasks.length;
    data.todayTasks = null; // merged above
    data.dueTasks = null;

    // at-a-glance "open" reveal: every open task, dated/overdue first
    const rank = (t) => (t.due && t.due <= today) ? 0 : (t.daily ? 1 : 2);
    data.tasksAll.sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      const da = a.due || '9999-99-99', db = b.due || '9999-99-99';
      if (da !== db) return da < db ? -1 : 1;
      const pa = priorityRank(priorityOf(a.raw)) - priorityRank(priorityOf(b.raw));
      if (pa !== 0) return pa;
      return a.raw.localeCompare(b.raw);
    });

    // meetings: sort by time
    data.meetings.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    if (meetingsIsFolder) {
      data.meetingCount = files.filter((f) => inMeetings(f) && f.stat.ctime).length;
    }

    // modified: newest first
    data.modified.sort((a, b) => b.mtime - a.mtime);

    // recent notes: 7 by mtime, skip today's daily duplicates of the same list
    recentFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
    data.recent = recentFiles.slice(0, 7).map((f) => ({
      path: f.path,
      title: f.basename,
      mtime: f.stat.mtime,
    }));

    // inbox: card shows 10 by ctime, reveal lists everything
    inboxFiles.sort((a, b) => b.stat.ctime - a.stat.ctime);
    data.inboxCount = inboxFiles.length;
    const tagOf = (f) => {
      const c = app.metadataCache.getFileCache(f);
      return c && c.frontmatter && typeof c.frontmatter.tag === 'string' ? c.frontmatter.tag : '';
    };
    data.inboxAll = inboxFiles.map((f) => ({ path: f.path, title: f.basename, ctime: f.stat.ctime, tag: tagOf(f) }));
    data.inbox = data.inboxAll.slice(0, 10);

    // calendar: which dates in journal folder have notes
    this._calendarNotes = new Set();
    const journal = app.vault.getAbstractFileByPath(s.journalFolder);
    if (journal instanceof TFolder) {
      for (const f of journal.children) {
        if (f instanceof TFile && /^\d{4}-\d{2}-\d{2}\.md$/.test(f.name)) {
          this._calendarNotes.add(f.name.replace(/\.md$/, ''));
        }
      }
    }

    return data;
  }

  /* ---------- rendering ---------- */

  async renderAll() {
    const data = await this.collectData();
    if (!this.root || !this.root.isConnected) return;
    // preserve an in-progress capture draft across re-renders (refresh timer / vault changes)
    const draft = this.input ? this.input.value : '';
    const draftFocus = !!(draft && this.input && this.input.ownerDocument.activeElement === this.input);
    this.root.empty();
    this.renderHero(data);
    this.renderActions();
    this.renderCapture();
    if (draft && this.input) {
      this.input.value = draft;
      if (draftFocus) {
        this.focusInput();
        try { this.input.setSelectionRange(draft.length, draft.length); } catch (e) { /* ignore */ }
      }
    }
    this.renderGrid(data);
    this.renderFooter();
  }

  renderHero(data) {
    const s = this.settings;
    const hero = this.root.createDiv({ cls: 'hd-hero' });

    const videoFile = this.app.vault.getAbstractFileByPath(s.videoPath);
    if (videoFile instanceof TFile) {
      const video = hero.createEl('video', { cls: 'hd-hero-video' });
      video.src = this.resourcePath(s.videoPath);
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.setAttribute('playsinline', '');
    } else {
      const poster = Platform.isMobile ? s.posterPhonePath : s.posterPath;
      if (this.app.vault.getAbstractFileByPath(poster) instanceof TFile) {
        hero.style.backgroundImage = `url("${this.resourcePath(poster)}")`;
      }
    }

    hero.createDiv({ cls: 'hd-hero-shade' });

    const top = hero.createDiv({ cls: 'hd-hero-top' });
    top.createDiv({ cls: 'hd-brand', text: '✦ AGENTIC' });
    const right = top.createDiv({ cls: 'hd-hero-right' });
    if (this.settings.weatherEnabled) {
      const wEl = right.createDiv({ cls: 'hd-weather' });
      wEl.hide();
      this.plugin.fetchWeather().then((d) => {
        if (!wEl.isConnected) return;
        if (!d) { wEl.hide(); return; }
        wEl.empty();
        if (d.nodata) {
          wEl.createSpan({ cls: 'hd-weather-icon', text: '📴' });
          wEl.createSpan({ text: ` Offline · ${d.city || ''}`.trim() });
          wEl.setAttribute('title', 'No network — weather unavailable');
          wEl.addClass('hd-weather-offline');
        } else {
          const icon = WEATHER_ICONS[d.icon] || WEATHER_ICONS['not-available'];
          const iconEl = wEl.createSpan({ cls: 'hd-weather-icon' });
          iconEl.innerHTML = icon;
          const suffix = d.stale ? ' · cached' : '';
          wEl.createSpan({ cls: 'hd-weather-text', text: `${d.temp}${d.unit} · ${d.city}${suffix}` });
          const base = d.label || d.city || '';
          wEl.setAttribute('title', d.stale ? `${base} (offline — showing cached data)` : base);
          if (d.stale) wEl.addClass('hd-weather-stale');
        }
        wEl.show();
      });
    }
    right.createDiv({ cls: 'hd-clock', attr: { id: 'hdClock' }, text: '--:--:--' });

    const bottom = hero.createDiv({ cls: 'hd-hero-bottom' });
    const dateEl = bottom.createDiv({ cls: 'hd-date', attr: { id: 'hdDate' } });
    this.writeDateLine(dateEl, data.today);
  }

  writeDateLine(el, today) {
    const d = new Date(today + 'T00:00:00');
    const formatted = moment(d).format('dddd DD MMMM');
    el.empty();
    el.appendText('Today is ');
    el.createSpan({ cls: 'hd-em', text: `📅 ${formatted}` });
    el.appendText(`, in Week ${pad2(isoWeek(d))}`);
  }

  renderActions() {
    const actions = this.root.createDiv({ cls: 'hd-actions' });

    const dailyBtn = actions.createEl('button', { cls: 'hd-btn', text: '📅 Daily note' });
    dailyBtn.addEventListener('click', () => this.openDaily());

    const taskBtn = actions.createEl('button', { cls: 'hd-btn', text: '＋ Task' });
    taskBtn.addEventListener('click', () => {
      this.plugin.openTaskModal();
    });

    const meetBtn = actions.createEl('button', { cls: 'hd-btn', text: 'Meeting' });
    meetBtn.addEventListener('click', () => {
      this.plugin.openMeetingModal();
    });
  }

  renderCapture() {
    const cap = this.root.createDiv({ cls: 'hd-capture' });
    const row = cap.createDiv({ cls: 'hd-inputrow' });
    this.input = row.createEl('input', {
      cls: 'hd-input',
      attr: { id: 'hdInput', type: 'text' },
    });
    this.refreshCaptureUI();

    this.input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') { evt.preventDefault(); this.submitCapture(); }
      else if (evt.key === 'Escape') { evt.preventDefault(); this.resetCapture(true); }
    });

    const chips = cap.createDiv({ cls: 'hd-chips' });
    this.chipEls = new Map();
    for (const t of CAPTURE_TYPES) {
      const chip = chips.createEl('button', { cls: 'hd-chip', text: t.label });
      chip.addEventListener('click', () => {
        if (RICH_CAPTURE_SLUGS.includes(t.slug)) {
          this.plugin.openCaptureModal(t.slug);
          return;
        }
        // chips are standalone: tapping always selects that type (no toggle-off, no silent fallback)
        this.captureMode = null;
        this.activeChip = t.slug;
        this.refreshCaptureUI();
        this.focusInput();
      });
      this.chipEls.set(t.slug, chip);
    }

    // quick task chip: one-line task into today's daily note (the ＋ Task button opens the full form)
    const taskChip = chips.createEl('button', { cls: 'hd-chip', text: 'Task ⚡' });
    taskChip.addEventListener('click', () => {
      if (this.captureMode === '__task') { this.resetCapture(); return; }
      this.captureMode = '__task';
      this.activeChip = null;
      this.refreshCaptureUI();
      this.focusInput();
    });
    this.chipEls.set('__task', taskChip);
  }

  refreshCaptureUI() {
    if (!this.input) return;
    let placeholder = 'Capture a thought to Inbox… (Enter to save, Esc to clear)';
    if (this.captureMode === '__task') placeholder = 'Add task to today… (Enter to save, Esc to clear)';
    else if (this.activeChip) {
      const t = CAPTURE_TYPES.find((x) => x.slug === this.activeChip);
      if (t) placeholder = `Capture ${t.label.replace(/\s\S+$/, '')} to Inbox… (Enter to save, Esc to clear)`;
    }
    this.input.placeholder = placeholder;

    if (this.chipEls) {
      for (const [slug, el] of this.chipEls) {
        el.toggleClass('is-active', this.activeChip === slug || (slug === '__task' && this.captureMode === '__task'));
      }
    }
  }

  focusInput() {
    if (this.input) this.input.focus();
  }

  resetCapture(keepChip) {
    this.captureMode = null;
    if (!keepChip) this.activeChip = null;
    if (this.input) this.input.value = '';
    this.refreshCaptureUI();
  }

  async submitCapture() {
    const raw = (this.input ? this.input.value : '').trim();
    if (!raw) return;
    try {
      if (this.captureMode === '__task') {
        await this.plugin.addTaskToDaily(raw);
        new Notice('Task added to today ✓');
      } else {
        const type = this.activeChip
          ? (CAPTURE_TYPES.find((x) => x.slug === this.activeChip) || { slug: 'thought' }).slug
          : 'thought';
        await this.plugin.captureToInbox(type, raw);
        new Notice('Saved to inbox ✓');
      }
      this.resetCapture(true);
      this.plugin.requestRefresh(450);
    } catch (e) {
      console.error('[agentic-dashboard] capture failed', e);
      new Notice('Agentic dashboard: could not save (see console)');
    }
  }

  renderGrid(data) {
    const grid = this.root.createDiv({ cls: 'hd-grid' });

    this.renderTasksCard(grid, data);
    this.renderCalendarCard(grid, data);
    this.renderStatsCard(grid, data);
    this.renderMeetingsCard(grid, data);
    this.renderRecentCard(grid, data);
    this.renderInboxCard(grid, data);
  }

  renderTasksCard(grid, data) {
    const card = grid.createDiv({ cls: 'hd-card' });
    const h = card.createEl('h3', { text: 'Tasks today' });
    h.createSpan({ cls: 'hd-count', text: `${data.tasksCount}` });

    const list = card.createDiv({ cls: 'hd-tasklist' });
    if (!data.tasks.length) {
      list.createDiv({ cls: 'hd-empty-ok', text: 'No open tasks ✓' });
      return;
    }

    for (const t of data.tasks) {
      const row = list.createDiv({ cls: 'hd-task' });
      const tick = row.createSpan({ cls: 'hd-tick', text: '✓' });
      const textEl = row.createSpan({ cls: 'hd-task-text', text: cleanTaskText(t.raw) });

      if (t.due && t.due < data.today) {
        const d = new Date(t.due + 'T00:00:00');
        row.createSpan({
          cls: 'hd-overdue',
          text: `overdue · ${pad2(d.getDate())} ${moment(d).format('MMM')}`,
        });
      } else if (t.due) {
        row.createSpan({ cls: 'hd-when', text: t.due.slice(5).replace('-', ' ') });
      }

      if (t.path !== data.dailyPath) {
        const src = row.createEl('a', { cls: 'hd-task-src', text: t.base });
        src.addEventListener('click', (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          this.openPath(t.path);
        });
      }

      const toggle = async () => {
        try {
          const ok = await this.plugin.toggleTaskLine(t.path, t.line);
          if (!ok) new Notice('Task line changed — dashboard refreshed');
          this.plugin.requestRefresh(250);
        } catch (e) {
          console.error('[agentic-dashboard] toggle failed', e);
          new Notice('Agentic dashboard: could not toggle task');
        }
      };
      row.addEventListener('click', toggle);
      tick.addEventListener('click', (evt) => { evt.stopPropagation(); toggle(); });
    }

    if (data.tasksCount > data.tasks.length) {
      list.createDiv({
        cls: 'hd-empty',
        text: `+ ${data.tasksCount - data.tasks.length} more due tasks not shown`,
      });
    }
  }

  renderCalendarCard(grid, data) {
    const card = grid.createDiv({ cls: 'hd-card' });
    const h = card.createEl('h3', { text: 'Calendar' });

    const head = card.createDiv({ cls: 'hd-cal-head' });
    const navWrap = head.createDiv();
    const prev = navWrap.createEl('button', { cls: 'hd-cal-nav', text: '‹' });
    const next = navWrap.createEl('button', { cls: 'hd-cal-nav', text: '›' });
    const todayBtn = navWrap.createEl('button', { cls: 'hd-cal-today', text: 'TODAY' });
    const title = head.createDiv({ cls: 'hd-cal-title' });

    const base = new Date();
    const viewDate = new Date(base.getFullYear(), base.getMonth() + this.calOffset, 1);
    title.textContent = moment(viewDate).format('MMMM YYYY');

    prev.addEventListener('click', () => { this.calOffset--; this.rerenderCalendar(); });
    next.addEventListener('click', () => { this.calOffset++; this.rerenderCalendar(); });
    todayBtn.addEventListener('click', () => { this.calOffset = 0; this.rerenderCalendar(); });

    const gridEl = card.createDiv({ cls: 'hd-cal-grid' });
    const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const dow of dows) gridEl.createDiv({ cls: 'hd-cal-dow', text: dow });

    // Monday-start 42-cell layout
    const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const firstDow = (first.getDay() + 6) % 7; // Mon=0
    const start = new Date(first);
    start.setDate(first.getDate() - firstDow);

    const todayStr = data.today;
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = ymd(d);
      const cell = gridEl.createDiv({
        cls: `hd-cal-day${d.getMonth() !== viewDate.getMonth() ? ' dim' : ''}${key < todayStr ? ' past' : ''}${key === todayStr ? ' today' : ''}${this._calendarNotes.has(key) ? ' has-note' : ''}`,
        text: String(d.getDate()),
      });
      cell.addEventListener('click', () => this.openDaily(key));
    }
  }

  rerenderCalendar() {
    if (!this.root || !this.root.isConnected) return;
    const cards = this.root.querySelectorAll('.hd-card');
    for (const card of cards) {
      const h3 = card.querySelector('h3');
      if (h3 && h3.textContent === 'Calendar') {
        // rebuild the whole grid to keep layout intact
        this.renderAll();
        return;
      }
    }
  }

  renderStatsCard(grid, data) {
    const card = grid.createDiv({ cls: 'hd-card' });
    card.createEl('h3', { text: 'At a glance' });
    const stats = card.createDiv({ cls: 'hd-stats' });
    const items = [
      {
        ico: '📝', num: `${data.noteCount}`, lbl: 'notes',
        reveal: () => this.revealFileExplorer(),
      },
      {
        ico: '☐', num: `${data.openCount}`, lbl: 'open',
        reveal: () => this.showListModal('Open tasks', data.tasksAll.map((t) => ({
          when: t.due ? t.due.slice(5).replace('-', ' ') : (t.daily ? 'today' : '—'),
          title: cleanTaskText(t.raw),
          path: t.path,
        }))),
      },
      {
        ico: '☑', num: `${data.doneCount}`, lbl: 'done',
        reveal: () => this.showListModal('Completed tasks', data.doneList.map((t) => ({
          when: t.base,
          title: cleanTaskText(t.raw),
          path: t.path,
        }))),
      },
      {
        ico: '📥', num: `${data.inboxCount}`, lbl: 'inbox',
        reveal: () => this.showListModal('Inbox', data.inboxAll.map((n) => ({
          when: n.tag ? `#${n.tag}` : '#',
          title: n.title,
          path: n.path,
        }))),
      },
      {
        ico: '🗓', num: `${data.meetings.length}`, lbl: 'meetings',
        reveal: () => this.showListModal('Meetings today', data.meetings.map((m) => ({
          when: m.time ? m.time.slice(0, 5) : '—',
          title: m.title,
          path: m.path,
        }))),
      },
      {
        ico: '⏱', num: `${data.modifiedCount}`, lbl: 'mod 7d',
        reveal: () => this.showListModal('Modified in the last 7 days', data.modified.map((r) => ({
          when: fromNow(r.mtime),
          title: r.title,
          path: r.path,
        }))),
      },
    ];
    for (const it of items) {
      const st = stats.createDiv({ cls: 'hd-stat click' });
      st.createSpan({ cls: 'hd-ico', text: it.ico });
      st.createDiv({ cls: 'hd-num', text: it.num });
      st.createDiv({ cls: 'hd-lbl', text: it.lbl });
      st.addEventListener('click', () => it.reveal());
    }
  }

  revealFileExplorer() {
    const leaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
    if (leaf) this.app.workspace.revealLeaf(leaf);
    else new Notice('Agentic dashboard: file explorer not available');
  }

  showListModal(title, rows) {
    new HdListModal(this.app, title, rows).open();
  }

  renderMeetingsCard(grid, data) {
    const card = grid.createDiv({ cls: 'hd-card' });
    card.createEl('h3', { text: 'Meetings today' });
    const list = card.createDiv({ cls: 'hd-list' });
    if (!data.meetings.length) {
      list.createDiv({ cls: 'hd-empty-ok', text: 'No meetings today ✓' });
      return;
    }
    for (const m of data.meetings) {
      const item = list.createDiv({ cls: 'hd-item' });
      item.createSpan({ cls: 'hd-when', text: m.time ? m.time.slice(0, 5) : '—' });
      const open = item.createSpan({ cls: 'hd-open', text: m.title });
      open.addEventListener('click', () => this.openPath(m.path));
    }
  }

  renderRecentCard(grid, data) {
    const card = grid.createDiv({ cls: 'hd-card' });
    card.createEl('h3', { text: 'Recent notes' });
    const list = card.createDiv({ cls: 'hd-list' });
    if (!data.recent.length) {
      list.createDiv({ cls: 'hd-empty', text: 'No notes yet' });
      return;
    }
    for (const r of data.recent) {
      const item = list.createDiv({ cls: 'hd-item' });
      item.createSpan({ cls: 'hd-when', text: fromNow(r.mtime) });
      const open = item.createSpan({ cls: 'hd-open', text: r.title });
      open.addEventListener('click', () => this.openPath(r.path));
    }
  }

  renderInboxCard(grid, data) {
    const card = grid.createDiv({ cls: 'hd-card' });
    const h = card.createEl('h3', { text: 'Inbox' });
    h.createSpan({ cls: 'hd-count', text: `${data.inboxCount}` });
    const list = card.createDiv({ cls: 'hd-list' });
    if (!data.inbox.length) {
      list.createDiv({ cls: 'hd-empty-ok', text: 'Inbox zero ✓' });
      return;
    }
    for (const n of data.inbox) {
      const item = list.createDiv({ cls: 'hd-item' });
      item.createSpan({ cls: 'hd-when', text: n.tag ? `#${n.tag}` : '#' });
      const open = item.createSpan({ cls: 'hd-open', text: n.title });
      open.addEventListener('click', () => this.openPath(n.path));
    }
  }

  renderFooter() {
    this.root.createDiv({
      cls: 'hd-foot',
      text: '✦ Agentic dashboard · quick capture, tasks & calendar',
    });
  }

  /* ---------- small utilities ---------- */

  resourcePath(vaultPath) {
    return this.app.vault.adapter.getResourcePath(vaultPath);
  }

  tickClock() {
    if (!this.root || !this.root.isConnected) return;
    const clockEl = this.root.querySelector('#hdClock');
    if (clockEl) {
      const n = new Date();
      clockEl.textContent = `${pad2(n.getHours())}:${pad2(n.getMinutes())}:${pad2(n.getSeconds())}`;
    }
    const dateEl = this.root.querySelector('#hdDate');
    if (dateEl) this.writeDateLine(dateEl, ymd(new Date()));
  }

  async openPath(vaultPath) {
    const f = this.app.vault.getAbstractFileByPath(vaultPath);
    if (f instanceof TFile) {
      await this.app.workspace.getLeaf('tab').openFile(f);
    }
  }

  async openDaily(dateStr) {
    const target = dateStr || ymd(new Date());
    await this.plugin.openOrCreateDaily(target);
  }
}

/* ════════════════════════════════════════════════════════════════
   ✦ At-a-glance reveal modal
   ════════════════════════════════════════════════════════════════ */

const HD_MODAL_LIST_CAP = 100;

class HdListModal extends Modal {
  constructor(app, title, rows) {
    super(app);
    this.modalTitle = title;
    this.rows = rows || [];
  }

  onOpen() {
    this.titleEl.setText(this.modalTitle);
    this.modalEl.addClass('hd-modal');
    const list = this.contentEl.createDiv({ cls: 'hd-list hd-modal-list' });
    if (!this.rows.length) {
      list.createDiv({ cls: 'hd-empty-ok', text: 'Nothing here ✓' });
      return;
    }
    let shown = 0;
    for (const r of this.rows) {
      if (shown >= HD_MODAL_LIST_CAP) {
        list.createDiv({ cls: 'hd-empty', text: `+ ${this.rows.length - shown} more` });
        break;
      }
      shown++;
      const item = list.createDiv({ cls: 'hd-item' });
      item.createSpan({ cls: 'hd-when', text: r.when || '' });
      const open = item.createSpan({ cls: 'hd-open', text: r.title });
      open.addEventListener('click', () => {
        this.close();
        this.openRow(r);
      });
    }
  }

  async openRow(r) {
    const f = this.app.vault.getAbstractFileByPath(r.path);
    if (f instanceof TFile) {
      await this.app.workspace.getLeaf('tab').openFile(f);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ════════════════════════════════════════════════════════════════
   ✦ New meeting form modal
   ════════════════════════════════════════════════════════════════ */

class HdMeetingModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.titleEl.setText('New meeting');
    this.modalEl.addClass('hd-modal');
    const form = this.contentEl.createDiv({ cls: 'hd-form' });

    const nameRow = form.createDiv({ cls: 'hd-form-row' });
    nameRow.createEl('label', { text: 'Meeting name' });
    const name = nameRow.createEl('input', {
      cls: 'hd-input',
      attr: { type: 'text', placeholder: 'Design review' },
    });

    const dtRow = form.createDiv({ cls: 'hd-form-row hd-form-inline' });
    const dwrap = dtRow.createDiv();
    dwrap.createEl('label', { text: 'Date' });
    const date = dwrap.createEl('input', {
      cls: 'hd-input',
      attr: { type: 'date', value: ymd(new Date()) },
    });
    const twrap = dtRow.createDiv();
    twrap.createEl('label', { text: 'Time' });
    const now = new Date();
    const time = twrap.createEl('input', {
      cls: 'hd-input',
      attr: { type: 'time', value: `${pad2(now.getHours())}:${pad2(now.getMinutes())}` },
    });

    const area = (label, placeholder, rows) => {
      const row = form.createDiv({ cls: 'hd-form-row' });
      row.createEl('label', { text: label });
      return row.createEl('textarea', {
        cls: 'hd-input hd-textarea',
        attr: { rows, placeholder },
      });
    };
    const agenda = area('Agenda', 'One point per line…', 3);
    const notes = area('Notes', 'Live notes during the meeting…', 3);
    const decisions = area('Decisions', 'What was decided…', 2);
    const actions = area('Action items', 'One task per line — saved as checkboxes…', 2);

    const btnRow = form.createDiv({ cls: 'hd-form-btns' });
    const cancel = btnRow.createEl('button', { text: 'Cancel' });
    const create = btnRow.createEl('button', { cls: 'mod-cta', text: 'Create meeting' });

    cancel.addEventListener('click', () => this.close());
    create.addEventListener('click', async () => {
      const title = name.value.trim();
      if (!title) { name.focus(); return; }
      try {
        await this.plugin.createMeeting(title, time.value, {
          date: date.value,
          agenda: agenda.value,
          notes: notes.value,
          decisions: decisions.value,
          actions: actions.value,
        });
        new Notice('Meeting created ✓');
        this.close();
        this.plugin.refreshViews(400);
      } catch (e) {
        console.error('[agentic-dashboard] meeting creation failed', e);
        new Notice('Agentic dashboard: could not create meeting');
      }
    });
    name.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') { evt.preventDefault(); create.click(); }
    });
    name.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ════════════════════════════════════════════════════════════════
   ✦ Rich task form modal
   ════════════════════════════════════════════════════════════════ */

class HdTaskModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.titleEl.setText('New task');
    this.modalEl.addClass('hd-modal');
    const form = this.contentEl.createDiv({ cls: 'hd-form' });

    const nameRow = form.createDiv({ cls: 'hd-form-row' });
    nameRow.createEl('label', { text: 'Task' });
    const name = nameRow.createEl('input', {
      cls: 'hd-input',
      attr: { type: 'text', placeholder: 'Dentist appointment' },
    });

    const dtRow = form.createDiv({ cls: 'hd-form-row hd-form-inline' });
    const dwrap = dtRow.createDiv();
    dwrap.createEl('label', { text: 'Date' });
    const date = dwrap.createEl('input', {
      cls: 'hd-input',
      attr: { type: 'date', value: ymd(new Date()) },
    });
    const pwrap = dtRow.createDiv();
    pwrap.createEl('label', { text: 'Priority' });
    const priority = pwrap.createEl('select', { cls: 'hd-input' });
    for (const [val, label] of [['', 'None'], ['high', 'High ⏫'], ['medium', 'Medium 🔼'], ['low', 'Low 🔽']]) {
      priority.createEl('option', { value: val, text: label });
    }

    const recRow = form.createDiv({ cls: 'hd-form-row' });
    recRow.createEl('label', { text: 'Repeat (optional)' });
    const recurrence = recRow.createEl('input', {
      cls: 'hd-input',
      attr: { type: 'text', placeholder: 'e.g. every week, every 3 days, every weekday' },
    });

    const btnRow = form.createDiv({ cls: 'hd-form-btns' });
    const cancel = btnRow.createEl('button', { text: 'Cancel' });
    const create = btnRow.createEl('button', { cls: 'mod-cta', text: 'Create task' });

    cancel.addEventListener('click', () => this.close());
    create.addEventListener('click', async () => {
      const text = name.value.trim();
      if (!text) { name.focus(); return; }
      try {
        await this.plugin.addTaskToDaily(text, date.value, {
          priority: priority.value,
          recurrence: recurrence.value,
        });
        new Notice('Task created ✓');
        this.close();
        this.plugin.refreshViews(400);
      } catch (e) {
        console.error('[agentic-dashboard] task creation failed', e);
        new Notice('Agentic dashboard: could not create task');
      }
    });
    name.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') { evt.preventDefault(); create.click(); }
    });
    name.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ════════════════════════════════════════════════════════════════
   ✦ Rich capture form modal (reflection / to-watch / book)
   ════════════════════════════════════════════════════════════════ */

class HdCaptureModal extends Modal {
  constructor(app, plugin, slug) {
    super(app);
    this.plugin = plugin;
    this.slug = slug;
  }

  onOpen() {
    const type = CAPTURE_TYPES.find((x) => x.slug === this.slug) || { label: 'Capture' };
    this.titleEl.setText(`New ${type.label.replace(/\s\S+$/, '').toLowerCase()}`);
    this.modalEl.addClass('hd-modal');
    const form = this.contentEl.createDiv({ cls: 'hd-form' });

    const titleRow = form.createDiv({ cls: 'hd-form-row' });
    titleRow.createEl('label', { text: 'Title' });
    const title = titleRow.createEl('input', {
      cls: 'hd-input',
      attr: { type: 'text', placeholder: type.label },
    });

    const fields = RICH_CAPTURE_FIELDS[this.slug] || [];
    const controls = {};
    for (const f of fields) {
      const row = form.createDiv({ cls: 'hd-form-row' });
      row.createEl('label', { text: f.label });
      if (f.kind === 'select') {
        const sel = row.createEl('select', { cls: 'hd-input dropdown' });
        for (const opt of f.options) sel.createEl('option', { value: opt, text: opt });
        controls[f.key] = sel;
      } else if ((f.rows || 0) <= 1) {
        controls[f.key] = row.createEl('input', {
          cls: 'hd-input',
          attr: { type: 'text', placeholder: f.placeholder || '' },
        });
      } else {
        controls[f.key] = row.createEl('textarea', {
          cls: 'hd-input hd-textarea',
          attr: { rows: f.rows, placeholder: f.placeholder || '' },
        });
      }
    }

    const btnRow = form.createDiv({ cls: 'hd-form-btns' });
    const cancel = btnRow.createEl('button', { text: 'Cancel' });
    const create = btnRow.createEl('button', { cls: 'mod-cta', text: 'Save to inbox' });

    cancel.addEventListener('click', () => this.close());
    create.addEventListener('click', async () => {
      const value = title.value.trim();
      if (!value) { title.focus(); return; }
      try {
        const values = {};
        for (const f of fields) {
          const el = controls[f.key];
          values[f.key] = el ? String(el.value || '').trim() : '';
        }
        await this.plugin.captureToInbox(this.slug, value, values);
        new Notice('Saved to inbox ✓');
        this.close();
        this.plugin.refreshViews(400);
      } catch (e) {
        console.error('[agentic-dashboard] capture failed', e);
        new Notice('Agentic dashboard: could not save (see console)');
      }
    });
    title.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') { evt.preventDefault(); create.click(); }
    });
    title.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ════════════════════════════════════════════════════════════════
   ✦ Settings tab
   ════════════════════════════════════════════════════════════════ */

class HermesDashboardSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions() {
    const D = DEFAULT_SETTINGS;
    return [
      {
        name: 'Open dashboard at startup',
        desc: 'Automatically open the dashboard when the app starts.',
        control: { type: 'toggle', key: 'openOnStartup', defaultValue: D.openOnStartup },
      },
      {
        name: 'Link notes together',
        desc: 'Connect daily notes, meetings and captures with links (follows your Files and links format preference). Linking a capture or meeting also creates that daily note if missing.',
        control: { type: 'toggle', key: 'linkNotes', defaultValue: D.linkNotes },
      },
      {
        type: 'group',
        heading: 'Folders',
        items: [
          { name: 'Journal folder', desc: 'Folder holding YYYY-MM-DD daily notes.', control: { type: 'folder', key: 'journalFolder', defaultValue: D.journalFolder } },
          { name: 'Inbox folder', desc: 'Folder where quick captures are stored.', control: { type: 'folder', key: 'inboxFolder', defaultValue: D.inboxFolder } },
          { name: 'Meetings folder', desc: 'Folder where new meetings are created.', control: { type: 'folder', key: 'meetingsFolder', defaultValue: D.meetingsFolder } },
          { name: 'Dashboard note', desc: 'Name of your dashboard note — new daily notes link to it. Leave empty for no link.', control: { type: 'text', key: 'dashboardNote', defaultValue: D.dashboardNote } },
        ],
      },
      {
        type: 'group',
        heading: 'Media',
        items: [
          { name: 'Hero video path', desc: 'Vault-relative video for the hero banner (leave empty for gradient).', control: { type: 'file', key: 'videoPath', defaultValue: D.videoPath } },
          { name: 'Poster image (desktop)', desc: 'Vault-relative fallback image shown when there is no video.', control: { type: 'file', key: 'posterPath', defaultValue: D.posterPath } },
          { name: 'Poster image (mobile)', desc: 'Vault-relative fallback image for phones.', control: { type: 'file', key: 'posterPhonePath', defaultValue: D.posterPhonePath } },
        ],
      },
      {
        name: 'Max tasks shown',
        desc: 'Cap for the tasks today card.',
        control: { type: 'number', key: 'tasksCap', defaultValue: D.tasksCap, min: 1, max: 100 },
      },
      {
        name: 'Auto refresh (seconds)',
        desc: 'How often dashboard data refreshes (0 disables).',
        control: { type: 'number', key: 'refreshSeconds', defaultValue: D.refreshSeconds, min: 0, max: 3600 },
      },
      {
        name: 'Show weather',
        desc: 'Show live temperature beside the clock in the hero (Open-Meteo, no API key).',
        control: { type: 'toggle', key: 'weatherEnabled', defaultValue: D.weatherEnabled },
      },
      {
        name: 'Weather city',
        desc: 'City name to fetch weather for (e.g. Dhaka).',
        control: { type: 'text', key: 'weatherCity', defaultValue: D.weatherCity },
      },
      {
        name: 'Weather units',
        desc: 'Temperature unit for the weather chip.',
        control: { type: 'dropdown', key: 'weatherUnits', defaultValue: D.weatherUnits, options: [
          { value: 'metric', label: 'Celsius (°C)' },
          { value: 'imperial', label: 'Fahrenheit (°F)' },
        ]},
      },
    ];
  }

  getControlValue(key) {
    return this.plugin.settings[key];
  }

  async setControlValue(key, value) {
    if (key === 'tasksCap' || key === 'refreshSeconds') {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 0) return;
      this.plugin.settings[key] = n;
    } else if (typeof value === 'string') {
      this.plugin.settings[key] = value.trim();
    } else {
      this.plugin.settings[key] = value;
    }
    await this.plugin.saveSettings();
    if (key === 'weatherEnabled' || key === 'weatherCity' || key === 'weatherUnits') {
      this.plugin.weather.data = null;
      this.plugin.refreshViews(400);
    }
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Open dashboard at startup')
      .setDesc('Automatically open the dashboard when Obsidian starts.')
      .addToggle((t) => t.setValue(this.plugin.settings.openOnStartup)
        .onChange(async (v) => { this.plugin.settings.openOnStartup = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Journal folder')
      .setDesc('Folder holding YYYY-MM-DD daily notes.')
      .addText((t) => t.setValue(this.plugin.settings.journalFolder)
        .onChange(async (v) => { this.plugin.settings.journalFolder = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Inbox folder')
      .setDesc('Folder where quick captures are stored.')
      .addText((t) => t.setValue(this.plugin.settings.inboxFolder)
        .onChange(async (v) => { this.plugin.settings.inboxFolder = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Meetings folder')
      .setDesc('Folder where new meetings are created.')
      .addText((t) => t.setValue(this.plugin.settings.meetingsFolder)
        .onChange(async (v) => { this.plugin.settings.meetingsFolder = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Dashboard note')
      .setDesc('Name of your dashboard note — new daily notes link to it. Leave empty for no link.')
      .addText((t) => t.setValue(this.plugin.settings.dashboardNote)
        .onChange(async (v) => { this.plugin.settings.dashboardNote = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Hero video path')
      .setDesc('Vault-relative video for the hero banner (leave empty for gradient).')
      .addText((t) => t.setValue(this.plugin.settings.videoPath)
        .onChange(async (v) => { this.plugin.settings.videoPath = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Poster image (desktop)')
      .setDesc('Vault-relative fallback image shown when there is no video.')
      .addText((t) => t.setValue(this.plugin.settings.posterPath)
        .onChange(async (v) => { this.plugin.settings.posterPath = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Poster image (mobile)')
      .setDesc('Vault-relative fallback image for phones.')
      .addText((t) => t.setValue(this.plugin.settings.posterPhonePath)
        .onChange(async (v) => { this.plugin.settings.posterPhonePath = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Max tasks shown')
      .setDesc('Cap for the tasks today card.')
      .addText((t) => t.setValue(String(this.plugin.settings.tasksCap))
        .onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n > 0) { this.plugin.settings.tasksCap = n; await this.plugin.saveSettings(); }
        }));

    new Setting(containerEl)
      .setName('Auto refresh (seconds)')
      .setDesc('How often dashboard data refreshes (0 disables).')
      .addText((t) => t.setValue(String(this.plugin.settings.refreshSeconds))
        .onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0) { this.plugin.settings.refreshSeconds = n; await this.plugin.saveSettings(); }
        }));

    new Setting(containerEl)
      .setName('Show weather')
      .setDesc('Show live temperature beside the clock in the hero (Open-Meteo, no API key).')
      .addToggle((t) => t.setValue(this.plugin.settings.weatherEnabled)
        .onChange(async (v) => {
          this.plugin.settings.weatherEnabled = v;
          this.plugin.weather.data = null;
          await this.plugin.saveSettings();
          this.plugin.refreshViews(400);
        }));

    new Setting(containerEl)
      .setName('Weather city')
      .setDesc('City name to fetch weather for (e.g. Dhaka).')
      .addText((t) => t.setValue(this.plugin.settings.weatherCity)
        .onChange(async (v) => {
          this.plugin.settings.weatherCity = v.trim();
          this.plugin.weather.data = null;
          await this.plugin.saveSettings();
          this.plugin.refreshViews(400);
        }));

    new Setting(containerEl)
      .setName('Weather units')
      .setDesc('Temperature unit for the weather chip.')
      .addDropdown((d) => d
        .addOption('metric', 'Celsius (°C)')
        .addOption('imperial', 'Fahrenheit (°F)')
        .setValue(this.plugin.settings.weatherUnits)
        .onChange(async (v) => {
          this.plugin.settings.weatherUnits = v;
          this.plugin.weather.data = null;
          await this.plugin.saveSettings();
          this.plugin.refreshViews(400);
        }));
  }
}

/* ════════════════════════════════════════════════════════════════
   ✦ Plugin
   ════════════════════════════════════════════════════════════════ */

class HermesDashboardPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.weather = { geo: null, data: null, lastFetch: 0, fetching: false };

    this.registerView(VIEW_TYPE_HERMES_DASHBOARD, (leaf) => new HermesDashboardView(leaf, this));

    this.addRibbonIcon('sparkles', 'Open dashboard', () => this.activateView());
    this.addCommand({
      id: 'open-dashboard',
      name: 'Open dashboard',
      callback: () => this.activateView(),
    });

    this.addSettingTab(new HermesDashboardSettingTab(this.app, this));

    // agent / automation entry point: obsidian://agentic-dashboard?...
    this.registerObsidianProtocolHandler(
      'agentic-dashboard',
      (params) => this.handleAgentAction(params),
    );

    // official Obsidian CLI commands (Obsidian 1.12.2+): obsidian agentic-dashboard[:action] ...
    if (typeof this.registerCliHandler === 'function') {
      this.registerAgentCliCommands();
    }

    // open the dashboard on startup (native replacement for the Homepage plugin)
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.openOnStartup) this.activateView();
    });

    // live refresh on vault changes (debounced)
    let timer = null;
    const queueRefresh = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { timer = null; this.refreshViews(); }, 800);
    };
    this.registerEvent(this.app.vault.on('create', queueRefresh));
    this.registerEvent(this.app.vault.on('delete', queueRefresh));
    this.registerEvent(this.app.vault.on('modify', queueRefresh));
    this.registerEvent(this.app.vault.on('rename', queueRefresh));
    this.registerEvent(this.app.metadataCache.on('resolved', queueRefresh));

    if (this.settings.refreshSeconds > 0) {
      this.registerInterval(window.setInterval(
        () => this.refreshViews(),
        this.settings.refreshSeconds * 1000,
      ));
    }
  }

  onunload() {
    // views are detached by Obsidian; nothing else to release
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /* ---------- weather (Open-Meteo, no API key) ---------- */

  async resolveCity(city) {
    const q = String(city || '').trim();
    if (this.weather.geo && this.weather.geo.q === q) return this.weather.geo;
    const res = await requestUrl({
      url: `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`,
      headers: { accept: 'application/json' },
    });
    const g = res.json && res.json.results && res.json.results[0];
    if (!g) return null;
    this.weather.geo = { q, lat: g.latitude, lon: g.longitude, name: g.name };
    return this.weather.geo;
  }

  async fetchWeather() {
    const s = this.settings;
    if (!s.weatherEnabled || !String(s.weatherCity || '').trim()) return null;
    if (this.weather.fetching) return this.weather.data;
    const now = Date.now();
    const rs = Number(s.refreshSeconds);
    const interval = rs > 0 ? rs * 1000 : 0;
    if (interval > 0 && this.weather.data && this.weather.data.q === String(s.weatherCity).trim() && now - this.weather.lastFetch < interval) return this.weather.data;
    this.weather.fetching = true;
    try {
      const geo = await this.resolveCity(s.weatherCity.trim());
      if (!geo) {
        this.weather.lastFetch = now;
        this.weather.data = null;
        return null;
      }
      const unit = s.weatherUnits === 'imperial' ? 'fahrenheit' : 'celsius';
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,weather_code,is_day&temperature_unit=${unit}&timezone=auto`;
      const res = await requestUrl({ url, headers: { accept: 'application/json' } });
      const cur = res.json && res.json.current;
      if (!cur || typeof cur.temperature_2m !== 'number') {
        this.weather.lastFetch = now;
        return this.weather.data;
      }
      const w = WEATHER_CODES[cur.weather_code] || { icon: 'not-available', label: '' };
      const isNight = Number(cur.is_day) === 0;
      this.weather.data = {
        temp: Math.round(cur.temperature_2m),
        unit: s.weatherUnits === 'imperial' ? '°F' : '°C',
        q: String(s.weatherCity).trim(),
        city: geo.name,
        icon: isNight && w.night ? w.night : w.icon,
        label: w.label,
        stale: false,
      };
      this.weather.lastFetch = now;
      return this.weather.data;
    } catch (e) {
      console.error('[agentic-dashboard] weather fetch failed', e);
      if (this.weather.data) {
        this.weather.data = { ...this.weather.data, stale: true };
        return this.weather.data;
      }
      return { offline: true, nodata: true, city: String(s.weatherCity).trim() };
    } finally {
      this.weather.fetching = false;
    }
  }

  async activateView() {
    const { workspace } = this.app;
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_HERMES_DASHBOARD);
    const leaf = workspace.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_TYPE_HERMES_DASHBOARD, active: true });
    workspace.revealLeaf(leaf);
  }

  refreshViews(delay) {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_HERMES_DASHBOARD)) {
      const view = leaf.view;
      if (view instanceof HermesDashboardView) {
        window.setTimeout(() => { if (view && view.root && view.root.isConnected) view.renderAll(); }, delay || 0);
      }
    }
  }

  requestRefresh(delay) {
    this.refreshViews(delay);
  }

  /* ---------- agent & automation actions (obsidian:// protocol) ---------- */

  normalizeDate(v) {
    const s = String(v || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ymd(new Date());
  }

  normalizeTime(v, now) {
    const t = String(v || '').trim();
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      const [h, m] = t.split(':');
      return `${pad2(Number(h))}${m}`;
    }
    if (/^\d{4}$/.test(t)) return t;
    return `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  }

  agentHelp(action, usage) {
    new Notice(`Agentic dashboard · "${action}" needs: ${usage}`);
  }

  registerAgentCliCommands() {
    const flag = (description, value, required) => ({ description, value, required });
    const reg = (command, description, flags, run) => {
      try {
        this.registerCliHandler(command, description, flags, (data) => {
          const flagsIn = (data && data.flags) || data || {};
          return Promise.resolve(run(flagsIn, data)).catch((err) => {
            console.error('[agentic-dashboard] cli failed:', command, err);
            return `error: ${err.message}`;
          });
        });
      } catch (err) {
        console.warn('[agentic-dashboard] cli registration unavailable:', command, err.message);
      }
    };

    reg('agentic-dashboard', 'Open the Agentic dashboard', null, async () => {
      await this.activateView();
      return 'Agentic dashboard opened';
    });

    reg('agentic-dashboard:add-task', "Append a task to a daily note ('today' by default)", {
      text: flag('Task text', '<text>', true),
      date: flag('Target date (YYYY-MM-DD, default today)', '<date>'),
      priority: flag('high | medium | low', '<priority>'),
      recurrence: flag("Recurrence rule, e.g. 'every week'", '<rule>'),
    }, async (f) => {
      const text = String(f.text || '').trim();
      if (!text) return 'error: text=<task text> is required';
      const dateStr = this.normalizeDate(f.date);
      await this.addTaskToDaily(text, dateStr, {
        priority: String(f.priority || '').trim().toLowerCase(),
        recurrence: String(f.recurrence || '').trim(),
      });
      this.refreshViews(400);
      return `Task added to ${dateStr}: ${text}`;
    });

    reg('agentic-dashboard:capture', 'Create a quick note in the Inbox folder', {
      text: flag('Note text (used as title + body)', '<text>', true),
      type: flag('thought | idea | reflection | to-watch | book | article', '<type>'),
      context: flag('Reflection: context (\\n separated)', '<text>'),
      takeaway: flag('Reflection: takeaway (\\n separated)', '<text>'),
      source: flag('To watch: link or platform', '<text>'),
      author: flag('Book: author', '<text>'),
      status: flag('Book: want-to-read | reading | finished', '<text>'),
      body: flag('Notes body (\\n separated)', '<text>'),
    }, async (f) => {
      const text = String(f.text || '').trim();
      if (!text) return 'error: text=<note text> is required';
      const type = String(f.type || 'thought').trim() || 'thought';
      await this.captureToInbox(type, text, f);
      this.refreshViews(400);
      return `Saved to Inbox (${type}): ${text}`;
    });

    reg('agentic-dashboard:meeting', 'Create a meeting note', {
      title: flag('Meeting title', '<title>', true),
      date: flag('Meeting date (YYYY-MM-DD, default today)', '<date>'),
      time: flag('Start time (HH:mm or HHmm)', '<time>'),
      agenda: flag('Agenda points, one per line (\\n separated)', '<text>'),
      notes: flag('Notes, one bullet per line (\\n separated)', '<text>'),
      decisions: flag('Decisions, one bullet per line (\\n separated)', '<text>'),
      actions: flag('Action items, one task per line (\\n separated)', '<text>'),
    }, async (f) => {
      const title = String(f.title || '').trim();
      if (!title) return 'error: title=<meeting title> is required';
      await this.createMeeting(title, f.time, {
        date: f.date,
        agenda: f.agenda,
        notes: f.notes,
        decisions: f.decisions,
        actions: f.actions,
      });
      this.refreshViews(400);
      return `Meeting created: ${title}`;
    });

    reg('agentic-dashboard:new-daily', 'Create (if missing) and open a daily note', {
      date: flag('Target date (YYYY-MM-DD, default today)', '<date>'),
    }, async (f) => {
      const dateStr = this.normalizeDate(f.date);
      await this.openOrCreateDaily(dateStr);
      return `Daily note ready: ${dateStr}`;
    });

    reg('agentic-dashboard:open-note', 'Open a note by exact vault path', {
      path: flag('Vault path, e.g. folder/note.md', '<path>', true),
    }, async (f) => {
      const p = String(f.path || '').trim();
      if (!p) return 'error: path=<vault path> is required';
      const file = this.app.vault.getAbstractFileByPath(p);
      if (file instanceof TFile && file.extension === 'md') {
        await this.app.workspace.getLeaf('tab').openFile(file);
        return `Opened ${file.path}`;
      }
      return this.findAndOpenNote(p) || '';
    });

    reg('agentic-dashboard:find-note', 'Find a note by name and open the best match', {
      query: flag('Search text matched against note names', '<query>', true),
    }, async (f) => {
      const q = String(f.query || '').trim();
      if (!q) return 'error: query=<search text> is required';
      this.findAndOpenNote(q);
      return `Searched for: ${q}`;
    });

    reg('agentic-dashboard:toggle-task', 'Toggle a task line in any note', {
      text: flag('Text contained in the task', '<text>'),
      line: flag('Exact task line', '<line>'),
      path: flag('Vault path of the note', '<path>'),
      date: flag('Daily note date (YYYY-MM-DD)', '<date>'),
      index: flag('0-based match index when several tasks match', '<n>'),
    }, async (f) => {
      if (!String(f.text || '').trim() && !String(f.line || '').trim()) {
        return 'error: text=<task text> or line=<exact task line> is required';
      }
      const hit = await this.toggleTaskTarget(f);
      this.refreshViews(300);
      return `Task toggled (${hit.file.path}:${hit.index + 1}): ${cleanTaskText(hit.line)}`;
    });

    reg('agentic-dashboard:update-task', 'Change a task: text, status, dates, priority or repeat', {
      text: flag('Text contained in the task', '<text>'),
      line: flag('Exact task line', '<line>'),
      path: flag('Vault path of the note', '<path>'),
      date: flag('Daily note date (YYYY-MM-DD)', '<date>'),
      index: flag('0-based match index when several tasks match', '<n>'),
      'new-text': flag('Replacement task text', '<text>'),
      status: flag('open | done | cancelled', '<status>'),
      due: flag('Due date (YYYY-MM-DD, or none to clear)', '<date>'),
      scheduled: flag('Scheduled date (YYYY-MM-DD, or none)', '<date>'),
      start: flag('Start date (YYYY-MM-DD, or none)', '<date>'),
      priority: flag('high | medium | low | none', '<priority>'),
      recurrence: flag("Recurrence rule (or none to clear)", '<rule>'),
      append: flag('Text to append to the task body', '<text>'),
    }, async (f) => {
      if (!String(f.text || '').trim() && !String(f.line || '').trim() && !f.path && !f.date) {
        return 'error: pass text=<task text> plus the change (new-text=, status=, due=, priority=…)';
      }
      const hit = await this.updateTaskTarget(f);
      this.refreshViews(300);
      return `Task updated (${hit.file.path}:${hit.index + 1}): ${cleanTaskText(hit.line)}`;
    });

    reg('agentic-dashboard:update-meeting', 'Edit a meeting note: title, date, time, agenda, notes, decisions, actions', {
      query: flag('Meeting name or text to match', '<query>'),
      path: flag('Vault path of the meeting note', '<path>'),
      'new-title': flag('New meeting title', '<title>'),
      date: flag('New date (YYYY-MM-DD)', '<date>'),
      time: flag('New start time (HH:mm or HHmm)', '<time>'),
      agenda: flag('Agenda points, one per line (\\n separated)', '<text>'),
      notes: flag('Notes, one bullet per line (\\n separated)', '<text>'),
      decisions: flag('Decisions, one bullet per line (\\n separated)', '<text>'),
      actions: flag('Action items, one task per line (\\n separated)', '<text>'),
      mode: flag('append (default) or replace section content', '<mode>'),
    }, async (f) => {
      if (!f.query && !f.path) return 'error: query=<meeting> or path=<vault path> is required';
      const file = await this.updateMeeting(f);
      this.refreshViews(300);
      return `Meeting updated: ${file.path}`;
    });

    const captureFlags = () => ({
      query: flag('Capture text to match', '<query>'),
      path: flag('Vault path of the capture note', '<path>'),
      text: flag('New main line (also renames the note)', '<text>'),
      date: flag('New date (YYYY-MM-DD)', '<date>'),
      time: flag('New time (HH:mm or HHmmss)', '<time>'),
      source: flag('To watch: link or platform (none to clear)', '<text>'),
      author: flag('Book: author (none to clear)', '<text>'),
      status: flag('Book: want-to-read | reading | finished (none to clear)', '<text>'),
      context: flag('Reflection: context lines (\\n separated)', '<text>'),
      takeaway: flag('Reflection: takeaway lines (\\n separated)', '<text>'),
      body: flag('Notes lines (\\n separated)', '<text>'),
      mode: flag('append (default) or replace section content', '<mode>'),
    });
    for (const t of CAPTURE_TYPES) {
      reg(`agentic-dashboard:update-${t.slug}`, `Edit ${t.label} capture in the Inbox`, captureFlags(), async (f) => {
        if (!f.query && !f.path) return `error: query=<${t.slug}> or path=<vault path> is required`;
        const file = await this.updateCapture(f, t.slug);
        this.refreshViews(300);
        return `Updated ${t.slug}: ${file.path}`;
      });
    }
  }

  /** Agents phrase actions differently (create-meeting, new_meeting, schedule meeting…). */
  canonicalAction(raw) {
    const key = String(raw || '')
      .toLowerCase()
      .trim()
      .replace(/^obsidian[:\/]*/, '')
      .replace(/[_\s]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    const aliases = {
      'create-meeting': 'meeting',
      'new-meeting': 'meeting',
      'add-meeting': 'meeting',
      'make-meeting': 'meeting',
      'schedule-meeting': 'meeting',
      'meeting-note': 'meeting',
      'meetings': 'meeting',
      'create-task': 'add-task',
      'new-task': 'add-task',
      'add-todo': 'add-task',
      'addtask': 'add-task',
      'task': 'add-task',
      'todo': 'add-task',
      'toggle-task': 'toggle-task',
      'complete-task': 'toggle-task',
      'done-task': 'toggle-task',
      'check-task': 'toggle-task',
      'uncheck-task': 'toggle-task',
      'toggle': 'toggle-task',
      'update-task': 'update-task',
      'edit-task': 'update-task',
      'modify-task': 'update-task',
      'reschedule-task': 'update-task',
      'reschedule': 'update-task',
      'update-meeting': 'update-meeting',
      'edit-meeting': 'update-meeting',
      'modify-meeting': 'update-meeting',
      'meeting-update': 'update-meeting',
      'update-capture': 'update-capture',
      'edit-capture': 'update-capture',
      'update-thought': 'update-thought',
      'edit-thought': 'update-thought',
      'update-idea': 'update-idea',
      'edit-idea': 'update-idea',
      'update-reflection': 'update-reflection',
      'edit-reflection': 'update-reflection',
      'update-to-watch': 'update-to-watch',
      'edit-to-watch': 'update-to-watch',
      'update-book': 'update-book',
      'edit-book': 'update-book',
      'update-article': 'update-article',
      'edit-article': 'update-article',
      'quick-capture': 'capture',
      'capture-note': 'capture',
      'create-note': 'capture',
      'new-note': 'capture',
      'inbox': 'capture',
      'note': 'capture',
      'daily-note': 'new-daily',
      'daily': 'new-daily',
      'today': 'new-daily',
      'open': 'open-note',
      'note-open': 'open-note',
      'find': 'find-note',
      'search': 'find-note',
      'dashboard': 'open-dashboard',
      'home': 'open-dashboard',
    };
    return aliases[key] || key;
  }

  /** First non-empty value among alternative parameter names. */
  pickParam(params, names) {
    for (const n of names) {
      const v = params && params[n];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  /** Obsidian overwrites `action` with the protocol handler id, so the requested
   *  action has to come from `op` — or be inferred from the parameters supplied. */
  intendedAction(params) {
    const host = String((params && params.action) || '').toLowerCase().trim();
    const named = host && host !== 'agentic-dashboard' ? host : '';
    const alt = this.pickParam(params, ['op', 'do', 'command', 'intent', 'mode']);
    if (named) return named;
    if (alt) return alt;
    const has = (k) => params && params[k] !== undefined && params[k] !== null && String(params[k]).trim() !== '';
    const anyOf = (keys) => keys.some(has);
    if (has('new-title') || has('newtitle')) return 'update-meeting';
    if (has('path')) return 'open-note';
    if (has('query') || has('q')) return 'find-note';
    if (anyOf(['agenda', 'decisions', 'actions', 'time', 'start', 'starttime', 'at', 'title', 'subject'])) return 'meeting';
    if (has('type')) return 'capture';
    if (anyOf(['new-text', 'newtext', 'status', 'line'])) return 'update-task';
    if (anyOf(['priority', 'recurrence'])) return 'add-task';
    if (has('date') && !anyOf(['text', 'task', 'todo', 'body', 'content'])) return 'new-daily';
    if (anyOf(['text', 'task', 'todo', 'body', 'content'])) return 'add-task';
    return 'open-dashboard';
  }

  async handleAgentAction(params) {
    const rawAction = this.intendedAction(params);
    const action = this.canonicalAction(rawAction);
    const text = this.pickParam(params, ['text', 'task', 'todo', 'body', 'content']);
    const title = this.pickParam(params, ['title', 'name', 'subject']) || text;
    const callbacks = this.callbackUrls(params);
    const open = async (file) => {
      await this.app.workspace.getLeaf('tab').openFile(file);
      new Notice(`Opened ${file.basename} ✓`);
      return file;
    };
    const need = (usage) => {
      this.agentHelp(action, usage);
      throw Object.assign(new Error(`${action} needs ${usage}`), { code: 'missing_parameter', silent: true });
    };
    try {
      let result = {};
      switch (action) {
        case 'open-dashboard':
          await this.activateView();
          new Notice('Agentic dashboard opened ✓');
          result = { name: 'dashboard' };
          break;
        case 'add-task': {
          if (!text) need('text=Buy milk (&date=YYYY-MM-DD &priority=high &recurrence=every week optional)');
          const dateStr = this.normalizeDate(this.pickParam(params, ['date', 'day', 'when']));
          const file = await this.addTaskToDaily(text, dateStr, {
            priority: params.priority,
            recurrence: params.recurrence,
          });
          new Notice(`Task added to ${dateStr} ✓`);
          this.refreshViews(400);
          result = this.fileResult(file, { date: dateStr, task: sanitizeName(text) });
          break;
        }
        case 'capture': {
          if (!text) need('text=Idea about X (&type=thought|idea|reflection|to-watch|book|article)');
          const type = String(params.type || 'thought').trim() || 'thought';
          const file = await this.captureToInbox(type, text, params);
          new Notice('Saved to inbox ✓');
          this.refreshViews(400);
          result = this.fileResult(file, { type: slugify(type) });
          break;
        }
        case 'meeting': {
          if (!title) need('title=Design review (&date=YYYY-MM-DD &time=HH:mm &agenda=… optional)');
          const file = await this.createMeeting(title, this.pickParam(params, ['time', 'start', 'starttime', 'at']), {
            date: this.pickParam(params, ['date', 'day', 'when']),
            agenda: params.agenda,
            notes: params.notes,
            decisions: params.decisions,
            actions: params.actions,
          });
          new Notice('Meeting created ✓');
          this.refreshViews(400);
          result = this.fileResult(file, { title: sanitizeName(title) });
          break;
        }
        case 'new-daily': {
          const dateStr = this.normalizeDate(this.pickParam(params, ['date', 'day', 'when']));
          const file = await this.openOrCreateDaily(dateStr);
          new Notice(`Daily note ready: ${dateStr} ✓`);
          result = this.fileResult(file, { date: dateStr });
          break;
        }
        case 'open-note': {
          const p = String(params.path || '').trim();
          if (!p) need('path=Journal/2026-11-13.md');
          const f = this.app.vault.getAbstractFileByPath(p);
          if (f instanceof TFile && f.extension === 'md') {
            result = this.fileResult(await open(f));
            break;
          }
          const found = this.findAndOpenNote(p);
          if (!found) throw Object.assign(new Error(`No note matches "${p}"`), { code: 'note_not_found' });
          result = this.fileResult(found);
          break;
        }
        case 'find-note': {
          const q = String(params.query || params.q || '').trim();
          if (!q) need('query=dashboard');
          const found = this.findAndOpenNote(q);
          if (!found) throw Object.assign(new Error(`No note matches "${q}"`), { code: 'note_not_found' });
          result = this.fileResult(found);
          break;
        }
        case 'toggle-task': {
          if (!text && !params.line && !params.path && !params.date) {
            need('text=<task text> (&path=… or &date=YYYY-MM-DD optional)');
          }
          const hit = await this.toggleTaskTarget(params);
          new Notice('Task toggled ✓');
          this.refreshViews(300);
          result = this.fileResult(hit.file, { task: cleanTaskText(hit.line), line: hit.index + 1 });
          break;
        }
        case 'update-task': {
          if (!params.path && !params.date && !text && !params.line) {
            need('text=<task text> plus one of new-text=, status=, due=, priority=…');
          }
          const hit = await this.updateTaskTarget(params);
          new Notice('Task updated ✓');
          this.refreshViews(300);
          result = this.fileResult(hit.file, { task: cleanTaskText(hit.line), line: hit.index + 1 });
          break;
        }
        case 'update-meeting': {
          if (!this.pickParam(params, ['path', 'file', 'note', 'query', 'q', 'match', 'search', 'title', 'name', 'subject'])) {
            need('query=<meeting name> (&new-title=, date=, agenda=… optional)');
          }
          const file = await this.updateMeeting(params);
          new Notice('Meeting updated ✓');
          this.refreshViews(300);
          result = this.fileResult(file);
          break;
        }
        case 'update-capture':
        case 'update-thought':
        case 'update-idea':
        case 'update-reflection':
        case 'update-to-watch':
        case 'update-book':
        case 'update-article': {
          if (!this.pickParam(params, ['path', 'file', 'note', 'query', 'q', 'match', 'search', 'title', 'name', 'subject'])) {
            need('query=<capture text> (&text=, body=, status=… optional)');
          }
          const type = action === 'update-capture'
            ? this.pickParam(params, ['type', 'tag'])
            : action.replace(/^update-/, '');
          const file = await this.updateCapture(params, type);
          new Notice('Capture updated ✓');
          this.refreshViews(300);
          result = this.fileResult(file, { type: type || 'capture' });
          break;
        }
        default:
          throw Object.assign(
            new Error(`Unknown action "${rawAction}". Use: open-dashboard, add-task, toggle-task, update-task, capture, meeting, update-meeting, update-capture, update-thought, update-idea, update-reflection, update-to-watch, update-book, update-article, new-daily, open-note, find-note`),
            { code: 'unknown_action' },
          );
      }
      await this.finishCallback(callbacks.success, { action, ...result });
    } catch (err) {
      const known = err && ['unknown_action', 'note_not_found', 'missing_parameter', 'task_not_found', 'ambiguous_match', 'match_not_found', 'no_change', 'type_mismatch'].includes(err.code);
      const message = known ? err.message : `action failed: ${err && err.message ? err.message : err}`;
      if (!(err && err.silent)) {
        console.error('[agentic-dashboard] action failed:', action, err);
        new Notice(`Agentic dashboard · ${message}`);
      }
      await this.finishCallback(callbacks.error, {
        action,
        errorCode: (err && err.code) || 'action_failed',
        errorMessage: message,
      });
    }
  }

  /* ---------- x-callback-url support (Shortcuts / on-device agents) ---------- */

  /** x-success / x-error targets passed on the URI; empty when not used. */
  callbackUrls(params) {
    const read = (names) => {
      for (const n of names) {
        const v = params && params[n];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };
    return {
      success: read(['x-success', 'xsuccess', 'x_success']),
      error: read(['x-error', 'xerror', 'x_error']),
    };
  }

  buildCallbackUrl(base, fields) {
    if (!base) return '';
    const query = Object.keys(fields || {})
      .filter((k) => fields[k] !== undefined && fields[k] !== null && String(fields[k]) !== '')
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(fields[k]))}`)
      .join('&');
    if (!query) return base;
    return base.includes('?') ? `${base}&${query}` : `${base}?${query}`;
  }

  /** Open the callback URL back to the caller, appending result fields. */
  async finishCallback(base, fields) {
    const target = this.buildCallbackUrl(base, fields);
    if (!target) return;
    // let the write/notice settle before handing control back to Shortcuts or the agent
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    try {
      window.open(target);
    } catch (e) {
      console.error('[agentic-dashboard] x-callback failed:', target, e);
    }
  }

  /** name/path/file/url fields describing a created or opened note. */
  fileResult(file, extra) {
    const base = { ...(extra || {}) };
    if (file && file.path) {
      base.name = file.basename;
      base.file = file.path;
      base.path = file.path;
      base.url = this.obsidianOpenUrl(file.path);
    }
    return base;
  }

  obsidianOpenUrl(vaultPath) {
    let vault = '';
    try { vault = this.app.vault.getName(); } catch (e) { vault = ''; }
    return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(vaultPath)}`;
  }

  findAndOpenNote(query) {
    const q = query.toLowerCase().replace(/\.md$/, '');
    const files = this.app.vault.getMarkdownFiles();
    const scored = [];
    for (const f of files) {
      const base = f.basename.toLowerCase();
      let score = -1;
      if (base === q) score = 3;
      else if (base.startsWith(q)) score = 2;
      else if (base.includes(q)) score = 1;
      else if (f.path.toLowerCase().includes(q)) score = 0;
      if (score >= 0) scored.push({ f, score });
    }
    if (!scored.length) return null;
    const bestScore = Math.max(...scored.map((s) => s.score));
    const ties = scored
      .filter((s) => s.score === bestScore)
      .sort((a, b) => a.f.basename.length - b.f.basename.length || a.f.path.localeCompare(b.f.path));
    const win = ties[0].f;
    this.app.workspace.getLeaf('tab').openFile(win);
    new Notice(ties.length > 1
      ? `Opened ${win.basename} (${scored.length} matches)`
      : `Opened ${win.basename} ✓`);
    return win;
  }

  /* ---------- note helpers (daily / task / meeting / capture) ---------- */

  dailyPathFor(dateStr) {
    const folder = String(this.settings.journalFolder || '').trim().replace(/^\/+|\/+$/g, '') || 'Journal';
    return `${folder}/${dateStr}.md`;
  }

  dailyTemplateFor(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const wk = pad2(isoWeek(d));
    const name = String(this.settings.dashboardNote || '').trim();
    let head = `## Week ${wk}`;
    if (name) {
      const dest = this.app.metadataCache.getFirstLinkpathDest(name, '');
      const path = dest instanceof TFile ? dest.path : name;
      head += ` ⌂ ${this.linkFor(name, path)}`;
    }
    return [
      '---',
      'type: daily',
      `date: ${dateStr}`,
      '---',
      '',
      head,
      '',
      '### ✅ Tasks',
      '',
      '- ',
      '',
      '### 📓 Log',
      '',
      '- ',
      '',
      '### 🌙 Reflection',
      '',
      '- ',
      '',
    ].join('\n');
  }

  async openOrCreateDaily(dateStr) {
    const folder = await this.ensureVaultFolder(this.settings.journalFolder, 'Journal');
    const path = `${folder}/${dateStr}.md`;
    let f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) {
      f = await this.app.vault.create(path, this.dailyTemplateFor(dateStr));
    }
    await this.app.workspace.getLeaf('tab').openFile(f);
    return f;
  }

  async addTaskToDaily(text, dateOpt, opts) {
    const o = opts || {};
    const dateStr = this.normalizeDate(dateOpt);
    const f = await this.ensureDailyNote(dateStr);
    let prio = '';
    if (o.priority === 'high') prio = ' ⏫';
    else if (o.priority === 'medium') prio = ' 🔼';
    else if (o.priority === 'low') prio = ' 🔽';
    const rule = String(o.recurrence || '').trim().replace(/\s+/g, ' ');
    const rec = rule ? ` 🔁 ${rule}` : '';
    const existing = await this.app.vault.read(f);
    const content = existing.endsWith('\n') ? existing : existing + '\n';
    await this.app.vault.modify(f, `${content}- [ ] ${sanitizeName(text)}${prio}${rec} ➕ ${ymd(new Date())} 📅 ${dateStr}\n`);
    return f;
  }

  /** Flip one task line inside a lines array (in place).
   *  Returns { changed, index } where index points at the toggled line after
   *  mutation (a completed recurring task inserts its next occurrence above). */
  flipTaskLines(lines, idx, today) {
    const m = TASK_LINE_RE.exec(lines[idx] || '');
    if (!m) return { changed: false, index: idx };
    const indent = m[1];
    const status = m[2];
    const body = m[3];

    if (status === ' ') {
      // open -> done (+ cancelled stamps removed if re-opening happened before)
      let doneLine = `${indent}${lines[idx].replace('[ ]', '[x]')}`;
      if (!DONE_DATE_RE.test(doneLine)) doneLine += ` ✅ ${today}`;
      lines[idx] = doneLine;
      let at = idx;

      // recurring task: create the next occurrence above the completed one
      const rec = parseRecurrence(body);
      if (rec) {
        const ref = dueDateOf(body) || scheduledDateOf(body) || startDateOf(body);
        if (ref) {
          const next = computeNextRecurrence(rec, rec.whenDone ? today : ref);
          if (next) {
            const delta = Math.round((new Date(`${next}T00:00:00`) - new Date(`${ref}T00:00:00`)) / 86400000);
            let nb = body;
            if (startDateOf(nb)) nb = nb.replace(/🛫\s*\d{4}-\d{2}-\d{2}/, `🛫 ${shiftDate(startDateOf(nb), delta)}`);
            if (scheduledDateOf(nb)) nb = nb.replace(/⏳\s*\d{4}-\d{2}-\d{2}/, `⏳ ${shiftDate(scheduledDateOf(nb), delta)}`);
            nb = nb.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${next}`);
            lines.splice(idx, 0, `${indent}- [ ] ${nb}`);
            at = idx + 1;
          }
        }
      }
      return { changed: true, index: at };
    }

    // done/cancelled -> open: drop the completion/cancellation stamp
    const reopened = lines[idx]
      .replace(/\[[xX]\]/, '[ ]')
      .replace(/\[-\]/, '[ ]')
      .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '')
      .replace(/\s*❌\s*\d{4}-\d{2}-\d{2}/, '');
    if (reopened === lines[idx]) return { changed: false, index: idx };
    lines[idx] = reopened;
    return { changed: true, index: idx };
  }

  async toggleTaskLine(path, rawLine) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) return false;
    const today = ymd(new Date());
    let changed = false;
    await this.app.vault.process(f, (text) => {
      const lines = text.split('\n');
      let idx = lines.indexOf(rawLine);
      if (idx === -1) {
        const target = rawLine.trim();
        idx = lines.findIndex((l) => l.trim() === target);
      }
      if (idx === -1) return text;
      changed = this.flipTaskLines(lines, idx, today).changed;
      return changed ? lines.join('\n') : text;
    });
    if (changed) new Notice('Task updated ✓');
    return changed;
  }

  /** Resolve one task line from path/date plus a text, raw-line or index selector. */
  async findTaskTarget(params) {
    const p = params || {};
    const rawLine = this.pickParam(p, ['line', 'rawline', 'raw']);
    const needle = this.pickParam(p, ['text', 'task', 'todo', 'match', 'query', 'q']);
    const idxRaw = this.pickParam(p, ['index', 'i']);

    let files;
    const path = this.pickParam(p, ['path', 'file', 'note']);
    if (path) {
      const f = this.app.vault.getAbstractFileByPath(path);
      if (!(f instanceof TFile) || f.extension !== 'md') {
        throw Object.assign(new Error(`No note at "${path}"`), { code: 'note_not_found' });
      }
      files = [f];
    } else {
      const dateOpt = this.pickParam(p, ['date', 'day', 'when']);
      files = dateOpt
        ? [await this.ensureDailyNote(this.normalizeDate(dateOpt))]
        : this.app.vault.getMarkdownFiles();
    }

    const hits = [];
    for (const f of files) {
      let text;
      try { text = await this.app.vault.cachedRead(f); } catch (e) { continue; }
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = TASK_LINE_RE.exec(lines[i]);
        if (!m) continue;
        if (rawLine && lines[i].trim() !== rawLine.trim()) continue;
        if (needle && !m[3].toLowerCase().includes(needle.toLowerCase())) continue;
        hits.push({ file: f, index: i, line: lines[i] });
      }
    }
    if (!hits.length) {
      const where = path ? ` in ${path}` : '';
      throw Object.assign(
        new Error(`No task matches${needle ? ` "${needle}"` : ''}${where}`),
        { code: 'task_not_found' },
      );
    }
    if (hits.length > 1 && !idxRaw) {
      const sample = hits.slice(0, 5).map((h) => `${h.file.path}:${h.index + 1}`).join(', ');
      throw Object.assign(
        new Error(`Task match is ambiguous (${hits.length} hits): ${sample} — pass path=, date= or index=`),
        { code: 'ambiguous_match' },
      );
    }
    const wanted = Math.max(0, parseInt(idxRaw, 10) || 0);
    return hits[Math.min(wanted, hits.length - 1)];
  }

  /** Normalise a date-ish action parameter: null = untouched, '' = clear. */
  taskDateParam(v) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    if (!s) return null;
    if (/^(none|clear|remove|off|-)$/i.test(s)) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : ymd(d);
  }

  async toggleTaskTarget(params) {
    const hit = await this.findTaskTarget(params);
    const today = ymd(new Date());
    let changed = false;
    let newLine = hit.line;
    await this.app.vault.process(hit.file, (text) => {
      const lines = text.split('\n');
      const idx = (lines[hit.index] && lines[hit.index].trim() === hit.line.trim())
        ? hit.index
        : lines.findIndex((l) => l.trim() === hit.line.trim());
      if (idx === -1) return text;
      const res = this.flipTaskLines(lines, idx, today);
      changed = res.changed;
      newLine = lines[res.index] || newLine;
      return changed ? lines.join('\n') : text;
    });
    if (!changed) {
      throw Object.assign(new Error('Task line changed before it could be toggled — retry'), { code: 'no_change' });
    }
    return { file: hit.file, index: hit.index, line: newLine };
  }

  async updateTaskTarget(params) {
    const p = params || {};
    const hit = await this.findTaskTarget(p);
    const today = ymd(new Date());
    const has = (k) => p[k] !== undefined && p[k] !== null && String(p[k]).trim() !== '';
    const statusRaw = String(p.status || '').trim().toLowerCase();
    let changed = false;
    let newLine = hit.line;

    await this.app.vault.process(hit.file, (text) => {
      const lines = text.split('\n');
      const idx = (lines[hit.index] && lines[hit.index].trim() === hit.line.trim())
        ? hit.index
        : lines.findIndex((l) => l.trim() === hit.line.trim());
      if (idx === -1) return text;
      const m = TASK_LINE_RE.exec(lines[idx]);
      if (!m) return text;
      const parts = splitTaskBody(m[3]);
      let status = m[2];

      const newText = this.pickParam(p, ['new-text', 'newtext', 'rename']);
      if (newText) parts.text = newText.replace(/\s+/g, ' ').trim();
      if (has('append')) parts.text = `${parts.text} ${String(p.append).trim()}`.trim();

      if (has('priority')) {
        const prio = String(p.priority).trim().toLowerCase();
        parts.priority = (prio === 'high' || prio === 'medium' || prio === 'low') ? prio : null;
      }
      if (has('recurrence')) {
        const rule = String(p.recurrence).trim();
        parts.recurrence = /^(none|clear|remove|off|-)$/i.test(rule) ? '' : rule.replace(/\s+/g, ' ');
      }
      for (const key of ['due', 'scheduled', 'start', 'created']) {
        const v = this.taskDateParam(p[key]);
        if (v !== null) parts[key] = v;
      }

      if (statusRaw) {
        if (/^(done|complete|completed|x|check|checked)$/.test(statusRaw)) {
          status = 'x';
          if (!parts.done) parts.done = today;
          parts.cancelled = '';
        } else if (/^(cancel|cancelled|canceled|-)$/.test(statusRaw)) {
          status = '-';
          if (!parts.cancelled) parts.cancelled = today;
          parts.done = '';
        } else if (/^(open|todo|undone|uncheck|reopen)$/.test(statusRaw)) {
          status = ' ';
          parts.done = '';
          parts.cancelled = '';
        }
      }

      newLine = buildTaskLine(m[1], status, parts);
      if (newLine === lines[idx]) return text;
      lines[idx] = newLine;
      changed = true;
      return lines.join('\n');
    });

    if (!changed) {
      throw Object.assign(
        new Error('Nothing to update — pass new-text, status, due, scheduled, start, priority or recurrence'),
        { code: 'no_change' },
      );
    }
    return { file: hit.file, index: hit.index, line: newLine };
  }

  /** Resolve one entity note: exact path=, or the only folder match for query= (optionally tag-filtered). */
  async findEntityNote(params, folder, tag) {
    const p = params || {};
    const path = this.pickParam(p, ['path', 'file', 'note']);
    if (path) {
      const f = this.app.vault.getAbstractFileByPath(path);
      if (!(f instanceof TFile) || f.extension !== 'md') {
        throw Object.assign(new Error(`No note at "${path}"`), { code: 'note_not_found' });
      }
      return f;
    }
    const q = this.pickParam(p, ['query', 'q', 'match', 'search', 'title', 'name', 'subject']).toLowerCase();
    const wanted = slugify(tag || '');
    const files = this.app.vault.getMarkdownFiles()
      .filter((f) => !folder || f.path.startsWith(folder + '/'));
    const tagOf = (f) => {
      const c = this.app.metadataCache.getFileCache(f);
      const fm = (c && c.frontmatter) || {};
      return slugify(String(fm.tag || fm.type || ''));
    };
    const pool = wanted ? files.filter((f) => tagOf(f) === wanted) : files;
    let hits = q ? pool.filter((f) => f.basename.toLowerCase().includes(q)) : pool;
    if (!hits.length && q) {
      for (const f of pool) {
        const raw = await this.app.vault.cachedRead(f);
        if (raw.toLowerCase().includes(q)) hits.push(f);
      }
    }
    if (!hits.length) {
      throw Object.assign(
        new Error(`No ${tag || 'note'} matches${q ? ` "${q}"` : ''}`),
        { code: 'note_not_found' },
      );
    }
    if (hits.length > 1) {
      hits.sort((a, b) => b.stat.mtime - a.stat.mtime);
      throw Object.assign(
        new Error(`${hits.length} ${tag || 'notes'} match — pass path= or a longer query= (e.g. ${hits.slice(0, 3).map((f) => f.path).join(' | ')})`),
        { code: 'ambiguous_match' },
      );
    }
    return hits[0];
  }

  /** Read one YAML frontmatter value. */
  fmValue(raw, key) {
    const m = new RegExp(`^${key}\\s*:\\s*(.*)$`, 'm').exec(raw);
    return m ? m[1].trim() : '';
  }

  /** Set or insert one YAML frontmatter key (creates a block when missing). */
  setFrontmatter(raw, key, value) {
    const cr = raw.includes('\r\n') ? '\r' : '';
    const lines = raw.split('\n');
    const end = frontmatterEnd(lines);
    const line = `${key}: ${value}${cr}`;
    if (!end) return `---${cr}\n${line}\n---${cr}\n${raw}`;
    const re = new RegExp(`^${key}\\s*:`);
    for (let i = 1; i < end - 1; i++) {
      if (re.test(lines[i])) {
        lines[i] = line;
        return lines.join('\n');
      }
    }
    lines.splice(end - 1, 0, line);
    return lines.join('\n');
  }

  /** Remove one YAML frontmatter key. */
  removeFrontmatterKey(raw, key) {
    const lines = raw.split('\n');
    const end = frontmatterEnd(lines);
    if (!end) return raw;
    const re = new RegExp(`^${key}\\s*:`);
    for (let i = 1; i < end - 1; i++) {
      if (re.test(lines[i])) {
        lines.splice(i, 1);
        return lines.join('\n');
      }
    }
    return raw;
  }

  /** Append to, or replace, the body of a `## Heading` section. Returns null when the heading is missing. */
  replaceSectionBody(raw, heading, contentLines, mode) {
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const lines = raw.split(/\r?\n/);
    const levelOf = (l) => {
      const m = /^(#{1,6})\s+/.exec(l);
      return m ? m[1].length : 0;
    };
    const wanted = heading.toLowerCase();
    const start = lines.findIndex((l) => levelOf(l) && l.replace(/^#+\s*/, '').trim().toLowerCase() === wanted);
    if (start === -1) return null;
    const level = levelOf(lines[start]);
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      const lv = levelOf(lines[i]);
      if (lv && lv <= level) { end = i; break; }
    }
    let bodyEnd = end;
    while (bodyEnd > start + 1 && lines[bodyEnd - 1].trim() === '') bodyEnd--;
    const existing = lines.slice(start + 1, bodyEnd).filter((l) => l.trim() !== '');
    const next = mode === 'replace' ? contentLines : [...existing, ...contentLines];
    lines.splice(start + 1, bodyEnd - (start + 1), '', ...next, '');
    for (let i = lines.length - 1; i > 0; i--) {
      if (lines[i].trim() === '' && lines[i - 1].trim() === '') lines.splice(i, 1);
    }
    return lines.join(eol);
  }

  /** Add a `## Heading` section at the end of the body. */
  appendSection(raw, heading, contentLines) {
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    return `${raw.replace(/\s+$/, '')}${eol}${eol}## ${heading}${eol}${eol}${contentLines.join(eol)}${eol}`;
  }

  /** Rename within a folder, keeping the file's links intact. */
  async renameEntityFile(file, folder, base) {
    let path = `${folder}/${base}.md`;
    for (let n = 2; path !== file.path && this.app.vault.getAbstractFileByPath(path); n++) {
      path = `${folder}/${base} (${n}).md`;
    }
    if (path === file.path) return file;
    await this.app.fileManager.renameFile(file, path);
    return this.app.vault.getAbstractFileByPath(path) || file;
  }

  /** Edit a meeting note in its own format: date, time, title, agenda/notes/decisions/actions. */
  async updateMeeting(params) {
    const p = params || {};
    const folder = await this.ensureVaultFolder(this.settings.meetingsFolder, 'Meetings');
    const file = await this.findEntityNote(p, folder, 'meeting');
    const mode = /^(replace|overwrite|set)$/i.test(String(p.mode || '')) ? 'replace' : 'append';
    const items = (v) => String(v || '').split(/\r?\n|\\n/).map((x) => x.trim()).filter(Boolean);
    const dateStr = this.pickParam(p, ['date', 'day', 'when'])
      ? this.normalizeDate(this.pickParam(p, ['date', 'day', 'when'])) : '';
    const timeRaw = this.pickParam(p, ['time', 'start', 'starttime', 'at']);
    const timeStr = timeRaw ? this.normalizeTime(timeRaw, new Date()) : '';
    const title = sanitizeName(this.pickParam(p, ['new-title', 'newtitle', 'rename']));
    let raw = await this.app.vault.read(file);
    let changed = false;

    if (dateStr) { raw = this.setFrontmatter(raw, 'date', dateStr); changed = true; }
    if (timeStr) { raw = this.setFrontmatter(raw, 'time', timeStr); changed = true; }
    if (title) {
      raw = raw.replace(/^#\s+.*$/m, `# ${title}`);
      changed = true;
    }
    for (const [key, heading] of [['agenda', 'Agenda'], ['notes', 'Notes'], ['decisions', 'Decisions']]) {
      const v = this.pickParam(p, [key]);
      if (!v) continue;
      const out = this.replaceSectionBody(raw, heading, items(v).map((x) => `- ${x}`), mode);
      raw = out === null ? this.appendSection(raw, heading, items(v).map((x) => `- ${x}`)) : out;
      changed = true;
    }
    const act = this.pickParam(p, ['actions', 'action-items', 'actionitems', 'todo']);
    if (act) {
      const day = dateStr || this.fmValue(raw, 'date') || ymd(new Date());
      const out = this.replaceSectionBody(raw, 'Action items', items(act).map((x) => `- [ ] ${x} 📅 ${day}`), mode);
      if (out === null) {
        throw Object.assign(new Error(`Heading "## Action items" not found in ${file.path}`), { code: 'match_not_found' });
      }
      raw = out;
      changed = true;
    }
    if (!changed) {
      throw Object.assign(
        new Error('Nothing to update — pass date=, time=, agenda=, notes=, decisions=, actions= or new-title='),
        { code: 'no_change' },
      );
    }
    await this.app.vault.modify(file, raw);
    const name = title || sanitizeName(file.basename.replace(/^\d{4}-\d{2}-\d{2} \d{4} - /, '')) || 'Meeting';
    const base = `${this.fmValue(raw, 'date') || ymd(new Date())} ${this.fmValue(raw, 'time') || '0000'} - ${name}`;
    return this.renameEntityFile(file, folder, base);
  }

  /** Edit an inbox capture in its own format (thought, idea, reflection, to-watch, book, article). */
  async updateCapture(params, type) {
    const p = params || {};
    const folder = await this.ensureVaultFolder(this.settings.inboxFolder, 'Inbox');
    const file = await this.findEntityNote(p, folder, type || '');
    const mode = /^(replace|overwrite|set)$/i.test(String(p.mode || '')) ? 'replace' : 'append';
    const items = (v) => String(v || '').split(/\r?\n|\\n/).map((x) => x.trim()).filter(Boolean);
    const wantType = slugify(type || this.pickParam(p, ['type', 'tag']) || '');
    let raw = await this.app.vault.read(file);
    const currentTag = slugify(this.fmValue(raw, 'tag'));
    if (type && currentTag && currentTag !== slugify(type)) {
      throw Object.assign(
        new Error(`${file.path} is tagged "${currentTag}", not "${slugify(type)}"`),
        { code: 'type_mismatch' },
      );
    }
    let changed = false;
    const hasFooter = /^— captured from Agentic dashboard\s*$/m.test(raw);
    if (hasFooter) {
      raw = raw.replace(/^— captured from Agentic dashboard\s*$/m, '').replace(/\s+$/, '\n');
    }

    const text = this.pickParam(p, ['text', 'content', 'line']);
    if (text) {
      const eol = raw.includes('\r\n') ? '\r\n' : '\n';
      const lines = raw.split(/\r?\n/);
      const start = frontmatterEnd(lines);
      let at = -1;
      for (let i = start; i < lines.length; i++) {
        const l = lines[i].trim();
        if (!l) continue;
        if (l.startsWith('#') || l.startsWith('— captured')) break;
        at = i;
        break;
      }
      if (at === -1) {
        throw Object.assign(new Error(`No body line to update in ${file.path}`), { code: 'match_not_found' });
      }
      lines[at] = sanitizeName(text);
      raw = lines.join(eol);
      changed = true;
    }
    const dateRaw = this.pickParam(p, ['date', 'day', 'when']);
    const dateStr = dateRaw ? this.normalizeDate(dateRaw) : '';
    if (dateStr) { raw = this.setFrontmatter(raw, 'date', dateStr); changed = true; }
    const timeRaw = this.pickParam(p, ['time']);
    const timeStr = timeRaw ? (/^\d{4,6}$/.test(timeRaw) ? timeRaw : this.normalizeTime(timeRaw, new Date())) : '';
    if (timeStr) { raw = this.setFrontmatter(raw, 'time', timeStr); changed = true; }
    if (wantType && currentTag !== wantType) {
      raw = this.setFrontmatter(raw, 'tag', wantType);
      changed = true;
    }
    for (const key of ['source', 'author', 'status']) {
      const v = this.pickParam(p, [key]);
      if (!v) continue;
      raw = /^(none|clear|remove|-)$/i.test(v)
        ? this.removeFrontmatterKey(raw, key)
        : this.setFrontmatter(raw, key, v);
      changed = true;
    }
    for (const [key, heading] of [['context', 'Context'], ['takeaway', 'Takeaway'], ['body', 'Notes'], ['notes', 'Notes']]) {
      const v = this.pickParam(p, [key]);
      if (!v) continue;
      const out = this.replaceSectionBody(raw, heading, items(v), mode);
      raw = out === null ? this.appendSection(raw, heading, items(v)) : out;
      changed = true;
    }
    if (!changed) {
      throw Object.assign(
        new Error('Nothing to update — pass text=, type=, date=, time=, source=, author=, status=, context=, takeaway= or body='),
        { code: 'no_change' },
      );
    }
    if (hasFooter) raw = raw.replace(/\s+$/, '') + '\n\n— captured from Agentic dashboard\n';
    await this.app.vault.modify(file, raw);
    const bodyName = (raw.split(/\r?\n/).find((l, i, arr) => i > frontmatterEnd(arr) && l.trim() && !l.trim().startsWith('#') && !l.startsWith('— captured')) || '').trim();
    const name = sanitizeName(text || bodyName || file.basename.replace(/^\d{4}-\d{2}-\d{2} \d{6} - /, '')).slice(0, 60) || wantType || 'capture';
    const base = `${this.fmValue(raw, 'date') || ymd(new Date())} ${this.fmValue(raw, 'time') || '000000'} - ${name}`;
    return this.renameEntityFile(file, folder, base);
  }

  openMeetingModal() {
    new HdMeetingModal(this.app, this).open();
  }

  openTaskModal() {
    new HdTaskModal(this.app, this).open();
  }

  openCaptureModal(slug) {
    new HdCaptureModal(this.app, this, slug).open();
  }

  /* ---------- note linking (optional) ---------- */

  usesMarkdownLinks() {
    try { return !!this.app.vault.getConfig('useMarkdownLinks'); } catch (e) { return false; }
  }

  linkFor(title, vaultPath) {
    // Use the file basename (which includes timestamp) so Obsidian can resolve wiki links
    // This ensures links reference notes by date (basename) not by full folder path
    const basename = vaultPath.split('/').pop()?.replace(/\.md$/, '') || title;
    if (this.usesMarkdownLinks()) return `[${title}](${basename})`;
    return `[[${basename}]]`;
  }

  /** Resolve a settings folder defensively (empty/missing/badly-cased folders break writes on iOS). */
  async ensureVaultFolder(raw, fallback) {
    const path = String(raw || '').trim().replace(/^\/+|\/+$/g, '') || fallback;
    const existing = await this.findVaultFolder(path);
    if (existing) return existing;
    let acc = '';
    for (const part of path.split('/').filter(Boolean)) {
      acc = acc ? `${acc}/${part}` : part;
      const found = await this.findVaultFolder(acc);
      if (found) { acc = found; continue; }
      await this.app.vault.createFolder(acc);
    }
    return acc;
  }

  /** Exact match first, then a case-insensitive one (iOS/macOS filesystems ignore case). */
  async findVaultFolder(path) {
    const direct = this.app.vault.getAbstractFileByPath(path);
    if (direct instanceof TFolder) return direct.path;
    const want = String(path).toLowerCase();
    const all = typeof this.app.vault.getAllLoadedFiles === 'function'
      ? this.app.vault.getAllLoadedFiles()
      : [];
    const hit = all.find((f) => f instanceof TFolder && String(f.path).toLowerCase() === want);
    return hit ? hit.path : '';
  }

  async ensureDailyNote(dateStr) {
    const folder = await this.ensureVaultFolder(this.settings.journalFolder, 'Journal');
    const path = `${folder}/${dateStr}.md`;
    let f = this.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) return f;
    return this.app.vault.create(path, this.dailyTemplateFor(dateStr));
  }

  upsertSectionLine(content, heading, line) {
    const lines = content.split('\n');
    const hIdx = lines.findIndex((l) => l.trim() === heading);
    if (hIdx === -1) {
      const out = content.replace(/\s*$/, '');
      return `${out}\n\n${heading}\n\n${line}\n`;
    }
    let insertAt = hIdx + 1;
    while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;
    lines.splice(insertAt, 0, line);
    return lines.join('\n');
  }

  async linkIntoDaily(dateStr, heading, entry) {
    if (!this.settings.linkNotes) return;
    try {
      const daily = await this.ensureDailyNote(dateStr);
      await this.app.vault.process(daily, (text) => this.upsertSectionLine(text, heading, entry));
    } catch (e) {
      console.error('[agentic-dashboard] linking daily note failed', e);
    }
  }

  async createMeeting(title, timeOpt, opts) {
    const o = opts || {};
    const now = new Date();
    const dateStr = this.normalizeDate(o.date);
    const timeStr = this.normalizeTime(timeOpt, now);
    const name = sanitizeName(title) || 'Meeting';
    const folder = await this.ensureVaultFolder(this.settings.meetingsFolder, 'Meetings');
    let path = `${folder}/${dateStr} ${timeStr} - ${name}.md`;
    for (let n = 2; this.app.vault.getAbstractFileByPath(path); n++) {
      path = `${folder}/${dateStr} ${timeStr} - ${name} (${n}).md`;
    }
    const listBlock = (v) => {
      const lines = String(v || '').split(/\r?\n|\\n/).map((x) => x.trim()).filter(Boolean);
      return lines.length ? lines.map((x) => `- ${x}`).join('\n') : '- ';
    };
    const actionsBlock = () => {
      const lines = String(o.actions || '').split(/\r?\n|\\n/).map((x) => x.trim()).filter(Boolean);
      return lines.length ? lines.map((x) => `- [ ] ${x} 📅 ${dateStr}`).join('\n') : `- [ ]  📅 ${dateStr}`;
    };
    const content = [
      '---',
      'type: meeting',
      `date: ${dateStr}`,
      `time: ${timeStr}`,
      '---',
      '',
      `# ${name}`,
      '',
      ...(this.settings.linkNotes ? [`Day: ${this.linkFor(dateStr, this.dailyPathFor(dateStr))}`, ''] : []),
      '## Agenda',
      '',
      listBlock(o.agenda),
      '',
      '## Notes',
      '',
      listBlock(o.notes),
      '',
      '## Decisions',
      '',
      listBlock(o.decisions),
      '',
      '## Action items',
      '',
      actionsBlock(),
      '',
    ].join('\n');
    const file = await this.app.vault.create(path, content);
    if (this.settings.linkNotes) {
      await this.linkIntoDaily(
        dateStr,
        '## Meetings',
        `- ${timeStr.slice(0, 2)}:${timeStr.slice(2)} ${this.linkFor(name, path)}`,
      );
    }
    return file;
  }

  async captureToInbox(type, text, opts) {
    const o = opts || {};
    const now = new Date();
    const dateStr = ymd(now);
    const timeStr = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
    const name = sanitizeName(text).slice(0, 60) || type;
    const folder = await this.ensureVaultFolder(this.settings.inboxFolder, 'Inbox');
    const path = `${folder}/${dateStr} ${timeStr} - ${name}.md`;

    // rich captures: extra frontmatter + body sections
    const paras = (v) => String(v || '').split(/\r?\n|\\n/).map((x) => x.trim()).filter(Boolean);
    const extraFm = [];
    const sections = [];
    if (type === 'reflection') {
      const ctx = paras(o.context);
      if (ctx.length) sections.push('## Context', '', ctx.join('\n'), '');
      const tk = paras(o.takeaway);
      if (tk.length) sections.push('## Takeaway', '', tk.join('\n'), '');
    } else if (type === 'to-watch') {
      if (o.source) extraFm.push(`source: ${String(o.source).trim()}`);
      const b = paras(o.body);
      if (b.length) sections.push('## Notes', '', b.join('\n'), '');
    } else if (type === 'book') {
      if (o.author) extraFm.push(`author: ${String(o.author).trim()}`);
      if (o.status) extraFm.push(`status: ${String(o.status).trim()}`);
      const b = paras(o.body);
      if (b.length) sections.push('## Notes', '', b.join('\n'), '');
    }

    const content = [
      '---',
      'type: inbox',
      `tag: ${slugify(type)}`,
      `date: ${dateStr}`,
      `time: ${timeStr}`,
      ...extraFm,
      '---',
      '',
      sanitizeName(text),
      '',
      ...sections,
      '— captured from Agentic dashboard',
      '',
    ].join('\n');
    const file = await this.app.vault.create(path, content);
    if (this.settings.linkNotes) {
      await this.linkIntoDaily(
        dateStr,
        '## Captures',
        `- ${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)} ${this.linkFor(name, path)}`,
      );
    }
    return file;
  }
}

module.exports = HermesDashboardPlugin;
