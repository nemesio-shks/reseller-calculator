import { t, getLang, setLang, applyTranslations, currencySymbols, getCategoryLabel, categoryLabels } from './i18n.js';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- IndexedDB storage for custom bg video/gif (local to this browser) ----------
const IDB_NAME = 'reseller_calc_media';
const IDB_STORE = 'bgMedia';

function openMediaDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveCustomBgMedia(key, blob) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadCustomBgMedia(key) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteCustomBgMedia(key) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function defaultProject(name) {
  return { id: uid(), name: name || 'Проект 1', currency: 'RUB', cars: [] };
}

function defaultState() {
  const p = defaultProject('Проект 1');
  return { activeId: p.id, projects: [p], theme: 'dark', bgImage: null, bgPos: { x: 0, y: 0, zoom: 100 }, bgType: 'video', bgFit: 'cover' };
}

let state = defaultState();
let currentUser = null;
let fb = null;
let saveTimer = null;
let activeCarIdForModal = null;
let selectedCarImage = null;
let activeCarIdForIconModal = null;

const authCard = document.getElementById('authCard');
const appContent = document.getElementById('appContent');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authError = document.getElementById('authError');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authSwitchText = document.getElementById('authSwitchText');
const authSwitchLink = document.getElementById('authSwitchLink');
const userEmailLabel = document.getElementById('userEmailLabel');
const logoutBtn = document.getElementById('logoutBtn');

const projectsTabs = document.getElementById('projectsTabs');
const addProjectBtn = document.getElementById('addProjectBtn');
const carForm = document.getElementById('carForm');
const historyBody = document.getElementById('historyBody');
const emptyMsg = document.getElementById('emptyMsg');
const totalSum = document.getElementById('totalSum');

const projectNameInput = document.getElementById('projectNameInput');
const saveProjectNameBtn = document.getElementById('saveProjectNameBtn');
const currencySelect = document.getElementById('currencySelect');
const notSoldYetCheckbox = document.getElementById('notSoldYet');
const sellPriceInput = document.getElementById('sellPrice');
const carCommentInput = document.getElementById('carComment');
const carNameInput = document.getElementById('carName');
const carSuggestions = document.getElementById('carSuggestions');
const buyPriceInputEl = document.getElementById('buyPrice');
const carPreview = document.getElementById('carPreview');
const carPreviewImg = document.getElementById('carPreviewImg');
const carPreviewName = document.getElementById('carPreviewName');

const carIconModal = document.getElementById('carIconModal');
const carIconViewport = document.getElementById('carIconViewport');
const carIconEditorImg = document.getElementById('carIconEditorImg');
const carIconZoomRange = document.getElementById('carIconZoomRange');
const carIconInput = document.getElementById('carIconInput');
const carIconResetBtn = document.getElementById('carIconResetBtn');
const carIconCancelBtn = document.getElementById('carIconCancelBtn');
const carIconSaveBtn = document.getElementById('carIconSaveBtn');

const langSelect = document.getElementById('langSelect');
const themeSelect = document.getElementById('themeSelect');
const bgInput = document.getElementById('bgInput');
const bgResetBtn = document.getElementById('bgResetBtn');
const bgLayer = document.getElementById('bgLayer');

const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const bgEditBtn = document.getElementById('bgEditBtn');

const bgEditorModal = document.getElementById('bgEditorModal');
const bgEditorViewport = document.getElementById('bgEditorViewport');
const bgEditorImg = document.getElementById('bgEditorImg');
const bgZoomRange = document.getElementById('bgZoomRange');
const bgEditorCancelBtn = document.getElementById('bgEditorCancelBtn');
const bgEditorSaveBtn = document.getElementById('bgEditorSaveBtn');

const bgParticles = document.getElementById('bgParticles');
const bgImageEl = document.getElementById('bgImageEl');
const bgVideoEl = document.getElementById('bgVideoEl');
const bgTypeSelect = document.getElementById('bgTypeSelect');
const bgFitSelect = document.getElementById('bgFitSelect');
const bgCustomVideoEl = document.getElementById('bgCustomVideoEl');
const bgCustomGifEl = document.getElementById('bgCustomGifEl');
const bgVideoInput = document.getElementById('bgVideoInput');
const bgVideoResetBtn = document.getElementById('bgVideoResetBtn');

const CUSTOM_BG_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const CUSTOM_BG_MAX_DURATION = 15; // seconds

const adjustModal = document.getElementById('adjustModal');
const adjustBody = document.getElementById('adjustBody');
const adjustForm = document.getElementById('adjustForm');
const adjustDesc = document.getElementById('adjustDesc');
const adjustAmount = document.getElementById('adjustAmount');
const commentsList = document.getElementById('commentsList');
const commentForm = document.getElementById('commentForm');
const commentInput = document.getElementById('commentInput');
const closeModalBtn = document.getElementById('closeModalBtn');

let isRegisterMode = false;

// ---------- Localization ----------
langSelect.value = getLang();
applyTranslations();

langSelect.addEventListener('change', () => {
  setLang(langSelect.value);
  renderAll();
});

// ---------- Number formatting with thousand separators ----------
function parseNumberInput(str) {
  if (typeof str !== 'string') return NaN;
  const cleaned = str.replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned);
}

function attachThousandsFormatting(input) {
  input.addEventListener('input', () => {
    const cursorFromEnd = input.value.length - input.selectionStart;
    let raw = input.value.replace(/[^\d.,-]/g, '');

    const isNegative = raw.startsWith('-');
    if (isNegative) raw = raw.slice(1);

    const sepIdx = raw.search(/[.,]/);
    let intPart = sepIdx === -1 ? raw : raw.slice(0, sepIdx);
    let fracPart = sepIdx === -1 ? '' : raw.slice(sepIdx + 1).replace(/[.,]/g, '');

    intPart = intPart.replace(/^0+(?=\d)/, '');
    const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    let formatted = groupedInt;
    if (sepIdx !== -1) formatted += ',' + fracPart;
    if (isNegative) formatted = '-' + formatted;

    input.value = formatted;
    const newPos = Math.max(0, formatted.length - cursorFromEnd);
    input.setSelectionRange(newPos, newPos);
  });
  input.addEventListener('blur', () => {
    const num = parseNumberInput(input.value);
    if (!isNaN(num)) {
      input.value = formatNumberPlain(num);
    }
  });
}

function formatNumberPlain(n) {
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

[document.getElementById('buyPrice'), sellPriceInput, adjustAmount].forEach(attachThousandsFormatting);

function formatMoney(n, currency) {
  const symbol = currencySymbols[currency] || currency;
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 }) + ' ' + symbol;
}

// ---------- Not sold yet toggle ----------
notSoldYetCheckbox.addEventListener('change', () => {
  sellPriceInput.disabled = notSoldYetCheckbox.checked;
  if (notSoldYetCheckbox.checked) sellPriceInput.value = '';
});

// ---------- Auth ----------
authSwitchLink.addEventListener('click', (e) => {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;
  authTitle.textContent = isRegisterMode ? t('registerTitle') : t('loginTitle');
  authSubmitBtn.textContent = isRegisterMode ? t('registerBtn') : t('loginBtn');
  authSwitchText.textContent = isRegisterMode ? t('haveAccount') : t('noAccount');
  authSwitchLink.textContent = isRegisterMode ? t('loginLink') : t('registerLink');
  authError.textContent = '';
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;

  if (!fb) {
    authError.textContent = 'Firebase ще не завантажився, спробуйте ще раз.';
    return;
  }

  try {
    if (isRegisterMode) {
      await fb.createUserWithEmailAndPassword(fb.auth, email, password);
    } else {
      await fb.signInWithEmailAndPassword(fb.auth, email, password);
    }
  } catch (err) {
    authError.textContent = translateAuthError(err.code);
  }
});

logoutBtn.addEventListener('click', async () => {
  await fb.signOut(fb.auth);
});

function translateAuthError(code) {
  const map = {
    'auth/email-already-in-use': 'Цей email вже зареєстрований.',
    'auth/invalid-email': 'Некоректний email.',
    'auth/weak-password': 'Пароль занадто слабкий (мін. 6 символів).',
    'auth/user-not-found': 'Користувача не знайдено.',
    'auth/wrong-password': 'Невірний пароль.',
    'auth/invalid-credential': 'Невірний email або пароль.'
  };
  return map[code] || 'Помилка: ' + code;
}

async function waitForFirebase() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.__firebase) {
        resolve(window.__firebase);
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

// ---------- State helpers ----------
function getActiveProject() {
  return state.projects.find(p => p.id === state.activeId) || state.projects[0];
}

function carIconBgPosition(iconPos) {
  if (!iconPos) return 'center center';
  // Approximate: convert pixel offset to a percentage shift around center for a small thumbnail
  const x = 50 - Math.max(-40, Math.min(40, (iconPos.x || 0) / 3));
  const y = 50 - Math.max(-40, Math.min(40, (iconPos.y || 0) / 3));
  return `${x}% ${y}%`;
}

function getCarProfit(car) {
  const adjTotal = (car.adjustments || []).reduce((s, a) => s + a.amount, 0);
  if (car.sellPrice == null) return null;
  return car.sellPrice - car.buyPrice + adjTotal;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveData, 400);
}

async function saveData() {
  if (!currentUser || !fb) return;
  try {
    const ref = fb.doc(fb.db, 'users', currentUser.uid);
    await fb.setDoc(ref, { state }, { merge: false });
  } catch (err) {
    console.error('Помилка збереження даних:', err);
    alert(t('saveError'));
  }
}

async function loadUserData() {
  const ref = fb.doc(fb.db, 'users', currentUser.uid);
  const snap = await fb.getDoc(ref);
  if (snap.exists() && snap.data().state && snap.data().state.projects && snap.data().state.projects.length) {
    state = snap.data().state;
    if (!state.theme) state.theme = 'dark';
    if (!state.bgPos) state.bgPos = { x: 0, y: 0, zoom: 100 };
    if (!state.bgType) state.bgType = 'video';
    if (!state.bgFit) state.bgFit = 'cover';
    state.projects.forEach(p => {
      if (!p.currency) p.currency = 'RUB';
      p.cars.forEach(c => {
        if (!c.adjustments) c.adjustments = [];
        if (!c.comments) c.comments = [];
        if (c.image === undefined) c.image = null;
        if (!c.iconPos) c.iconPos = { x: 0, y: 0, zoom: 100 };
      });
    });
  } else {
    state = defaultState();
    await saveData();
  }
}

// ---------- Theme ----------
function applyTheme() {
  document.body.setAttribute('data-theme', state.theme || 'dark');
  themeSelect.value = state.theme || 'dark';
}

themeSelect.addEventListener('change', () => {
  state.theme = themeSelect.value;
  applyTheme();
  scheduleSave();
});

// ---------- Background image/video positioning helper ----------
function positionMediaElement(el, naturalW, naturalH, pos, fit) {
  if (!naturalW || !naturalH) return;
  const viewportRect = bgLayer.getBoundingClientRect();
  const baseScale = fit === 'contain'
    ? Math.min(viewportRect.width / naturalW, viewportRect.height / naturalH)
    : Math.max(viewportRect.width / naturalW, viewportRect.height / naturalH);
  const scale = baseScale * (pos.zoom / 100);
  el.style.width = naturalW + 'px';
  el.style.height = naturalH + 'px';
  el.style.left = '50%';
  el.style.top = '50%';
  el.style.transform = `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})`;
}

let bgLayerResizeHandler = () => {};
let currentCustomVideoUrl = null;

// ---------- Background image ----------
function applyBackground() {
  const bgType = state.bgType || 'video';
  const fit = state.bgFit || 'cover';
  bgTypeSelect.value = bgType;
  bgFitSelect.value = fit;

  const useDefaultVideo = bgType === 'video';
  const useImage = bgType === 'image';
  const useCustomVideo = bgType === 'custom-video';

  bgVideoEl.classList.toggle('hidden', !useDefaultVideo);
  if (useDefaultVideo) bgVideoEl.play().catch(() => {}); else bgVideoEl.pause();

  bgImageEl.classList.toggle('hidden', !(useImage && state.bgImage));
  bgLayer.classList.toggle('has-custom-bg', useImage || useCustomVideo);

  window.removeEventListener('resize', bgLayerResizeHandler);

  if (useImage && state.bgImage) {
    bgImageEl.src = state.bgImage;
    const pos = state.bgPos || { x: 0, y: 0, zoom: 100 };
    const positionImg = () => positionMediaElement(bgImageEl, bgImageEl.naturalWidth, bgImageEl.naturalHeight, pos, fit);
    if (bgImageEl.complete && bgImageEl.naturalWidth) positionImg();
    else bgImageEl.onload = positionImg;
    bgLayerResizeHandler = positionImg;
    window.addEventListener('resize', bgLayerResizeHandler);
  } else {
    bgImageEl.removeAttribute('src');
  }

  bgCustomVideoEl.classList.add('hidden');
  bgCustomGifEl.classList.add('hidden');
  bgCustomVideoEl.pause();

  if (useCustomVideo) {
    loadCustomBgMedia('bgCustomFile').then(stored => {
      if (!stored || state.bgType !== 'custom-video') return;
      if (currentCustomVideoUrl) {
        URL.revokeObjectURL(currentCustomVideoUrl);
        currentCustomVideoUrl = null;
      }
      const url = URL.createObjectURL(stored.blob);
      currentCustomVideoUrl = url;
      const pos = state.bgPos || { x: 0, y: 0, zoom: 100 };

      if (stored.mimeType === 'image/gif') {
        bgCustomGifEl.src = url;
        bgCustomGifEl.classList.remove('hidden');
        const positionGif = () => positionMediaElement(bgCustomGifEl, bgCustomGifEl.naturalWidth, bgCustomGifEl.naturalHeight, pos, fit);
        bgCustomGifEl.onload = positionGif;
        bgLayerResizeHandler = positionGif;
      } else {
        bgCustomVideoEl.src = url;
        bgCustomVideoEl.classList.remove('hidden');
        bgCustomVideoEl.play().catch(() => {});
        const positionVid = () => positionMediaElement(bgCustomVideoEl, bgCustomVideoEl.videoWidth, bgCustomVideoEl.videoHeight, pos, fit);
        bgCustomVideoEl.onloadedmetadata = positionVid;
        bgLayerResizeHandler = positionVid;
      }
      window.addEventListener('resize', bgLayerResizeHandler);
    });
  }
}

bgTypeSelect.addEventListener('change', () => {
  state.bgType = bgTypeSelect.value;
  applyBackground();
  scheduleSave();
});

bgFitSelect.addEventListener('change', () => {
  state.bgFit = bgFitSelect.value;
  applyBackground();
  scheduleSave();
});

// ---------- Custom video/GIF background upload ----------
function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => reject(new Error('cannot read video metadata'));
    video.src = URL.createObjectURL(file);
  });
}

bgVideoInput.addEventListener('change', async () => {
  const file = bgVideoInput.files[0];
  if (!file) return;

  const allowedTypes = ['video/mp4', 'video/webm', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    alert(t('bgVideoWrongType'));
    bgVideoInput.value = '';
    return;
  }

  if (file.size > CUSTOM_BG_MAX_BYTES) {
    alert(t('bgVideoTooLarge'));
    bgVideoInput.value = '';
    return;
  }

  if (file.type !== 'image/gif') {
    try {
      const duration = await getVideoDuration(file);
      if (duration > CUSTOM_BG_MAX_DURATION) {
        alert(t('bgVideoTooLong'));
        bgVideoInput.value = '';
        return;
      }
    } catch (err) {
      console.error(err);
    }
  }

  try {
    await saveCustomBgMedia('bgCustomFile', { blob: file, mimeType: file.type });
    state.bgType = 'custom-video';
    state.bgPos = { x: 0, y: 0, zoom: 100 };
    applyBackground();
    scheduleSave();
  } catch (err) {
    console.error('Помилка збереження медіа:', err);
    alert(t('imageProcessError'));
  }
  bgVideoInput.value = '';
});

bgVideoResetBtn.addEventListener('click', async () => {
  try {
    await deleteCustomBgMedia('bgCustomFile');
  } catch (err) {
    console.error(err);
  }
  if (state.bgType === 'custom-video') {
    state.bgType = 'video';
  }
  applyBackground();
  scheduleSave();
});

function compressImageFile(file, maxDimension, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDimension || h > maxDimension) {
          if (w >= h) {
            h = Math.round(h * (maxDimension / w));
            w = maxDimension;
          } else {
            w = Math.round(w * (maxDimension / h));
            h = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

bgInput.addEventListener('change', async () => {
  const file = bgInput.files[0];
  if (!file) return;
  try {
    const compressed = await compressImageFile(file, 1600, 0.75);
    state.bgImage = compressed;
    state.bgPos = { x: 0, y: 0, zoom: 100 };
    state.bgType = 'image';
    applyBackground();
    scheduleSave();
    openBgEditor();
  } catch (err) {
    console.error('Помилка обробки зображення:', err);
    alert(t('imageProcessError'));
  }
  bgInput.value = '';
});

bgResetBtn.addEventListener('click', () => {
  state.bgImage = null;
  state.bgPos = { x: 0, y: 0, zoom: 100 };
  applyBackground();
  scheduleSave();
});

// ---------- Settings modal ----------
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});
closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.classList.add('hidden');
});

// ---------- Background editor (drag + zoom, preserves original aspect ratio) ----------
let bgDragState = null;
let bgEditorBaseScale = 1;
let bgEditorOffsetX = 0;
let bgEditorOffsetY = 0;

function openBgEditor() {
  if (!state.bgImage) return;
  const pos = state.bgPos || { x: 0, y: 0, zoom: 100 };

  bgEditorImg.onload = () => {
    const viewportRect = bgEditorViewport.getBoundingClientRect();
    const naturalW = bgEditorImg.naturalWidth;
    const naturalH = bgEditorImg.naturalHeight;

    // base scale so the image fits the viewport (cover or contain) while keeping aspect ratio
    const fit = state.bgFit || 'cover';
    bgEditorBaseScale = fit === 'contain'
      ? Math.min(viewportRect.width / naturalW, viewportRect.height / naturalH)
      : Math.max(viewportRect.width / naturalW, viewportRect.height / naturalH);

    bgEditorImg.style.width = naturalW + 'px';
    bgEditorImg.style.height = naturalH + 'px';

    bgZoomRange.value = pos.zoom;
    bgEditorOffsetX = pos.x || 0;
    bgEditorOffsetY = pos.y || 0;
    updateBgEditorTransform();
  };
  bgEditorImg.src = state.bgImage;

  bgEditorModal.classList.remove('hidden');
}

function updateBgEditorTransform() {
  const zoomFactor = parseFloat(bgZoomRange.value) / 100;
  const scale = bgEditorBaseScale * zoomFactor;
  bgEditorImg.style.transform = `translate(-50%, -50%) translate(${bgEditorOffsetX}px, ${bgEditorOffsetY}px) scale(${scale})`;
  bgEditorImg.style.left = '50%';
  bgEditorImg.style.top = '50%';
}

bgEditBtn.addEventListener('click', () => {
  if (!state.bgImage) {
    bgInput.click();
    return;
  }
  openBgEditor();
});

bgEditorCancelBtn.addEventListener('click', () => {
  bgEditorModal.classList.add('hidden');
});

bgEditorModal.addEventListener('click', (e) => {
  if (e.target === bgEditorModal) bgEditorModal.classList.add('hidden');
});

bgEditorSaveBtn.addEventListener('click', () => {
  const zoom = parseFloat(bgZoomRange.value);
  state.bgPos = { x: bgEditorOffsetX, y: bgEditorOffsetY, zoom };
  applyBackground();
  scheduleSave();
  bgEditorModal.classList.add('hidden');
});

bgZoomRange.addEventListener('input', () => {
  updateBgEditorTransform();
});

bgEditorViewport.addEventListener('mousedown', (e) => {
  e.preventDefault();
  bgDragState = {
    startX: e.clientX,
    startY: e.clientY,
    startOffsetX: bgEditorOffsetX,
    startOffsetY: bgEditorOffsetY
  };
});

window.addEventListener('mousemove', (e) => {
  if (!bgDragState) return;
  bgEditorOffsetX = bgDragState.startOffsetX + (e.clientX - bgDragState.startX);
  bgEditorOffsetY = bgDragState.startOffsetY + (e.clientY - bgDragState.startY);
  updateBgEditorTransform();
});

window.addEventListener('mouseup', () => {
  bgDragState = null;
});

// touch support
bgEditorViewport.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  bgDragState = {
    startX: touch.clientX,
    startY: touch.clientY,
    startOffsetX: bgEditorOffsetX,
    startOffsetY: bgEditorOffsetY
  };
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!bgDragState) return;
  const touch = e.touches[0];
  bgEditorOffsetX = bgDragState.startOffsetX + (touch.clientX - bgDragState.startX);
  bgEditorOffsetY = bgDragState.startOffsetY + (touch.clientY - bgDragState.startY);
  updateBgEditorTransform();
}, { passive: true });

window.addEventListener('touchend', () => {
  bgDragState = null;
});

// ---------- Project name & currency ----------
saveProjectNameBtn.addEventListener('click', () => {
  const project = getActiveProject();
  const name = projectNameInput.value.trim();
  if (name) {
    project.name = name;
    scheduleSave();
    renderTabs();
  }
});

currencySelect.addEventListener('change', () => {
  const project = getActiveProject();
  project.currency = currencySelect.value;
  scheduleSave();
  renderHistory();
});

function renderProjectHeader() {
  const project = getActiveProject();
  projectNameInput.value = project.name;
  currencySelect.value = project.currency || 'RUB';
}

// ---------- Tabs ----------
function renderTabs() {
  projectsTabs.innerHTML = '';
  state.projects.forEach(p => {
    const tab = document.createElement('div');
    tab.className = 'project-tab' + (p.id === state.activeId ? ' active' : '');
    tab.innerHTML = `<span>${escapeHtml(p.name)}</span>` +
      (state.projects.length > 1 ? '<span class="del-project">×</span>' : '') +
      (p.id === state.activeId ? '<img src="assets/radmirlogo.png" class="tab-emblem" alt="">' : '');
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('del-project')) {
        e.stopPropagation();
        deleteProject(p.id);
        return;
      }
      if (p.id === state.activeId) return;
      animateTabSwitch(tab, () => {
        state.activeId = p.id;
        scheduleSave();
        renderAll();
      });
    });
    projectsTabs.appendChild(tab);
  });
}

function animateTabSwitch(targetTab, callback) {
  const flyingLogo = document.createElement('img');
  flyingLogo.src = 'assets/radmirlogo.png';
  flyingLogo.className = 'flying-emblem';

  const fromRect = projectsTabs.querySelector('.project-tab.active') || projectsTabs.firstElementChild;
  const startRect = (fromRect || targetTab).getBoundingClientRect();
  const endRect = targetTab.getBoundingClientRect();

  flyingLogo.style.left = startRect.left + startRect.width / 2 - 12 + 'px';
  flyingLogo.style.top = startRect.top + startRect.height / 2 - 12 + 'px';
  document.body.appendChild(flyingLogo);

  requestAnimationFrame(() => {
    flyingLogo.style.transform = `translate(${endRect.left - startRect.left}px, ${endRect.top - startRect.top}px) scale(1.4) rotate(360deg)`;
    flyingLogo.style.opacity = '0';
  });

  const mainCard = document.querySelector('main');
  if (mainCard) {
    mainCard.classList.add('tab-fade-out');
  }

  setTimeout(() => {
    flyingLogo.remove();
    callback();
    if (mainCard) {
      mainCard.classList.remove('tab-fade-out');
      mainCard.classList.add('tab-fade-in');
      setTimeout(() => mainCard.classList.remove('tab-fade-in'), 300);
    }
  }, 380);
}

// ---------- Car icon editor (per-car, drag + zoom, custom photo upload) ----------
let carIconDragState = null;
let carIconBaseScale = 1;
let carIconOffsetX = 0;
let carIconOffsetY = 0;

function getIconModalCar() {
  const project = getActiveProject();
  return project.cars.find(c => c.id === activeCarIdForIconModal);
}

function openCarIconModal(carId) {
  activeCarIdForIconModal = carId;
  const car = getIconModalCar();
  if (!car) return;

  if (!car.image) {
    // no image yet — go straight to file picker
    carIconInput.click();
    return;
  }

  loadCarIconIntoEditor(car.image, car.iconPos || { x: 0, y: 0, zoom: 100 });
  carIconModal.classList.remove('hidden');
}

function loadCarIconIntoEditor(imageSrc, pos) {
  carIconEditorImg.onload = () => {
    const viewportRect = carIconViewport.getBoundingClientRect();
    const naturalW = carIconEditorImg.naturalWidth;
    const naturalH = carIconEditorImg.naturalHeight;
    carIconBaseScale = Math.max(viewportRect.width / naturalW, viewportRect.height / naturalH);

    carIconEditorImg.style.width = naturalW + 'px';
    carIconEditorImg.style.height = naturalH + 'px';

    carIconZoomRange.value = pos.zoom;
    carIconOffsetX = pos.x || 0;
    carIconOffsetY = pos.y || 0;
    updateCarIconTransform();
  };
  carIconEditorImg.src = imageSrc;
}

function updateCarIconTransform() {
  const zoomFactor = parseFloat(carIconZoomRange.value) / 100;
  const scale = carIconBaseScale * zoomFactor;
  carIconEditorImg.style.left = '50%';
  carIconEditorImg.style.top = '50%';
  carIconEditorImg.style.transform = `translate(-50%, -50%) translate(${carIconOffsetX}px, ${carIconOffsetY}px) scale(${scale})`;
}

carIconInput.addEventListener('change', async () => {
  const file = carIconInput.files[0];
  if (!file) return;
  const car = getIconModalCar();
  if (!car) return;

  try {
    const compressed = await compressImageFile(file, 800, 0.8);
    car.image = compressed;
    car.iconPos = { x: 0, y: 0, zoom: 100 };
    scheduleSave();
    loadCarIconIntoEditor(car.image, car.iconPos);
    carIconModal.classList.remove('hidden');
    renderHistory();
  } catch (err) {
    console.error('Помилка обробки зображення іконки:', err);
    alert(t('imageProcessError'));
  }
  carIconInput.value = '';
});

carIconResetBtn.addEventListener('click', () => {
  const car = getIconModalCar();
  if (!car) return;
  car.image = null;
  car.iconPos = { x: 0, y: 0, zoom: 100 };
  scheduleSave();
  carIconModal.classList.add('hidden');
  renderHistory();
});

carIconCancelBtn.addEventListener('click', () => {
  carIconModal.classList.add('hidden');
});

carIconModal.addEventListener('click', (e) => {
  if (e.target === carIconModal) carIconModal.classList.add('hidden');
});

carIconSaveBtn.addEventListener('click', () => {
  const car = getIconModalCar();
  if (!car) return;
  const zoom = parseFloat(carIconZoomRange.value);
  car.iconPos = { x: carIconOffsetX, y: carIconOffsetY, zoom };
  scheduleSave();
  carIconModal.classList.add('hidden');
  renderHistory();
});

carIconZoomRange.addEventListener('input', () => {
  updateCarIconTransform();
});

carIconViewport.addEventListener('mousedown', (e) => {
  e.preventDefault();
  carIconDragState = {
    startX: e.clientX,
    startY: e.clientY,
    startOffsetX: carIconOffsetX,
    startOffsetY: carIconOffsetY
  };
});

window.addEventListener('mousemove', (e) => {
  if (!carIconDragState) return;
  carIconOffsetX = carIconDragState.startOffsetX + (e.clientX - carIconDragState.startX);
  carIconOffsetY = carIconDragState.startOffsetY + (e.clientY - carIconDragState.startY);
  updateCarIconTransform();
});

window.addEventListener('mouseup', () => {
  carIconDragState = null;
});

carIconViewport.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  carIconDragState = {
    startX: touch.clientX,
    startY: touch.clientY,
    startOffsetX: carIconOffsetX,
    startOffsetY: carIconOffsetY
  };
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!carIconDragState) return;
  const touch = e.touches[0];
  carIconOffsetX = carIconDragState.startOffsetX + (touch.clientX - carIconDragState.startX);
  carIconOffsetY = carIconDragState.startOffsetY + (touch.clientY - carIconDragState.startY);
  updateCarIconTransform();
}, { passive: true });

window.addEventListener('touchend', () => {
  carIconDragState = null;
});

function deleteProject(id) {
  if (state.projects.length <= 1) return;
  if (!confirm(t('deleteProjectConfirm'))) return;
  state.projects = state.projects.filter(p => p.id !== id);
  if (state.activeId === id) {
    state.activeId = state.projects[0].id;
  }
  scheduleSave();
  renderAll();
}

addProjectBtn.addEventListener('click', () => {
  const name = prompt(t('newProjectPrompt'), 'Проект ' + (state.projects.length + 1));
  if (!name) return;
  const newProject = defaultProject(name.trim());
  state.projects.push(newProject);
  state.activeId = newProject.id;
  scheduleSave();
  renderAll();
});

// ---------- History rendering ----------
function renderHistory() {
  const project = getActiveProject();
  historyBody.innerHTML = '';

  emptyMsg.style.display = project.cars.length ? 'none' : 'block';

  [...project.cars].reverse().forEach(car => {
    const profit = getCarProfit(car);
    const adjTotal = (car.adjustments || []).reduce((s, a) => s + a.amount, 0);
    const totalCost = car.buyPrice - adjTotal;
    const isSold = car.sellPrice != null;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="car-icon-cell">
        ${car.image
          ? `<div class="car-history-icon" data-id="${car.id}" style="background-image:url('${car.image}'); background-position:${carIconBgPosition(car.iconPos)}; background-size:${(car.iconPos && car.iconPos.zoom) || 100}%;"></div>`
          : `<span class="car-history-icon-empty" data-id="${car.id}" title="${t('carIconEditorTitle')}">➕</span>`
        }
      </td>
      <td>${escapeHtml(car.name)}${car.comment ? `<div class="car-subcomment">${escapeHtml(car.comment)}</div>` : ''}</td>
      <td>${formatMoney(car.buyPrice, project.currency)}</td>
      <td>${isSold ? formatMoney(car.sellPrice, project.currency) : '—'}</td>
      <td>${adjTotal ? (adjTotal >= 0 ? '+' : '') + formatMoney(adjTotal, project.currency) : '—'} <span class="link-btn" data-id="${car.id}" data-action="adjust">${t('editComment')}</span></td>
      <td class="total-cost-cell">${formatMoney(totalCost, project.currency)}</td>
      <td class="${profit == null ? '' : (profit >= 0 ? 'profit-pos' : 'profit-neg')}">${profit == null ? '—' : (profit >= 0 ? '+' : '') + formatMoney(profit, project.currency)}</td>
      <td>
        ${isSold
          ? `<span class="status-badge status-sold">${t('statusSold')}</span>`
          : `<span class="status-badge status-notsold">${t('statusNotSold')}</span>
             <div class="inline-sell-row">
               <input type="text" inputmode="decimal" class="inline-sell-input" data-id="${car.id}" placeholder="${t('sellPricePlaceholder')}">
               <button class="link-btn inline-sell-confirm" data-id="${car.id}" data-action="marksold">${t('confirmSaleBtn')}</button>
             </div>`
        }
      </td>
      <td><span class="del-row" data-id="${car.id}" data-action="delete">✕</span></td>
    `;
    historyBody.appendChild(tr);
  });

  historyBody.querySelectorAll('.inline-sell-input').forEach(attachThousandsFormatting);

  historyBody.querySelectorAll('.car-history-icon, .car-history-icon-empty').forEach(el => {
    const id = el.getAttribute('data-id');
    const car = project.cars.find(c => c.id === id);

    el.addEventListener('click', () => {
      openCarIconModal(id);
    });

    if (car && car.image) {
      el.addEventListener('mouseenter', (e) => {
        carPreviewImg.src = car.image;
        carPreviewName.textContent = car.name;
        carPreview.classList.remove('hidden');
        positionCarPreview(e.clientX, e.clientY);
      });
      el.addEventListener('mousemove', (e) => {
        positionCarPreview(e.clientX, e.clientY);
      });
      el.addEventListener('mouseleave', () => {
        carPreview.classList.add('hidden');
      });
    }
  });

  historyBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm(t('deleteCarConfirm'))) return;
      const id = btn.getAttribute('data-id');
      project.cars = project.cars.filter(c => c.id !== id);
      scheduleSave();
      renderAll();
    });
  });

  historyBody.querySelectorAll('[data-action="marksold"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const car = project.cars.find(c => c.id === id);
      const input = historyBody.querySelector(`.inline-sell-input[data-id="${id}"]`);
      if (!input) return;
      const price = parseNumberInput(input.value);
      if (isNaN(price)) {
        input.focus();
        return;
      }
      car.sellPrice = price;
      scheduleSave();
      renderAll();
    });
  });

  historyBody.querySelectorAll('[data-action="adjust"]').forEach(btn => {
    btn.addEventListener('click', () => {
      openAdjustModal(btn.getAttribute('data-id'));
    });
  });

  const grandTotal = project.cars.reduce((sum, c) => {
    const p = getCarProfit(c);
    return sum + (p || 0);
  }, 0);
  totalSum.textContent = (grandTotal >= 0 ? '+' : '') + formatMoney(grandTotal, project.currency);
  totalSum.style.color = grandTotal >= 0 ? 'var(--profit-pos)' : 'var(--profit-neg)';
}

// ---------- Adjustments & comments modal ----------
function openAdjustModal(carId) {
  activeCarIdForModal = carId;
  adjustModal.classList.remove('hidden');
  renderModal();
}

function closeAdjustModal() {
  adjustModal.classList.add('hidden');
  activeCarIdForModal = null;
}

closeModalBtn.addEventListener('click', closeAdjustModal);
adjustModal.addEventListener('click', (e) => {
  if (e.target === adjustModal) closeAdjustModal();
});

function getActiveModalCar() {
  const project = getActiveProject();
  return project.cars.find(c => c.id === activeCarIdForModal);
}

function renderModal() {
  const car = getActiveModalCar();
  if (!car) return;
  const project = getActiveProject();

  adjustBody.innerHTML = '';
  (car.adjustments || []).forEach((adj, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(adj.desc)}</td>
      <td class="${adj.amount >= 0 ? 'profit-pos' : 'profit-neg'}">${adj.amount >= 0 ? '+' : ''}${formatMoney(adj.amount, project.currency)}</td>
      <td><span class="del-row" data-idx="${idx}">✕</span></td>
    `;
    adjustBody.appendChild(tr);
  });

  adjustBody.querySelectorAll('.del-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      car.adjustments.splice(idx, 1);
      scheduleSave();
      renderModal();
      renderHistory();
    });
  });

  commentsList.innerHTML = '';
  (car.comments || []).forEach((c, idx) => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `<span>${escapeHtml(c)}</span><span class="del-row" data-idx="${idx}">✕</span>`;
    commentsList.appendChild(div);
  });
  commentsList.querySelectorAll('.del-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      car.comments.splice(idx, 1);
      scheduleSave();
      renderModal();
    });
  });
}

adjustForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const car = getActiveModalCar();
  if (!car) return;
  const desc = adjustDesc.value.trim();
  const amount = parseNumberInput(adjustAmount.value);
  if (!desc || isNaN(amount)) return;
  if (!car.adjustments) car.adjustments = [];
  car.adjustments.push({ desc, amount });
  scheduleSave();
  adjustForm.reset();
  renderModal();
  renderHistory();
});

commentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const car = getActiveModalCar();
  if (!car) return;
  const text = commentInput.value.trim();
  if (!text) return;
  if (!car.comments) car.comments = [];
  car.comments.push(text);
  scheduleSave();
  commentForm.reset();
  renderModal();
});

// ---------- Add car form ----------
carForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('carName').value.trim();
  const buyPrice = parseNumberInput(document.getElementById('buyPrice').value);
  const comment = carCommentInput.value.trim();
  const notSold = notSoldYetCheckbox.checked;
  const sellPrice = notSold ? null : parseNumberInput(sellPriceInput.value);

  if (!name || isNaN(buyPrice)) return;
  if (!notSold && isNaN(sellPrice)) return;

  const project = getActiveProject();
  project.cars.push({
    id: uid(),
    name,
    buyPrice,
    sellPrice: notSold ? null : sellPrice,
    comment,
    adjustments: [],
    comments: [],
    image: selectedCarImage || null,
    iconPos: { x: 0, y: 0, zoom: 100 }
  });
  scheduleSave();
  carForm.reset();
  sellPriceInput.disabled = false;
  selectedCarImage = null;
  renderAll();
});

// ---------- Render all ----------
function renderAll() {
  applyTheme();
  applyBackground();
  renderTabs();
  renderProjectHeader();
  renderHistory();
}

// ---------- Animated background particles ----------
function initParticles() {
  const count = 28;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    const size = 2 + Math.random() * 4;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (12 + Math.random() * 18) + 's';
    p.style.animationDelay = (Math.random() * 20) + 's';
    bgParticles.appendChild(p);
  }
}
initParticles();

// ---------- Car name autocomplete (from CARS_DB) ----------
let carSuggestionIndex = -1;
let currentSuggestions = [];

function normalizeSearchStr(s) {
  return (s || '').toLowerCase().trim();
}

// ---------- Cyrillic <-> Latin transliteration for search matching ----------
const CYR_TO_LAT_MAP = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ґ': 'g', 'д': 'd',
  'е': 'e', 'є': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i',
  'і': 'i', 'ї': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh',
  'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
};

function transliterateToLatin(str) {
  return (str || '').toLowerCase().split('').map(ch => {
    if (ch in CYR_TO_LAT_MAP) return CYR_TO_LAT_MAP[ch];
    return ch;
  }).join('');
}

function normalizeForSearch(str) {
  // produce a latin-only, lowercase, transliterated string for loose comparison
  return transliterateToLatin(str).replace(/[^a-z0-9]/g, '');
}

// Known brand/model name aliases (cyrillic phonetic spelling -> latin spelling used in the DB)
const CAR_NAME_ALIASES = [
  ['бмв', 'bmw'], ['мерседес', 'mercedes'], ['мерс', 'merc'], ['ауди', 'audi'],
  ['фольксваген', 'volkswagen'], ['фольцваген', 'volkswagen'], ['вольво', 'volvo'],
  ['тойота', 'toyota'], ['хонда', 'honda'], ['ниссан', 'nissan'], ['нісан', 'nissan'],
  ['мазда', 'mazda'], ['субару', 'subaru'], ['лексус', 'lexus'], ['форд', 'ford'],
  ['шевроле', 'chevrolet'], ['додж', 'dodge'], ['крайслер', 'chrysler'], ['джип', 'jeep'],
  ['ламборгини', 'lamborghini'], ['ламборджини', 'lamborghini'], ['феррари', 'ferrari'],
  ['порше', 'porsche'], ['бентли', 'bentley'], ['роллс ройс', 'rollsroyce'], ['ролс ройс', 'rollsroyce'],
  ['майбах', 'maybach'], ['бугатти', 'bugatti'], ['мазерати', 'maserati'], ['астон мартин', 'astonmartin'],
  ['ягуар', 'jaguar'], ['ленд ровер', 'landrover'], ['рендж ровер', 'rangerover'], ['инфинити', 'infiniti'],
  ['киа', 'kia'], ['хендай', 'hyundai'], ['хёндай', 'hyundai'], ['шкода', 'skoda'], ['сеат', 'seat'],
  ['опель', 'opel'], ['пежо', 'peugeot'], ['ситроен', 'citroen'], ['рено', 'renault'], ['фиат', 'fiat'],
  ['альфа ромео', 'alfaromeo'], ['лада', 'lada'], ['ваз', 'vaz'], ['газ', 'gaz'], ['уаз', 'uaz'],
  ['зил', 'zil'], ['москвич', 'moskvich'], ['камаз', 'kamaz'], ['джили', 'geely'], ['чери', 'chery'],
  ['татра', 'tatra'], ['скания', 'scania'], ['ман', 'man'], ['вольво трак', 'volvotruck'],
  ['макларен', 'mclaren'], ['пагани', 'pagani'], ['кёнигсегг', 'koenigsegg'], ['кенигсегг', 'koenigsegg'],
  ['тесла', 'tesla'], ['кадиллак', 'cadillac'], ['бьюик', 'buick'], ['понтиак', 'pontiac'],
  ['хаммер', 'hummer'], ['гмс', 'gmc'], ['линкольн', 'lincoln'], ['акура', 'acura'], ['датсун', 'datsun'],
  ['мицубиси', 'mitsubishi'], ['мицубиши', 'mitsubishi'], ['сузуки', 'suzuki'], ['исузу', 'isuzu'],
  ['дайхатсу', 'daihatsu'], ['саманд', 'samand'], ['заз', 'zaz'], ['зaз', 'zaz']
];

function applyCarNameAliases(str) {
  let result = normalizeSearchStr(str);
  CAR_NAME_ALIASES.forEach(([cyr, lat]) => {
    if (result.includes(cyr)) {
      result = result.split(cyr).join(lat);
    }
  });
  return result;
}

function positionCarPreview(clientX, clientY) {
  const offset = 20;
  const previewWidth = carPreview.offsetWidth || 340;
  const previewHeight = carPreview.offsetHeight || 260;

  let left = clientX + offset;
  let top = clientY - previewHeight / 2;

  if (left + previewWidth > window.innerWidth) {
    left = clientX - previewWidth - offset;
  }
  if (top < 0) top = 8;
  if (top + previewHeight > window.innerHeight) top = window.innerHeight - previewHeight - 8;

  carPreview.style.left = left + 'px';
  carPreview.style.top = top + 'px';
}

function renderCarSuggestions(query) {
  const list = window.CARS_FLAT_LIST || [];
  const q = normalizeSearchStr(query);
  if (!q) {
    carSuggestions.classList.add('hidden');
    carSuggestions.innerHTML = '';
    currentSuggestions = [];
    return;
  }

  const qNormalized = normalizeForSearch(q);
  const qAliased = applyCarNameAliases(q).replace(/[^a-z0-9]/g, '');
  const matches = list.filter(car => {
    const nameNormalized = normalizeSearchStr(car.name);
    if (nameNormalized.includes(q)) return true;
    const nameTranslit = normalizeForSearch(car.name);
    if (nameTranslit.includes(qNormalized)) return true;
    return nameTranslit.includes(qAliased);
  }).slice(0, 15);
  currentSuggestions = matches;
  carSuggestionIndex = -1;

  if (!matches.length) {
    carSuggestions.classList.add('hidden');
    carSuggestions.innerHTML = '';
    return;
  }

  carSuggestions.innerHTML = matches.map((car, idx) => `
    <div class="car-suggestion-item" data-idx="${idx}">
      <span class="car-suggestion-icon">${car.icon}</span>
      ${car.image ? `<img src="${car.image}" class="car-suggestion-thumb" alt="">` : ''}
      <div class="car-suggestion-text">
        <div class="car-suggestion-name">${escapeHtml(car.name)}</div>
        <div class="car-suggestion-meta">${escapeHtml(getCategoryLabel(car.category))}${car.price ? ' · ' + escapeHtml(car.price) + ' ₽' : ''}</div>
      </div>
    </div>
  `).join('');
  carSuggestions.classList.remove('hidden');

  carSuggestions.querySelectorAll('.car-suggestion-item').forEach(el => {
    const idx = parseInt(el.getAttribute('data-idx'), 10);
    const car = matches[idx];

    el.addEventListener('click', () => {
      selectCarSuggestion(car);
    });

    if (car.image) {
      el.addEventListener('mouseenter', (e) => {
        carPreviewImg.src = car.image;
        carPreviewName.textContent = car.name;
        carPreview.classList.remove('hidden');
        positionCarPreview(e.clientX, e.clientY);
      });
      el.addEventListener('mousemove', (e) => {
        positionCarPreview(e.clientX, e.clientY);
      });
      el.addEventListener('mouseleave', () => {
        carPreview.classList.add('hidden');
      });
    }
  });
}

function selectCarSuggestion(car) {
  carNameInput.value = car.name;
  selectedCarImage = car.image || null;
  if (car.price) {
    const priceNum = parseNumberInput(car.price.replace(/\./g, ''));
    if (!isNaN(priceNum)) {
      buyPriceInputEl.value = formatNumberPlain(priceNum);
    }
  }
  carSuggestions.classList.add('hidden');
  carSuggestions.innerHTML = '';
  carPreview.classList.add('hidden');
}

carNameInput.addEventListener('input', () => {
  selectedCarImage = null;
  renderCarSuggestions(carNameInput.value);
});

carNameInput.addEventListener('focus', () => {
  if (carNameInput.value.trim()) {
    renderCarSuggestions(carNameInput.value);
  }
});

carNameInput.addEventListener('keydown', (e) => {
  if (carSuggestions.classList.contains('hidden') || !currentSuggestions.length) return;
  const items = carSuggestions.querySelectorAll('.car-suggestion-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    carSuggestionIndex = Math.min(carSuggestionIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === carSuggestionIndex));
    items[carSuggestionIndex]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    carSuggestionIndex = Math.max(carSuggestionIndex - 1, 0);
    items.forEach((el, i) => el.classList.toggle('active', i === carSuggestionIndex));
    items[carSuggestionIndex]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    if (carSuggestionIndex >= 0 && currentSuggestions[carSuggestionIndex]) {
      e.preventDefault();
      selectCarSuggestion(currentSuggestions[carSuggestionIndex]);
    }
  } else if (e.key === 'Escape') {
    carSuggestions.classList.add('hidden');
    carPreview.classList.add('hidden');
  }
});

document.addEventListener('click', (e) => {
  if (!carSuggestions.contains(e.target) && e.target !== carNameInput) {
    carSuggestions.classList.add('hidden');
    carPreview.classList.add('hidden');
  }
});

// ---------- Init ----------
async function init() {
  fb = await waitForFirebase();

  fb.onAuthStateChanged(fb.auth, async (user) => {
    if (user) {
      currentUser = user;
      authCard.classList.add('hidden');
      appContent.classList.remove('hidden');
      userEmailLabel.textContent = user.email;
      await loadUserData();
      renderAll();
    } else {
      currentUser = null;
      authCard.classList.remove('hidden');
      appContent.classList.add('hidden');
      authForm.reset();
    }
  });
}

init();
