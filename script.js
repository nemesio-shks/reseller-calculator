import { t, getLang, setLang, applyTranslations, currencySymbols } from './i18n.js';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultProject(name) {
  return { id: uid(), name: name || 'Проект 1', currency: 'UAH', cars: [] };
}

function defaultState() {
  const p = defaultProject('Проект 1');
  return { activeId: p.id, projects: [p], theme: 'dark', bgImage: null, bgPos: { x: 50, y: 50, zoom: 100 } };
}

let state = defaultState();
let currentUser = null;
let fb = null;
let saveTimer = null;
let activeCarIdForModal = null;

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
  const ref = fb.doc(fb.db, 'users', currentUser.uid);
  await fb.setDoc(ref, { state }, { merge: false });
}

async function loadUserData() {
  const ref = fb.doc(fb.db, 'users', currentUser.uid);
  const snap = await fb.getDoc(ref);
  if (snap.exists() && snap.data().state && snap.data().state.projects && snap.data().state.projects.length) {
    state = snap.data().state;
    if (!state.theme) state.theme = 'dark';
    if (!state.bgPos) state.bgPos = { x: 50, y: 50, zoom: 100 };
    state.projects.forEach(p => {
      if (!p.currency) p.currency = 'UAH';
      p.cars.forEach(c => {
        if (!c.adjustments) c.adjustments = [];
        if (!c.comments) c.comments = [];
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

// ---------- Background image ----------
function applyBackground() {
  if (state.bgImage) {
    bgLayer.style.backgroundImage = `url(${state.bgImage})`;
    const pos = state.bgPos || { x: 50, y: 50, zoom: 100 };
    bgLayer.style.backgroundPosition = `${pos.x}% ${pos.y}%`;
    bgLayer.style.backgroundSize = `${pos.zoom}%`;
    bgLayer.classList.add('has-custom-bg');
  } else {
    bgLayer.style.backgroundImage = '';
    bgLayer.style.backgroundPosition = '';
    bgLayer.style.backgroundSize = '';
    bgLayer.classList.remove('has-custom-bg');
  }
}

bgInput.addEventListener('change', () => {
  const file = bgInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.bgImage = reader.result;
    state.bgPos = { x: 50, y: 50, zoom: 100 };
    applyBackground();
    scheduleSave();
    openBgEditor();
  };
  reader.readAsDataURL(file);
});

bgResetBtn.addEventListener('click', () => {
  state.bgImage = null;
  state.bgPos = { x: 50, y: 50, zoom: 100 };
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

// ---------- Background editor (drag + zoom) ----------
let bgDragState = null;

function openBgEditor() {
  if (!state.bgImage) return;
  bgEditorImg.src = state.bgImage;
  const pos = state.bgPos || { x: 50, y: 50, zoom: 100 };
  bgZoomRange.value = pos.zoom;
  applyBgEditorTransform(pos.x, pos.y, pos.zoom);
  bgEditorModal.classList.remove('hidden');
}

function applyBgEditorTransform(x, y, zoom) {
  bgEditorImg.style.width = zoom + '%';
  bgEditorImg.style.left = x + '%';
  bgEditorImg.style.top = y + '%';
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
  const left = parseFloat(bgEditorImg.style.left) || 50;
  const top = parseFloat(bgEditorImg.style.top) || 50;
  state.bgPos = { x: left, y: top, zoom };
  applyBackground();
  scheduleSave();
  bgEditorModal.classList.add('hidden');
});

bgZoomRange.addEventListener('input', () => {
  const zoom = parseFloat(bgZoomRange.value);
  bgEditorImg.style.width = zoom + '%';
});

bgEditorViewport.addEventListener('mousedown', (e) => {
  e.preventDefault();
  const rect = bgEditorViewport.getBoundingClientRect();
  bgDragState = {
    startX: e.clientX,
    startY: e.clientY,
    startLeft: parseFloat(bgEditorImg.style.left) || 50,
    startTop: parseFloat(bgEditorImg.style.top) || 50,
    rectW: rect.width,
    rectH: rect.height
  };
});

window.addEventListener('mousemove', (e) => {
  if (!bgDragState) return;
  const dx = ((e.clientX - bgDragState.startX) / bgDragState.rectW) * 100;
  const dy = ((e.clientY - bgDragState.startY) / bgDragState.rectH) * 100;
  const newLeft = Math.min(100, Math.max(0, bgDragState.startLeft + dx));
  const newTop = Math.min(100, Math.max(0, bgDragState.startTop + dy));
  bgEditorImg.style.left = newLeft + '%';
  bgEditorImg.style.top = newTop + '%';
});

window.addEventListener('mouseup', () => {
  bgDragState = null;
});

// touch support
bgEditorViewport.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  const rect = bgEditorViewport.getBoundingClientRect();
  bgDragState = {
    startX: touch.clientX,
    startY: touch.clientY,
    startLeft: parseFloat(bgEditorImg.style.left) || 50,
    startTop: parseFloat(bgEditorImg.style.top) || 50,
    rectW: rect.width,
    rectH: rect.height
  };
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!bgDragState) return;
  const touch = e.touches[0];
  const dx = ((touch.clientX - bgDragState.startX) / bgDragState.rectW) * 100;
  const dy = ((touch.clientY - bgDragState.startY) / bgDragState.rectH) * 100;
  const newLeft = Math.min(100, Math.max(0, bgDragState.startLeft + dx));
  const newTop = Math.min(100, Math.max(0, bgDragState.startTop + dy));
  bgEditorImg.style.left = newLeft + '%';
  bgEditorImg.style.top = newTop + '%';
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
  currencySelect.value = project.currency || 'UAH';
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
    const isSold = car.sellPrice != null;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(car.name)}${car.comment ? `<div class="car-subcomment">${escapeHtml(car.comment)}</div>` : ''}</td>
      <td>${formatMoney(car.buyPrice, project.currency)}</td>
      <td>${isSold ? formatMoney(car.sellPrice, project.currency) : '—'}</td>
      <td>${adjTotal ? (adjTotal >= 0 ? '+' : '') + formatMoney(adjTotal, project.currency) : '—'} <span class="link-btn" data-id="${car.id}" data-action="adjust">${t('editComment')}</span></td>
      <td class="${profit == null ? '' : (profit >= 0 ? 'profit-pos' : 'profit-neg')}">${profit == null ? '—' : (profit >= 0 ? '+' : '') + formatMoney(profit, project.currency)}</td>
      <td>
        ${isSold
          ? `<span class="status-badge status-sold">${t('statusSold')}</span>`
          : `<span class="status-badge status-notsold">${t('statusNotSold')}</span><br><span class="link-btn" data-id="${car.id}" data-action="marksold">${t('markSold')}</span>`
        }
      </td>
      <td><span class="del-row" data-id="${car.id}" data-action="delete">✕</span></td>
    `;
    historyBody.appendChild(tr);
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
      const priceStr = prompt(t('sellPricePrompt'));
      if (priceStr === null) return;
      const price = parseNumberInput(priceStr);
      if (isNaN(price)) return;
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
    comments: []
  });
  scheduleSave();
  carForm.reset();
  sellPriceInput.disabled = false;
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
