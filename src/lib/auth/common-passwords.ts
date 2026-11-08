// Hand-written blocklist (SR6): passwords and phrases people really pick that still clear the 15-character minimum.
// Entries are lower case; compare with `isCommonPassword`. Anything shorter than 15 is already refused by length.

export const COMMON_PASSWORDS: readonly string[] = [
  // Words typed twice, or padded with digits
  'passwordpassword', 'password1234567', 'password12345678', 'password123456789', 'password1234567890',
  'password1password1', 'password123password123', 'passwordpassword1', 'passwordpassword123', 'password password',
  'passw0rdpassw0rd', 'p@ssw0rdp@ssw0rd', 'p@ssword12345678', 'p@$$w0rd12345678', 'pa55wordpa55word',
  'passwordqwerty123', 'password!password!', 'password123456!', 'password2024password', 'password2025password',
  'password2026password', 'password20262026', 'mypasswordmypassword', 'mypassword12345',
  'welcome12345678', 'welcomewelcome1', 'welcome2026welcome', 'welcome20262026',
  'letmeinletmein1', 'letmeinletmeinletmein', 'letmeinplease123',
  'adminadminadmin', 'admin12345678901', 'administrator123', 'administrator1234', 'adminpassword123', 'rootpassword1234',
  'changemechangeme', 'changeme12345678', 'pleasechangeme123',
  'iloveyouiloveyou', 'iloveyou12345678', 'iloveyouforever',
  'trustno1trustno1', 'trustnoonetrustnoone', 'whatever12345678', 'whateverwhatever',
  'sunshine12345678', 'sunshinesunshine', 'princess12345678', 'princessprincess', 'shadowshadow123',
  'monkeymonkeymonkey', 'monkey1234567890', 'dragondragondragon', 'dragon1234567890',
  'michael123456789', 'jessica123456789', 'jennifer12345678', 'charlie123456789', 'thomas1234567890',
  'football12345678', 'footballfootball', 'baseball12345678', 'basketball12345', 'basketballbasketball',
  'superman12345678', 'supermansuperman', 'batmanbatmanbatman', 'batman1234567890', 'spiderman12345678',
  'starwarsstarwars', 'starwars12345678', 'pokemon123456789', 'dragonballz12345',
  'harrypotter12345', 'harrypotterhermione', 'gameofthrones123', 'lordoftherings123',
  'manchesterunited', 'manchesterunited1', 'liverpool1234567', 'arsenalarsenal1', 'chelseafc1234567',
  'barcelona1234567', 'realmadrid123456',
  'summer2026summer', 'winter2026winter', 'spring2026spring', 'autumn2026autumn',

  // Digits and keyboard runs
  '123456789012345', '1234567890123456', '12345678901234567890', '098765432109876', '112233445566778',
  '123123123123123', '123451234512345', '121212121212121', '123321123321123', '147258369147258',
  '159753159753159', '987654321987654', '000000000000001',
  'qwertyuiopasdfg', 'qwertyuiopasdfgh', 'qwertyuiopasdfghjkl', 'qwertyuiopasdfghjklzxcvbnm', 'qwertyqwertyqwerty',
  'qwerty123456789', 'qwertyuiop123456', 'qwertyuiop1234567890', 'asdfghjklzxcvbnm', 'asdfghjkl123456',
  'asdfasdfasdfasdf', 'zxcvbnmasdfghjkl', 'zxcvbnm123456789', '1qaz2wsx3edc4rfv', '1q2w3e4r5t6y7u8i',
  'qazwsxedcrfvtgb', 'qazwsxedcrfvtgbyhn', 'q1w2e3r4t5y6u7i8o9p0', 'poiuytrewqlkjhgfdsa',
  'abcdefghijklmnopqrstuvwxyz', 'abcdefghijklmno', 'abcdefghijklmnop', 'abc123abc123abc', 'abcabcabcabcabc',
  'aabbccddeeffgghh', 'a1b2c3d4e5f6g7h8',

  // Famous phrases
  'correct horse battery staple', 'correcthorsebatterystaple', 'the quick brown fox', 'thequickbrownfox',
  'the quick brown fox jumps over the lazy dog', 'thequickbrownfoxjumpsoverthelazydog',
  'to be or not to be', 'tobeornottobethatisthequestion', 'mary had a little lamb', 'maryhadalittlelamb',
  'twinkle twinkle little star', 'may the force be with you', 'maytheforcebewithyou', 'hello world hello world',
  'helloworldhelloworld', 'game of thrones', 'the lord of the rings', 'never gonna give you up', 'nevergonnagiveyouup',
  'you only live once', 'youonlyliveonce', 'yolo yolo yolo yolo', 'live laugh love always', 'livelaughlove123',
  'carpe diem carpe diem', 'carpediemcarpediem', 'just do it just do it', 'justdoitjustdoit', 'hakuna matata forever',
  'hakunamatata1234', 'all you need is love', 'allyouneedislove', 'dont worry be happy', 'dontworrybehappy',
  'life is beautiful', 'lifeisbeautiful1', 'life is good today', 'lifeisgoodtoday', 'time is money my friend',
  'timeismoney12345', 'knowledge is power', 'knowledgeispower', 'money money money', 'moneymoneymoney1',
  'get rich or die trying', 'getrichordietrying', 'open sesame please', 'opensesameopensesame',
  'happy birthday to you', 'happybirthdaytoyou', 'merry christmas', 'merrychristmas12', 'happy new year 2026', 'happynewyear2026',
  'i am the best in the world', 'iamthebestintheworld',

  // Family and faith
  'i love you forever', 'i love my family', 'ilovemyfamily123', 'ilovemykids12345', 'ilovemymom12345', 'ilovemydad12345',
  'ilovemydog123456', 'ilovemycat123456', 'ilovemywife12345', 'ilovemyhusband1', 'i love jesus christ', 'ilovejesuschrist',
  'jesuschrist12345', 'jesus is my lord', 'jesusismysavior', 'god is good all the time', 'godisgoodallthetime',
  'godisgood1234567', 'in god we trust', 'ingodwetrust1234', 'praise the lord', 'praisethelord123',

  // Sentences about the password itself
  'this is my password', 'thisismypassword', 'this is a password', 'thisisapassword', 'this is a secret password',
  'my password is password', 'mypasswordispassword', 'i forgot my password', 'iforgotmypassword', 'forgot my password',
  'forgotmypassword', 'what is my password', 'whatismypassword', 'i dont know my password', 'idontknowmypassword',
  'idontknowwhattoput', 'i dont remember it', 'idontremember123', 'nopasswordneeded', 'no password needed',
  'secretpassword12', 'secret password here', 'topsecretpassword', 'top secret password', 'supersecretpassword',
  'super secret password', 'verysecretpassword', 'very secret password', 'strongpassword123', 'strong password here',
  'verystrongpassword', 'very strong password', 'a very long password', 'averylongpassword', 'long password here',
  'longpasswordhere', 'this is a long password', 'thisisalongpassword', 'a really long password', 'areallylongpassword',
  'password is too short', 'passwordistooshort', 'at least fifteen characters', 'atleastfifteencharacters',
  'fifteen characters', 'fifteencharacters', 'fifteen characters long', 'this password is long enough',
  'thispasswordislongenough', 'change me please', 'let me in please', 'nothing to see here',
  'a short sentence only i would say', 'a short sentence works well', 'ashortsentenceworkswell',

  // Shops and this product
  'shelfieshelfie1', 'shelfie12345678', 'shelfiepassword', 'shelfie password', 'my shelfie password',
  'paypalpassword1', 'paypal123456789', 'my paypal password', 'mypaypalpassword', 'bakery123456789',
  'mybakery1234567', 'my shop password', 'myshoppassword1', 'shoppassword123', 'storepassword123',
  'restaurant12345', 'coffeeshop12345', 'the coffee shop', 'thecoffeeshop123', 'flowershop12345',
  'pizza1234567890', 'cupcake12345678', 'welcome to my shop', 'welcometomyshop',
];

const COMMON = new Set(COMMON_PASSWORDS);

export const isCommonPassword = (password: string): boolean => COMMON.has(password.toLowerCase());
