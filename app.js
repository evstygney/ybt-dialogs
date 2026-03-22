const DATA_ROOT = "./data";
const HISTORY_KEY = "psyvit-ybt-history";

const state = {
  manifest: null,
  scenarios: new Map(),
  modules: [],
  history: loadHistory(),
  selectedModule: null,
  currentScenario: null,
  currentStepIndex: 0,
  answers: [],
  view: "loading",
  error: "",
  deferredInstallPrompt: null,
};

const app = document.querySelector("#app");
const heroStats = document.querySelector("#hero-stats");

boot();

async function boot() {
  registerServiceWorker();
  bindPwaEvents();
  renderLoading();

  try {
    const manifest = await fetchJson(`${DATA_ROOT}/manifest.json`);
    const modules = manifest.modules ?? [];
    const exerciseIds = modules.flatMap((module) => module.exercise_ids ?? []);
    const scenarioEntries = await Promise.all(
      exerciseIds.map(async (id) => [id, await fetchJson(`${DATA_ROOT}/scenarios/${id}.json`)]),
    );

    state.manifest = manifest;
    state.modules = modules;
    state.scenarios = new Map(scenarioEntries);
    state.view = "home";
    render();
  } catch (error) {
    state.view = "error";
    state.error = error instanceof Error ? error.message : String(error);
    render();
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${path}`);
  }
  return response.json();
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
}

function render() {
  renderHeroStats();

  if (state.view === "loading") {
    renderLoading();
    return;
  }

  if (state.view === "error") {
    const template = document.querySelector("#error-template").content.cloneNode(true);
    template.querySelector("#error-text").textContent = state.error;
    app.replaceChildren(template);
    return;
  }

  const fragment = document.createDocumentFragment();
  fragment.append(renderLeftColumn());
  fragment.append(renderRightColumn());
  app.replaceChildren(fragment);
}

function renderLoading() {
  const template = document.querySelector("#loading-template").content.cloneNode(true);
  app.replaceChildren(template);
}

function renderHeroStats() {
  if (!state.manifest) {
    heroStats.innerHTML = "";
    return;
  }

  const totalExercises = state.modules.reduce((sum, module) => sum + module.exercise_ids.length, 0);
  const totalRuns = state.history.length;
  const passedRuns = state.history.filter((item) => item.passed).length;
  const latestRun = state.history[0];

  heroStats.innerHTML = `
    <div>
      <p class="panel__label">Пакет</p>
      <h3>${escapeHtml(state.manifest.program)}</h3>
      <p class="muted">${escapeHtml(state.manifest.description)}</p>
    </div>
    <div class="stats-grid">
      <div class="stat">
        <p class="badge">Модулей</p>
        <strong>${state.modules.length}</strong>
      </div>
      <div class="stat">
        <p class="badge">Упражнений</p>
        <strong>${totalExercises}</strong>
      </div>
      <div class="stat">
        <p class="badge">Прохождений</p>
        <strong>${totalRuns}</strong>
      </div>
    </div>
    <div class="meta-row">
      <span class="pill ${passedRuns === totalRuns && totalRuns ? "pill--pass" : "pill--accent"}">
        Успешных: ${passedRuns}/${totalRuns}
      </span>
      <span class="pill">Версия ${escapeHtml(state.manifest.version)}</span>
    </div>
    ${
      latestRun
        ? `<p class="fineprint">Последний запуск: ${escapeHtml(latestRun.title)} • ${formatDateTime(latestRun.completedAt)}</p>`
        : `<p class="fineprint">История пока пуста. Запустите первое упражнение.</p>`
    }
  `;

  const actionRow = document.createElement("div");
  actionRow.className = "inline-actions";

  const installButton = document.createElement("button");
  installButton.className = "secondary";
  installButton.textContent = "Установить web-app";
  installButton.disabled = !state.deferredInstallPrompt;
  installButton.addEventListener("click", installPwa);
  actionRow.append(installButton);

  heroStats.append(actionRow);
}

function renderLeftColumn() {
  const section = document.createElement("section");
  section.className = "stack";

  if (state.view === "home") {
    section.append(renderHomePanel());
  } else if (state.view === "exercise") {
    section.append(renderExercisePanel());
  } else if (state.view === "result") {
    section.append(renderResultPanel());
  }

  return section;
}

function renderRightColumn() {
  const aside = document.createElement("aside");
  aside.className = "stack";
  aside.append(renderOverviewPanel());
  aside.append(renderHistoryPanel());
  return aside;
}

function renderHomePanel() {
  const panel = wrapPanel("Обзор", "Выберите модуль и запустите упражнение");

  const description = document.createElement("p");
  description.className = "muted";
  description.textContent =
    "Движок читает упражнения из manifest и JSON-сценариев. Изменения в контенте не требуют правок приложения.";
  panel.append(description);

  const moduleGrid = document.createElement("div");
  moduleGrid.className = "module-grid";

  for (const module of state.modules) {
    const card = document.createElement("article");
    card.className = "card module-card";
    card.dataset.module = module.name;

    const scenarios = module.exercise_ids.map((id) => state.scenarios.get(id)).filter(Boolean);
    const avgMinutes =
      Math.round(scenarios.reduce((sum, scenario) => sum + (scenario.estimated_minutes ?? 0), 0) / scenarios.length) || 0;

    card.innerHTML = `
      <p class="panel__label">${escapeHtml(module.name)}</p>
      <h3>${escapeHtml(getModuleHeadline(module.name))}</h3>
      <p class="muted">${scenarios.length} упражнений, в среднем ${avgMinutes} мин на одно.</p>
      <div class="meta-row">
        <span class="chip">JSON-driven</span>
        <span class="chip">${escapeHtml(module.exercise_ids.join(" • "))}</span>
      </div>
    `;

    const action = document.createElement("button");
    action.textContent = "Открыть модуль";
    action.addEventListener("click", () => {
      state.selectedModule = module.name;
      render();
    });
    card.append(action);
    moduleGrid.append(card);
  }

  panel.append(moduleGrid);

  if (state.selectedModule) {
    panel.append(renderExerciseList(state.selectedModule));
  }

  return panel;
}

function renderExerciseList(moduleName) {
  const wrapper = document.createElement("section");
  wrapper.className = "stack";

  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `
    <div>
      <p class="panel__label">Модуль</p>
      <h3>${escapeHtml(moduleName)}</h3>
    </div>
  `;

  const resetButton = document.createElement("button");
  resetButton.className = "ghost";
  resetButton.textContent = "Сбросить выбор";
  resetButton.addEventListener("click", () => {
    state.selectedModule = null;
    render();
  });
  header.append(resetButton);

  wrapper.append(header);

  const grid = document.createElement("div");
  grid.className = "exercise-grid";

  const module = state.modules.find((item) => item.name === moduleName);
  for (const exerciseId of module.exercise_ids) {
    const scenario = state.scenarios.get(exerciseId);
    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <p class="panel__label">${escapeHtml(scenario.exercise_id)}</p>
      <h3>${escapeHtml(scenario.title)}</h3>
      <p>${escapeHtml(scenario.description)}</p>
      <div class="meta-row">
        <span class="pill">${scenario.steps.length} шага</span>
        <span class="pill">${scenario.estimated_minutes} мин</span>
        <span class="pill">${getScenarioMaxScore(scenario)} макс. баллов</span>
      </div>
      <p class="fineprint">Цель: ${escapeHtml(scenario.objective)}</p>
    `;

    const actionRow = document.createElement("div");
    actionRow.className = "inline-actions";

    const launch = document.createElement("button");
    launch.textContent = "Запустить";
    launch.addEventListener("click", () => startScenario(scenario.exercise_id));
    actionRow.append(launch);

    const inspect = document.createElement("button");
    inspect.className = "secondary";
    inspect.textContent = "Показать оси";
    inspect.addEventListener("click", () => {
      alert(
        `self: ${scenario.ybt_weights.self}, business: ${scenario.ybt_weights.business}, team: ${scenario.ybt_weights.team}`,
      );
    });
    actionRow.append(inspect);

    card.append(actionRow);
    grid.append(card);
  }

  wrapper.append(grid);
  return wrapper;
}

function renderExercisePanel() {
  const scenario = state.currentScenario;
  const currentStep = scenario.steps[state.currentStepIndex];
  const selectedAnswer = state.answers[state.currentStepIndex];
  const progressValue = ((state.currentStepIndex + 1) / scenario.steps.length) * 100;
  const reveal = Boolean(selectedAnswer);

  const panel = wrapPanel("Упражнение", scenario.title);

  const summary = document.createElement("div");
  summary.className = "stack";
  summary.innerHTML = `
    <div class="meta-row">
      <span class="pill">${escapeHtml(scenario.module)}</span>
      <span class="pill">${scenario.estimated_minutes} мин</span>
      <span class="pill">${scenario.steps.length} шага</span>
      <span class="pill">Порог ${scenario.engine.pass_threshold}%</span>
    </div>
    <p class="muted">${escapeHtml(scenario.description)}</p>
    <div class="progress" aria-label="Прогресс упражнения">
      <span style="width: ${progressValue}%"></span>
    </div>
  `;
  panel.append(summary);

  const questionCard = document.createElement("article");
  questionCard.className = "card";
  questionCard.innerHTML = `
    <p class="panel__label">Шаг ${state.currentStepIndex + 1} / ${scenario.steps.length}</p>
    <h3>${escapeHtml(currentStep.scene_title)}</h3>
    <p>${escapeHtml(currentStep.text)}</p>
  `;

  const optionList = document.createElement("div");
  optionList.className = "option-list";

  for (const option of currentStep.options) {
    const button = document.createElement("button");
    button.className = "option";
    if (selectedAnswer?.optionId === option.id) {
      button.classList.add("selected");
      button.classList.add(option.correct ? "correct" : "incorrect");
    } else if (reveal && option.id === currentStep.correct_option_id) {
      button.classList.add("correct");
    }
    button.disabled = reveal;
    button.innerHTML = `
      <strong>${escapeHtml(option.text)}</strong>
      <div class="meta-row">
        <span class="chip">score ${option.score}</span>
        <span class="chip">self ${formatSigned(option.ybt_delta.self)}</span>
        <span class="chip">business ${formatSigned(option.ybt_delta.business)}</span>
        <span class="chip">team ${formatSigned(option.ybt_delta.team)}</span>
      </div>
    `;
    button.addEventListener("click", () => answerCurrentStep(option.id));
    optionList.append(button);
  }

  questionCard.append(optionList);
  panel.append(questionCard);

  if (selectedAnswer) {
    const chosenOption = currentStep.options.find((option) => option.id === selectedAnswer.optionId);
    const feedback = document.createElement("section");
    feedback.className = "stack";
    feedback.innerHTML = `
      <div class="consequence-box">
        <p class="panel__label">Consequence</p>
        <p>${escapeHtml(chosenOption.consequence)}</p>
      </div>
      <div class="feedback-box">
        <p class="panel__label">Разбор</p>
        <p>${escapeHtml(chosenOption.correct ? currentStep.feedback.correct : currentStep.feedback.incorrect)}</p>
      </div>
    `;
    panel.append(feedback);

    const actions = document.createElement("div");
    actions.className = "inline-actions";

    const next = document.createElement("button");
    next.textContent = state.currentStepIndex === scenario.steps.length - 1 ? "Показать результат" : "Следующий шаг";
    next.addEventListener("click", advanceStep);
    actions.append(next);

    const restart = document.createElement("button");
    restart.className = "ghost";
    restart.textContent = "Начать заново";
    restart.addEventListener("click", () => startScenario(scenario.exercise_id));
    actions.append(restart);

    panel.append(actions);
  }

  return panel;
}

function renderResultPanel() {
  const scenario = state.currentScenario;
  const outcome = buildScenarioOutcome(scenario, state.answers);
  const panel = wrapPanel("Результат", scenario.title);

  const grid = document.createElement("div");
  grid.className = "result-grid";

  const left = document.createElement("section");
  left.className = "stack";
  left.innerHTML = `
    <div class="summary-box">
      <p class="panel__label">Итог</p>
      <h3>${outcome.passed ? "Порог пройден" : "Нужен повтор"}</h3>
      <p>${escapeHtml(scenario.completion_feedback)}</p>
    </div>
    <div class="stats-grid">
      <div class="stat">
        <p class="badge">Баллы</p>
        <strong>${outcome.totalScore}</strong>
      </div>
      <div class="stat">
        <p class="badge">Максимум</p>
        <strong>${outcome.maxScore}</strong>
      </div>
      <div class="stat">
        <p class="badge">Результат</p>
        <strong>${outcome.percent}%</strong>
      </div>
    </div>
    <div class="meta-row">
      <span class="pill ${outcome.passed ? "pill--pass" : "pill--fail"}">
        ${outcome.passed ? "Pass" : "Retry"}
      </span>
      <span class="pill">Правильных шагов: ${outcome.correctCount}/${scenario.steps.length}</span>
    </div>
  `;

  const right = document.createElement("section");
  right.className = "stack";

  const axisCard = document.createElement("div");
  axisCard.className = "card";
  axisCard.innerHTML = `
    <p class="panel__label">YBT профиль</p>
    <h3>Накопленные дельты по осям</h3>
    <div class="axis-list">
      ${renderAxisRow("self", outcome.axis.self)}
      ${renderAxisRow("business", outcome.axis.business)}
      ${renderAxisRow("team", outcome.axis.team)}
    </div>
  `;

  const tips = document.createElement("div");
  tips.className = "card";
  tips.innerHTML = `
    <p class="panel__label">Retry tips</p>
    <h3>На что смотреть при повторе</h3>
    <ul>
      ${scenario.retry_tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}
    </ul>
  `;

  right.append(axisCard, tips);
  grid.append(left, right);
  panel.append(grid);

  const actions = document.createElement("div");
  actions.className = "inline-actions";

  const retryButton = document.createElement("button");
  retryButton.textContent = "Пройти заново";
  retryButton.addEventListener("click", () => startScenario(scenario.exercise_id));

  const homeButton = document.createElement("button");
  homeButton.className = "secondary";
  homeButton.textContent = "К списку упражнений";
  homeButton.addEventListener("click", () => {
    state.view = "home";
    state.selectedModule = scenario.module;
    render();
  });

  const exportJsonButton = document.createElement("button");
  exportJsonButton.className = "ghost";
  exportJsonButton.textContent = "Экспорт JSON";
  exportJsonButton.addEventListener("click", () => exportCurrentResult("json"));

  const exportCsvButton = document.createElement("button");
  exportCsvButton.className = "ghost";
  exportCsvButton.textContent = "Экспорт CSV";
  exportCsvButton.addEventListener("click", () => exportCurrentResult("csv"));

  actions.append(retryButton, homeButton, exportJsonButton, exportCsvButton);
  panel.append(actions);
  return panel;
}

function renderOverviewPanel() {
  const panel = wrapPanel("Статус", "Что умеет текущая сборка");
  panel.innerHTML += `
    <div class="stack">
      <div class="card">
        <p class="panel__label">Движок</p>
        <h3>Single choice + immediate feedback</h3>
        <p>Каждый шаг показывает consequence и корректирующий разбор сразу после ответа.</p>
      </div>
      <div class="card">
        <p class="panel__label">Данные</p>
        <h3>Manifest-first загрузка</h3>
        <p>Все 9 упражнений подхватываются из <code>/data/manifest.json</code>, тексты живут в отдельных JSON.</p>
      </div>
      <div class="card">
        <p class="panel__label">Результаты</p>
        <h3>localStorage + export</h3>
        <p>История прохождений сохраняется локально и выгружается в <code>JSON</code> или <code>CSV</code>.</p>
      </div>
    </div>
  `;
  return panel;
}

function renderHistoryPanel() {
  const panel = wrapPanel("История", "Последние прохождения");

  const actions = document.createElement("div");
  actions.className = "inline-actions";

  const exportAllJson = document.createElement("button");
  exportAllJson.className = "ghost";
  exportAllJson.textContent = "Вся история JSON";
  exportAllJson.disabled = state.history.length === 0;
  exportAllJson.addEventListener("click", () => downloadFile("psyvit-ybt-history.json", JSON.stringify(state.history, null, 2), "application/json"));

  const exportAllCsv = document.createElement("button");
  exportAllCsv.className = "ghost";
  exportAllCsv.textContent = "Вся история CSV";
  exportAllCsv.disabled = state.history.length === 0;
  exportAllCsv.addEventListener("click", () => {
    downloadFile("psyvit-ybt-history.csv", buildHistoryCsv(state.history), "text/csv;charset=utf-8");
  });

  actions.append(exportAllJson, exportAllCsv);
  panel.append(actions);

  if (state.history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "История появится после первого завершённого упражнения.";
    panel.append(empty);
    return panel;
  }

  const grid = document.createElement("div");
  grid.className = "history-grid";

  for (const item of state.history.slice(0, 6)) {
    const card = document.createElement("article");
    card.className = "history-item";
    card.innerHTML = `
      <p class="panel__label">${escapeHtml(item.exerciseId)}</p>
      <h3>${escapeHtml(item.title)}</h3>
      <div class="meta-row">
        <span class="pill ${item.passed ? "pill--pass" : "pill--fail"}">${item.percent}%</span>
        <span class="pill">${item.totalScore}/${item.maxScore}</span>
      </div>
      <p class="fineprint">${formatDateTime(item.completedAt)}</p>
    `;
    grid.append(card);
  }

  panel.append(grid);
  return panel;
}

function wrapPanel(label, title) {
  const section = document.createElement("section");
  section.className = "panel";
  section.innerHTML = `
    <p class="panel__label">${escapeHtml(label)}</p>
    <h2>${escapeHtml(title)}</h2>
  `;
  return section;
}

function startScenario(exerciseId) {
  state.currentScenario = state.scenarios.get(exerciseId);
  state.currentStepIndex = 0;
  state.answers = [];
  state.view = "exercise";
  render();
}

function answerCurrentStep(optionId) {
  const scenario = state.currentScenario;
  const step = scenario.steps[state.currentStepIndex];
  const option = step.options.find((item) => item.id === optionId);

  state.answers[state.currentStepIndex] = {
    stepId: step.step_id,
    optionId,
    correct: option.correct,
    score: option.score,
    ybtDelta: option.ybt_delta,
  };

  render();
}

function advanceStep() {
  const scenario = state.currentScenario;
  if (state.currentStepIndex < scenario.steps.length - 1) {
    state.currentStepIndex += 1;
    render();
    return;
  }

  finalizeScenario();
}

function finalizeScenario() {
  const scenario = state.currentScenario;
  const outcome = buildScenarioOutcome(scenario, state.answers);
  const historyItem = {
    exerciseId: scenario.exercise_id,
    module: scenario.module,
    title: scenario.title,
    completedAt: new Date().toISOString(),
    totalScore: outcome.totalScore,
    maxScore: outcome.maxScore,
    percent: outcome.percent,
    correctCount: outcome.correctCount,
    passed: outcome.passed,
    axis: outcome.axis,
    answers: state.answers,
  };

  state.history.unshift(historyItem);
  state.history = state.history.slice(0, 30);
  saveHistory();
  state.view = "result";
  render();
}

function buildScenarioOutcome(scenario, answers) {
  const maxScore = getScenarioMaxScore(scenario);
  const totalScore = answers.reduce((sum, answer) => sum + answer.score, 0);
  const correctCount = answers.filter((answer) => answer.correct).length;
  const percent = maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100);
  const axis = answers.reduce(
    (acc, answer) => ({
      self: acc.self + (answer.ybtDelta.self ?? 0),
      business: acc.business + (answer.ybtDelta.business ?? 0),
      team: acc.team + (answer.ybtDelta.team ?? 0),
    }),
    { self: 0, business: 0, team: 0 },
  );

  return {
    totalScore,
    maxScore,
    correctCount,
    percent,
    axis,
    passed: percent >= scenario.engine.pass_threshold,
  };
}

function getScenarioMaxScore(scenario) {
  return scenario.steps.reduce((sum, step) => {
    const bestScore = Math.max(...step.options.map((option) => option.score));
    return sum + bestScore;
  }, 0);
}

function exportCurrentResult(format) {
  const item = state.history[0];
  if (!item) return;

  if (format === "json") {
    downloadFile(
      `${item.exerciseId}-${item.completedAt.slice(0, 10)}.json`,
      JSON.stringify(item, null, 2),
      "application/json",
    );
    return;
  }

  downloadFile(
    `${item.exerciseId}-${item.completedAt.slice(0, 10)}.csv`,
    buildHistoryCsv([item]),
    "text/csv;charset=utf-8",
  );
}

function buildHistoryCsv(rows) {
  const header = [
    "exerciseId",
    "module",
    "title",
    "completedAt",
    "totalScore",
    "maxScore",
    "percent",
    "correctCount",
    "passed",
    "axisSelf",
    "axisBusiness",
    "axisTeam",
  ];

  const body = rows.map((row) =>
    [
      row.exerciseId,
      row.module,
      row.title,
      row.completedAt,
      row.totalScore,
      row.maxScore,
      row.percent,
      row.correctCount,
      row.passed,
      row.axis.self,
      row.axis.business,
      row.axis.team,
    ]
      .map(csvEscape)
      .join(","),
  );

  return [header.join(","), ...body].join("\n");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderAxisRow(axis, value) {
  const percentage = Math.max(0, Math.min(100, 50 + value * 8));
  return `
    <div class="axis-row" data-axis="${axis}">
      <strong>${axis}</strong>
      <div class="progress"><span style="width: ${percentage}%"></span></div>
      <span>${formatSigned(value)}</span>
    </div>
  `;
}

function getModuleHeadline(moduleName) {
  if (moduleName === "Я") return "Личная устойчивость и саморегуляция";
  if (moduleName === "Бизнес") return "Приоритеты, цели и рабочая ясность";
  if (moduleName === "Команда") return "Доверие, ответственность и взаимодействие";
  return moduleName;
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value);
}

function formatDateTime(isoString) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoString));
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function bindPwaEvents() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    renderHeroStats();
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    renderHeroStats();
  });
}

async function installPwa() {
  if (!state.deferredInstallPrompt) return;
  await state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  renderHeroStats();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
