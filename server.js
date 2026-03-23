require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'aihub-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAdmin(req, res, next) {
  if (req.session.adminId) return next();
  res.status(401).json({ error: '未登录' });
}

// ============ PUBLIC API ============

// Settings
app.get('/api/settings', (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

// Tools
app.get('/api/tools', (req, res) => {
  const { category } = req.query;
  let sql = "SELECT * FROM tools";
  if (category && category !== 'all') sql += " WHERE category = ?";
  sql += " ORDER BY sort_order, id";
  const tools = category && category !== 'all' ? db.prepare(sql).all(category) : db.prepare(sql).all();
  res.json(tools);
});

// News
app.get('/api/news', (req, res) => {
  const news = db.prepare("SELECT * FROM news ORDER BY is_featured DESC, id DESC").all();
  res.json(news);
});

app.get('/api/news/:id', (req, res) => {
  const item = db.prepare("SELECT * FROM news WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// Courses
app.get('/api/courses', (req, res) => {
  const { category } = req.query;
  let sql = "SELECT * FROM courses";
  if (category && category !== '全部') sql += " WHERE category = ?";
  sql += " ORDER BY sort_order, id";
  const courses = category && category !== '全部' ? db.prepare(sql).all(category) : db.prepare(sql).all();
  res.json(courses);
});

// Posts
app.get('/api/posts', (req, res) => {
  const posts = db.prepare("SELECT * FROM posts ORDER BY id DESC").all();
  res.json(posts);
});

// Jobs
app.get('/api/jobs', (req, res) => {
  const jobs = db.prepare("SELECT * FROM jobs ORDER BY id DESC").all();
  res.json(jobs);
});

// Side incomes
app.get('/api/side-incomes', (req, res) => {
  const items = db.prepare("SELECT * FROM side_incomes ORDER BY id").all();
  res.json(items);
});

// Apps
app.get('/api/apps', (req, res) => {
  const { category } = req.query;
  let sql = "SELECT * FROM apps";
  if (category && category !== '全部') sql += " WHERE category = ?";
  sql += " ORDER BY id";
  const items = category && category !== '全部' ? db.prepare(sql).all(category) : db.prepare(sql).all();
  res.json(items);
});

// User registration/login (mock SMS)
app.post('/api/user/send-code', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^1\d{10}$/.test(phone)) return res.status(400).json({ error: '手机号格式错误' });
  req.session.smsCode = '888888';
  req.session.smsPhone = phone;
  res.json({ success: true, message: '验证码已发送（模拟：888888）' });
});

app.post('/api/user/login', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: '参数错误' });
  if (code !== req.session.smsCode || phone !== req.session.smsPhone) {
    return res.status(400).json({ error: '验证码错误' });
  }
  let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
  if (!user) {
    const result = db.prepare("INSERT INTO users (phone) VALUES (?)").run(phone);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  }
  req.session.userId = user.id;
  res.json({ success: true, user: { id: user.id, phone: user.phone, nickname: user.nickname } });
});

app.get('/api/user/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare("SELECT id, phone, nickname, avatar FROM users WHERE id = ?").get(req.session.userId);
  res.json({ user });
});

app.post('/api/user/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// AI Chat (DeepSeek proxy)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: '消息不能为空' });
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是AIHUB的AI助手，帮助用户解答AI相关的问题。请用中文回答，简洁友好。' },
          { role: 'user', content: message }
        ],
        max_tokens: 1000
      })
    });
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答。';
    res.json({ reply });
  } catch (e) {
    res.json({ reply: 'AI服务暂时不可用，请稍后再试。' });
  }
});

// ============ ADMIN API ============

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username);
  if (!admin) return res.status(401).json({ error: '用户名或密码错误' });
  const bcrypt = require('bcryptjs');
  if (!bcrypt.compareSync(password, admin.password)) return res.status(401).json({ error: '用户名或密码错误' });
  req.session.adminId = admin.id;
  req.session.adminUser = admin.username;
  res.json({ success: true });
});

app.get('/api/admin/me', (req, res) => {
  if (!req.session.adminId) return res.json({ admin: null });
  res.json({ admin: { id: req.session.adminId, username: req.session.adminUser } });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Dashboard stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const users = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const tools = db.prepare("SELECT COUNT(*) as c FROM tools").get().c;
  const news = db.prepare("SELECT COUNT(*) as c FROM news").get().c;
  const courses = db.prepare("SELECT COUNT(*) as c FROM courses").get().c;
  const posts = db.prepare("SELECT COUNT(*) as c FROM posts").get().c;
  const jobs = db.prepare("SELECT COUNT(*) as c FROM jobs").get().c;
  res.json({ users, tools, news, courses, posts, jobs });
});

// CRUD: Tools
app.get('/api/admin/tools', requireAdmin, (req, res) => {
  const tools = db.prepare("SELECT * FROM tools ORDER BY category, sort_order, id").all();
  const categories = db.prepare("SELECT DISTINCT category FROM tools").all().map(r => r.category);
  res.json({ tools, categories });
});

app.post('/api/admin/tools', requireAdmin, (req, res) => {
  const { name, category, icon, url, description } = req.body;
  db.prepare("INSERT INTO tools (name, category, icon, url, description) VALUES (?,?,?,?,?)").run(name, category, icon||'🤖', url||'', description||'');
  res.json({ success: true });
});

app.put('/api/admin/tools/:id', requireAdmin, (req, res) => {
  const { name, category, icon, url, description } = req.body;
  db.prepare("UPDATE tools SET name=?, category=?, icon=?, url=?, description=? WHERE id=?").run(name, category, icon, url, description, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/tools/:id', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM tools WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// CRUD: News
app.get('/api/admin/news', requireAdmin, (req, res) => {
  const news = db.prepare("SELECT * FROM news ORDER BY id DESC").all();
  res.json(news);
});

app.post('/api/admin/news', requireAdmin, (req, res) => {
  const { title, content, category, tags, cover, is_featured } = req.body;
  db.prepare("INSERT INTO news (title, content, category, tags, cover, is_featured) VALUES (?,?,?,?,?,?)").run(title, content||'', category||'大模型', tags||'', cover||'', is_featured?1:0);
  res.json({ success: true });
});

app.put('/api/admin/news/:id', requireAdmin, (req, res) => {
  const { title, content, category, tags, cover, is_featured } = req.body;
  db.prepare("UPDATE news SET title=?, content=?, category=?, tags=?, cover=?, is_featured=? WHERE id=?").run(title, content, category, tags, cover, is_featured?1:0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/news/:id', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM news WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// CRUD: Courses
app.get('/api/admin/courses', requireAdmin, (req, res) => {
  const courses = db.prepare("SELECT * FROM courses ORDER BY category, id").all();
  res.json(courses);
});

app.post('/api/admin/courses', requireAdmin, (req, res) => {
  const { title, description, category, difficulty, icon, students, rating } = req.body;
  db.prepare("INSERT INTO courses (title, description, category, difficulty, icon, students, rating) VALUES (?,?,?,?,?,?,?)").run(title, description||'', category||'AI编程', difficulty||'入门', icon||'📚', students||'0', rating||'4.8');
  res.json({ success: true });
});

app.put('/api/admin/courses/:id', requireAdmin, (req, res) => {
  const { title, description, category, difficulty, icon, students, rating } = req.body;
  db.prepare("UPDATE courses SET title=?, description=?, category=?, difficulty=?, icon=?, students=?, rating=? WHERE id=?").run(title, description, category, difficulty, icon, students, rating, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/courses/:id', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM courses WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// CRUD: Posts
app.get('/api/admin/posts', requireAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM posts ORDER BY id DESC").all());
});

app.post('/api/admin/posts', requireAdmin, (req, res) => {
  const { title, content, author, author_avatar, members } = req.body;
  db.prepare("INSERT INTO posts (title, content, author, author_avatar, members) VALUES (?,?,?,?,?)").run(title, content||'', author||'', author_avatar||'🤖', members||'0');
  res.json({ success: true });
});

app.put('/api/admin/posts/:id', requireAdmin, (req, res) => {
  const { title, content, author, author_avatar, members, status } = req.body;
  db.prepare("UPDATE posts SET title=?, content=?, author=?, author_avatar=?, members=?, status=? WHERE id=?").run(title, content, author, author_avatar, members, status||'active', req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/posts/:id', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM posts WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// CRUD: Jobs
app.get('/api/admin/jobs', requireAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM jobs ORDER BY id DESC").all());
});

app.post('/api/admin/jobs', requireAdmin, (req, res) => {
  const { title, company, location, salary, icon, tag, tag_color } = req.body;
  db.prepare("INSERT INTO jobs (title, company, location, salary, icon, tag, tag_color) VALUES (?,?,?,?,?,?,?)").run(title, company||'', location||'', salary||'', icon||'🏢', tag||'新发布', tag_color||'green');
  res.json({ success: true });
});

app.put('/api/admin/jobs/:id', requireAdmin, (req, res) => {
  const { title, company, location, salary, icon, tag, tag_color } = req.body;
  db.prepare("UPDATE jobs SET title=?, company=?, location=?, salary=?, icon=?, tag=?, tag_color=? WHERE id=?").run(title, company, location, salary, icon, tag, tag_color, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/jobs/:id', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM jobs WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// CRUD: Side incomes
app.get('/api/admin/side-incomes', requireAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM side_incomes ORDER BY id").all());
});

app.post('/api/admin/side-incomes', requireAdmin, (req, res) => {
  const { title, description, income, icon, tags, level } = req.body;
  db.prepare("INSERT INTO side_incomes (title, description, income, icon, tags, level) VALUES (?,?,?,?,?,?)").run(title, description||'', income||'', icon||'💰', tags||'', level||'入门');
  res.json({ success: true });
});

app.put('/api/admin/side-incomes/:id', requireAdmin, (req, res) => {
  const { title, description, income, icon, tags, level } = req.body;
  db.prepare("UPDATE side_incomes SET title=?, description=?, income=?, icon=?, tags=?, level=? WHERE id=?").run(title, description, income, icon, tags, level, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/side-incomes/:id', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM side_incomes WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// CRUD: Apps
app.get('/api/admin/apps', requireAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM apps ORDER BY category, id").all());
});

app.post('/api/admin/apps', requireAdmin, (req, res) => {
  const { title, description, category, icon, tags } = req.body;
  db.prepare("INSERT INTO apps (title, description, category, icon, tags) VALUES (?,?,?,?,?)").run(title, description||'', category||'教育', icon||'📚', tags||'');
  res.json({ success: true });
});

app.put('/api/admin/apps/:id', requireAdmin, (req, res) => {
  const { title, description, category, icon, tags } = req.body;
  db.prepare("UPDATE apps SET title=?, description=?, category=?, icon=?, tags=? WHERE id=?").run(title, description, category, icon, tags, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/apps/:id', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM apps WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// Admin: Users
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY id DESC").all();
  res.json(users);
});

// Admin: Settings
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM settings").all();
  res.json(rows);
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const { settings } = req.body;
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  const txn = db.transaction((items) => {
    for (const [k, v] of items) upsert.run(k, String(v));
  });
  txn(Object.entries(settings));
  res.json({ success: true });
});

// Admin: Banners
app.get('/api/admin/banners', requireAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM banners ORDER BY sort_order, id").all());
});

app.post('/api/admin/banners', requireAdmin, (req, res) => {
  const { title, subtitle, link, sort_order } = req.body;
  db.prepare("INSERT INTO banners (title, subtitle, link, sort_order) VALUES (?,?,?,?)").run(title||'', subtitle||'', link||'', sort_order||0);
  res.json({ success: true });
});

app.put('/api/admin/banners/:id', requireAdmin, (req, res) => {
  const { title, subtitle, link, sort_order, active } = req.body;
  db.prepare("UPDATE banners SET title=?, subtitle=?, link=?, sort_order=?, active=? WHERE id=?").run(title, subtitle, link, sort_order, active?1:0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/banners/:id', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM banners WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// Catch-all: serve index.html for SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`AIHUB running on http://localhost:${PORT}`);
});
