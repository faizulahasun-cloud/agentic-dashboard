'use strict';

const obsidian = require('obsidian');
const {
  Plugin,
  PluginSettingTab,
  Setting,
  ItemView,
  Notice,
  TFile,
  TFolder,
  Platform,
  moment,
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
  tasksCap: 18,
  refreshSeconds: 60,
};

const CAPTURE_TYPES = [
  { label: 'Thought 💭', slug: 'thought' },
  { label: 'Idea 💡', slug: 'idea' },
  { label: 'Reflection 🌙', slug: 'reflection' },
  { label: 'To watch 📺', slug: 'to-watch' },
  { label: 'Book 📚', slug: 'book' },
  { label: 'Article 📰', slug: 'article' },
];

const DUE_EMOJI_RE = /[📅⏳🛫]\s*(\d{4}-\d{2}-\d{2})/;
const TASK_LINE_RE = /^(\s*)- \[([ xX])\] ?(.*)$/;

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

// Strip wiki links ([[a|b]] -> b, [[a]] -> a) and trailing task emoji metadata.
function cleanTaskText(raw) {
  let t = String(raw || '');
  t = t.replace(/\[\[[^\]]*\|([^\]]*)\]\]/g, '$1');
  t = t.replace(/\[\[([^\]]*)\]\]/g, '$1');
  t = t.replace(/[\s]*[📅⏳🛫➕][^\s📅⏳🛫➕]*[\s]*$/, '');
  t = t.replace(/\s+$/, '');
  return t;
}

function dueDateOf(lineText) {
  const m = DUE_EMOJI_RE.exec(String(lineText || ''));
  return m ? m[1] : null;
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
    this.captureMode = null; // null | '__task' | '__meeting' | capture slug
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
      inboxCount: 0,
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
      if (f.stat.mtime >= weekAgo) data.modifiedCount++;
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
          const isDone = m[2] !== ' ';
          const raw = m[3];
          if (isDone) { data.doneCount++; continue; }
          data.openCount++;

          if (f.path === dailyPath) {
            data.todayTasks.push({
              path: f.path, line, raw, due: null, done: false,
              base: f.basename,
            });
          } else {
            const due = dueDateOf(line);
            if (due && due <= today) {
              data.dueTasks.push({
                path: f.path, line, raw, due, done: false,
                base: f.basename,
              });
            }
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
      return a.raw.localeCompare(b.raw);
    });
    data.tasks = allTasks.slice(0, Math.max(1, s.tasksCap));
    data.tasksCount = allTasks.length;
    data.todayTasks = null; // merged above
    data.dueTasks = null;

    // meetings: sort by time
    data.meetings.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    if (meetingsIsFolder) {
      data.meetingCount = files.filter((f) => inMeetings(f) && f.stat.ctime).length;
    }

    // recent notes: 7 by mtime, skip today's daily duplicates of the same list
    recentFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
    data.recent = recentFiles.slice(0, 7).map((f) => ({
      path: f.path,
      title: f.basename,
      mtime: f.stat.mtime,
    }));

    // inbox: 10 by ctime + total count
    inboxFiles.sort((a, b) => b.stat.ctime - a.stat.ctime);
    data.inboxCount = inboxFiles.length;
    data.inbox = inboxFiles.slice(0, 10).map((f) => {
      const cache = app.metadataCache.getFileCache(f);
      let tag = '';
      if (cache && cache.frontmatter && typeof cache.frontmatter.tag === 'string') {
        tag = cache.frontmatter.tag;
      }
      return { path: f.path, title: f.basename, ctime: f.stat.ctime, tag };
    });

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
    this.root.empty();
    this.renderHero(data);
    this.renderActions();
    this.renderCapture();
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
    top.createDiv({ cls: 'hd-clock', attr: { id: 'hdClock' }, text: '--:--:--' });

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
      this.captureMode = '__task';
      this.activeChip = null;
      this.refreshCaptureUI();
      this.focusInput();
    });

    const meetBtn = actions.createEl('button', { cls: 'hd-btn', text: 'Meeting' });
    meetBtn.addEventListener('click', () => {
      this.captureMode = '__meeting';
      this.activeChip = null;
      this.refreshCaptureUI();
      this.focusInput();
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
      else if (evt.key === 'Escape') { evt.preventDefault(); this.resetCapture(); }
    });

    const chips = cap.createDiv({ cls: 'hd-chips' });
    this.chipEls = new Map();
    for (const t of CAPTURE_TYPES) {
      const chip = chips.createEl('button', { cls: 'hd-chip', text: t.label });
      chip.addEventListener('click', () => {
        // clicking a chip selects it as the capture type (plain capture mode)
        if (this.captureMode !== '__task' && this.captureMode !== '__meeting') {
          this.activeChip = this.activeChip === t.slug ? null : t.slug;
        } else {
          this.activeChip = t.slug;
        }
        this.refreshCaptureUI();
        this.focusInput();
      });
      this.chipEls.set(t.slug, chip);
    }
  }

  refreshCaptureUI() {
    if (!this.input) return;
    let placeholder = 'Capture a thought to Inbox… (Enter to save, Esc to clear)';
    if (this.captureMode === '__task') placeholder = 'Add task to today…';
    else if (this.captureMode === '__meeting') placeholder = 'New meeting title…';
    else if (this.activeChip) {
      const t = CAPTURE_TYPES.find((x) => x.slug === this.activeChip);
      if (t) placeholder = `Capture ${t.label.replace(/\s\S+$/, '')} to Inbox…`;
    }
    this.input.placeholder = placeholder;

    if (this.chipEls) {
      for (const [slug, el] of this.chipEls) {
        el.toggleClass('is-active', this.activeChip === slug);
      }
    }
  }

  focusInput() {
    if (this.input) this.input.focus();
  }

  resetCapture() {
    this.captureMode = null;
    this.activeChip = null;
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
      } else if (this.captureMode === '__meeting') {
        await this.plugin.createMeeting(raw);
        new Notice('Meeting created ✓');
      } else {
        const type = this.activeChip
          ? (CAPTURE_TYPES.find((x) => x.slug === this.activeChip) || { slug: 'thought' }).slug
          : 'thought';
        await this.plugin.captureToInbox(type, raw);
        new Notice('Saved to inbox ✓');
      }
      this.resetCapture();
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
          await this.plugin.toggleTaskLine(t.path, t.line);
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
      { ico: '📝', num: `${data.noteCount}`, lbl: 'notes' },
      { ico: '☐', num: `${data.openCount}`, lbl: 'open' },
      { ico: '☑', num: `${data.doneCount}`, lbl: 'done' },
      { ico: '📥', num: `${data.inboxCount}`, lbl: 'inbox' },
      { ico: '🗓', num: `${data.meetings.length}`, lbl: 'meetings' },
      { ico: '⏱', num: `${data.modifiedCount}`, lbl: 'mod 7d' },
    ];
    for (const it of items) {
      const st = stats.createDiv({ cls: 'hd-stat' });
      st.createSpan({ cls: 'hd-ico', text: it.ico });
      st.createDiv({ cls: 'hd-num', text: it.num });
      st.createDiv({ cls: 'hd-lbl', text: it.lbl });
    }
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
        type: 'group',
        heading: 'Folders',
        items: [
          { name: 'Journal folder', desc: 'Folder holding YYYY-MM-DD daily notes.', control: { type: 'folder', key: 'journalFolder', defaultValue: D.journalFolder } },
          { name: 'Inbox folder', desc: 'Folder where quick captures are stored.', control: { type: 'folder', key: 'inboxFolder', defaultValue: D.inboxFolder } },
          { name: 'Meetings folder', desc: 'Folder where new meetings are created.', control: { type: 'folder', key: 'meetingsFolder', defaultValue: D.meetingsFolder } },
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
  }
}

/* ════════════════════════════════════════════════════════════════
   ✦ Plugin
   ════════════════════════════════════════════════════════════════ */

class HermesDashboardPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

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
    }, async (f) => {
      const text = String(f.text || '').trim();
      if (!text) return 'error: text=<task text> is required';
      const dateStr = this.normalizeDate(f.date);
      await this.addTaskToDaily(text, dateStr);
      this.refreshViews(400);
      return `Task added to ${dateStr}: ${text}`;
    });

    reg('agentic-dashboard:capture', 'Create a quick note in the Inbox folder', {
      text: flag('Note text (used as title + body)', '<text>', true),
      type: flag('thought | idea | reflection | to-watch | book | article', '<type>'),
    }, async (f) => {
      const text = String(f.text || '').trim();
      if (!text) return 'error: text=<note text> is required';
      const type = String(f.type || 'thought').trim() || 'thought';
      await this.captureToInbox(type, text);
      this.refreshViews(400);
      return `Saved to Inbox (${type}): ${text}`;
    });

    reg('agentic-dashboard:meeting', 'Create a meeting note for today', {
      title: flag('Meeting title', '<title>', true),
      time: flag('Start time (HH:mm or HHmm)', '<time>'),
    }, async (f) => {
      const title = String(f.title || '').trim();
      if (!title) return 'error: title=<meeting title> is required';
      await this.createMeeting(title, f.time);
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
  }

  async handleAgentAction(params) {
    const action = String(params.action || '').toLowerCase().trim();
    const text = String(params.text || '').trim();
    const title = String(params.title || text || '').trim();
    const open = async (file) => {
      await this.app.workspace.getLeaf('tab').openFile(file);
      new Notice(`Opened ${file.basename} ✓`);
    };
    try {
      switch (action) {
        case 'open-dashboard':
          await this.activateView();
          new Notice('Agentic dashboard opened ✓');
          return;
        case 'add-task': {
          if (!text) return this.agentHelp('add-task', 'text=Buy milk (&date=YYYY-MM-DD optional)');
          const dateStr = this.normalizeDate(params.date);
          await this.addTaskToDaily(text, dateStr);
          new Notice(`Task added to ${dateStr} ✓`);
          this.refreshViews(400);
          return;
        }
        case 'capture': {
          if (!text) return this.agentHelp('capture', 'text=Idea about X (&type=thought|idea|reflection|to-watch|book|article)');
          const type = String(params.type || 'thought').trim() || 'thought';
          await this.captureToInbox(type, text);
          new Notice('Saved to inbox ✓');
          this.refreshViews(400);
          return;
        }
        case 'meeting': {
          if (!title) return this.agentHelp('meeting', 'title=Design review (&time=HH:mm optional)');
          await this.createMeeting(title, params.time);
          new Notice('Meeting created ✓');
          this.refreshViews(400);
          return;
        }
        case 'new-daily': {
          const dateStr = this.normalizeDate(params.date);
          await this.openOrCreateDaily(dateStr);
          new Notice(`Daily note ready: ${dateStr} ✓`);
          return;
        }
        case 'open-note': {
          const p = String(params.path || '').trim();
          if (!p) return this.agentHelp('open-note', 'path=open code/Journal/2026-11-13.md');
          const f = this.app.vault.getAbstractFileByPath(p);
          if (f instanceof TFile && f.extension === 'md') return void (await open(f));
          return this.findAndOpenNote(p);
        }
        case 'find-note': {
          const q = String(params.query || params.q || '').trim();
          if (!q) return this.agentHelp('find-note', 'query=dashboard');
          return this.findAndOpenNote(q);
        }
        default:
          new Notice('Agentic dashboard · unknown action. Use: open-dashboard, add-task, capture, meeting, new-daily, open-note, find-note');
      }
    } catch (err) {
      console.error('[agentic-dashboard] action failed:', action, err);
      new Notice(`Agentic dashboard · action failed: ${err.message}`);
    }
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
    if (!scored.length) {
      new Notice(`Agentic dashboard · no note matching "${query}"`);
      return;
    }
    const bestScore = Math.max(...scored.map((s) => s.score));
    const ties = scored
      .filter((s) => s.score === bestScore)
      .sort((a, b) => a.f.basename.length - b.f.basename.length || a.f.path.localeCompare(b.f.path));
    const win = ties[0].f;
    this.app.workspace.getLeaf('tab').openFile(win);
    new Notice(ties.length > 1
      ? `Opened ${win.basename} (${scored.length} matches)`
      : `Opened ${win.basename} ✓`);
  }

  /* ---------- note helpers (daily / task / meeting / capture) ---------- */

  dailyPathFor(dateStr) {
    return `${this.settings.journalFolder}/${dateStr}.md`;
  }

  dailyTemplateFor(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const wk = pad2(isoWeek(d));
    return [
      '---',
      'type: daily',
      `date: ${dateStr}`,
      '---',
      '',
      `## Week ${wk} ⌂ [[000 - Dashboard]]`,
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
    const path = this.dailyPathFor(dateStr);
    let f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) {
      const folder = this.settings.journalFolder;
      if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) {
        await this.app.vault.createFolder(folder);
      }
      f = await this.app.vault.create(path, this.dailyTemplateFor(dateStr));
    }
    await this.app.workspace.getLeaf('tab').openFile(f);
    return f;
  }

  async addTaskToDaily(text, dateOpt) {
    const dateStr = this.normalizeDate(dateOpt);
    const path = this.dailyPathFor(dateStr);
    let f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) {
      const folder = this.settings.journalFolder;
      if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) {
        await this.app.vault.createFolder(folder);
      }
      f = await this.app.vault.create(path, this.dailyTemplateFor(dateStr));
    }
    const existing = await this.app.vault.read(f);
    const content = existing.endsWith('\n') ? existing : existing + '\n';
    await this.app.vault.modify(f, `${content}- [ ] ${sanitizeName(text)}\n`);
  }

  async toggleTaskLine(path, rawLine) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) return;
    await this.app.vault.process(f, (text) => {
      const lines = text.split('\n');
      let idx = lines.indexOf(rawLine);
      if (idx === -1) {
        const target = rawLine.trim();
        idx = lines.findIndex((l) => l.trim() === target);
      }
      if (idx === -1) return text;
      if (/\[ \]/.test(lines[idx])) lines[idx] = lines[idx].replace('[ ]', '[x]');
      else if (/\[[xX]\]/.test(lines[idx])) lines[idx] = lines[idx].replace(/\[[xX]\]/, '[ ]');
      return lines.join('\n');
    });
    new Notice('Task updated ✓');
  }

  async createMeeting(title, timeOpt) {
    const now = new Date();
    const dateStr = ymd(now);
    const timeStr = this.normalizeTime(timeOpt, now);
    const name = sanitizeName(title) || 'Meeting';
    const folder = this.settings.meetingsFolder;
    if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) {
      await this.app.vault.createFolder(folder);
    }
    const path = `${folder}/${dateStr} ${timeStr} - ${name}.md`;
    const content = [
      '---',
      'type: meeting',
      `date: ${dateStr}`,
      `time: ${timeStr}`,
      '---',
      '',
      `# ${name}`,
      '',
      '## Agenda',
      '',
      '- ',
      '',
      '## Notes',
      '',
      '- ',
      '',
      '## Decisions',
      '',
      '- ',
      '',
      '## Action items',
      '',
      `- [ ]  📅 ${dateStr}`,
      '',
    ].join('\n');
    await this.app.vault.create(path, content);
  }

  async captureToInbox(type, text) {
    const now = new Date();
    const dateStr = ymd(now);
    const timeStr = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
    const name = sanitizeName(text).slice(0, 60) || type;
    const folder = this.settings.inboxFolder;
    if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) {
      await this.app.vault.createFolder(folder);
    }
    const path = `${folder}/${dateStr} ${timeStr} - ${name}.md`;
    const content = [
      '---',
      'type: inbox',
      `tag: ${slugify(type)}`,
      `date: ${dateStr}`,
      `time: ${timeStr}`,
      '---',
      '',
      sanitizeName(text),
      '',
      '— captured from Agentic dashboard',
      '',
    ].join('\n');
    await this.app.vault.create(path, content);
  }
}

module.exports = HermesDashboardPlugin;
