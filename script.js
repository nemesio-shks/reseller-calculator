function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultState() {
  const defaultProject = { id: uid(), name: 'Проект 1', cars: [] };
  return { activeId: defaultProject.id, projects: [defaultProject] };
}

let state = defaultState();
let currentUser = null;
let fb = null;
let saveTimer = null;

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

let isRegisterMode = false;

authSwitchLink.addEventListener('click', (e) => {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;
  authTitle.textContent = isRegisterMode ? 'Реєстрація' : 'Вхід у кабінет';
  authSubmitBtn.textContent = isRegisterMode ? 'Зареєструватися' : 'Увійти';
  authSwitchText.textContent = isRegisterMode ? 'Вже маєте акаунт?' : 'Немає акаунта?';
  authSwitchLink.textContent = isRegisterMode ? 'Увійти' : 'Зареєструватися';
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

function getActiveProject() {
  return state.projects.find(p => p.id === state.activeId) || state.projects[0];
}

function formatMoney(n) {
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 }) + ' грн';
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
  } else {
    state = defaultState();
    await saveData();
  }
}

function renderTabs() {
  projectsTabs.innerHTML = '';
  state.projects.forEach(p => {
    const tab = document.createElement('div');
    tab.className = 'project-tab' + (p.id === state.activeId ? ' active' : '');
    tab.innerHTML = `<span>${escapeHtml(p.name)}</span>` +
      (state.projects.length > 1 ? '<span class="del-project">×</span>' : '');
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('del-project')) {
        e.stopPropagation();
        deleteProject(p.id);
        return;
      }
      state.activeId = p.id;
      scheduleSave();
      renderAll();
    });
    projectsTabs.appendChild(tab);
  });
}

function deleteProject(id) {
  if (state.projects.length <= 1) return;
  if (!confirm('Видалити цей проект разом з історією?')) return;
  state.projects = state.projects.filter(p => p.id !== id);
  if (state.activeId === id) {
    state.activeId = state.projects[0].id;
  }
  scheduleSave();
  renderAll();
}

function renderHistory() {
  const project = getActiveProject();
  historyBody.innerHTML = '';

  emptyMsg.style.display = project.cars.length ? 'none' : 'block';

  [...project.cars].reverse().forEach(car => {
    const profit = car.sellPrice - car.buyPrice;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(car.name)}</td>
      <td>${formatMoney(car.buyPrice)}</td>
      <td>${formatMoney(car.sellPrice)}</td>
      <td class="${profit >= 0 ? 'profit-pos' : 'profit-neg'}">${profit >= 0 ? '+' : ''}${formatMoney(profit)}</td>
      <td><span class="del-row" data-id="${car.id}">✕</span></td>
    `;
    historyBody.appendChild(tr);
  });

  historyBody.querySelectorAll('.del-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      project.cars = project.cars.filter(c => c.id !== id);
      scheduleSave();
      renderAll();
    });
  });

  const grandTotal = project.cars.reduce((sum, c) => sum + (c.sellPrice - c.buyPrice), 0);
  totalSum.textContent = (grandTotal >= 0 ? '+' : '') + formatMoney(grandTotal);
  totalSum.style.color = grandTotal >= 0 ? '#4ade80' : '#f87171';
}

function renderAll() {
  renderTabs();
  renderHistory();
}

addProjectBtn.addEventListener('click', () => {
  const name = prompt('Назва нового проекту:', 'Проект ' + (state.projects.length + 1));
  if (!name) return;
  const newProject = { id: uid(), name: name.trim(), cars: [] };
  state.projects.push(newProject);
  state.activeId = newProject.id;
  scheduleSave();
  renderAll();
});

carForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('carName').value.trim();
  const buyPrice = parseFloat(document.getElementById('buyPrice').value);
  const sellPrice = parseFloat(document.getElementById('sellPrice').value);

  if (!name || isNaN(buyPrice) || isNaN(sellPrice)) return;

  const project = getActiveProject();
  project.cars.push({ id: uid(), name, buyPrice, sellPrice });
  scheduleSave();
  carForm.reset();
  renderAll();
});

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
