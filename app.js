/* ============================================================
   بيري | Berry Chatbot — app.js
   Vanilla JavaScript only. No frameworks, no external libs.

   File structure (for easy future extension):
     1. CONFIG                — Gemini integration flags & backend endpoint
     2. KNOWLEDGE_BASE        — the ONLY source of truth for program answers
     3. Utility helpers       — text normalization, escaping, ids, time
     4. Storage layer         — localStorage read/write for conversations
     5. State                 — in-memory app state + DOM references
     6. Rendering functions   — building chat bubbles, sidebar, modals
     7. Core chat logic       — sendMessage / generateResponse / findAnswer
     8. Gemini integration    — real AI answers + "more" action through backend
     9. Event bindings        — form submit, buttons, keyboard shortcuts
    10. App bootstrap         — initApp()
   ============================================================ */


/* ============================================================
   1. CONFIG
   ------------------------------------------------------------
   Central place to flip on real integrations later.
   NOTE: never put real API keys here — this file ships to the
   browser. Real keys must live on a backend server, and the
   frontend should only call YOUR backend endpoints.
   ============================================================ */
const CONFIG = {
  // Gemini is connected through our own Node.js backend.
  // IMPORTANT: the Gemini API key is NEVER exposed in this browser file.
  useRealAIAPI: true,
  aiApiEndpoint: '/api/ai-response',

  // The "more" button also uses Gemini instead of the old mock-search placeholder.
  useRealSearchAPI: false,
  searchApiEndpoint: '/api/search',

  mockSearchDelayMs: 0,
  botName: 'بيري'
};


/* ============================================================
   2. KNOWLEDGE BASE
   ------------------------------------------------------------
   This is the ONLY place Berry pulls program facts from.
   Each entry has:
     - id: unique key
     - keywords: Arabic phrases/words used to detect the intent
     - html(): returns the trusted HTML shown inside the bubble
     - allowDeepSearch: whether to show "🔎 أريد معرفة المزيد"
     - deepQuery: the search query used for the deep-dive search

   ➜ TO ADD A NEW QUESTION/ANSWER: add a new object to this array.
   ➜ TO EDIT EXISTING PROGRAM INFO: edit the html() strings below.
   ============================================================ */
const KNOWLEDGE_BASE = [
  {
    id: 'program_general',
    keywords: [
      'اسم البرنامج', 'عن البرنامج', 'ايه هو البرنامج', 'ما هو البرنامج',
      'ايه بيري', 'مين بيري', 'عرفني بالبرنامج', 'وصف البرنامج'
    ],
    allowDeepSearch: false,
    html: () => `
      <h3>عن البرنامج</h3>
      <p>
        هذا البرنامج هو <strong>"برنامج إعداد أخصائي تكنولوجيا التعليم لذوي الاحتياجات الخاصة"</strong>،
        وهو برنامج أكاديمي متخصص يهدف لإعداد كوادر قادرة على دمج التكنولوجيا في خدمة
        التعليم لذوي الاحتياجات الخاصة.
      </p>
      <p>يمكنك سؤالي عن: شروط الالتحاق، القبول، مهارات الخريج، مجالات العمل، وأهمية البرنامج.</p>
    `
  },

  {
    id: 'admission',
    keywords: [
      'شروط الالتحاق', 'شروط القبول', 'مين يقدر يدخل', 'مين يقدر يلتحق',
      'يقبل البرنامج', 'علمي علوم', 'علمي رياضه', 'ادبي', 'المدارس الفنيه',
      'خمس سنوات', 'التحاق', 'دخول البرنامج', 'شروط الدخول', 'هل اقدر التحق',
      'ثانويه عامه'
    ],
    allowDeepSearch: true,
    deepQuery: 'شروط الالتحاق ببرنامج إعداد أخصائي تكنولوجيا التعليم لذوي الاحتياجات الخاصة',
    html: () => `
      <h3>شروط الالتحاق بالبرنامج</h3>
      <p>يقبل البرنامج الفئات التالية:</p>
      <ul>
        <li>خريجو الثانوية العامة - شعبة علمي علوم</li>
        <li>خريجو الثانوية العامة - شعبة علمي رياضة</li>
        <li>خريجو الثانوية العامة - شعبة أدبي</li>
        <li>خريجو المدارس الفنية (نظام الخمس سنوات)</li>
      </ul>
      <p>بمعنى آخر: يقبل البرنامج خريجي الثانوية العامة من شعب علمي علوم وعلمي رياضة وأدبي، بالإضافة إلى خريجي المدارس الفنية نظام الخمس سنوات.</p>
    `
  },

  {
    id: 'acceptance',
    keywords: [
      'نظام القبول', 'القبول', 'كيف يتم القبول', 'التاهل', 'تنسيق القبول',
      'ازاي اتقبل', 'مكتب التنسيق'
    ],
    allowDeepSearch: true,
    deepQuery: 'نظام القبول في كليات التربية النوعية في مصر',
    html: () => `
      <h3>القبول في البرنامج</h3>
      <p>
        يتم القبول في البرنامج من خلال <strong>التأهل لأي كلية تربية نوعية على مستوى الجمهورية</strong>،
        وذلك وفق ضوابط التنسيق المعمول بها لكليات التربية النوعية.
      </p>
    `
  },

  {
    id: 'skills',
    keywords: [
      'المهارات', 'مهارات الخريج', 'هتعلم ايه', 'ماذا ساتعلم', 'ايه المهارات',
      'هدرس ايه', 'محتوى الدراسه', 'ايه اللي هتعلمه'
    ],
    allowDeepSearch: true,
    deepQuery: 'مهارات خريج تكنولوجيا التعليم لذوي الاحتياجات الخاصة',
    html: () => `
      <h3>أهم المهارات التي يكتسبها الخريج</h3>
      <ul>
        <li>تصميم المحتوى الرقمي</li>
        <li>إنتاج الوسائط التعليمية</li>
        <li>تصميم المواقع والتطبيقات لذوي الاحتياجات الخاصة</li>
        <li>التعلم الإلكتروني</li>
        <li>الذكاء الاصطناعي</li>
        <li>التقنيات المساعدة</li>
        <li>الإتاحة الرقمية</li>
        <li>معالجة الصور والفيديو والصوت</li>
      </ul>
    `
  },

  {
    id: 'importance',
    keywords: [
      'اهميه البرنامج', 'ليه البرنامج مهم', 'اهميه', 'فايده البرنامج',
      'ايه اهميه البرنامج', 'اهميه البرنامج بالنسبه لسوق العمل'
    ],
    allowDeepSearch: true,
    deepQuery: 'أهمية تكنولوجيا التعليم لذوي الاحتياجات الخاصة في سوق العمل',
    html: () => `
      <h3>أهمية البرنامج لسوق العمل والمجتمع</h3>
      <ul>
        <li>إعداد كوادر متخصصة في تكنولوجيا التعليم لذوي الاحتياجات الخاصة</li>
        <li>تلبية احتياجات سوق العمل في المدارس ومراكز التربية الخاصة والتأهيل والتدريب</li>
        <li>تأهيل الخريجين للعمل في شركات البرمجيات والمحتوى التعليمي والتقنيات المساعدة</li>
        <li>إكساب الطلاب مهارات التعليم الإلكتروني وتصميم المحتوى الرقمي والذكاء الاصطناعي</li>
        <li>توظيف التقنيات المساعدة لتيسير التعلم والتواصل والوصول إلى المعلومات</li>
        <li>دعم الدمج التعليمي والرقمي للأشخاص ذوي الاحتياجات الخاصة</li>
        <li>المساهمة في تحقيق تكافؤ الفرص التعليمية وتحسين جودة الخدمات المقدمة</li>
        <li>إعداد خريجين قادرين على تطوير حلول تكنولوجية تلائم الاحتياجات الفردية</li>
        <li>دعم المجتمع في بناء بيئة تعليمية أكثر إتاحة وشمولًا</li>
      </ul>
    `
  },

  {
    id: 'career',
    keywords: [
      'مجالات العمل', 'فرص العمل', 'وظائف', 'هشتغل فين', 'مجال العمل',
      'اشتغل ايه بعد التخرج', 'وظيفه', 'اماكن العمل'
    ],
    allowDeepSearch: true,
    deepQuery: 'مجالات عمل أخصائي تكنولوجيا التعليم لذوي الاحتياجات الخاصة',
    html: () => `
      <h3>مجالات عمل الخريج</h3>
      <ul>
        <li>أخصائي تكنولوجيا التعليم والمعلومات لذوي الاحتياجات الخاصة في مدارس التعليم العام والخاص والدولي</li>
        <li>مطور برامج ووسائل تعليمية رقمية وتفاعلية لذوي الاحتياجات الخاصة</li>
        <li>مصمم ومطور محتوى تعليمي رقمي ميسر وفق احتياجات وقدرات ذوي الاحتياجات الخاصة</li>
        <li>مصمم ومطور مواقع إلكترونية وتطبيقات رقمية ميسرة تراعي احتياجات الأشخاص ذوي الإعاقات المختلفة</li>
        <li>أخصائي التقنيات والوسائل التعليمية المساعدة في مدارس ومراكز التربية الخاصة والتأهيل</li>
        <li>أخصائي تكنولوجيا التعليم والتعلم الإلكتروني في المؤسسات التعليمية ومراكز التربية الخاصة</li>
        <li>أخصائي تصميم وتطوير التطبيقات والحلول الرقمية التعليمية لذوي الاحتياجات الخاصة</li>
        <li>أخصائي تدريب على التكنولوجيا والتقنيات المساعدة للطلاب والمعلمين وأسر ذوي الاحتياجات الخاصة</li>
        <li>العمل في شركات البرمجيات والتكنولوجيا التعليمية والتقنيات المساعدة وتطوير الحلول الرقمية الموجهة لذوي الاحتياجات الخاصة</li>
      </ul>
    `
  },

  {
    id: 'assistive_tech',
    keywords: [
      'التقنيات المساعده', 'ما هي التقنيات المساعده', 'تقنيات مساعده',
      'ايه هي التقنيات المساعده'
    ],
    allowDeepSearch: true,
    deepQuery: 'التقنيات المساعدة في التعليم لذوي الاحتياجات الخاصة',
    html: () => `
      <h3>التقنيات المساعدة</h3>
      <p>
        هي إحدى أهم المهارات التي يكتسبها خريج البرنامج، وتشمل الأدوات والبرمجيات
        التي تساعد ذوي الاحتياجات الخاصة على التعلم والتواصل والوصول إلى المعلومات
        بشكل أكثر سهولة واستقلالية.
      </p>
      <p class="not-found-note">هذا تعريف مختصر من قاعدة معلومات البرنامج. اضغط الزر أدناه لمزيد من التفاصيل عبر البحث.</p>
    `
  }
];


/* ============================================================
   3. UTILITY HELPERS
   ============================================================ */

// Escape user-provided text before ever inserting it as HTML (XSS safety)
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Normalize Arabic text so matching is forgiving of spelling variants:
// - strips tashkeel (diacritics)
// - unifies أ/إ/آ -> ا, ة -> ه, ى -> ي, ؤ/ئ -> ء forms simplified
// - removes punctuation and extra whitespace
function normalizeArabic(text){
  if (!text) return '';
  return text
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')      // remove diacritics/tatweel
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[؟!،.,؛:"'()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Generate a reasonably unique id (timestamp + random)
function generateId(){
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Format a timestamp into a short readable label
function formatTime(ts){
  const d = new Date(ts);
  return d.toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

// Build a short auto-title for a conversation from its first message
function buildTitleFromText(text){
  const trimmed = text.trim();
  if (trimmed.length <= 28) return trimmed;
  return trimmed.slice(0, 28) + '…';
}


/* ============================================================
   4. STORAGE LAYER (localStorage)
   ============================================================ */
const STORAGE_KEY_CONVERSATIONS = 'berry_conversations';
const STORAGE_KEY_CURRENT_ID = 'berry_current_conversation_id';

// Persist the full conversations array to localStorage
function saveConversation(){
  try{
    localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(state.conversations));
    localStorage.setItem(STORAGE_KEY_CURRENT_ID, state.currentConversationId || '');
  }catch(err){
    console.error('Failed to save conversations to localStorage:', err);
  }
}

// Load conversations + last active conversation id from localStorage
function loadConversation(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    const conversations = raw ? JSON.parse(raw) : [];
    const lastId = localStorage.getItem(STORAGE_KEY_CURRENT_ID) || null;
    return { conversations, lastId };
  }catch(err){
    console.error('Failed to load conversations from localStorage:', err);
    return { conversations: [], lastId: null };
  }
}


/* ============================================================
   5. STATE & DOM REFERENCES
   ============================================================ */
const state = {
  conversations: [],          // [{id, title, messages:[...], createdAt, updatedAt}]
  currentConversationId: null,
  isTyping: false
};

const dom = {};

function cacheDom(){
  dom.sidebar = document.getElementById('sidebar');
  dom.sidebarOverlay = document.getElementById('sidebarOverlay');
  dom.mobileToggle = document.getElementById('mobileToggle');
  dom.newChatBtn = document.getElementById('newChatBtn');
  dom.conversationsList = document.getElementById('conversationsList');
  dom.aboutBtn = document.getElementById('aboutBtn');
  dom.infoBtn = document.getElementById('infoBtn');
  dom.settingsBtn = document.getElementById('settingsBtn');

  dom.chatScroll = document.getElementById('chatScroll');
  dom.welcomeScreen = document.getElementById('welcomeScreen');
  dom.messages = document.getElementById('messages');
  dom.conversationTitle = document.getElementById('conversationTitle');

  dom.composerForm = document.getElementById('composerForm');
  dom.messageInput = document.getElementById('messageInput');
  dom.sendBtn = document.getElementById('sendBtn');

  dom.modalOverlay = document.getElementById('modalOverlay');
  dom.modal = document.getElementById('modal');
  dom.modalBody = document.getElementById('modalBody');
  dom.modalClose = document.getElementById('modalClose');

  dom.botMessageTemplate = document.getElementById('botMessageTemplate');
  dom.userMessageTemplate = document.getElementById('userMessageTemplate');
  dom.typingTemplate = document.getElementById('typingTemplate');
}


/* ============================================================
   6. RENDERING FUNCTIONS
   ============================================================ */

function getCurrentConversation(){
  return state.conversations.find(c => c.id === state.currentConversationId) || null;
}

// Show the welcome/empty state and hide the messages list
function showWelcomeScreen(){
  dom.welcomeScreen.style.display = 'block';
  dom.messages.style.display = 'none';
  dom.conversationTitle.textContent = 'محادثة جديدة';
}

function hideWelcomeScreen(){
  dom.welcomeScreen.style.display = 'none';
  dom.messages.style.display = 'flex';
}

function scrollToBottom(){
  requestAnimationFrame(() => {
    dom.chatScroll.scrollTop = dom.chatScroll.scrollHeight;
  });
}

// Render the sidebar list of previous conversations
function renderConversationsList(){
  dom.conversationsList.innerHTML = '';

  if (state.conversations.length === 0){
    const empty = document.createElement('div');
    empty.className = 'sidebar-empty-note';
    empty.textContent = 'لا توجد محادثات سابقة بعد';
    dom.conversationsList.appendChild(empty);
    return;
  }

  // Newest first
  const sorted = [...state.conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  sorted.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'conversation-item' + (conv.id === state.currentConversationId ? ' active' : '');

    const titleEl = document.createElement('span');
    titleEl.className = 'conv-title';
    titleEl.textContent = conv.title || 'محادثة بدون عنوان';
    titleEl.addEventListener('click', () => selectConversation(conv.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'conv-delete';
    deleteBtn.textContent = '✕';
    deleteBtn.setAttribute('aria-label', 'حذف المحادثة');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    });

    item.appendChild(titleEl);
    item.appendChild(deleteBtn);
    dom.conversationsList.appendChild(item);
  });
}

// Add a user message bubble to the DOM (and store it)
function addUserMessage(text, { persist = true } = {}){
  const node = dom.userMessageTemplate.content.cloneNode(true);
  const bubble = node.querySelector('.message-bubble');
  bubble.textContent = text; // textContent = safe against XSS, no HTML parsing
  dom.messages.appendChild(node);
  scrollToBottom();

  if (persist){
    const conv = getCurrentConversation();
    conv.messages.push({ id: generateId(), role: 'user', text, timestamp: Date.now() });
    conv.updatedAt = Date.now();
    if (conv.messages.length === 1){
      conv.title = buildTitleFromText(text);
    }
    saveConversation();
    renderConversationsList();
  }
}

// Add a bot message bubble to the DOM (and store it)
// html: trusted HTML string built by our own KB/search code (never raw user input)
// actions: array of action descriptors, e.g. [{type:'copy'}, {type:'search', query:'...'}]
function addBotMessage(html, actions = [], { persist = true } = {}){
  const node = dom.botMessageTemplate.content.cloneNode(true);
  const bubble = node.querySelector('.message-bubble');
  const actionsWrap = node.querySelector('.message-actions');

  bubble.innerHTML = html;
  renderMessageActions(actionsWrap, bubble, actions);

  dom.messages.appendChild(node);
  scrollToBottom();

  if (persist){
    const conv = getCurrentConversation();
    conv.messages.push({ id: generateId(), role: 'bot', html, actions, timestamp: Date.now() });
    conv.updatedAt = Date.now();
    saveConversation();
  }
}

// Build the action buttons (copy / retry / search more) under a bot bubble
function renderMessageActions(container, bubbleEl, actions){
  container.innerHTML = '';

  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.type = 'button';

    if (action.type === 'copy'){
      btn.className = 'action-btn';
      btn.textContent = '📋 نسخ';
      btn.addEventListener('click', () => copyBubbleText(bubbleEl, btn));
    }

    if (action.type === 'retry'){
      btn.className = 'action-btn';
      btn.textContent = '🔄 إعادة المحاولة';
      btn.addEventListener('click', () => {
        addUserMessage(action.query);
        handleUserQuery(action.query);
      });
    }

    if (action.type === 'search'){
      btn.className = 'action-btn action-search';
      btn.textContent = '🔎 البحث عن معلومات إضافية';
      btn.addEventListener('click', () => runSearchAction(action.query, btn));
    }

    if (action.type === 'more'){
      btn.className = 'action-btn action-search';
      btn.textContent = '🔎 أريد معرفة المزيد';
      btn.addEventListener('click', () => runSearchAction(action.query, btn));
    }

    container.appendChild(btn);
  });
}

// Copy the plain text of a bubble to the clipboard, with visual feedback
function copyBubbleText(bubbleEl, btn){
  const text = bubbleEl.innerText || bubbleEl.textContent || '';
  navigator.clipboard.writeText(text.trim())
    .then(() => {
      const original = btn.textContent;
      btn.textContent = '✅ تم النسخ';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1600);
    })
    .catch(() => {
      btn.textContent = '⚠️ تعذر النسخ';
    });
}

// Show the "بيري يكتب..." typing indicator
function showTyping(){
  hideTyping(); // avoid duplicates
  state.isTyping = true;
  const node = dom.typingTemplate.content.cloneNode(true);
  dom.messages.appendChild(node);
  scrollToBottom();
}

// Remove the typing indicator from the DOM
function hideTyping(){
  state.isTyping = false;
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}


/* ============================================================
   7. CORE CHAT LOGIC
   ============================================================ */

// Try to match the user's free-text question against the knowledge base.
// Returns the matching KB entry, or null if nothing matched confidently.
function findAnswer(userText){
  const normalizedInput = normalizeArabic(userText);
  if (!normalizedInput) return null;

  let bestMatch = null;
  let bestScore = 0;

  KNOWLEDGE_BASE.forEach(entry => {
    let score = 0;
    entry.keywords.forEach(keyword => {
      const normalizedKeyword = normalizeArabic(keyword);
      if (normalizedKeyword && normalizedInput.includes(normalizedKeyword)){
        // Longer/more specific keyword matches count more
        score += normalizedKeyword.length;
      }
    });
    if (score > bestScore){
      bestScore = score;
      bestMatch = entry;
    }
  });

  return bestMatch;
}

// Turn a KB match (or lack thereof) into a final {html, actions} response.
// This is the single place that decides what Berry "says" — it never
// invents program facts; everything comes from KNOWLEDGE_BASE.
async function generateResponse(userText){
  const match = findAnswer(userText);

  // Keep known program facts fast and deterministic.
  if (match){
    const actions = [{ type: 'copy' }];
    if (match.allowDeepSearch){
      actions.push({ type: 'more', query: userText });
    }
    return { html: match.html(), actions };
  }

  // Any question not covered by the local knowledge base is answered by Gemini.
  if (CONFIG.useRealAIAPI){
    const reply = await generateAIResponse(userText);
    return {
      html: formatAIResponse(reply),
      actions: [{ type: 'copy' }, { type: 'more', query: userText }]
    };
  }

  return {
    html: `<p class="not-found-note">لا أملك معلومات محددة عن هذا السؤال حاليًا.</p>`,
    actions: [{ type: 'retry', query: userText }]
  };
}

// Central handler: takes raw user text, shows typing, then responds.
// Used both for normal sends and for the "retry" action.
async function handleUserQuery(userText){
  showTyping();
  try{
    const response = await generateResponse(userText);
    hideTyping();
    addBotMessage(response.html, response.actions);
  }catch(err){
    hideTyping();
    console.error('AI response error:', err);
    addBotMessage(
      `<p class="not-found-note error-bubble-text">عزيزي طالب تكنولوجيا التعليم لذوي الاحتياجات الخاصة يوجد ضغط في الاسئلة حاليا .. حاول بعد قليل</p>`,
      [{ type: 'retry', query: userText }]
    );
  }
}

// Handle the composer form submit / send button
function sendMessage(){
  const text = dom.messageInput.value.trim();
  if (!text || state.isTyping) return;

  // Make sure we have an active conversation to write into
  if (!state.currentConversationId){
    createNewChat({ silent: true });
  }
  hideWelcomeScreen();

  addUserMessage(text);
  dom.messageInput.value = '';
  autoResizeTextarea();
  updateSendButtonState();

  handleUserQuery(text);
}


/* ============================================================
   8. GEMINI / "MORE" ACTION
   ------------------------------------------------------------
   All Gemini requests go through the local backend. The API key
   stays server-side in .env and is never shipped to the browser.
   ============================================================ */

function formatAIResponse(text){
  const safe = escapeHtml(String(text || '').trim());
  return safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

async function generateAIResponse(userText, { mode = 'answer' } = {}){
  const res = await fetch(CONFIG.aiApiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userText, mode })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `AI request failed (${res.status})`);
  if (!data.reply) throw new Error('Gemini returned an empty response');
  return data.reply;
}

// The "🔎 أريد معرفة المزيد" button asks Gemini directly for deeper details.
async function runSearchAction(query, triggerBtn){
  if (triggerBtn){
    triggerBtn.classList.add('action-loading');
    triggerBtn.textContent = '⏳ جارِ الحصول على التفاصيل...';
  }
  showTyping();

  try{
    const reply = await generateAIResponse(query, { mode: 'more' });
    hideTyping();
    addBotMessage(
      `<div class="search-block">
        <span class="search-title">🔎 مزيد من التفاصيل</span>
        <p>${formatAIResponse(reply)}</p>
      </div>`,
      [{ type: 'copy' }]
    );
  }catch(err){
    hideTyping();
    console.error('Gemini "more" error:', err);
    addBotMessage(
      `<p class="not-found-note error-bubble-text">تعذر الحصول على التفاصيل من قاعدة البيانات حاليًا. حاول مرة أخرى.</p>`,
      [{ type: 'retry', query }]
    );
  }finally{
    if (triggerBtn){
      triggerBtn.classList.remove('action-loading');
      triggerBtn.textContent = '🔎 أريد معرفة المزيد';
    }
  }
}

/* ============================================================
   9. CONVERSATION MANAGEMENT
   ============================================================ */

// Start a brand new conversation and show the welcome screen
function createNewChat({ silent = false } = {}){
  const conv = {
    id: generateId(),
    title: 'محادثة جديدة',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  state.conversations.push(conv);
  state.currentConversationId = conv.id;
  saveConversation();
  renderConversationsList();

  if (!silent){
    dom.messages.innerHTML = '';
    showWelcomeScreen();
    closeSidebarOnMobile();
  }
}

// Switch to an existing conversation and re-render its messages
function selectConversation(id){
  const conv = state.conversations.find(c => c.id === id);
  if (!conv) return;

  state.currentConversationId = id;
  saveConversation();
  renderConversationsList();
  renderConversationMessages(conv);
  closeSidebarOnMobile();
}

// Delete a conversation (with its messages) from storage + UI
function deleteConversation(id){
  state.conversations = state.conversations.filter(c => c.id !== id);

  if (state.currentConversationId === id){
    state.currentConversationId = null;
    dom.messages.innerHTML = '';
    showWelcomeScreen();
  }

  saveConversation();
  renderConversationsList();
}

// Rebuild the DOM for a given conversation's stored messages
function renderConversationMessages(conv){
  dom.messages.innerHTML = '';

  if (!conv || conv.messages.length === 0){
    showWelcomeScreen();
    return;
  }

  hideWelcomeScreen();
  dom.conversationTitle.textContent = conv.title || 'محادثة';

  conv.messages.forEach(msg => {
    if (msg.role === 'user'){
      addUserMessage(msg.text, { persist: false });
    } else {
      addBotMessage(msg.html, msg.actions || [], { persist: false });
    }
  });

  scrollToBottom();
}


/* ============================================================
   10. MODALS (About / Program info / Settings)
   ============================================================ */

function openModal(bodyHtml){
  dom.modalBody.innerHTML = bodyHtml;
  dom.modalOverlay.classList.add('open');
}

function closeModal(){
  dom.modalOverlay.classList.remove('open');
}

function renderAboutModal(){
  openModal(`
    <h2>ℹ️ عن البرنامج</h2>
    <p>
      برنامج إعداد أخصائي تكنولوجيا التعليم لذوي الاحتياجات الخاصة برنامج أكاديمي
      يهدف إلى إعداد كوادر متخصصة قادرة على توظيف التكنولوجيا والتقنيات المساعدة
      لخدمة التعليم والدمج التعليمي لذوي الاحتياجات الخاصة.
    </p>
    <p>
      "بيري" هو مساعدك الذكي للتعرف على تفاصيل هذا البرنامج: شروط الالتحاق، القبول،
      المهارات المكتسبة، مجالات العمل، وأهمية البرنامج لسوق العمل والمجتمع.
    </p>
  `);
}

function renderInfoModal(){
  openModal(`
    <h2>📚 معلومات البرنامج</h2>
    ${KNOWLEDGE_BASE
      .filter(entry => entry.id !== 'program_general')
      .map(entry => entry.html())
      .join('<hr style="border:none;border-top:1px solid var(--color-border);margin:14px 0">')}
  `);
}

function renderSettingsModal(){
  openModal(`
    <h2>⚙️ الإعدادات</h2>
    <div class="settings-row">
      <div>
        <div class="settings-row-label">مسح جميع المحادثات</div>
        <div class="settings-row-desc">سيتم حذف كل المحادثات المحفوظة محليًا في هذا المتصفح</div>
      </div>
      <button class="btn-danger" id="clearAllBtn">مسح الكل</button>
    </div>
    <div class="settings-row">
      <div>
        <div class="settings-row-label">حالة البحث الموسّع</div>
        <div class="settings-row-desc">${CONFIG.useRealSearchAPI ? 'متصل بخدمة بحث حقيقية' : 'وضع تجريبي (Mock) — بانتظار ربط Search API'}</div>
      </div>
    </div>
    <div class="settings-row">
      <div>
        <div class="settings-row-label">حالة الذكاء الاصطناعي</div>
        <div class="settings-row-desc">${CONFIG.useRealAIAPI ? 'متصل بخدمة AI حقيقية' : 'غير مفعّل — بانتظار ربط AI API عبر Backend'}</div>
      </div>
    </div>
  `);

  const clearBtn = document.getElementById('clearAllBtn');
  if (clearBtn){
    clearBtn.addEventListener('click', () => {
      if (confirm('هل أنت متأكد من حذف جميع المحادثات؟ لا يمكن التراجع عن هذا الإجراء.')){
        state.conversations = [];
        state.currentConversationId = null;
        saveConversation();
        renderConversationsList();
        dom.messages.innerHTML = '';
        showWelcomeScreen();
        closeModal();
      }
    });
  }
}


/* ============================================================
   11. TEXTAREA HELPERS
   ============================================================ */

function autoResizeTextarea(){
  dom.messageInput.style.height = 'auto';
  dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 160) + 'px';
}

function updateSendButtonState(){
  dom.sendBtn.disabled = dom.messageInput.value.trim().length === 0;
}


/* ============================================================
   12. SIDEBAR (mobile) HELPERS
   ============================================================ */

function toggleSidebar(){
  dom.sidebar.classList.toggle('open');
  dom.sidebarOverlay.classList.toggle('open');
}

function closeSidebarOnMobile(){
  if (window.innerWidth <= 768){
    dom.sidebar.classList.remove('open');
    dom.sidebarOverlay.classList.remove('open');
  }
}


/* ============================================================
   13. EVENT BINDINGS
   ============================================================ */

function bindEvents(){
  // Composer: submit on form submit (send button or Enter)
  dom.composerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  // Enter to send, Shift+Enter for newline
  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      sendMessage();
    }
  });

  dom.messageInput.addEventListener('input', () => {
    autoResizeTextarea();
    updateSendButtonState();
  });

  // Quick question buttons on the welcome screen
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const question = btn.getAttribute('data-question');
      dom.messageInput.value = question;
      sendMessage();
    });
  });

  // Sidebar: new chat
  dom.newChatBtn.addEventListener('click', () => createNewChat());

  // Sidebar footer: modals
  dom.aboutBtn.addEventListener('click', renderAboutModal);
  dom.infoBtn.addEventListener('click', renderInfoModal);
  dom.settingsBtn.addEventListener('click', renderSettingsModal);

  // Modal close (button, overlay click, Escape key)
  dom.modalClose.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Mobile sidebar toggle
  dom.mobileToggle.addEventListener('click', toggleSidebar);
  dom.sidebarOverlay.addEventListener('click', toggleSidebar);
}


/* ============================================================
   14. APP BOOTSTRAP
   ============================================================ */

function initApp(){
  cacheDom();
  bindEvents();

  const { conversations, lastId } = loadConversation();
  state.conversations = conversations;

  const lastConv = conversations.find(c => c.id === lastId);
  if (lastConv){
    state.currentConversationId = lastConv.id;
    renderConversationMessages(lastConv);
  } else {
    state.currentConversationId = null;
    showWelcomeScreen();
  }

  renderConversationsList();
  updateSendButtonState();
}

document.addEventListener('DOMContentLoaded', initApp);
