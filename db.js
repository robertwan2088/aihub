const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'aihub.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE,
    nickname TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    icon TEXT DEFAULT '🤖',
    url TEXT DEFAULT '',
    description TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    category TEXT DEFAULT '大模型',
    tags TEXT DEFAULT '',
    cover TEXT DEFAULT '',
    views INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'AI编程',
    difficulty TEXT DEFAULT '入门',
    icon TEXT DEFAULT '🐍',
    students TEXT DEFAULT '0',
    rating TEXT DEFAULT '4.8',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    author TEXT DEFAULT '',
    author_avatar TEXT DEFAULT '',
    members TEXT DEFAULT '0',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT DEFAULT '',
    location TEXT DEFAULT '',
    salary TEXT DEFAULT '',
    icon TEXT DEFAULT '🏢',
    tag TEXT DEFAULT '新发布',
    tag_color TEXT DEFAULT 'green',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS side_incomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    income TEXT DEFAULT '',
    icon TEXT DEFAULT '💰',
    tags TEXT DEFAULT '',
    level TEXT DEFAULT '入门',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT '教育',
    icon TEXT DEFAULT '📚',
    tags TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT DEFAULT '',
    subtitle TEXT DEFAULT '',
    image TEXT DEFAULT '',
    link TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed data
const adminExists = db.prepare("SELECT id FROM admin_users WHERE username = 'admin'").get();
if (!adminExists) {
  const bcrypt = require('bcryptjs');
  db.prepare("INSERT INTO admin_users (username, password) VALUES (?, ?)").run(
    'admin', bcrypt.hashSync('admin123', 10)
  );
}

// Seed settings
const settingCount = db.prepare("SELECT COUNT(*) as c FROM settings").get().c;
if (settingCount === 0) {
  const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  const settings = [
    ['site_title', 'AIHUB'],
    ['site_subtitle', '你的AI宇宙中心'],
    ['site_description', '编程学习 · 考研指南 · 求职招聘 · AI新闻 · 前沿研究'],
    ['stat_tools', '500'],
    ['stat_courses', '50'],
    ['stat_users', '10'],
    ['stat_users_unit', '万+'],
    ['stat_support', '24/7'],
    ['ticker_1', 'ChatGPT日活突破1亿'],
    ['ticker_2', 'OpenAI发布GPT-5技术报告'],
    ['ticker_3', '国产大模型DeepSeek V3发布'],
    ['ticker_4', '谷歌Gemini 2.0全面开放API'],
    ['ticker_5', '斯坦福大学成立AI安全研究中心'],
    ['ticker_6', 'AI程序员替代30%传统编程岗位'],
  ];
  const insertMany = db.transaction((items) => {
    for (const [k, v] of items) insertSetting.run(k, v);
  });
  insertMany(settings);
}

// Seed tools
const toolCount = db.prepare("SELECT COUNT(*) as c FROM tools").get().c;
if (toolCount === 0) {
  const insert = db.prepare("INSERT INTO tools (name, category, icon, url, description) VALUES (?,?,?,?,?)");
  const tools = [
    ['ChatGPT','chat','🤖','https://chat.openai.com','OpenAI · 全球最火AI对话'],
    ['Claude','chat','🧠','https://claude.ai','Anthropic · 最强推理模型'],
    ['DeepSeek','chat','🌐','https://deepseek.com','国产 · 开源最强模型'],
    ['Gemini','chat','✨','https://gemini.google.com','谷歌 · 多模态大模型'],
    ['通义千问','chat','🟣','https://qianwen.aliyun.com','阿里 · 国产大模型'],
    ['零一万物','chat','🦄','https://yi.com','李开复 · 国产大模型'],
    ['Kimi','chat','🌙','https://kimi.moonshot.cn','月之暗面 · 长上下文'],
    ['Groq','chat','⚡','https://groq.com','最快推理 · 免费调用'],
    ['Midjourney','image','🎨','https://midjourney.com','最强AI绘画 · 艺术家首选'],
    ['Stable Diffusion','image','🖼️','https://stablediffusion.com','开源免费 · 本地部署'],
    ['DALL·E 3','image','🎭','https://dall-e.openai.com','OpenAI官方 · 画图神器'],
    ['Ideogram','image','🔮','https://ideogram.ai','文字生成图像 · 字体无敌'],
    ['Lexica','image','🔍','https://lexica.art','SD图库搜索 · 提示词库'],
    ['Liblib','image','📚','https://liblib.ai','国内SD · 大量模型'],
    ['AI灵描','image','🖌️','https://ailnmg.com','国产 · 中文提示词'],
    ['Sora','video','🌊','https://sora.com','OpenAI · AI视频生成'],
    ['Runway','video','✈️','https://runwayml.com','AI视频编辑 · 影视级'],
    ['Pika','video','🎞️','https://pika.art','文字转视频 · 简洁高效'],
    ['HeyGen','video','🎭','https://heygen.com','AI数字人视频 · 商业级'],
    ['可灵AI','video','⚡','https://klingai.com','快手 · 国产AI视频'],
    ['海螺AI','video','🎬','https://minimax.io','MiniMax · 视频生成'],
    ['ElevenLabs','audio','🎤','https://elevenlabs.io','最强AI配音 · 克隆声音'],
    ['Murf AI','audio','🗣️','https://murf.ai','AI配音 · 多语言'],
    ['TTSMaker','audio','🔊','https://ttsmaker.com','免费AI配音 · 中文支持'],
    ['Suno','audio','🎵','https://suno.com','AI音乐生成 · 作曲神器'],
    ['Cursor','code','💻','https://cursor.com','AI代码编辑器 · 编程革命'],
    ['GitHub Copilot','code','🐙','https://github.com/features/copilot','微软 · 代码补全神器'],
    ['Codeium','code','⚡','https://codeium.com','免费Copilot替代'],
    ['Windsurf','code','🌊','https://windsurf.com','AI编程 · 新兴力量'],
    ['Devin','code','🧑‍💻','https://devin.ai','首个AI软件工程师'],
    ['Replit','code','🚀','https://replit.com','AI在线编程 · 云IDE'],
    ['Notion AI','office','📝','https://notion.so','AI笔记 · 写作助手'],
    ['WPS AI','office','📄','https://wps.cn','国产 · 文档办公'],
    ['Microsoft Copilot','office','🔷','https://copilot.microsoft.com','Office全家桶AI'],
    ['Writesonic','office','✍️','https://writesonic.com','AI写作 · 营销文案'],
    ['秘塔写作猫','office','📊','https://jimmymeng.com','国产 · 中文写作AI'],
    ['文心一言','office','🔍','https://yiyan.baidu.com','百度 · 对话写作AI'],
    ['Perplexity','search','🔮','https://perplexity.ai','AI搜索引擎 · 联网问答'],
    ['Phind','search','💡','https://phind.com','程序员AI搜索'],
    ['Kimi','search','🌙','https://kimi.moonshot.cn','联网搜索 · 长文本'],
    ['Metaphor','search','🌐','https://metaphor.systems','AI驱动搜索 · 新范式'],
    ['D-ID','human','👤','https://d-id.com','AI数字人 · 照片说话'],
    ['HeyGen Studio','human','🎭','https://heygen.com','AI数字人视频 · 商业应用'],
    ['Synthesia','human','🎬','https://synthesia.io','AI视频制作 · 数字人'],
    ['D-ID Studio','human','🖥️','https://studio.d-id.com','克隆自己 · 数字分身'],
    ['闪剪AI','human','✂️','https://闪剪.ai','国产 · 数字人视频'],
  ];
  const insertMany = db.transaction((items) => {
    for (const t of items) insert.run(...t);
  });
  insertMany(tools);
}

// Seed news
const newsCount = db.prepare("SELECT COUNT(*) as c FROM news").get().c;
if (newsCount === 0) {
  const insert = db.prepare("INSERT INTO news (title, content, category, is_featured) VALUES (?,?,?,?)");
  const news = [
    ['GPT-5即将发布！OpenAI CEO确认最新进展，AGI再进一步','GPT-5预计将在今年发布，OpenAI CEO Sam Altman在最新采访中确认了多项重大进展...','头条',1],
    ['国产大模型DeepSeek V3发布，性能直逼GPT-4','DeepSeek V3在多项基准测试中取得优异成绩...','大模型',0],
    ['AI程序员淘汰传统码农？头部科技公司裁员30%','随着AI编程工具的普及，传统开发岗位面临前所未有的挑战...','行业',0],
    ['斯坦福最新研究：AI已具备7岁儿童推理能力','斯坦福大学AI实验室最新论文指出...','研究',0],
    ['谷歌发布Gemini 2.0，声称超越所有现有模型','谷歌最新推出的Gemini 2.0在多项评测中刷新记录...','产品',0],
  ];
  const insertMany = db.transaction((items) => {
    for (const n of items) insert.run(...n);
  });
  insertMany(news);
}

// Seed courses
const courseCount = db.prepare("SELECT COUNT(*) as c FROM courses").get().c;
if (courseCount === 0) {
  const insert = db.prepare("INSERT INTO courses (title, description, category, difficulty, icon, students, rating) VALUES (?,?,?,?,?,?,?)");
  const courses = [
    ['Python AI编程零基础入门','从安装配置到机器学习实战，7天搞定Python AI编程第一步','AI编程','入门','🐍','2.3万','4.9'],
    ['机器学习与深度学习实战','理论+代码双管齐下，用真实项目带你理解神经网络核心原理','深度学习','进阶','🧠','1.8万','4.8'],
    ['大模型(LLM)开发实战','RAG、LangChain、模型微调，从0到1开发你的第一个AI应用','大模型','高级','🔧','9800+','4.9'],
    ['2025 AI考研全程规划','从选校到上岸，考研名师带你避开所有坑','考研攻略','入门','📖','5.6千','4.7'],
  ];
  const insertMany = db.transaction((items) => {
    for (const c of items) insert.run(...c);
  });
  insertMany(courses);
}

// Seed posts
const postCount = db.prepare("SELECT COUNT(*) as c FROM posts").get().c;
if (postCount === 0) {
  const insert = db.prepare("INSERT INTO posts (title, content, author, author_avatar, members) VALUES (?,?,?,?,?)");
  const posts = [
    ['AI编程交流群','专注于Python、机器学习、深度学习的技术交流','AI爱好者','🤖','2,847'],
    ['AI绘画创作区','MJ、SD创作分享，提示词技巧交流','创作者','🎨','1,523'],
    ['AI创新大赛','年度AI创新大赛，奖金池10万+','官方','🏆','5,231'],
  ];
  const insertMany = db.transaction((items) => {
    for (const p of items) insert.run(...p);
  });
  insertMany(posts);
}

// Seed jobs
const jobCount = db.prepare("SELECT COUNT(*) as c FROM jobs").get().c;
if (jobCount === 0) {
  const insert = db.prepare("INSERT INTO jobs (title, company, location, salary, icon, tag, tag_color) VALUES (?,?,?,?,?,?,?)");
  const jobs = [
    ['AI算法工程师','字节跳动','北京','25-50K·15薪','🦉','急聘','red'],
    ['大模型研究员','阿里达摩院','杭州','35-80K','🧠','热招','gold'],
    ['AI产品经理','百度','北京','30-60K','🤖','新发布','green'],
    ['AIGC算法工程师','MiniMax','上海','40-80K','🎨','急聘','red'],
  ];
  const insertMany = db.transaction((items) => {
    for (const j of items) insert.run(...j);
  });
  insertMany(jobs);
}

// Seed side_incomes
const siCount = db.prepare("SELECT COUNT(*) as c FROM side_incomes").get().c;
if (siCount === 0) {
  const insert = db.prepare("INSERT INTO side_incomes (title, description, income, icon, tags, level) VALUES (?,?,?,?,?,?)");
  const items = [
    ['AI写作变现','代写文章、投稿公众号、商业文案，用ChatGPT提效10倍','月入 3000-2万','📝','ChatGPT','入门'],
    ['AI绘画接单','头像、壁纸、海报设计，在小红书/闲鱼接单','月入 5000-5万','🎨','Midjourney','进阶'],
    ['AI数字人带货','AI虚拟主播、克隆自己带货，24小时自动赚钱','月入 1万-10万','🤖','数字人','高级'],
    ['AI知识付费','卖AI课、社群、付费文档，把自己的AI经验变成可持续收入','月入 2万-20万','📚','知识付费','进阶'],
  ];
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(...r);
  });
  insertMany(items);
}

// Seed apps
const appCount = db.prepare("SELECT COUNT(*) as c FROM apps").get().c;
if (appCount === 0) {
  const insert = db.prepare("INSERT INTO apps (title, description, category, icon, tags) VALUES (?,?,?,?,?)");
  const items = [
    ['AI个性化学习','AI诊断学生薄弱点，自动生成专属学习路径，因材施教效率提升300%','教育','📚','自适应教学,智能出题'],
    ['AI智能电商运营','AI生成商品描述、智能客服、用户评论分析、个性化推荐','电商','🛒','智能客服,选品分析'],
    ['AI直播数字人','AI虚拟主播24小时不间断直播，克隆真人形象和声音，成本降低90%','直播','📺','虚拟主播,智能互动'],
    ['AI智慧农业','AI病虫害识别、智能灌溉、产量预测、无人机巡检','农业','🌾','精准农业,产量预测'],
    ['AI辅助诊断','AI读片辅助、罕见病筛查、药物研发加速','医学','🏥','AI读片,新药研发'],
    ['AI文物修复与探测','AI识别古文字、文物3D重建、遗址地下探测','考古','🏺','文物修复,文字识别'],
    ['AI智能制造','质量检测、预测性维护、柔性生产线，工厂效率提升40%','制造','🏭','质检,预测维护'],
    ['AI智能金融','智能风控、反欺诈、量化交易、个性化理财','金融','💰','风控,量化'],
  ];
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(...r);
  });
  insertMany(items);
}

module.exports = db;
