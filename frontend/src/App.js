import React, { useState, useEffect, useRef } from 'react';
import InputForm from './components/InputForm';
import Chart from './components/Chart';
import './App.css';

const METHOD_TEMPLATES = {
  euler: { label: 'Явный метод Эйлера', code: 'def custom_step_func(equations, t, y, h, params):\n    dy = equations(t, *y, *params)\n    return [y[i] + h * dy[i] for i in range(len(y))]' },
  heun: { label: 'Метод Хойна (Рунге-Кутта 2)', code: 'def custom_step_func(equations, t, y, h, params):\n    k1 = equations(t, *y, *params)\n    y_temp = [y[i] + h * k1[i] for i in range(len(y))]\n    k2 = equations(t + h, *y_temp, *params)\n    return [y[i] + h/2 * (k1[i] + k2[i]) for i in range(len(y))]' },
  rk4: { label: 'Классический Рунге-Кутта 4', code: 'def custom_step_func(equations, t, y, h, params):\n    k1 = equations(t, *y, *params)\n    y2 = [y[i] + h/2 * k1[i] for i in range(len(y))]\n    k2 = equations(t + h/2, *y2, *params)\n    y3 = [y[i] + h/2 * k2[i] for i in range(len(y))]\n    k3 = equations(t + h/2, *y3, *params)\n    y4 = [y[i] + h * k3[i] for i in range(len(y))]\n    k4 = equations(t + h, *y4, *params)\n    return [y[i] + h/6 * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]) for i in range(len(y))]' },
  midpoint: { label: 'Метод средней точки', code: 'def custom_step_func(equations, t, y, h, params):\n    k1 = equations(t, *y, *params)\n    y_mid = [y[i] + h/2 * k1[i] for i in range(len(y))]\n    k2 = equations(t + h/2, *y_mid, *params)\n    return [y[i] + h * k2[i] for i in range(len(y))]' },
  empty: { label: 'Пустой шаблон', code: 'def custom_step_func(equations, t, y, h, params):\n    # equations(t, *y, *params) – производные\n    # y – список текущих значений\n    # h – шаг\n    # params – параметры модели\n    return y' }
};

function App() {
  // Авторизация
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Моделирование
  const [results, setResults] = useState(null);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [mode, setMode] = useState('single');
  const [comparisonCompartment, setComparisonCompartment] = useState('i');

  const [comparisonConfigs, setComparisonConfigs] = useState([
    {
      id: 1, label: 'Модель 1', model_type: 'SEIR', method_type: 'RK4',
      initialS: 990, initialE: 0, initialI: 10, initialH: 0,
      beta: 0.3, sigma: 0.1, gamma: 0.1, rho: 0.011, delta: 0.05, mu: 0.01,
      custom_method_code: '', customTemplate: ''
    }
  ]);

  const fileInputRef = useRef(null);
  const compareFileInputRef = useRef(null);

  // Боковая панель
  const [savedSimulations, setSavedSimulations] = useState([]);
  const [savedComparisons, setSavedComparisons] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadedParams, setLoadedParams] = useState(null);
  const [sidebarSection, setSidebarSection] = useState('single');

  // При изменении основного режима переключаем раздел в боковой панели
  useEffect(() => {
    setSidebarSection(mode);
  }, [mode]);

  useEffect(() => {
    fetch('http://localhost:5000/current_user')
      .then(res => res.json())
      .then(data => { if (data && data.user_id) setUser(data); })
      .catch(() => {});
  }, []);

  const fetchSavedSimulations = async () => {
    if (!user) return;
    try {
      const res = await fetch('http://localhost:5000/simulations', { credentials: 'include' });
      if (!res.ok) throw new Error('Ошибка загрузки');
      const data = await res.json();
      setSavedSimulations(data);
    } catch (err) { console.error(err); }
  };

  const fetchSavedComparisons = async () => {
    if (!user) return;
    try {
      const res = await fetch('http://localhost:5000/comparisons', { credentials: 'include' });
      if (!res.ok) throw new Error('Ошибка загрузки');
      const data = await res.json();
      setSavedComparisons(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchSavedSimulations();
    fetchSavedComparisons();
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch('http://localhost:5000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: loginUsername, password: loginPassword })
    });
    if (res.ok) {
      const data = await res.json();
      setUser({ user_id: data.user_id, username: data.username });
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const res = await fetch('http://localhost:5000/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginUsername, password: loginPassword })
    });
    if (res.ok) {
      alert('Регистрация успешна, войдите');
      setAuthMode('login');
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const handleLogout = async () => {
    await fetch('http://localhost:5000/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setSavedSimulations([]);
    setSavedComparisons([]);
  };

  const handleSingleSimulation = async (params) => {
    try {
      const response = await fetch('http://localhost:5000/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Ошибка сервера');
      }
      const data = await response.json();
      setResults(data);
      setComparisonResults(null);
      setLoadedParams(params);
    } catch (error) {
      alert(`Ошибка симуляции: ${error.message}`);
    }
  };

  // Сохранение одиночной симуляции
  const handleSaveToDB = async () => {
    if (!user) return alert('Необходимо войти');
    if (!results) return alert('Нет результатов для сохранения');
    const name = prompt('Название:');
    if (!name) return;
    const payload = {
      name,
      model_type: loadedParams?.model_type || 'SEIR',
      method_type: loadedParams?.method_type || 'RK4',
      parameters: loadedParams || {},
      results: results
    };
    try {
      const res = await fetch('http://localhost:5000/save_simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Сохранено');
        fetchSavedSimulations();
      } else {
        const err = await res.json();
        alert('Ошибка: ' + (err.error || err.message));
      }
    } catch (err) { alert('Ошибка соединения'); }
  };

  const loadSimulationFromDB = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/simulation/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.results);
      if (data.parameters && Object.keys(data.parameters).length > 0) setLoadedParams(data.parameters);
      setComparisonResults(null);
      setMode('single');
    } catch { alert('Ошибка загрузки'); }
  };

  const deleteSimulation = async (id) => {
    if (!window.confirm('Удалить?')) return;
    await fetch(`http://localhost:5000/simulation/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchSavedSimulations();
  };

  // Сохранение сравнения
  const handleSaveComparison = async () => {
    if (!user) return alert('Необходимо войти');
    if (!comparisonResults) return alert('Нет результатов сравнения');
    const name = prompt('Название сравнения:');
    if (!name) return;
    const payload = {
      name,
      common_params: {
        time: parseInt(document.getElementById('compareTime').value, 10) || 100,
        population: parseInt(document.getElementById('comparePop').value, 10) || 1000,
        tolerance: parseFloat(document.getElementById('compareTol')?.value) || 1e-6,
        startup_method: document.getElementById('compareStartup')?.value || 'RK4',
        compartment: comparisonCompartment
      },
      configs: comparisonConfigs.map(({ id, ...rest }) => rest),
      results: comparisonResults
    };
    try {
      const res = await fetch('http://localhost:5000/save_comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Сравнение сохранено');
        fetchSavedComparisons();
      } else {
        const err = await res.json();
        alert('Ошибка: ' + (err.error || err.message));
      }
    } catch (err) { alert('Ошибка соединения'); }
  };

  const loadComparisonFromDB = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/comparison/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.common_params) {
        document.getElementById('compareTime').value = data.common_params.time;
        document.getElementById('comparePop').value = data.common_params.population;
        if (data.common_params.tolerance) document.getElementById('compareTol').value = data.common_params.tolerance;
        if (data.common_params.startup_method) document.getElementById('compareStartup').value = data.common_params.startup_method;
        if (data.common_params.compartment) setComparisonCompartment(data.common_params.compartment);
      }
      if (data.configs) {
        setComparisonConfigs(data.configs.map((cfg, idx) => ({ ...cfg, id: idx + 1, customTemplate: cfg.customTemplate || '' })));
      }
      setComparisonResults(data.results);
      setResults(null);
      setMode('compare');
    } catch { alert('Ошибка загрузки'); }
  };

  const deleteComparison = async (id) => {
    if (!window.confirm('Удалить?')) return;
    await fetch(`http://localhost:5000/comparison/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchSavedComparisons();
  };

  // Экспорт/импорт одиночной конфигурации
  const handleExportSingle = () => {
    if (!loadedParams) return alert('Нет параметров. Выполните симуляцию.');
    const blob = new Blob([JSON.stringify(loadedParams, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'single_config.json'; a.click();
    URL.revokeObjectURL(url);
    alert('✅ Конфигурация экспортирована.');
  };

  const handleImportSingle = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const cfg = JSON.parse(e.target.result);
        if (!cfg.model_type || !cfg.method_type) throw new Error('Неверный формат');
        setLoadedParams(cfg);
        alert('✅ Конфигурация загружена. Нажмите "Запустить симуляцию".');
      } catch (err) { alert('❌ Ошибка импорта: ' + err.message); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Экспорт/импорт сравнения
  const handleExportComparison = () => {
    const timeVal = document.getElementById('compareTime')?.value || 100;
    const popVal = document.getElementById('comparePop')?.value || 1000;
    const tol = document.getElementById('compareTol')?.value || 1e-6;
    const startup = document.getElementById('compareStartup')?.value || 'RK4';
    const exportData = {
      time: Number(timeVal), population: Number(popVal),
      tolerance: Number(tol), startup_method: startup,
      configs: comparisonConfigs.map(({ id, ...rest }) => rest)
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'comparison_config.json'; a.click();
    URL.revokeObjectURL(url);
    alert('✅ Конфигурация сравнения экспортирована.');
  };

  const handleImportComparison = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.configs || !Array.isArray(data.configs)) throw new Error('Файл не содержит конфигураций сравнения');
        if (data.time) document.getElementById('compareTime').value = data.time;
        if (data.population) document.getElementById('comparePop').value = data.population;
        if (data.tolerance) document.getElementById('compareTol').value = data.tolerance;
        if (data.startup_method) document.getElementById('compareStartup').value = data.startup_method;
        if (data.configs) {
          setComparisonConfigs(data.configs.map((cfg, idx) => ({ ...cfg, id: idx + 1, customTemplate: cfg.customTemplate || '' })));
        }
        alert('✅ Конфигурация сравнения импортирована.');
      } catch (err) { alert('❌ Ошибка импорта: ' + err.message); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleComparison = async () => {
    const timeVal = parseInt(document.getElementById('compareTime').value, 10) || 100;
    const popVal = parseInt(document.getElementById('comparePop').value, 10) || 1000;
    const tol = parseFloat(document.getElementById('compareTol')?.value) || 1e-6;
    const startup = document.getElementById('compareStartup')?.value || 'RK4';
    const comp = comparisonCompartment;

    const payload = {
      time: timeVal, population: popVal, step_size: 1, tolerance: tol,
      startup_method: startup,
      configs: comparisonConfigs.map(cfg => ({
        ...cfg,
        custom_method_code: cfg.method_type === 'Custom' ? cfg.custom_method_code : undefined
      }))
    };

    try {
      const response = await fetch('http://localhost:5000/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      const processedData = data.map(item => {
        if (item.error) return item;
        if (!item.data || !item.data[comp]) {
          const compName = comp.toUpperCase();
          return { ...item, error: `Компартмент ${compName} отсутствует в модели ${item.label}` };
        }
        return item;
      });
      setComparisonResults(processedData);
      setResults(null);
    } catch (error) {
      alert(`Ошибка соединения: ${error.message}`);
    }
  };

  const addModelConfig = () => {
    const newId = Math.max(...comparisonConfigs.map(c => c.id), 0) + 1;
    setComparisonConfigs([...comparisonConfigs, {
      id: newId, label: `Модель ${newId}`, model_type: 'SEIR', method_type: 'RK4',
      initialS: 990, initialE: 0, initialI: 10, initialH: 0,
      beta: 0.3, sigma: 0.1, gamma: 0.1, rho: 0.011, delta: 0.05, mu: 0.01,
      custom_method_code: '', customTemplate: ''
    }]);
  };

  const removeModelConfig = (id) => {
    if (comparisonConfigs.length <= 1) return;
    setComparisonConfigs(comparisonConfigs.filter(c => c.id !== id));
  };

  const updateModelConfig = (id, field, value) => {
    setComparisonConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const hasSuccessfulComparison = comparisonResults && comparisonResults.some(item => !item.error);

  if (!user) {
    return (
      <div className="auth-container">
        <h2>{authMode === 'login' ? 'Вход' : 'Регистрация'}</h2>
        <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
          <input type="text" placeholder="Логин" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} required />
          <input type="password" placeholder="Пароль" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
          <button type="submit">{authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
        </form>
        <p onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ cursor: 'pointer', color: 'blue' }}>
          {authMode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
        </p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <button className="sidebar-trigger" onClick={() => setSidebarOpen(!sidebarOpen)} title="Инструменты">
        {sidebarOpen ? '✕' : '☰'}
      </button>

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
          <h3>Инструменты</h3>
          <div className="sidebar-tabs">
            <button onClick={() => { setSidebarSection('single'); setMode('single'); }} className={sidebarSection === 'single' ? 'active' : ''}>
              Одиночная
            </button>
            <button onClick={() => { setSidebarSection('compare'); setMode('compare'); }} className={sidebarSection === 'compare' ? 'active' : ''}>
              Сравнение
            </button>
          </div>

          {sidebarSection === 'single' ? (
            <>
              <button onClick={handleSaveToDB}>💾 Сохранить текущую</button>
              <button onClick={fetchSavedSimulations}>🔄 Обновить</button>
              <button onClick={handleExportSingle}>📤 Экспорт</button>
              <button onClick={() => fileInputRef.current.click()}>📥 Импорт</button>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImportSingle} />
              <hr />
              <h4>Сохранённые симуляции</h4>
              {savedSimulations.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#666' }}>Нет сохранений</p>
              ) : (
                <ul className="sidebar-sim-list">
                  {savedSimulations.map(sim => (
                    <li key={sim.id}>
                      <span>{sim.name}</span>
                      <div>
                        <button onClick={() => loadSimulationFromDB(sim.id)} title="Загрузить">📂</button>
                        <button onClick={() => deleteSimulation(sim.id)} title="Удалить">🗑️</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              {mode === 'compare' && (
                <button onClick={handleSaveComparison}>💾 Сохранить сравнение</button>
              )}
              <button onClick={fetchSavedComparisons}>🔄 Обновить</button>
              {mode === 'compare' && (
                <>
                  <button onClick={handleExportComparison}>📤 Экспорт</button>
                  <button onClick={() => compareFileInputRef.current?.click()}>📥 Импорт</button>
                  <input type="file" ref={compareFileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImportComparison} />
                </>
              )}
              <hr />
              <h4>Сохранённые сравнения</h4>
              {savedComparisons.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#666' }}>Нет сохранений</p>
              ) : (
                <ul className="sidebar-sim-list">
                  {savedComparisons.map(comp => (
                    <li key={comp.id}>
                      <span>{comp.name}</span>
                      <div>
                        <button onClick={() => loadComparisonFromDB(comp.id)} title="Загрузить">📂</button>
                        <button onClick={() => deleteComparison(comp.id)} title="Удалить">🗑️</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      <div className={`main-content ${sidebarOpen ? 'shifted' : ''}`}>
        <div className="user-bar">
          <span>{user.username}</span>
          <button onClick={handleLogout}>Выйти</button>
        </div>
        <h1>Учебная эпидемиологическая модель</h1>
        <div className="mode-switch">
          <button onClick={() => setMode('single')} className={mode === 'single' ? 'active' : ''}>Одиночная</button>
          <button onClick={() => setMode('compare')} className={mode === 'compare' ? 'active' : ''}>Сравнение</button>
        </div>

        {mode === 'single' && (
          <>
            <InputForm onSimulate={handleSingleSimulation} loadedParams={loadedParams} />
            {results && <Chart results={results} />}
          </>
        )}

        {mode === 'compare' && (
          <div className="comparison-panel">
            <h2>Настройка сравнения</h2>
            <div className="common-settings">
              <div><label>Время (дни):</label><input type="number" id="compareTime" defaultValue="100" /></div>
              <div><label>Популяция:</label><input type="number" id="comparePop" defaultValue="1000" /></div>
              <div><label>Погрешность (RKF45/DOPRI5):</label><input type="number" step="1e-8" id="compareTol" defaultValue="1e-6" /></div>
              <div>
                <label>Метод разгона (Адамсы):</label>
                <select id="compareStartup" defaultValue="RK4">
                  <option value="RK4">RK4</option>
                  <option value="Euler">Эйлер</option>
                  <option value="Heun">Хойн</option>
                </select>
              </div>
              <div>
                <label>Компартмент:</label>
                <select value={comparisonCompartment} onChange={e => setComparisonCompartment(e.target.value)}>
                  <option value="s">S</option><option value="e">E</option><option value="i">I</option><option value="h">H</option><option value="r">R</option>
                </select>
              </div>
            </div>

            {comparisonConfigs.map((cfg, idx) => (
              <div key={cfg.id} className="model-config">
                <h4>Модель {idx + 1}</h4>
                <button className="remove-btn" onClick={() => removeModelConfig(cfg.id)}>×</button>
                <div><label>Название:</label><input type="text" value={cfg.label} onChange={e => updateModelConfig(cfg.id, 'label', e.target.value)} /></div>
                <div><label>Модель:</label>
                  <select value={cfg.model_type} onChange={e => updateModelConfig(cfg.id, 'model_type', e.target.value)}>
                    <option value="SIR">SIR</option><option value="SEIR">SEIR</option><option value="SEIRS">SEIRS</option><option value="SEIHR">SEIHR</option><option value="SEIHRS">SEIHRS</option>
                  </select>
                </div>
                <div><label>Метод:</label>
                  <select value={cfg.method_type} onChange={e => updateModelConfig(cfg.id, 'method_type', e.target.value)}>
                    <option value="Euler">Эйлер</option><option value="Heun">Хойн (RK2)</option><option value="RK3">RK3</option><option value="RK4">RK4</option>
                    <option value="RKF45">RKF45</option><option value="DOPRI5">DOPRI5</option>
                    <option value="Adams-Bashforth-4">Adams-Bashforth 4</option><option value="Adams-Moulton-4-PC">Adams-Moulton 4 (PECE)</option>
                    <option value="Rosenbrock2">Rosenbrock 2</option><option value="Custom">Свой метод</option>
                  </select>
                </div>
                {cfg.method_type === 'Custom' && (
                  <>
                    <div><label>Шаблон:</label>
                      <select value={cfg.customTemplate || ''} onChange={e => {
                        const key = e.target.value;
                        updateModelConfig(cfg.id, 'customTemplate', key);
                        if (key && METHOD_TEMPLATES[key]) updateModelConfig(cfg.id, 'custom_method_code', METHOD_TEMPLATES[key].code);
                      }}>
                        <option value="">-- Выберите --</option>
                        {Object.entries(METHOD_TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div><label>Код метода:</label>
                      <textarea rows={8} value={cfg.custom_method_code} onChange={e => { updateModelConfig(cfg.id, 'custom_method_code', e.target.value); updateModelConfig(cfg.id, 'customTemplate', ''); }} />
                      <button type="button" className="help-btn" onClick={() => alert('Функция custom_step_func(equations, t, y, h, params)\n\n...')}>?</button>
                    </div>
                  </>
                )}
                <div><label>Начальное S:</label><input type="number" value={cfg.initialS} onChange={e => updateModelConfig(cfg.id, 'initialS', Number(e.target.value))} /></div>
                {cfg.model_type.includes('E') && <div><label>Начальное E:</label><input type="number" value={cfg.initialE} onChange={e => updateModelConfig(cfg.id, 'initialE', Number(e.target.value))} /></div>}
                <div><label>Начальное I:</label><input type="number" value={cfg.initialI} onChange={e => updateModelConfig(cfg.id, 'initialI', Number(e.target.value))} /></div>
                {cfg.model_type.includes('H') && <div><label>Начальное H:</label><input type="number" value={cfg.initialH} onChange={e => updateModelConfig(cfg.id, 'initialH', Number(e.target.value))} /></div>}
                <div><label>β:</label><input type="number" step="0.01" value={cfg.beta} onChange={e => updateModelConfig(cfg.id, 'beta', Number(e.target.value))} /></div>
                {cfg.model_type.includes('E') && <div><label>σ:</label><input type="number" step="0.01" value={cfg.sigma} onChange={e => updateModelConfig(cfg.id, 'sigma', Number(e.target.value))} /></div>}
                <div><label>γ:</label><input type="number" step="0.01" value={cfg.gamma} onChange={e => updateModelConfig(cfg.id, 'gamma', Number(e.target.value))} /></div>
                {cfg.model_type.endsWith('S') && <div><label>ρ:</label><input type="number" step="0.001" value={cfg.rho} onChange={e => updateModelConfig(cfg.id, 'rho', Number(e.target.value))} /></div>}
                {cfg.model_type.includes('H') && (
                  <>
                    <div><label>δ:</label><input type="number" step="0.01" value={cfg.delta} onChange={e => updateModelConfig(cfg.id, 'delta', Number(e.target.value))} /></div>
                    <div><label>μ:</label><input type="number" step="0.01" value={cfg.mu} onChange={e => updateModelConfig(cfg.id, 'mu', Number(e.target.value))} /></div>
                  </>
                )}
              </div>
            ))}

            <div className="comparison-actions">
              <button onClick={addModelConfig}>Добавить модель</button>
              <button onClick={handleComparison}>Запустить сравнение</button>
            </div>

            {comparisonResults && (
              <div className="comparison-results">
                <h3>Результаты сравнения</h3>
                {hasSuccessfulComparison && <Chart comparisonData={comparisonResults} comparisonCompartment={comparisonCompartment} />}
                {comparisonResults.some(item => item.error) && (
                  <div className="comparison-errors">
                    <h4>Ошибки:</h4>
                    <ul>{comparisonResults.filter(item => item.error).map((item, idx) => <li key={idx}><strong>{item.label}</strong>: {item.error}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;