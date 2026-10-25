// 音楽練習サポート - step-2 メトロノーム実装
// Web Audio API のスケジューリング機能を使って、バックグラウンドでも安定した拍子を再生します。

// ============================================================
// 設定機能（step-2）
// LocalStorage に設定値を保存・読み込みし、設定タブの UI に反映します。
// 他のメトロノーム・タイマー機能がページ読み込み時に設定値を参照できるよう、
// このIIFEをファイルの先頭（他の機能より前）に配置しています。
// ============================================================
(function () {
  'use strict';

  const STORAGE_KEY = 'practice-music-app:settings';

  const DEFAULT_SETTINGS = {
    volume: 80,
    theme: 'light',
    defaultBpm: 100,
    defaultTimerMinutes: 15,
  };

  const settingsForm = document.getElementById('settings-form');
  const volumeInput = document.getElementById('settings-volume');
  const volumeValueOutput = document.getElementById('settings-volume-value');
  const themeInput = document.getElementById('settings-theme');
  const themeText = document.getElementById('settings-theme-text');
  const defaultBpmInput = document.getElementById('settings-default-bpm');
  const defaultTimerInput = document.getElementById('settings-default-timer');

  // 設定タブが存在しないページでは何もしない
  if (!settingsForm) return;

  let currentSettings = loadSettings();

  // 設定変更を他の機能（メトロノーム・タイマー等）に通知するためのリスナー一覧
  const changeListeners = [];

  // ============================================================
  // 設定値の正規化
  // ============================================================
  function normalizeSettings(raw) {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_SETTINGS };
    }

    const volume = Number(raw.volume);
    const theme = raw.theme === 'dark' ? 'dark' : 'light';
    const defaultBpm = Number(raw.defaultBpm);
    const defaultTimerMinutes = Number(raw.defaultTimerMinutes);

    return {
      volume: Number.isFinite(volume)
        ? Math.max(0, Math.min(100, volume))
        : DEFAULT_SETTINGS.volume,
      theme,
      defaultBpm: Number.isFinite(defaultBpm)
        ? Math.max(40, Math.min(208, defaultBpm))
        : DEFAULT_SETTINGS.defaultBpm,
      defaultTimerMinutes: Number.isFinite(defaultTimerMinutes)
        ? Math.max(1, Math.min(120, defaultTimerMinutes))
        : DEFAULT_SETTINGS.defaultTimerMinutes,
    };
  }

  // ============================================================
  // LocalStorage 読み書き
  // ============================================================
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return normalizeSettings(parsed);
    } catch (err) {
      console.error('設定の読み込みに失敗しました:', err);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      currentSettings = normalizeSettings(settings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
      applySettingsToUI();
      notifyListeners();
    } catch (err) {
      console.error('設定の保存に失敗しました:', err);
    }
  }

  // ============================================================
  // UI 反映
  // ============================================================
  function applySettingsToUI() {
    if (volumeInput) volumeInput.value = currentSettings.volume;
    if (volumeValueOutput) volumeValueOutput.textContent = currentSettings.volume + '%';

    if (themeInput) {
      const isDark = currentSettings.theme === 'dark';
      themeInput.checked = isDark;
      themeInput.setAttribute('aria-checked', String(isDark));
    }
    if (themeText) {
      themeText.textContent = currentSettings.theme === 'dark' ? 'ダーク' : 'ライト';
    }

    if (defaultBpmInput) defaultBpmInput.value = currentSettings.defaultBpm;
    if (defaultTimerInput) defaultTimerInput.value = currentSettings.defaultTimerMinutes;

    // テーマをページ全体に反映する。<body data-theme="dark"> の有無を
    // style.css の [data-theme="dark"] セレクタで判定しています。
    if (currentSettings.theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }

  // ============================================================
  // 他機能からの取得用 getter
  // ============================================================
  function getSettings() {
    return { ...currentSettings };
  }

  // ============================================================
  // 設定変更の通知（メトロノーム・タイマー等への購読用）
  // ============================================================
  function onSettingsChange(callback) {
    if (typeof callback === 'function') {
      changeListeners.push(callback);
    }
  }

  function notifyListeners() {
    changeListeners.forEach((callback) => {
      try {
        callback(getSettings());
      } catch (err) {
        console.error('設定変更コールバックの実行に失敗しました:', err);
      }
    });
  }

  // ============================================================
  // UI 変更時の自動保存
  // ============================================================
  function collectSettingsFromUI() {
    return normalizeSettings({
      volume: volumeInput ? Number(volumeInput.value) : currentSettings.volume,
      theme: themeInput && themeInput.checked ? 'dark' : 'light',
      defaultBpm: defaultBpmInput
        ? Number(defaultBpmInput.value)
        : currentSettings.defaultBpm,
      defaultTimerMinutes: defaultTimerInput
        ? Number(defaultTimerInput.value)
        : currentSettings.defaultTimerMinutes,
    });
  }

  function handleSettingsInput() {
    saveSettings(collectSettingsFromUI());
  }

  if (volumeInput) volumeInput.addEventListener('input', handleSettingsInput);
  if (themeInput) themeInput.addEventListener('change', handleSettingsInput);
  if (defaultBpmInput) {
    defaultBpmInput.addEventListener('input', handleSettingsInput);
    defaultBpmInput.addEventListener('change', handleSettingsInput);
  }
  if (defaultTimerInput) {
    defaultTimerInput.addEventListener('input', handleSettingsInput);
    defaultTimerInput.addEventListener('change', handleSettingsInput);
  }

  // 他の IIFE からも参照できるよう window に公開
  window.practiceMusicApp = Object.assign(window.practiceMusicApp || {}, {
    getSettings: getSettings,
    onSettingsChange: onSettingsChange,
  });

  // 初期表示
  applySettingsToUI();
})();

(function () {
  'use strict';

  // ============================================================
  // タブ切り替え
  // ============================================================
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.tab-panel');

  function switchTab(targetId) {
    tabButtons.forEach((btn) => {
      const isTarget = btn.dataset.tab === targetId;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', String(isTarget));
    });

    tabPanels.forEach((panel) => {
      const isTarget = panel.id === targetId;
      panel.classList.toggle('active', isTarget);
      panel.hidden = !isTarget;
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ============================================================
  // メトロノーム要素
  // ============================================================
  const playButton = document.getElementById('metro-play');
  const bpmSlider = document.getElementById('metro-bpm-slider');
  const bpmNumber = document.getElementById('metro-bpm-number');
  const signatureSelect = document.getElementById('metro-signature');
  const tapButton = document.getElementById('metro-tap');
  const indicator = document.getElementById('metro-indicator');

  // ============================================================
  // メトロノーム状態
  // ============================================================
  let audioCtx = null;
  let isPlaying = false;
  let bpm = 120;
  let beatsPerMeasure = 4;
  let currentBeat = 0;       // 次に再生する拍（0が強拍）
  let nextNoteTime = 0.0;    // 次の拍を再生する時刻（AudioContext時間）
  let schedulerTimerId = null;

  // 設定（音量）。クリック音のゲインに反映します。0-100。
  // 設定IIFEから window.practiceMusicApp.getSettings() 経由で取得し、
  // onSettingsChange でリアルタイムに最新値を追従させます（step-3）。
  let currentVolume = 80;

  // スケジュール済みの拍情報。描画ループがここから現在の拍を判断します。
  const notesInQueue = [];

  // スケジューラー設定
  const LOOKAHEAD_MS = 25;        // スケジュールループの間隔
  const SCHEDULE_AHEAD_S = 0.1;   // 先読みしてスケジュールする秒数

  // ============================================================
  // AudioContext の初期化
  // ============================================================
  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // ============================================================
  // クリック音の生成
  // ============================================================
  function secondsPerBeat() {
    return 60.0 / bpm;
  }

  function scheduleNote(beatNumber, time) {
    // 描画用キューに追加
    notesInQueue.push({ beat: beatNumber, time: time });

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // 強拍は少し高く・大きくする
    const isAccent = beatNumber === 0;
    oscillator.frequency.value = isAccent ? 1200 : 800;
    // 設定の音量（0-100）をゲインの係数として反映する
    const peakVolume = (isAccent ? 1.0 : 0.55) * (currentVolume / 100);
    const clickDuration = 0.05;

    // 短い矩形波のようなクリック音を作る
    oscillator.type = 'square';

    const start = time;
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(peakVolume, start + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, start + clickDuration);

    oscillator.start(start);
    oscillator.stop(start + clickDuration);
  }

  function nextNote() {
    nextNoteTime += secondsPerBeat();
    currentBeat = (currentBeat + 1) % beatsPerMeasure;
  }

  // ============================================================
  // Web Audio API スケジューラー
  // setInterval ではなく、AudioContext.currentTime を基準に先読みスケジューリング
  // ============================================================
  function scheduler() {
    while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD_S) {
      scheduleNote(currentBeat, nextNoteTime);
      nextNote();
    }
    schedulerTimerId = setTimeout(scheduler, LOOKAHEAD_MS);
  }

  // ============================================================
  // 再生 / 停止
  // ============================================================
  function start() {
    initAudio();
    if (isPlaying) return;

    isPlaying = true;
    currentBeat = 0;
    notesInQueue.length = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;

    scheduler();
    updatePlayButton();
  }

  function stop() {
    isPlaying = false;

    if (schedulerTimerId !== null) {
      clearTimeout(schedulerTimerId);
      schedulerTimerId = null;
    }

    notesInQueue.length = 0;
    updatePlayButton();
  }

  function updatePlayButton() {
    playButton.textContent = isPlaying ? '停止' : '再生';
    playButton.classList.toggle('playing', isPlaying);
    playButton.setAttribute('aria-pressed', String(isPlaying));
  }

  // ============================================================
  // BPM 調整
  // ============================================================
  function updateBPM(value) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;

    bpm = Math.max(40, Math.min(208, parsed));
    bpmSlider.value = bpm;
    bpmNumber.value = bpm;
  }

  // ============================================================
  // 拍子表示
  // ============================================================
  function renderIndicator() {
    indicator.innerHTML = '';
    for (let i = 0; i < beatsPerMeasure; i++) {
      const dot = document.createElement('span');
      dot.className = 'beat-dot' + (i === 0 ? ' accent' : '');
      dot.setAttribute('aria-hidden', 'true');
      indicator.appendChild(dot);
    }
  }

  function highlightBeat(beat) {
    const dots = indicator.querySelectorAll('.beat-dot');
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === beat);
    });
  }

  // ============================================================
  // 視覚的拍子表示の更新ループ
  // requestAnimationFrame で notesInQueue をポーリングし、
  // 現在鳴っている拍に合わせてインジケーターを点滅させる
  // ============================================================
  let lastDrawnBeat = -1;

  function drawLoop() {
    if (!isPlaying) {
      if (lastDrawnBeat !== -1) {
        highlightBeat(-1);
        lastDrawnBeat = -1;
      }
      requestAnimationFrame(drawLoop);
      return;
    }

    const now = audioCtx.currentTime;
    let currentHighlightedBeat = lastDrawnBeat;

    // 再生時刻を過ぎた拍をキューから取り出し、最新の拍を描画対象にする
    while (notesInQueue.length && notesInQueue[0].time < now) {
      currentHighlightedBeat = notesInQueue.shift().beat;
    }

    if (currentHighlightedBeat !== lastDrawnBeat) {
      highlightBeat(currentHighlightedBeat);
      lastDrawnBeat = currentHighlightedBeat;
    }

    requestAnimationFrame(drawLoop);
  }

  requestAnimationFrame(drawLoop);

  // ============================================================
  // タップテンポ
  // ============================================================
  const tapTimes = [];
  const MAX_TAP_HISTORY = 5;
  const TAP_TIMEOUT_MS = 2000;
  let tapTimeoutId = null;

  function handleTap() {
    const now = performance.now();

    // 一定時間タップがなかったら履歴をリセット
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_TIMEOUT_MS) {
      tapTimes.length = 0;
    }

    tapTimes.push(now);
    if (tapTimes.length > MAX_TAP_HISTORY) {
      tapTimes.shift();
    }

    clearTimeout(tapTimeoutId);
    tapTimeoutId = setTimeout(() => {
      tapTimes.length = 0;
    }, TAP_TIMEOUT_MS);

    if (tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimes.length; i++) {
        intervals.push(tapTimes[i] - tapTimes[i - 1]);
      }
      const averageInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / averageInterval);
      updateBPM(calculatedBpm);
    }
  }

  // ============================================================
  // イベント紐付け
  // ============================================================
  playButton.addEventListener('click', () => {
    if (isPlaying) {
      stop();
    } else {
      start();
    }
  });

  bpmSlider.addEventListener('input', (event) => {
    updateBPM(event.target.value);
  });

  bpmNumber.addEventListener('change', (event) => {
    updateBPM(event.target.value);
  });

  signatureSelect.addEventListener('change', (event) => {
    beatsPerMeasure = Number(event.target.value);
    currentBeat = 0;
    renderIndicator();
  });

  tapButton.addEventListener('click', handleTap);

  // ============================================================
  // 設定の反映（step-3）
  // ページ読み込み時にデフォルトBPMと音量を適用する。
  // 音量は設定変更時にリアルタイムで追従させる
  // （デフォルトBPMはあくまで初期値のため、読み込み時のみ適用する）。
  // ============================================================
  function applyInitialSettings() {
    if (!window.practiceMusicApp || typeof window.practiceMusicApp.getSettings !== 'function') {
      return;
    }
    const settings = window.practiceMusicApp.getSettings();
    currentVolume = settings.volume;
    updateBPM(settings.defaultBpm);
  }

  applyInitialSettings();

  if (window.practiceMusicApp && typeof window.practiceMusicApp.onSettingsChange === 'function') {
    window.practiceMusicApp.onSettingsChange((settings) => {
      currentVolume = settings.volume;
    });
  }

  // 初期表示
  renderIndicator();
})();

// ============================================================
// 練習タイマー機能（step-3）
// 既存のメトロノーム機能とは独立した IIFE として実装し、
// 変数の衝突やメトロノーム機能への影響を避けます。
// ============================================================
(function () {
  'use strict';

  const modeButtons = document.querySelectorAll('.timer-mode-button');
  const presetsPractice = document.getElementById('timer-presets-practice');
  const presetsRest = document.getElementById('timer-presets-rest');
  const customMinutesInput = document.getElementById('timer-custom-minutes');
  const customApplyButton = document.getElementById('timer-custom-apply');
  const timerDisplay = document.getElementById('timer-display');
  const timerStartButton = document.getElementById('timer-start');
  const timerPauseButton = document.getElementById('timer-pause');
  const timerResetButton = document.getElementById('timer-reset');

  // 練習タイマータブが未実装のページでは何もしない
  if (!timerDisplay) return;

  // ============================================================
  // 練習タイマー状態
  // ============================================================
  let timerMode = 'practice';        // 'practice' または 'rest'
  let totalSeconds = 0;              // 設定された総秒数
  let remainingSeconds = 0;          // 残り秒数
  let timerIntervalId = null;
  let timerIsRunning = false;
  let timerAudioCtx = null;

  // 設定（音量）。完了ビープ音のゲインに反映します。0-100。
  let currentVolume = 80;

  // ============================================================
  // タイマー表示の更新
  // ============================================================
  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.round(seconds));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function renderTimerDisplay() {
    timerDisplay.textContent = formatTime(remainingSeconds);
    timerDisplay.classList.toggle('timer-warning', remainingSeconds > 0 && remainingSeconds <= 10);
    timerDisplay.classList.toggle('timer-finished', remainingSeconds === 0 && totalSeconds > 0);
  }

  function updateTimerButtons() {
    const hasTime = totalSeconds > 0;
    const canStart = remainingSeconds > 0; // 残り0秒（完了後）は開始できないようにする
    timerStartButton.disabled = timerIsRunning || !canStart;
    timerPauseButton.disabled = !timerIsRunning;
    timerResetButton.disabled = !hasTime;
  }

  // ============================================================
  // タイマー時間の設定（プリセット・カスタム共通）
  // ============================================================
  function setTimerSeconds(seconds) {
    stopTimerInterval();
    timerIsRunning = false;
    totalSeconds = Math.max(0, Math.round(seconds));
    remainingSeconds = totalSeconds;
    renderTimerDisplay();
    updateTimerButtons();
  }

  function markActivePreset(container, seconds) {
    const buttons = container.querySelectorAll('.timer-preset-button');
    buttons.forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.seconds) === seconds);
    });
  }

  // ============================================================
  // モード切り替え（練習 / 休憩）
  // ============================================================
  function switchTimerMode(mode) {
    timerMode = mode;

    modeButtons.forEach((btn) => {
      const isTarget = btn.dataset.mode === mode;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-pressed', String(isTarget));
    });

    const isPractice = mode === 'practice';
    presetsPractice.hidden = !isPractice;
    presetsRest.hidden = isPractice;

    // モード切り替え時は選択中プリセットの表示もリセットする
    markActivePreset(presetsPractice, -1);
    markActivePreset(presetsRest, -1);

    setTimerSeconds(0);
  }

  // ============================================================
  // タイマー完了通知（Web Audio API）
  // ============================================================
  function playTimerCompletionSound() {
    try {
      if (!timerAudioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        timerAudioCtx = new AudioContextClass();
      }
      if (timerAudioCtx.state === 'suspended') {
        timerAudioCtx.resume();
      }

      // ピコピコと3回鳴らして練習タイマー完了を知らせる
      const beepCount = 3;
      const beepDuration = 0.2;
      const beepGap = 0.25;
      // 設定の音量（0-100）をゲインの係数として反映する
      const peakVolume = 0.6 * (currentVolume / 100);

      for (let i = 0; i < beepCount; i++) {
        const oscillator = timerAudioCtx.createOscillator();
        const gainNode = timerAudioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(timerAudioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = 880;

        const start = timerAudioCtx.currentTime + i * beepGap;
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(peakVolume, start + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + beepDuration);

        oscillator.start(start);
        oscillator.stop(start + beepDuration);
      }
    } catch (err) {
      // Web Audio API が利用できない場合はアラートにフォールバック
      window.alert('タイマーが完了しました！');
    }
  }

  function handleTimerComplete() {
    stopTimerInterval();
    timerIsRunning = false;
    remainingSeconds = 0;
    renderTimerDisplay();
    updateTimerButtons();
    playTimerCompletionSound();
  }

  // ============================================================
  // タイマー動作（setInterval で1秒ごとに残り時間を減らす）
  // ============================================================
  function stopTimerInterval() {
    if (timerIntervalId !== null) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  function tickTimer() {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      handleTimerComplete();
      return;
    }
    renderTimerDisplay();
  }

  function startTimer() {
    if (timerIsRunning || remainingSeconds <= 0) return;
    timerIsRunning = true;
    updateTimerButtons();
    timerIntervalId = setInterval(tickTimer, 1000);
  }

  function pauseTimer() {
    if (!timerIsRunning) return;
    timerIsRunning = false;
    stopTimerInterval();
    updateTimerButtons();
  }

  function resetTimer() {
    stopTimerInterval();
    timerIsRunning = false;
    remainingSeconds = totalSeconds;
    renderTimerDisplay();
    updateTimerButtons();
  }

  // ============================================================
  // イベント紐付け
  // ============================================================
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTimerMode(btn.dataset.mode));
  });

  presetsPractice.querySelectorAll('.timer-preset-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const seconds = Number(btn.dataset.seconds);
      setTimerSeconds(seconds);
      markActivePreset(presetsPractice, seconds);
    });
  });

  presetsRest.querySelectorAll('.timer-preset-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const seconds = Number(btn.dataset.seconds);
      setTimerSeconds(seconds);
      markActivePreset(presetsRest, seconds);
    });
  });

  customApplyButton.addEventListener('click', () => {
    const minutes = Number(customMinutesInput.value);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const clampedMinutes = Math.min(180, minutes);
    setTimerSeconds(clampedMinutes * 60);
    markActivePreset(presetsPractice, -1);
    markActivePreset(presetsRest, -1);
  });

  timerStartButton.addEventListener('click', startTimer);
  timerPauseButton.addEventListener('click', pauseTimer);
  timerResetButton.addEventListener('click', resetTimer);

  // ============================================================
  // 設定の反映（step-3）
  // ページ読み込み時にデフォルト時間と音量を適用する。
  // 音量は設定変更時にリアルタイムで追従させる
  // （デフォルト時間はあくまで初期値のため、読み込み時のみ適用する）。
  // ============================================================
  function applyInitialSettings() {
    if (!window.practiceMusicApp || typeof window.practiceMusicApp.getSettings !== 'function') {
      return;
    }
    const settings = window.practiceMusicApp.getSettings();
    currentVolume = settings.volume;
    setTimerSeconds(settings.defaultTimerMinutes * 60);
  }

  applyInitialSettings();

  if (window.practiceMusicApp && typeof window.practiceMusicApp.onSettingsChange === 'function') {
    window.practiceMusicApp.onSettingsChange((settings) => {
      currentVolume = settings.volume;
    });
  }

  // 初期表示
  renderTimerDisplay();
  updateTimerButtons();
})();

// ============================================================
// 練習記録機能（step-4）
// 既存のメトロノーム機能とは独立した IIFE として実装し、
// 変数の衝突やタイマー機能への影響を避けます。
// ============================================================
(function () {
  'use strict';

  const STORAGE_KEY = 'practice-music-app:records';

  const form = document.getElementById('record-form');
  const dateInput = document.getElementById('record-date');
  const instrumentSelect = document.getElementById('record-instrument');
  const durationInput = document.getElementById('record-duration');
  const songInput = document.getElementById('record-song');
  const memoInput = document.getElementById('record-memo');
  const listEl = document.getElementById('record-list');
  const emptyEl = document.getElementById('record-empty');

  // フォームが存在しない（＝練習記録タブが未実装のページ）場合は何もしない
  if (!form) return;

  // ============================================================
  // LocalStorage 読み書き
  // ============================================================
  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('練習記録の読み込みに失敗しました:', err);
      return [];
    }
  }

  function saveRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.error('練習記録の保存に失敗しました:', err);
    }
  }

  let records = loadRecords();

  // ============================================================
  // 履歴表示
  // ============================================================
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }

  function renderList() {
    listEl.innerHTML = '';

    // 新しい順（日付降順、同日内は登録順の逆）に表示
    const sorted = [...records].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

    emptyEl.hidden = sorted.length > 0;

    sorted.forEach((record) => {
      const li = document.createElement('li');
      li.className = 'record-item';
      li.dataset.id = String(record.id);

      const main = document.createElement('div');
      main.className = 'record-item-main';

      const meta = document.createElement('div');
      meta.className = 'record-item-meta';
      meta.textContent = `${formatDate(record.date)}　${record.instrument}　${record.duration}分`;
      main.appendChild(meta);

      if (record.song) {
        const song = document.createElement('div');
        song.className = 'record-item-song';
        song.textContent = record.song;
        main.appendChild(song);
      }

      if (record.memo) {
        const memo = document.createElement('div');
        memo.className = 'record-item-memo';
        memo.textContent = record.memo;
        main.appendChild(memo);
      }

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'record-delete';
      deleteButton.textContent = '削除';
      deleteButton.setAttribute('aria-label', '記録を削除');
      deleteButton.addEventListener('click', () => deleteRecord(record.id));

      li.appendChild(main);
      li.appendChild(deleteButton);
      listEl.appendChild(li);
    });
  }

  // ============================================================
  // 記録の追加・削除
  // ============================================================
  function addRecord(record) {
    records.push(record);
    saveRecords(records);
    renderList();
  }

  function deleteRecord(id) {
    records = records.filter((r) => r.id !== id);
    saveRecords(records);
    renderList();
  }

  // ============================================================
  // フォーム送信
  // ============================================================
  function resetForm() {
    form.reset();
    dateInput.value = todayStr();
  }

  function todayStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const duration = Number(durationInput.value);
    if (!dateInput.value || !Number.isFinite(duration) || duration <= 0) {
      return;
    }

    addRecord({
      id: Date.now(),
      createdAt: Date.now(),
      date: dateInput.value,
      instrument: instrumentSelect.value,
      duration: duration,
      song: songInput.value.trim(),
      memo: memoInput.value.trim(),
    });

    resetForm();
  });

  // ============================================================
  // 初期表示
  // ============================================================
  dateInput.value = todayStr();
  renderList();
})();
