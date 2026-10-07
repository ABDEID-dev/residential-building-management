const MONTHLY_FEE = 360;
const EGYPT_TIME_ZONE = "Africa/Cairo";
const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر"
];

let state = { user: null, apartments: [], payments: [], expenses: [], sharedCharges: [] };
let activeView = localStorage.getItem("amer_active_view") || "dashboard";
let activeMonth = egyptMonthValue();
let pendingDeleteApartmentId = null;

const els = {
  loginScreen: document.querySelector("#loginScreen"),
  appShell: document.querySelector("#appShell"),
  loginForm: document.querySelector("#loginForm"),
  loginError: document.querySelector("#loginError"),
  currentUserText: document.querySelector("#currentUserText"),
  accountIcon: document.querySelector("#accountIcon"),
  mobileUserText: document.querySelector("#mobileUserText"),
  buildingSummary: document.querySelector("#buildingSummary"),
  logoutBtn: document.querySelector("#logoutBtn"),
  menuBtn: document.querySelector("#menuBtn"),
  sidebarCloseBtn: document.querySelector("#sidebarCloseBtn"),
  mobileOverlay: document.querySelector("#mobileOverlay"),
  notifyBtn: document.querySelector("#notifyBtn"),
  notifyBadge: document.querySelector("#notifyBadge"),
  notificationPanel: document.querySelector("#notificationPanel"),
  notificationText: document.querySelector("#notificationText"),
  desktopNotifyBtn: document.querySelector("#desktopNotifyBtn"),
  desktopNotifyBadge: document.querySelector("#desktopNotifyBadge"),
  desktopNotificationPanel: document.querySelector("#desktopNotificationPanel"),
  desktopNotificationText: document.querySelector("#desktopNotificationText"),
  monthSelect: document.querySelector("#monthSelect"),
  yearSelect: document.querySelector("#yearSelect"),
  todayText: document.querySelector("#todayText"),
  viewTitle: document.querySelector("#viewTitle"),
  navLinks: document.querySelectorAll(".nav-link"),
  views: {
    dashboard: document.querySelector("#dashboardView"),
    apartments: document.querySelector("#apartmentsView"),
    payments: document.querySelector("#paymentsView"),
    expenses: document.querySelector("#expensesView"),
    sharedCharges: document.querySelector("#sharedChargesView"),
    reports: document.querySelector("#reportsView"),
    account: document.querySelector("#accountView")
  },
  imageDialog: document.querySelector("#imageDialog"),
  dialogImage: document.querySelector("#dialogImage"),
  closeDialog: document.querySelector("#closeDialog"),
  apartmentDeleteDialog: document.querySelector("#apartmentDeleteDialog"),
  apartmentDeleteForm: document.querySelector("#apartmentDeleteForm"),
  apartmentDeleteText: document.querySelector("#apartmentDeleteText"),
  apartmentDeletePassword: document.querySelector("#apartmentDeletePassword"),
  apartmentDeleteError: document.querySelector("#apartmentDeleteError"),
  cancelApartmentDeleteBtn: document.querySelector("#cancelApartmentDeleteBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importFile: document.querySelector("#importFile"),
  resetBtn: document.querySelector("#resetBtn"),
  storageActions: document.querySelector(".storage-actions")
};

init();

async function init() {
  if (els.loginForm && !els.appShell) {
    bindLoginEvents();
    await restoreLoginSession();
    return;
  }

  if (!els.appShell) return;

  setupMonthPicker();
  els.todayText.textContent = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: EGYPT_TIME_ZONE,
    numberingSystem: "latn"
  }).format(new Date());

  bindDashboardEvents();
  await restoreSession();
}

function bindLoginEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
}

function bindDashboardEvents() {
  els.logoutBtn.addEventListener("click", logout);
  els.menuBtn.addEventListener("click", openMobileMenu);
  els.sidebarCloseBtn.addEventListener("click", closeMobileMenu);
  els.mobileOverlay.addEventListener("click", closeMobilePanels);
  els.notifyBtn.addEventListener("click", toggleNotifications);
  els.desktopNotifyBtn?.addEventListener("click", toggleDesktopNotifications);
  document.addEventListener("click", handleNotificationAction);
  els.monthSelect.addEventListener("change", handleMainMonthChange);
  els.yearSelect.addEventListener("change", handleMainMonthChange);
  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-month-part]");
    if (!select) return;
    const group = select.closest(".arabic-month-field");
    syncArabicMonthField(group);
  });
  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-date-part]");
    if (!select) return;
    const group = select.closest(".arabic-date-field");
    syncArabicDateField(group);
  });

  els.navLinks.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.view);
      closeMobileMenu();
      render();
    });
  });

  els.closeDialog.addEventListener("click", () => els.imageDialog.close());
  els.cancelApartmentDeleteBtn?.addEventListener("click", closeApartmentDeleteDialog);
  els.apartmentDeleteForm?.addEventListener("submit", confirmApartmentDelete);
  els.exportBtn.addEventListener("click", exportData);
  els.importFile.parentElement.hidden = true;
  els.resetBtn.hidden = true;

  document.addEventListener("submit", handleSubmit);
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleFileChange);
}

function handleMainMonthChange() {
  activeMonth = `${els.yearSelect.value}-${String(els.monthSelect.value).padStart(2, "0")}`;
  render();
}

function setupMonthPicker() {
  const currentYear = Number(activeMonth.slice(0, 4));
  els.monthSelect.innerHTML = ARABIC_MONTHS
    .map((name, index) => `<option value="${index + 1}">${name}</option>`)
    .join("");
  els.yearSelect.innerHTML = yearOptions(currentYear);
  syncMonthPicker();
}

function syncMonthPicker() {
  if (!els.monthSelect || !els.yearSelect) return;
  els.yearSelect.value = activeMonth.slice(0, 4);
  els.monthSelect.value = String(Number(activeMonth.slice(5, 7)));
}

async function handleLogin(event) {
  event.preventDefault();
  const response = await api("login", new FormData(event.target));
  if (!response.ok) {
    els.loginError.textContent = response.message || "تعذر تسجيل الدخول.";
    els.loginError.classList.add("active");
    return;
  }
  els.loginError.classList.remove("active");
  els.loginForm.reset();
  window.location.href = "dashboard";
}

async function restoreLoginSession() {
  const response = await api("me");
  if (response.ok && response.user) {
    window.location.href = "dashboard";
  }
}

async function restoreSession() {
  const response = await api("me");
  if (response.ok && response.user) {
    await loadData();
    showApp();
    return;
  }
  showLogin();
}

async function logout() {
  await api("logout", new FormData());
  state = { user: null, apartments: [], payments: [], expenses: [], sharedCharges: [] };
  setActiveView("dashboard");
  showLogin();
}

async function loadData() {
  const response = await api("data");
  if (!response.ok) {
    showLogin();
    return;
  }
  state = response;
}

function showApp() {
  if (els.loginScreen) els.loginScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  render();
}

function showLogin() {
  if (els.appShell) els.appShell.classList.add("hidden");
  closeMobilePanels();
  window.location.href = "login";
}

function render() {
  if (!state.user) return;
  if (!els.views[activeView]) {
    setActiveView("dashboard");
  }

  const userText = state.user.role === "admin"
    ? "رئيس اتحاد الملاك"
    : `${apartmentLabel(state.user)} (${state.user.username})`;
  els.currentUserText.textContent = userText;
  els.accountIcon.innerHTML = avatarIcon(state.user.role);
  els.mobileUserText.textContent = userText;
  els.storageActions.hidden = state.user.role === "resident";
  if (els.buildingSummary) {
    const floors = Math.max(0, ...state.apartments.map((apt) => Number(apt.floorNumber || 0)));
    els.buildingSummary.textContent = `${formatArabicNumber(state.apartments.length)} شقة · ${formatArabicNumber(floors)} دور · اشتراك شهري ${formatArabicNumber(MONTHLY_FEE)} جنيه`;
  }

  if (state.user.role === "resident" && !["dashboard", "expenses", "account"].includes(activeView)) {
    setActiveView("dashboard");
  }

  els.navLinks.forEach((button) => {
    const residentViews = ["dashboard", "expenses", "account"];
    const hiddenForResident = state.user.role === "resident" && !residentViews.includes(button.dataset.view);
    button.hidden = hiddenForResident;
    button.classList.toggle("active", button.dataset.view === activeView);
  });

  Object.entries(els.views).forEach(([name, element]) => {
    element.classList.toggle("active", name === activeView);
  });

  const titles = {
    dashboard: "الرئيسية",
    apartments: "إدارة الشقق والحسابات",
    payments: "المدفوعات الشهرية",
    expenses: "المصروفات والفواتير",
    sharedCharges: "المطالبات الجماعية",
    reports: "التقارير",
    account: "حسابي"
  };
  els.viewTitle.textContent = titles[activeView];
  renderNotifications();

  renderDashboard();
  renderApartments();
  renderPayments();
  renderExpenses();
  renderSharedCharges();
  renderReports();
  renderAccount();
}

function setActiveView(view) {
  activeView = view || "dashboard";
  localStorage.setItem("amer_active_view", activeView);
}

function openMobileMenu() {
  els.appShell.classList.add("menu-open");
  els.notificationPanel.hidden = true;
  if (els.desktopNotificationPanel) els.desktopNotificationPanel.hidden = true;
}

function closeMobileMenu() {
  els.appShell.classList.remove("menu-open");
}

function toggleNotifications() {
  closeMobileMenu();
  els.notificationPanel.hidden = !els.notificationPanel.hidden;
  if (els.desktopNotificationPanel) els.desktopNotificationPanel.hidden = true;
  els.appShell.classList.toggle("notify-open", !els.notificationPanel.hidden);
}

function toggleDesktopNotifications() {
  const willOpen = els.desktopNotificationPanel.hidden;
  closeMobilePanels();
  els.desktopNotificationPanel.hidden = !willOpen;
}

function closeMobilePanels() {
  closeMobileMenu();
  els.notificationPanel.hidden = true;
  els.appShell.classList.remove("notify-open");
  if (els.desktopNotificationPanel) els.desktopNotificationPanel.hidden = true;
}

function renderNotifications() {
  const items = visibleNotificationItems();
  els.notifyBadge.hidden = items.length === 0;
  els.notifyBadge.textContent = String(items.length);
  els.notificationText.innerHTML = notificationListHtml(items);
  if (els.desktopNotifyBadge) {
    els.desktopNotifyBadge.hidden = items.length === 0;
    els.desktopNotifyBadge.textContent = String(items.length);
  }
  if (els.desktopNotificationText) {
    els.desktopNotificationText.innerHTML = notificationListHtml(items);
  }
}

function visibleNotificationItems() {
  return notificationItems().filter((item) => !isNotificationHidden(item.id));
}

function notificationItems() {
  if (state.user.role === "admin") {
    const late = unpaidCount(activeMonth);
    return late ? [{
      id: `admin-unpaid-${activeMonth}`,
      title: "متابعة السداد",
      text: `${late} شقة لم تسدد شهر ${formatMonth(activeMonth)} حتى الآن.`,
      view: "dashboard"
    }] : [];
  }

  const apt = getApartment(state.user.apartmentId);
  const debt = debtForApartment(apt.id, activeMonth);
  const extraShare = sharedChargeShareForMonth(activeMonth);
  return debt > 0 ? [{
    id: `resident-debt-${apt.id}-${activeMonth}-${Math.round(debt)}`,
    title: "تنبيه دفع",
    text: `المطلوب حتى ${formatMonth(activeMonth)} هو ${currency(debt)}${extraShare > 0 ? `، ويشمل ${currency(extraShare)} نصيب الشقة من المطالبات الجماعية.` : "."}`,
    view: "dashboard"
  }] : [];
}

function notificationListHtml(items) {
  if (!items.length) {
    return `<div class="notification-empty">لا توجد إشعارات حالية.</div>`;
  }
  return items.map((item) => `
    <article class="notification-item">
      <button class="notification-open" type="button" data-notification-open="${escapeHtml(item.view)}">
        <span>${escapeHtml(item.title)}</span>
        <small>${escapeHtml(item.text)}</small>
      </button>
      <button class="notification-dismiss" type="button" data-notification-dismiss="${escapeHtml(item.id)}">إزالة</button>
    </article>
  `).join("");
}

function handleNotificationAction(event) {
  const dismiss = event.target.closest("[data-notification-dismiss]");
  if (dismiss) {
    hideNotification(dismiss.dataset.notificationDismiss);
    renderNotifications();
    return;
  }

  const open = event.target.closest("[data-notification-open]");
  if (!open) return;
  setActiveView(open.dataset.notificationOpen || "dashboard");
  closeMobilePanels();
  render();
}

function notificationStorageKey() {
  return `amer_hidden_notifications_${state.user?.id || state.user?.username || "guest"}`;
}

function hiddenNotifications() {
  try {
    return JSON.parse(localStorage.getItem(notificationStorageKey()) || "[]");
  } catch {
    return [];
  }
}

function isNotificationHidden(id) {
  return hiddenNotifications().includes(id);
}

function hideNotification(id) {
  const hidden = new Set(hiddenNotifications());
  hidden.add(id);
  localStorage.setItem(notificationStorageKey(), JSON.stringify([...hidden]));
}

function renderDashboard() {
  if (state.user.role === "resident") {
    renderResidentDashboard();
    return;
  }

  const monthPayments = paymentsForMonth(activeMonth);
  const chargeable = chargeableApartments();
  const unpaid = chargeable.filter((apt) => debtForApartment(apt.id, activeMonth) > 0);
  const income = sum(monthPayments, "amount");
  const expenses = sum(expensesForMonth(activeMonth), "amount");
  const balance = totalIncome() - totalExpenses();

  els.views.dashboard.innerHTML = `
    ${unpaid.length ? `<div class="alert-strip">تنبيه: ${unpaid.length} شقة لم تدفع شهر ${formatMonth(activeMonth)} حتى الآن.</div>` : ""}
    <div class="stats-grid">
      ${statCard("إجمالي المطلوب", currency(chargeable.length * MONTHLY_FEE + sharedChargeTotalForMonth(activeMonth)))}
      ${statCard("المدفوع هذا الشهر", currency(income))}
      ${statCard("مصروفات الشهر", currency(expenses))}
      ${statCard("الرصيد الحالي", currency(balance), balance >= 0 ? "balance-positive" : "balance-negative")}
    </div>
    <div class="grid-two">
      <div class="panel">
        <div class="panel-title"><h3>الشقق غير المسددة</h3><span class="small-muted">${formatMonth(activeMonth)}</span></div>
        ${renderUnpaidList(unpaid)}
      </div>
      <div class="panel">
        <div class="panel-title"><h3>آخر الحركات</h3><span class="small-muted">مدفوعات ومصروفات</span></div>
        ${renderRecentActivity()}
      </div>
    </div>
  `;
}

function renderResidentDashboard() {
  const apt = getApartment(state.user.apartmentId);
  const myPayments = state.payments.filter((payment) => String(payment.apartmentId) === String(apt.id));
  const hasPaid = myPayments.some((payment) => payment.month === activeMonth);
  const debt = debtForApartment(apt.id, activeMonth);
  const chargeable = isApartmentChargeable(apt);
  const paidThisMonth = sum(paymentsForMonth(activeMonth, apt.id), "amount");
  const totalPaid = sum(myPayments, "amount");
  const monthExtra = sharedChargeShareForMonth(activeMonth);
  const monthDue = paymentDueForMonth(activeMonth);
  const isClear = chargeable && hasPaid && debt === 0;

  els.views.dashboard.innerHTML = `
    ${isClear ? `<div class="payment-alert success"><strong>شكرًا، تم دفع خدمات هذا الشهر</strong><span>لا توجد أي مستحقات عليك حاليًا.</span></div>` : ""}
    ${chargeable && !hasPaid ? `<div class="payment-alert"><strong>برجاء دفع الخدمات</strong><span>سداد خدمة برج العامر يساعد في الحفاظ على شكل البرج ونظافته وانتظام المصروفات.</span></div>` : ""}
    ${!chargeable ? `<div class="payment-alert neutral"><strong>بدون مستحقات</strong><span>هذه الشقة لم تشطب، لذلك لا يتم احتساب اشتراك شهري عليها حاليًا.</span></div>` : ""}
    <section class="resident-hero">
      <div class="resident-head">
        <div>
          <h3>${apartmentLabel(apt)}</h3>
          <p class="small-muted">${escapeHtml(apt.residentName || "لم يحدد الاسم")} · ${occupancyLabel(apt.occupancy)} · ${finishStatusLabel(apt.finishStatus)}</p>
        </div>
        <span class="badge ${!chargeable ? "pending" : (hasPaid ? "paid" : "unpaid")}">${!chargeable ? "غير مطالب بالدفع" : (hasPaid ? "مدفوع هذا الشهر" : "غير مدفوع")}</span>
      </div>
      <div class="resident-payment-summary">
        <div>
          <span>${isClear ? "الحالة الحالية" : "المطلوب الآن"}</span>
          <strong class="${debt > 0 ? "balance-negative" : "balance-positive"}">${isClear ? "لا يوجد مستحقات" : currency(debt)}</strong>
          <small>${isClear ? `تم تسجيل خدمة ${formatMonth(activeMonth)}` : `خدمة الشهر ${currency(MONTHLY_FEE)}${monthExtra > 0 ? ` · مطالبات جماعية ${currency(monthExtra)}` : ""} · المدفوع هذا الشهر ${currency(paidThisMonth)}`}</small>
        </div>
        <div>
          <span>إجمالي المدفوع</span>
          <strong>${currency(totalPaid)}</strong>
          <small>${myPayments.length} إيصال مسجل</small>
        </div>
      </div>
      ${chargeable && !isClear ? `<button class="primary-btn resident-pay-btn" type="button" data-action="focus-payment-form">تسديد ورفع صورة التحويل</button>` : ""}
    </section>
    ${chargeable && monthExtra > 0 ? `<div class="payment-alert neutral"><strong>مطالبة جماعية لهذا الشهر</strong><span>نصيب شقتك من المطالبات الجماعية هو ${currency(monthExtra)}، وإجمالي دفع هذا الشهر ${currency(monthDue)}.</span></div>` : ""}
    ${chargeable && !isClear ? paymentForm(apt.id, false) : ""}
    ${renderResidentMonthStatus()}
    <div class="table-wrap">
      <div class="panel-title"><h3>مصروفات برج العامر المنشورة</h3></div>
      ${expensesTable(state.expenses)}
    </div>
  `;
}

function renderResidentMonthStatus() {
  const paidApartmentIds = new Set(paymentsForMonth(activeMonth).map((payment) => String(payment.apartmentId)));
  const chargeable = state.apartments.filter(isApartmentChargeable);
  const paidApartments = chargeable.filter((apt) => paidApartmentIds.has(String(apt.id)));
  const unpaidApartments = chargeable.filter((apt) => !paidApartmentIds.has(String(apt.id)));
  const exemptApartments = state.apartments.filter((apt) => !isApartmentChargeable(apt));

  return `
    <section class="panel resident-status-panel">
      <div class="panel-title">
        <h3>حالة دفع الشقق</h3>
        <span class="small-muted">${formatMonth(activeMonth)} · عرض مختصر للسكان</span>
      </div>
      <div class="mini-stats">
        <button type="button" data-action="toggle-status-list" data-target="paidList"><span>دفع</span><strong>${formatArabicNumber(paidApartments.length)}</strong></button>
        <button type="button" data-action="toggle-status-list" data-target="unpaidList"><span>لم يدفع</span><strong>${formatArabicNumber(unpaidApartments.length)}</strong></button>
        <button type="button" data-action="toggle-status-list" data-target="exemptList"><span>غير مطالب</span><strong>${formatArabicNumber(exemptApartments.length)}</strong></button>
      </div>
      ${statusList("paidList", paidApartments, "paid", "دفع", true)}
      ${statusList("unpaidList", unpaidApartments, "unpaid", "لم يدفع", false)}
      ${statusList("exemptList", exemptApartments, "pending", "غير مطالب", true)}
    </section>
  `;
}

function statusList(id, apartments, className, label, hidden = true) {
  return `
    <div class="status-list" id="${id}" ${hidden ? "hidden" : ""}>
      ${apartments.length ? apartments.map((apt) => `
        <button class="status-item" type="button" data-action="toggle-apartment-contact" data-apartment-id="${apt.id}">
          <strong>${apartmentLabel(apt)}</strong>
          <span class="badge ${className}">${label}</span>
        </button>
        <div class="apartment-contact" data-contact-for="${apt.id}" hidden>
          <strong>${escapeHtml(apt.residentName || "لم يتم تسجيل الاسم")}</strong>
          <span>${escapeHtml(apt.phone || "لا يوجد رقم هاتف")}</span>
        </div>
      `).join("") : emptyState("لا توجد شقق", "لا يوجد عناصر في هذه الحالة لهذا الشهر.")}
    </div>
  `;
}

function renderApartments() {
  if (state.user.role !== "admin") {
    els.views.apartments.innerHTML = "";
    return;
  }

  els.views.apartments.innerHTML = `
    <div class="form-panel">
      <div class="panel-title apartment-editor-title">
        <div>
          <h3 id="apartmentFormTitle">تعديل بيانات وحساب شقة</h3>
          <span class="small-muted">رئيس اتحاد الملاك يتحكم في كل حساب</span>
        </div>
        <div class="panel-actions">
          <button class="secondary-btn" type="button" data-action="new-apartment">إضافة شقة</button>
          <button class="danger-btn" type="button" data-action="delete-apartment">حذف الشقة</button>
        </div>
      </div>
      <form id="apartmentForm" class="form-grid">
        <div class="field">
          <label for="editApartmentId">اختيار الشقة</label>
          <select id="editApartmentId" name="apartmentId">
            ${state.apartments.map((apt) => `<option value="${apt.id}">${apartmentLabel(apt)} - ${escapeHtml(apt.residentName || "بدون اسم")}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="floorNumber">الدور</label>
          <input id="floorNumber" name="floorNumber" type="number" min="1" required>
        </div>
        <div class="field">
          <label for="unitNumber">رقم الشقة في الدور</label>
          <input id="unitNumber" name="unitNumber" type="number" min="1" required>
        </div>
        <div class="field">
          <label for="residentName">اسم الساكن</label>
          <input id="residentName" name="residentName">
        </div>
        <div class="field">
          <label for="apartmentUsername">يوزر الشقة</label>
          <input id="apartmentUsername" name="username" required>
        </div>
        <div class="field">
          <label for="apartmentPassword">باسورد جديد</label>
          <input id="apartmentPassword" name="password" type="password" placeholder="اتركه فارغًا بدون تغيير">
        </div>
        <div class="field">
          <label for="accountStatus">حالة الحساب</label>
          <select id="accountStatus" name="isActive">
            <option value="1">مفتوح</option>
            <option value="0">مقفول</option>
          </select>
        </div>
        <div class="field">
          <label for="phone">رقم الهاتف</label>
          <input id="phone" name="phone">
        </div>
        <div class="field">
          <label for="occupancy">الصفة</label>
          <select id="occupancy" name="occupancy">
            <option value="owner">مالك</option>
            <option value="tenant">مستأجر</option>
          </select>
        </div>
        <div class="field">
          <label for="finishStatus">حالة التشطيب</label>
          <select id="finishStatus" name="finishStatus">
            <option value="finished">مشطب - عليه اشتراك</option>
            <option value="unfinished">لم يشطب - بدون اشتراك</option>
          </select>
        </div>
        <div class="field">
          <label for="previousArrears">متأخرات سابقة</label>
          <input id="previousArrears" name="previousArrears" type="number" min="0" step="1" value="0">
        </div>
        <div class="field full">
          <label for="notes">ملاحظات</label>
          <textarea id="notes" name="notes" rows="2"></textarea>
        </div>
        <div class="actions-row full">
          <button class="primary-btn" id="apartmentSubmitBtn" type="submit">حفظ الشقة والحساب</button>
          <button class="secondary-btn" id="cancelApartmentCreateBtn" type="button" data-action="cancel-new-apartment" hidden>إلغاء الإضافة</button>
        </div>
      </form>
    </div>
    <div class="apartments-grid">
      ${state.apartments.map(apartmentCard).join("")}
    </div>
  `;

  const form = document.querySelector("#apartmentForm");
  const select = document.querySelector("#editApartmentId");
  const syncForm = () => {
    const apt = getApartment(select.value);
    if (!apt) {
      setApartmentFormMode("create");
      return;
    }
    form.dataset.mode = "edit";
    select.disabled = false;
    form.residentName.value = apt.residentName || "";
    form.username.value = apt.username || "";
    form.password.value = "";
    form.floorNumber.value = apt.floorNumber || Math.ceil(Number(apt.number || 1) / 4);
    form.unitNumber.value = apt.unitNumber || (((Number(apt.number || 1) - 1) % 4) + 1);
    form.isActive.value = String(Number(apt.isActive));
    form.phone.value = apt.phone || "";
    form.occupancy.value = apt.occupancy;
    form.finishStatus.value = apt.finishStatus || "finished";
    form.previousArrears.value = Number(apt.previousArrears || 0);
    form.notes.value = apt.notes || "";
    document.querySelector("#apartmentFormTitle").textContent = "تعديل بيانات وحساب شقة";
    document.querySelector("#apartmentSubmitBtn").textContent = "حفظ الشقة والحساب";
    document.querySelector("#cancelApartmentCreateBtn").hidden = true;
  };
  select.addEventListener("change", syncForm);
  if (state.apartments.length) syncForm();
  else setApartmentFormMode("create");
}

function setApartmentFormMode(mode) {
  const form = document.querySelector("#apartmentForm");
  const select = document.querySelector("#editApartmentId");
  if (!form || !select) return;
  if (mode !== "create") {
    select.disabled = false;
    const apt = getApartment(select.value);
    if (apt) {
      select.dispatchEvent(new Event("change"));
      return;
    }
  }

  const nextNumber = nextApartmentNumber();
  const nextSlot = nextApartmentSlot();
  form.dataset.mode = "create";
  select.disabled = true;
  form.reset();
  form.floorNumber.value = nextSlot.floorNumber;
  form.unitNumber.value = nextSlot.unitNumber;
  form.username.value = `apt${nextNumber}`;
  form.password.value = "123456";
  form.isActive.value = "1";
  form.occupancy.value = "owner";
  form.finishStatus.value = "finished";
  form.previousArrears.value = "0";
  document.querySelector("#apartmentFormTitle").textContent = "إضافة شقة جديدة";
  document.querySelector("#apartmentSubmitBtn").textContent = "إضافة الشقة والحساب";
  document.querySelector("#cancelApartmentCreateBtn").hidden = false;
}

function nextApartmentNumber() {
  return Math.max(0, ...state.apartments.map((apt) => Number(apt.number || 0))) + 1;
}

function nextApartmentSlot() {
  const used = new Set(state.apartments.map((apt) => `${Number(apt.floorNumber || 1)}-${Number(apt.unitNumber || 1)}`));
  const highestFloor = Math.max(12, ...state.apartments.map((apt) => Number(apt.floorNumber || 1)));
  for (let floorNumber = 1; floorNumber <= highestFloor + 1; floorNumber++) {
    for (let unitNumber = 1; unitNumber <= 4; unitNumber++) {
      if (!used.has(`${floorNumber}-${unitNumber}`)) return { floorNumber, unitNumber };
    }
  }
  return { floorNumber: highestFloor + 1, unitNumber: 1 };
}

function openApartmentDeleteDialog(apt) {
  pendingDeleteApartmentId = apt.id;
  els.apartmentDeleteText.textContent = `سيتم حذف ${apartmentLabel(apt)} وحسابها وكل المدفوعات المسجلة لها. اكتب الرقم السري لتأكيد الحذف.`;
  els.apartmentDeletePassword.value = "";
  els.apartmentDeleteError.hidden = true;
  els.apartmentDeleteError.textContent = "";
  els.apartmentDeleteDialog.showModal();
  setTimeout(() => els.apartmentDeletePassword.focus(), 50);
}

function closeApartmentDeleteDialog() {
  pendingDeleteApartmentId = null;
  els.apartmentDeleteDialog.close();
}

async function confirmApartmentDelete(event) {
  event.preventDefault();
  if (!pendingDeleteApartmentId) return;
  const deletePassword = els.apartmentDeletePassword.value.trim();
  if (deletePassword !== "1993") {
    els.apartmentDeleteError.textContent = "الرقم السري غير صحيح.";
    els.apartmentDeleteError.hidden = false;
    els.apartmentDeletePassword.select();
    return;
  }

  const response = await postAction("delete_apartment", {
    apartmentId: pendingDeleteApartmentId,
    deletePassword
  });
  if (!response.ok) {
    els.apartmentDeleteError.textContent = response.message || "تعذر حذف الشقة.";
    els.apartmentDeleteError.hidden = false;
    return;
  }
  closeApartmentDeleteDialog();
  await loadData();
  render();
}

function renderPayments() {
  const apartmentId = state.user.role === "resident" ? state.user.apartmentId : "";
  els.views.payments.innerHTML = `
    ${paymentForm(apartmentId, state.user.role === "admin")}
    <div class="table-wrap">
      <div class="panel-title"><h3>سجل المدفوعات</h3><span class="small-muted">${formatMonth(activeMonth)}</span></div>
      ${paymentsTable(paymentsForMonth(activeMonth, apartmentId || null))}
    </div>
  `;
}

function renderExpenses() {
  els.views.expenses.innerHTML = `
    ${state.user.role === "admin" ? expenseForm() : ""}
    <div class="table-wrap">
      <div class="panel-title"><h3>مصروفات برج العامر</h3><span class="small-muted">ظاهرة لكل السكان</span></div>
      ${expensesTable(state.expenses)}
    </div>
  `;
}

function renderSharedCharges() {
  if (state.user.role !== "admin") {
    els.views.sharedCharges.innerHTML = "";
    return;
  }

  els.views.sharedCharges.innerHTML = `
    ${sharedChargeForm()}
    <div class="table-wrap">
      <div class="panel-title"><h3>مطالبات جماعية على الشقق المشطبة</h3><span class="small-muted">تقسم بالتساوي على الشقق المشطبة فقط</span></div>
      ${sharedChargesTable(state.sharedCharges)}
    </div>
  `;
}

function renderReports() {
  const rows = state.apartments.map((apt) => {
    const paid = paymentsForMonth(activeMonth, apt.id)[0];
    const debt = debtForApartment(apt.id, activeMonth);
    const chargeable = isApartmentChargeable(apt);
    return `
      <tr>
        <td>${apartmentLabel(apt)}</td>
        <td>${escapeHtml(apt.residentName || "-")}</td>
        <td><span class="badge ${apt.occupancy}">${occupancyLabel(apt.occupancy)}</span></td>
        <td><span class="badge ${finishStatusClass(apt.finishStatus)}">${finishStatusLabel(apt.finishStatus)}</span></td>
        <td><span class="badge ${!chargeable ? "pending" : (paid ? "paid" : "unpaid")}">${!chargeable ? "غير مطالب" : (paid ? "دفع" : "لم يدفع")}</span></td>
        <td>${currency(debt)}</td>
      </tr>
    `;
  }).join("");

  els.views.reports.innerHTML = `
    <div class="stats-grid">
      ${statCard("إجمالي التحصيل", currency(totalIncome()))}
      ${statCard("إجمالي المصروف", currency(totalExpenses()))}
      ${statCard("الرصيد", currency(totalIncome() - totalExpenses()))}
      ${statCard("متأخرات الشهر المختار", currency(unpaidCount(activeMonth) * MONTHLY_FEE))}
    </div>
    <div class="table-wrap">
      <div class="panel-title"><h3>حالة كل الشقق</h3><span class="small-muted">${formatMonth(activeMonth)}</span></div>
      <table class="reports-table responsive-table">
        <thead><tr><th>الشقة</th><th>الاسم</th><th>الصفة</th><th>التشطيب</th><th>حالة الشهر</th><th>المتأخرات</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderAccount() {
  const apt = state.user.role === "resident" ? getApartment(state.user.apartmentId) : null;
  const debt = apt ? debtForApartment(apt.id, activeMonth) : 0;
  const paid = apt ? sum(state.payments.filter((payment) => String(payment.apartmentId) === String(apt.id)), "amount") : totalIncome();
  els.views.account.innerHTML = `
    <div class="account-layout">
      <section class="profile-card">
        <div class="profile-top">
          <div class="profile-avatar">${state.user.role === "admin" ? "أ" : "ش"}</div>
          <div>
            <h3>${state.user.role === "admin" ? "حساب رئيس اتحاد الملاك" : `حساب ${apartmentLabel(apt || state.user)}`}</h3>
            <p>${escapeHtml(state.user.username)}${apt ? ` · ${finishStatusLabel(apt.finishStatus)}` : ""}</p>
          </div>
        </div>
        <div class="profile-metrics">
          <div>
            <span>نوع الحساب</span>
            <strong>${state.user.role === "admin" ? "إدارة" : "ساكن"}</strong>
          </div>
          <div>
            <span>${apt ? "المطلوب" : "إجمالي التحصيل"}</span>
            <strong>${currency(apt ? debt : paid)}</strong>
          </div>
          ${apt ? `
            <div>
              <span>إجمالي المدفوع</span>
              <strong>${currency(paid)}</strong>
            </div>
          ` : ""}
        </div>
      </section>

      <section class="form-panel account-form-panel">
        <div class="panel-title">
          <h3>بيانات الحساب</h3>
          <span class="small-muted">اترك كلمة المرور فارغة إذا كنت لا تريد تغييرها</span>
        </div>
        <form id="profileForm" class="form-grid">
          ${apt ? `
            <div class="field">
              <label for="profileResidentName">اسم الساكن</label>
              <input id="profileResidentName" name="residentName" value="${escapeHtml(apt.residentName || "")}">
            </div>
          ` : ""}
          <div class="field">
            <label for="profileUsername">اسم المستخدم</label>
            <input id="profileUsername" name="username" value="${escapeHtml(state.user.username)}" required>
          </div>
          <div class="field">
            <label for="profilePassword">كلمة مرور جديدة</label>
            <input id="profilePassword" name="password" type="password" placeholder="اتركها فارغة بدون تغيير">
          </div>
          <div class="actions-row full">
            <button class="primary-btn" type="submit">حفظ بيانات الحساب</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function paymentForm(apartmentId = "", allowApartmentChoice = true) {
  const residentMode = state.user.role === "resident";
  const amount = residentMode ? paymentDueForMonth(activeMonth) : MONTHLY_FEE;
  return `
    <div class="form-panel payment-panel" id="paymentSection">
      <div class="panel-title"><h3>${residentMode ? "تسديد خدمة برج العامر" : "تسجيل دفع شهر"}</h3><span class="small-muted">${residentMode ? "قيمة الخدمة الشهرية 360 جنيه فقط مع رفع صورة التحويل" : "محفظة أو إنستا باي مع صورة التحويل"}</span></div>
      <form id="paymentForm" class="form-grid">
        <div class="field">
          <label for="paymentApartmentId">الشقة</label>
          <select id="paymentApartmentId" name="apartmentId" ${allowApartmentChoice ? "" : "disabled"}>
            ${state.apartments.map((apt) => `<option value="${apt.id}" ${String(apt.id) === String(apartmentId) ? "selected" : ""}>${apartmentLabel(apt)} - ${escapeHtml(apt.residentName || "بدون اسم")}</option>`).join("")}
          </select>
        </div>
        ${arabicMonthField("paymentMonth", "month", "شهر الخدمة", activeMonth)}
        <div class="field"><label for="paymentAmount">المبلغ</label><input id="paymentAmount" type="number" name="amount" min="1" step="0.01" value="${amount}" ${residentMode ? "readonly" : ""} required></div>
        <div class="field"><label for="paidTo">تم الدفع إلى</label><input id="paidTo" name="paidTo" required></div>
        <div class="field">
          <label for="method">طريقة الدفع</label>
          <select id="method" name="method">
            <option value="wallet">محفظة</option>
            <option value="instapay">إنستا باي</option>
            <option value="cash">كاش</option>
          </select>
        </div>
        <div class="field"><label for="reference">رقم العملية</label><input id="reference" name="reference" required></div>
        ${arabicDateField("paidAt", "paidAt", "تاريخ الدفع", todayISO())}
        ${fileUploadField("paymentReceipt", "receipt", "مرفق التحويل", "صورة أو PDF للتحويل")}
        <div class="actions-row full"><button class="primary-btn" type="submit">تسجيل الدفع</button></div>
      </form>
    </div>
  `;
}

function sharedChargeForm() {
  return `
    <div class="form-panel shared-charge-panel">
      <div class="panel-title"><h3>إضافة مطالبة جماعية</h3><span class="small-muted">مثال: كهرباء أو ممارسة كهرباء، وتقسم تلقائيًا على الشقق المشطبة</span></div>
      <form id="sharedChargeForm" class="form-grid">
        <div class="field"><label for="sharedChargeTitle">اسم المطالبة</label><input id="sharedChargeTitle" name="title" placeholder="مثال: ممارسة كهرباء" required></div>
        <div class="field"><label for="sharedChargeAmount">إجمالي المبلغ</label><input id="sharedChargeAmount" type="number" name="amount" min="1" value="10000" required></div>
        ${arabicMonthField("sharedChargeMonth", "month", "شهر المطالبة", activeMonth)}
        <div class="field full"><label for="sharedChargeDetails">تفاصيل مختصرة</label><textarea id="sharedChargeDetails" name="details" rows="2" placeholder="تظهر للسكان في الإشعارات والمصروفات"></textarea></div>
        <div class="actions-row full"><button class="primary-btn" type="submit">إضافة وتقسيم المبلغ</button></div>
      </form>
    </div>
  `;
}

function expenseForm() {
  return `
    <div class="form-panel">
      <div class="panel-title"><h3>تسجيل مصروف</h3><span class="small-muted">يوضح أين صُرفت الفلوس</span></div>
      <form id="expenseForm" class="form-grid">
        <div class="field"><label for="expenseTitle">البند</label><input id="expenseTitle" name="title" required></div>
        <div class="field"><label for="expenseAmount">المبلغ</label><input id="expenseAmount" type="number" name="amount" min="1" required></div>
        ${arabicMonthField("expenseMonth", "month", "شهر الصرف", activeMonth)}
        ${arabicDateField("expenseDate", "spentAt", "تاريخ الصرف", todayISO())}
        <div class="field full"><label for="expenseDetails">اتصرف في إيه؟</label><textarea id="expenseDetails" name="details" rows="3" required></textarea></div>
        ${fileUploadField("expenseInvoice", "invoice", "مرفق الفاتورة", "صورة أو PDF للفاتورة")}
        <div class="actions-row full"><button class="primary-btn" type="submit">نشر المصروف</button></div>
      </form>
    </div>
  `;
}

async function handleSubmit(event) {
  const form = event.target;
  if (!["apartmentForm", "profileForm", "paymentForm", "expenseForm", "sharedChargeForm"].includes(form.id)) return;
  event.preventDefault();

  const data = new FormData(form);
  const action = {
    apartmentForm: form.dataset.mode === "create" ? "create_apartment" : "save_apartment",
    profileForm: "save_profile",
    paymentForm: "save_payment",
    expenseForm: "save_expense",
    sharedChargeForm: "save_shared_charge"
  }[form.id];

  if (form.id === "paymentForm" && form.apartmentId.disabled) {
    data.set("apartmentId", String(state.user.apartmentId));
  }

  const response = await api(action, data);
  if (!response.ok) {
    alert(response.message || "تعذر حفظ البيانات.");
    return;
  }
  await loadData();
  render();
}

async function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  if (target.dataset.action === "show-image") {
    els.dialogImage.src = target.dataset.src;
    els.imageDialog.showModal();
  }

  if (target.dataset.action === "focus-payment-form") {
    document.querySelector("#paymentSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (target.dataset.action === "toggle-status-list") {
    const panel = target.closest(".resident-status-panel");
    const list = panel?.querySelector(`#${target.dataset.target}`);
    if (!list) return;
    panel.querySelectorAll(".status-list").forEach((item) => {
      if (item !== list) item.hidden = true;
    });
    list.hidden = !list.hidden;
  }

  if (target.dataset.action === "toggle-apartment-contact") {
    const list = target.closest(".status-list");
    const contact = list?.querySelector(`[data-contact-for="${target.dataset.apartmentId}"]`);
    if (!contact) return;
    list.querySelectorAll(".apartment-contact").forEach((item) => {
      if (item !== contact) item.hidden = true;
    });
    contact.hidden = !contact.hidden;
  }

  if (target.dataset.action === "toggle-long-list") {
    const list = target.closest("[data-long-list]");
    if (!list) return;
    const isExpanded = list.classList.toggle("expanded");
    list.querySelectorAll("[data-extra-row]").forEach((row) => {
      row.hidden = !isExpanded;
    });
    target.textContent = isExpanded ? "عرض أقل" : "مشاهدة المزيد";
  }

  if (target.dataset.action === "new-apartment") {
    setApartmentFormMode("create");
  }

  if (target.dataset.action === "cancel-new-apartment") {
    setApartmentFormMode("edit");
  }

  if (target.dataset.action === "delete-apartment") {
    const form = document.querySelector("#apartmentForm");
    const select = document.querySelector("#editApartmentId");
    if (form?.dataset.mode === "create") {
      alert("اختر شقة موجودة أولًا قبل الحذف.");
      return;
    }
    const apt = getApartment(select?.value);
    if (!apt) return;
    openApartmentDeleteDialog(apt);
  }

  if (target.dataset.action === "delete-payment") {
    if (!confirm("حذف عملية الدفع؟")) return;
    await postAction("delete_payment", { id: target.dataset.id });
    await loadData();
    render();
  }

  if (target.dataset.action === "delete-expense") {
    if (!confirm("حذف المصروف؟")) return;
    await postAction("delete_expense", { id: target.dataset.id });
    await loadData();
    render();
  }

  if (target.dataset.action === "delete-shared-charge") {
    if (!confirm("حذف المطالبة الجماعية؟")) return;
    await postAction("delete_shared_charge", { id: target.dataset.id });
    await loadData();
    render();
  }
}

function handleFileChange(event) {
  const input = event.target.closest(".file-input");
  if (!input) return;
  const box = input.closest(".upload-box");
  const name = input.files && input.files[0] ? input.files[0].name : "لم يتم اختيار ملف";
  box.querySelector(".upload-file-name").textContent = name;
  box.classList.toggle("has-file", Boolean(input.files && input.files[0]));
}

function apartmentCard(apt) {
  const paid = paymentsForMonth(activeMonth, apt.id).length > 0;
  const chargeable = isApartmentChargeable(apt);
  return `
    <article class="apartment-card">
      <h4>${apartmentLabel(apt)}</h4>
      <p>${escapeHtml(apt.residentName || "بدون اسم")}<br>${escapeHtml(apt.phone || "لا يوجد هاتف")}</p>
      <div>
        <span class="badge ${apt.occupancy}">${occupancyLabel(apt.occupancy)}</span>
        <span class="badge ${finishStatusClass(apt.finishStatus)}">${finishStatusLabel(apt.finishStatus)}</span>
        <span class="badge ${Number(apt.isActive) ? "paid" : "unpaid"}">${Number(apt.isActive) ? "الحساب مفتوح" : "الحساب مقفول"}</span>
        <span class="badge ${!chargeable ? "pending" : (paid ? "paid" : "unpaid")}">${!chargeable ? "غير مطالب" : (paid ? "دافع" : "لم يدفع")}</span>
      </div>
      <p>اليوزر: <strong>${escapeHtml(apt.username)}</strong></p>
      <p>متأخرات سابقة: <strong>${currency(apt.previousArrears || 0)}</strong></p>
      <p>المتأخرات: <strong>${currency(debtForApartment(apt.id, activeMonth))}</strong></p>
    </article>
  `;
}

function paymentsTable(payments) {
  if (!payments.length) return emptyState("لا توجد مدفوعات", "لم يتم تسجيل أي دفع في هذا الشهر.");
  const rows = payments.map((payment) => {
    const apt = getApartment(payment.apartmentId);
    return `
      <tr>
        <td>${apartmentLabel(apt)}<br><span class="small-muted">${escapeHtml(apt.residentName || "-")}</span></td>
        <td>${formatMonth(payment.month)}</td>
        <td>${currency(payment.amount)}</td>
        <td>${escapeHtml(payment.paidTo)}</td>
        <td>${methodLabel(payment.method)}<br><span class="small-muted">${escapeHtml(payment.reference)}</span></td>
        <td>${formatDate(payment.paidAt)}</td>
        <td>${imageCell(payment.receipt)}</td>
        <td>${state.user.role === "admin" ? `<button class="link-btn" data-action="delete-payment" data-id="${payment.id}">حذف</button>` : ""}</td>
      </tr>
    `;
  }).join("");
  return `<table class="payments-table responsive-table"><thead><tr><th>الشقة</th><th>الشهر</th><th>المبلغ</th><th>دفع إلى</th><th>الطريقة</th><th>التاريخ</th><th>الصورة</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function expensesTable(expenses) {
  if (!expenses.length) return emptyState("لا توجد مصروفات", "أي مصروف يسجله رئيس اتحاد الملاك سيظهر هنا للجميع.");
  const rows = expenses.map((expense) => `
    <tr>
      <td>${escapeHtml(expense.title)}<br><span class="small-muted">${escapeHtml(expense.details)}</span></td>
      <td>${formatMonth(expense.month)}</td>
      <td>${currency(expense.amount)}</td>
      <td>${formatDate(expense.spentAt)}</td>
      <td>${imageCell(expense.invoice)}</td>
      <td>${state.user.role === "admin" ? `<button class="link-btn" data-action="delete-expense" data-id="${expense.id}">حذف</button>` : ""}</td>
    </tr>
  `).join("");
  return `<table class="expenses-table responsive-table"><thead><tr><th>البند</th><th>الشهر</th><th>المبلغ</th><th>التاريخ</th><th>الفاتورة</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function sharedChargesTable(charges) {
  if (!charges.length) return emptyState("لا توجد مطالبات جماعية", "عند إضافة كهرباء أو ممارسة ستظهر هنا ونصيب كل شقة يظهر للسكان.");
  const rows = charges.map((charge) => `
    <tr>
      <td>${escapeHtml(charge.title)}<br><span class="small-muted">${escapeHtml(charge.details || "-")}</span></td>
      <td>${formatMonth(charge.month)}</td>
      <td>${currency(charge.amount)}</td>
      <td>${currency(sharedChargeShare(charge))}</td>
      <td>${state.user.role === "admin" ? `<button class="link-btn" data-action="delete-shared-charge" data-id="${charge.id}">حذف</button>` : ""}</td>
    </tr>
  `).join("");
  return `<table class="shared-charges-table responsive-table"><thead><tr><th>البند</th><th>الشهر</th><th>الإجمالي</th><th>نصيب الشقة</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderUnpaidList(apartments) {
  if (!apartments.length) return emptyState("كل الشقق دفعت", "لا توجد متأخرات لهذا الشهر.");
  const visibleLimit = 8;
  const hasMore = apartments.length > visibleLimit;
  return `
    <div class="compact-list" data-long-list>
      <table class="unpaid-table responsive-table">
        <thead><tr><th>الشقة</th><th>الاسم</th><th>الصفة</th><th>المتأخرات</th></tr></thead>
        <tbody>
          ${apartments.map((apt, index) => `
            <tr ${index >= visibleLimit ? "data-extra-row hidden" : ""}>
              <td>${apartmentLabel(apt)}</td>
              <td>${escapeHtml(apt.residentName || "-")}</td>
              <td><span class="badge ${apt.occupancy}">${occupancyLabel(apt.occupancy)}</span></td>
              <td>${currency(debtForApartment(apt.id, activeMonth))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${hasMore ? `
        <div class="list-more">
          <span>يعرض ${formatArabicNumber(visibleLimit)} من ${formatArabicNumber(apartments.length)}</span>
          <button class="secondary-btn" type="button" data-action="toggle-long-list">مشاهدة المزيد</button>
        </div>
      ` : ""}
    </div>
  `;
}

function renderRecentActivity() {
  const activity = [
    ...state.payments.map((item) => ({ ...item, type: "payment", date: item.paidAt })),
    ...state.expenses.map((item) => ({ ...item, type: "expense", date: item.spentAt }))
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);

  if (!activity.length) return emptyState("لا توجد حركات", "ابدأ بتسجيل مدفوعات أو مصروفات.");
  return `
    <table class="activity-table responsive-table">
      <thead><tr><th>النوع</th><th>البيان</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
      <tbody>
        ${activity.map((item) => `
          <tr>
            <td><span class="badge ${item.type === "payment" ? "paid" : "pending"}">${item.type === "payment" ? "دفع" : "مصروف"}</span></td>
            <td>${item.type === "payment" ? apartmentLabel(getApartment(item.apartmentId)) : escapeHtml(item.title)}</td>
            <td>${currency(item.amount)}</td>
            <td>${formatDate(item.date)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function statCard(label, value, className = "") {
  return `<div class="stat"><span>${label}</span><strong class="${className}">${value}</strong></div>`;
}

function arabicMonthField(id, name, label, value) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return `
    <div class="field arabic-month-field">
      <label for="${id}Year">${label}</label>
      <input id="${id}" type="hidden" name="${name}" value="${escapeHtml(value)}">
      <div class="month-picker compact">
        <select id="${id}Month" data-month-part="month">
          ${ARABIC_MONTHS.map((monthName, index) => `<option value="${index + 1}" ${index + 1 === month ? "selected" : ""}>${monthName}</option>`).join("")}
        </select>
        <select id="${id}Year" data-month-part="year">
          ${yearOptions(year)}
        </select>
      </div>
    </div>
  `;
}

function syncArabicMonthField(group) {
  if (!group) return;
  const hidden = group.querySelector("input[type='hidden']");
  const month = group.querySelector("[data-month-part='month']");
  const year = group.querySelector("[data-month-part='year']");
  if (!hidden || !month || !year) return;
  hidden.value = `${year.value}-${String(month.value).padStart(2, "0")}`;
}

function arabicDateField(id, name, label, value) {
  const [year, month, day] = value.split("-").map(Number);
  return `
    <div class="field arabic-date-field">
      <label for="${id}Day">${label}</label>
      <input id="${id}" type="hidden" name="${name}" value="${escapeHtml(value)}">
      <div class="date-picker">
        <select id="${id}Day" data-date-part="day">
          ${dayOptions(year, month, day)}
        </select>
        <select id="${id}Month" data-date-part="month">
          ${ARABIC_MONTHS.map((monthName, index) => `<option value="${index + 1}" ${index + 1 === month ? "selected" : ""}>${monthName}</option>`).join("")}
        </select>
        <select id="${id}Year" data-date-part="year">
          ${yearOptions(year)}
        </select>
      </div>
    </div>
  `;
}

function syncArabicDateField(group) {
  if (!group) return;
  const hidden = group.querySelector("input[type='hidden']");
  const day = group.querySelector("[data-date-part='day']");
  const month = group.querySelector("[data-date-part='month']");
  const year = group.querySelector("[data-date-part='year']");
  if (!hidden || !day || !month || !year) return;

  const selectedDay = Math.min(Number(day.value), daysInMonth(Number(year.value), Number(month.value)));
  day.innerHTML = dayOptions(Number(year.value), Number(month.value), selectedDay);
  hidden.value = `${year.value}-${String(month.value).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
}

function dayOptions(year, month, selectedDay) {
  const total = daysInMonth(year, month);
  return Array.from({ length: total }, (_, index) => index + 1)
    .map((day) => `<option value="${day}" ${day === selectedDay ? "selected" : ""}>${formatArabicNumber(day)}</option>`)
    .join("");
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function yearOptions(centerYear) {
  const start = centerYear - 4;
  const years = Array.from({ length: 9 }, (_, index) => start + index);
  return years
    .map((year) => `<option value="${year}" ${year === centerYear ? "selected" : ""}>${formatArabicNumber(year)}</option>`)
    .join("");
}

function fileUploadField(id, name, label, hint) {
  return `
    <div class="field file-field">
      <label for="${id}">${label}</label>
      <label class="upload-box" for="${id}">
        <input class="file-input" id="${id}" type="file" name="${name}" accept="image/*,application/pdf">
        <span class="upload-icon">↑</span>
        <span class="upload-content">
          <strong>اختر ملفًا للرفع</strong>
          <small>${hint} · JPG / PNG / WEBP / PDF</small>
          <em class="upload-file-name">لم يتم اختيار ملف</em>
        </span>
      </label>
    </div>
  `;
}

function imageCell(src) {
  if (!src) return '<span class="small-muted">لا توجد</span>';
  const safeSrc = escapeHtml(src);
  if (isPdf(src)) {
    return `
      <a class="attachment-card pdf-card" href="${safeSrc}" target="_blank" rel="noopener">
        <span class="attachment-icon">PDF</span>
        <span>
          <strong>ملف PDF</strong>
          <small>فتح المرفق</small>
        </span>
      </a>
    `;
  }
  return `
    <button class="attachment-card image-card" data-action="show-image" data-src="${safeSrc}">
      <img class="receipt-thumb" src="${safeSrc}" alt="صورة">
      <span>
        <strong>صورة</strong>
        <small>عرض المرفق</small>
      </span>
    </button>
  `;
}

function isPdf(src) {
  return String(src).toLowerCase().split("?")[0].endsWith(".pdf");
}

function emptyState(title, text) {
  return `<div class="empty-state"><strong>${title}</strong><p>${text}</p></div>`;
}

function paymentsForMonth(month, apartmentId = null) {
  return state.payments.filter((payment) => payment.month === month && (!apartmentId || String(payment.apartmentId) === String(apartmentId)));
}

function expensesForMonth(month) {
  return state.expenses.filter((expense) => expense.month === month);
}

function sharedChargesForMonth(month) {
  return (state.sharedCharges || []).filter((charge) => charge.month === month);
}

function sharedChargeTotalForMonth(month) {
  return sum(sharedChargesForMonth(month), "amount");
}

function sharedChargeShareForMonth(month) {
  const count = chargeableApartments().length;
  if (!count) return 0;
  return Math.round((sharedChargeTotalForMonth(month) / count) * 100) / 100;
}

function sharedChargeShare(charge) {
  const count = chargeableApartments().length;
  if (!count) return 0;
  return Math.round((Number(charge.amount || 0) / count) * 100) / 100;
}

function paymentDueForMonth(month) {
  return MONTHLY_FEE + sharedChargeShareForMonth(month);
}

function unpaidCount(month) {
  return chargeableApartments().filter((apt) => debtForApartment(apt.id, month) > 0).length;
}

function debtForApartment(apartmentId, throughMonth) {
  const apt = getApartment(apartmentId);
  if (!isApartmentChargeable(apt)) return 0;
  const months = monthsBetween(firstTrackedMonth(), throughMonth);
  const paidMonths = new Set(state.payments.filter((payment) => String(payment.apartmentId) === String(apartmentId)).map((payment) => payment.month));
  const monthlyDebt = months
    .filter((month) => !paidMonths.has(month))
    .reduce((total, month) => total + paymentDueForMonth(month), 0);
  return monthlyDebt + Number(apt.previousArrears || 0);
}

function chargeableApartments() {
  return state.apartments.filter(isApartmentChargeable);
}

function isApartmentChargeable(apt) {
  return (apt.finishStatus || "finished") === "finished";
}

function firstTrackedMonth() {
  const allMonths = [
    ...state.payments.map((p) => p.month),
    ...state.expenses.map((e) => e.month),
    ...(state.sharedCharges || []).map((c) => c.month),
    activeMonth
  ];
  return allMonths.sort()[0] || activeMonth;
}

function monthsBetween(startMonth, endMonth) {
  const result = [];
  let year = Number(startMonth.slice(0, 4));
  let month = Number(startMonth.slice(5, 7));
  const endYear = Number(endMonth.slice(0, 4));
  const endMonthNumber = Number(endMonth.slice(5, 7));

  while (year < endYear || (year === endYear && month <= endMonthNumber)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return result;
}

function getApartment(id) {
  return state.apartments.find((apt) => String(apt.id) === String(id)) || {};
}

function apartmentLabel(apt) {
  if (!apt) return "شقة";
  const floor = apt.floorNumber || Math.ceil(Number(apt.number || apt.apartmentNumber || 1) / 4);
  const unit = apt.unitNumber || (((Number(apt.number || apt.apartmentNumber || 1) - 1) % 4) + 1);
  return `الدور ${formatArabicNumber(floor)} - شقة ${formatArabicNumber(unit)}`;
}

function avatarIcon(role) {
  const adminBadge = role === "admin" ? '<path d="M12 3l3 2v3c0 2.5-1.2 4.2-3 5.2C10.2 12.2 9 10.5 9 8V5l3-2Z"/>' : '';
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4"></circle>
      <path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6"></path>
      ${adminBadge}
    </svg>
  `;
}

function occupancyLabel(value) {
  return value === "tenant" ? "مستأجر" : "مالك";
}

function finishStatusLabel(value) {
  return value === "unfinished" ? "لم يشطب" : "مشطب";
}

function finishStatusClass(value) {
  return value === "unfinished" ? "pending" : "paid";
}

function methodLabel(value) {
  return { wallet: "محفظة", instapay: "إنستا باي", cash: "كاش" }[value] || value;
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function totalIncome() {
  return sum(state.payments, "amount");
}

function totalExpenses() {
  return sum(state.expenses, "amount");
}

function currency(value) {
  return `${formatNumber(value)} ج.م`;
}

function formatMonth(month) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  return `${ARABIC_MONTHS[monthIndex] || ""} ${formatArabicNumber(year)}`.trim();
}

function formatDate(date) {
  const [year, month, day] = String(date).split("-").map(Number);
  return `${formatArabicNumber(day)} ${ARABIC_MONTHS[month - 1]} ${formatArabicNumber(year)}`;
}

function todayISO() {
  const parts = egyptDateParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function egyptMonthValue() {
  const parts = egyptDateParts();
  return `${parts.year}-${parts.month}`;
}

function egyptDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day")
  };
}

function formatArabicNumber(value) {
  return formatNumber(value, false);
}

function formatNumber(value, useGrouping = true) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, useGrouping }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(action, body = null) {
  const options = body ? { method: "POST", body } : {};
  try {
    const response = await fetch(`api?action=${encodeURIComponent(action)}`, options);
    return await response.json();
  } catch {
    return { ok: false, message: "تعذر الاتصال بالسيرفر." };
  }
}

async function postAction(action, values) {
  const body = new FormData();
  Object.entries(values).forEach(([key, value]) => body.append(key, value));
  return api(action, body);
}

function exportData() {
  const report = buildPdfReport();
  const win = window.open("", "_blank");
  if (!win) {
    alert("برجاء السماح بفتح النوافذ المنبثقة لتصدير التقرير PDF.");
    return;
  }

  win.document.open();
  win.document.write(report);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

function buildPdfReport() {
  const monthPayments = paymentsForMonth(activeMonth);
  const paidApartmentIds = new Set(monthPayments.map((payment) => String(payment.apartmentId)));
  const chargeable = chargeableApartments();
  const paid = chargeable.filter((apt) => paidApartmentIds.has(String(apt.id)));
  const unpaid = chargeable.filter((apt) => debtForApartment(apt.id, activeMonth) > 0);
  const exempt = state.apartments.filter((apt) => !isApartmentChargeable(apt));
  const totalDue = chargeable.reduce((total, apt) => total + debtForApartment(apt.id, activeMonth), 0);
  const totalPaid = sum(monthPayments, "amount");
  const rows = state.apartments.map((apt) => {
    const paidThisMonth = paidApartmentIds.has(String(apt.id));
    const chargeableApt = isApartmentChargeable(apt);
    const due = debtForApartment(apt.id, activeMonth);
    const status = !chargeableApt ? "غير مطالب" : (paidThisMonth && due === 0 ? "دفع" : "لم يدفع");
    return `
      <tr>
        <td>${apartmentLabel(apt)}</td>
        <td>${escapeHtml(apt.residentName || "-")}</td>
        <td>${escapeHtml(apt.phone || "-")}</td>
        <td>${finishStatusLabel(apt.finishStatus)}</td>
        <td><span class="status ${status === "دفع" ? "paid" : status === "لم يدفع" ? "unpaid" : "pending"}">${status}</span></td>
        <td>${currency(due)}</td>
      </tr>
    `;
  }).join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>تقرير خدمات برج العامر - ${formatMonth(activeMonth)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; font-family: Cairo, Tahoma, Arial, sans-serif; color: #17211c; background: #f6f5ef; }
    .sheet { max-width: 1100px; margin: 0 auto; background: #fff; border: 1px solid #ddd9ca; border-radius: 10px; overflow: hidden; }
    header { padding: 24px; color: #fff; background: #10231f; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 26px; }
    header p { color: #c8d7d1; margin-top: 6px; }
    .mark { width: 58px; height: 58px; border-radius: 14px; background: linear-gradient(135deg, #6b3f1d, #8a5a2b); color: #fff7df; display: grid; place-items: center; font-size: 28px; font-weight: 900; }
    .content { padding: 22px; display: grid; gap: 18px; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
    .stat { border: 1px solid #ddd9ca; border-radius: 8px; padding: 12px; background: #fbfaf6; }
    .stat span { color: #66736b; font-size: 12px; }
    .stat strong { display: block; margin-top: 5px; font-size: 20px; }
    .section-title { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #ddd9ca; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px; border-bottom: 1px solid #e7e3d6; text-align: right; font-size: 13px; }
    th { background: #fbfaf6; color: #66736b; font-weight: 800; }
    tr:last-child td { border-bottom: 0; }
    .status { display: inline-block; min-width: 72px; text-align: center; border-radius: 999px; padding: 4px 9px; font-weight: 800; font-size: 12px; }
    .status.paid { color: #16803c; background: #edf8ef; }
    .status.unpaid { color: #b42318; background: #fff0ed; }
    .status.pending { color: #8a5a00; background: #fff7df; }
    .lists { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .mini-list { border: 1px solid #ddd9ca; border-radius: 8px; padding: 14px; background: #fbfaf6; }
    .mini-list h2 { font-size: 16px; margin-bottom: 10px; }
    .name-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .name-card { border: 1px solid #e7e3d6; border-radius: 8px; background: #fff; padding: 9px; display: grid; gap: 3px; }
    .name-card strong { font-size: 12px; color: #17211c; }
    .name-card span { font-size: 11px; color: #66736b; }
    .mini-list p { color: #66736b; line-height: 1.8; }
    @media print {
      body { padding: 0; background: #fff; }
      .sheet { border: 0; border-radius: 0; }
      @page { size: A4 landscape; margin: 10mm; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header>
      <div>
        <h1>تقرير خدمات برج العامر</h1>
        <p>${formatMonth(activeMonth)} · تاريخ التصدير ${formatDate(todayISO())}</p>
      </div>
      <div class="mark">ع</div>
    </header>
    <section class="content">
      <div class="stats">
        <div class="stat"><span>الشقق المشطبة</span><strong>${formatNumber(chargeable.length)}</strong></div>
        <div class="stat"><span>دفعت</span><strong>${formatNumber(paid.length)}</strong></div>
        <div class="stat"><span>لم تدفع</span><strong>${formatNumber(unpaid.length)}</strong></div>
        <div class="stat"><span>غير مطالبة</span><strong>${formatNumber(exempt.length)}</strong></div>
        <div class="stat"><span>إجمالي المطلوب</span><strong>${currency(totalDue)}</strong></div>
      </div>
      <div class="stats">
        <div class="stat"><span>مدفوع الشهر</span><strong>${currency(totalPaid)}</strong></div>
        <div class="stat"><span>خدمة الشهر</span><strong>${currency(MONTHLY_FEE)}</strong></div>
        <div class="stat"><span>مطالبات جماعية</span><strong>${currency(sharedChargeTotalForMonth(activeMonth))}</strong></div>
        <div class="stat"><span>نصيب الشقة</span><strong>${currency(sharedChargeShareForMonth(activeMonth))}</strong></div>
        <div class="stat"><span>المتبقي</span><strong>${currency(Math.max(totalDue - totalPaid, 0))}</strong></div>
      </div>
      <div class="lists">
        <div class="mini-list"><h2>الشقق التي لم تدفع</h2>${reportNameCards(unpaid, "لا توجد شقق غير مسددة.")}</div>
        <div class="mini-list"><h2>الشقق التي دفعت</h2>${reportNameCards(paid, "لا توجد مدفوعات لهذا الشهر.")}</div>
      </div>
      <div>
        <div class="section-title"><h2>تفاصيل كل شقة</h2><p>${formatMonth(activeMonth)}</p></div>
        <table>
          <thead><tr><th>الشقة</th><th>الاسم</th><th>الهاتف</th><th>التشطيب</th><th>الحالة</th><th>المطلوب</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function reportNameCards(apartments, emptyText) {
  if (!apartments.length) return `<p>${emptyText}</p>`;
  return `
    <div class="name-grid">
      ${apartments.map((apt) => `
        <div class="name-card">
          <strong>${escapeHtml(apt.residentName || "بدون اسم")}</strong>
          <span>${apartmentLabel(apt)} · ${escapeHtml(apt.phone || "لا يوجد هاتف")}</span>
        </div>
      `).join("")}
    </div>
  `;
}
