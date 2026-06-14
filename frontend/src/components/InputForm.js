import React, { useState, useEffect } from 'react';

const METHOD_TEMPLATES = {
  euler: { label: 'Явный метод Эйлера', code: 'def custom_step_func(equations, t, y, h, params):\n    dy = equations(t, *y, *params)\n    return [y[i] + h * dy[i] for i in range(len(y))]' },
  heun: { label: 'Метод Хойна (Рунге-Кутта 2)', code: 'def custom_step_func(equations, t, y, h, params):\n    k1 = equations(t, *y, *params)\n    y_temp = [y[i] + h * k1[i] for i in range(len(y))]\n    k2 = equations(t + h, *y_temp, *params)\n    return [y[i] + h/2 * (k1[i] + k2[i]) for i in range(len(y))]' },
  rk4: { label: 'Классический Рунге-Кутта 4', code: 'def custom_step_func(equations, t, y, h, params):\n    k1 = equations(t, *y, *params)\n    y2 = [y[i] + h/2 * k1[i] for i in range(len(y))]\n    k2 = equations(t + h/2, *y2, *params)\n    y3 = [y[i] + h/2 * k2[i] for i in range(len(y))]\n    k3 = equations(t + h/2, *y3, *params)\n    y4 = [y[i] + h * k3[i] for i in range(len(y))]\n    k4 = equations(t + h, *y4, *params)\n    return [y[i] + h/6 * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]) for i in range(len(y))]' },
  midpoint: { label: 'Метод средней точки', code: 'def custom_step_func(equations, t, y, h, params):\n    k1 = equations(t, *y, *params)\n    y_mid = [y[i] + h/2 * k1[i] for i in range(len(y))]\n    k2 = equations(t + h/2, *y_mid, *params)\n    return [y[i] + h * k2[i] for i in range(len(y))]' },
  empty: { label: 'Пустой шаблон', code: 'def custom_step_func(equations, t, y, h, params):\n    # equations(t, *y, *params) – производные\n    # y – список текущих значений\n    # h – шаг\n    # params – параметры модели\n    return y' }
};

const InputForm = ({ onSimulate, loadedParams }) => {
  const [model_type, setModelType] = useState('SEIR');
  const [method_type, setMethodType] = useState('RK4');
  const [custom_method_code, setCustomCode] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('empty');
  const [tolerance, setTolerance] = useState(1e-6);
  const [startup_method, setStartupMethod] = useState('RK4');

  const [initialS, setInitialS] = useState(990);
  const [initialE, setInitialE] = useState(0);
  const [initialI, setInitialI] = useState(10);
  const [initialH, setInitialH] = useState(0);
  const [beta, setBeta] = useState(0.3);
  const [sigma, setSigma] = useState(0.1);
  const [gamma, setGamma] = useState(0.1);
  const [rho, setRho] = useState(0.011);
  const [delta, setDelta] = useState(0.05);
  const [mu, setMu] = useState(0.01);
  const [time, setTime] = useState(100);
  const [population, setPopulation] = useState(1000);
  const [step_size, setStepSize] = useState(1);

  useEffect(() => {
    if (loadedParams) {
      if (loadedParams.model_type) setModelType(loadedParams.model_type);
      if (loadedParams.method_type) setMethodType(loadedParams.method_type);
      if (loadedParams.initialS !== undefined) setInitialS(loadedParams.initialS);
      if (loadedParams.initialE !== undefined) setInitialE(loadedParams.initialE);
      if (loadedParams.initialI !== undefined) setInitialI(loadedParams.initialI);
      if (loadedParams.initialH !== undefined) setInitialH(loadedParams.initialH);
      if (loadedParams.beta !== undefined) setBeta(loadedParams.beta);
      if (loadedParams.sigma !== undefined) setSigma(loadedParams.sigma);
      if (loadedParams.gamma !== undefined) setGamma(loadedParams.gamma);
      if (loadedParams.rho !== undefined) setRho(loadedParams.rho);
      if (loadedParams.delta !== undefined) setDelta(loadedParams.delta);
      if (loadedParams.mu !== undefined) setMu(loadedParams.mu);
      if (loadedParams.time !== undefined) setTime(loadedParams.time);
      if (loadedParams.population !== undefined) setPopulation(loadedParams.population);
      if (loadedParams.step_size !== undefined) setStepSize(loadedParams.step_size);
      if (loadedParams.tolerance !== undefined) setTolerance(loadedParams.tolerance);
      if (loadedParams.startup_method) setStartupMethod(loadedParams.startup_method);
      if (loadedParams.custom_method_code) {
        setCustomCode(loadedParams.custom_method_code);
        setSelectedTemplate('');
      }
    }
  }, [loadedParams]);

  const handleTemplateChange = (e) => {
    const key = e.target.value;
    setSelectedTemplate(key);
    if (key && METHOD_TEMPLATES[key]) setCustomCode(METHOD_TEMPLATES[key].code);
  };

  const buildParamsObject = () => ({
    model_type,
    method_type,
    initialS: Number(initialS),
    initialE: model_type.includes('E') ? Number(initialE) : 0,
    initialI: Number(initialI),
    initialH: model_type.includes('H') ? Number(initialH) : 0,
    beta: Number(beta),
    sigma: model_type.includes('E') ? Number(sigma) : 0,
    gamma: Number(gamma),
    rho: model_type.endsWith('S') ? Number(rho) : 0,
    delta: model_type.includes('H') ? Number(delta) : 0,
    mu: model_type.includes('H') ? Number(mu) : 0,
    time: Number(time),
    population: Number(population),
    step_size: Number(step_size),
    tolerance: (method_type === 'RKF45' || method_type === 'DOPRI5') ? Number(tolerance) : undefined,
    startup_method: method_type.startsWith('Adams') ? startup_method : undefined,
    custom_method_code: method_type === 'Custom' ? custom_method_code : undefined
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (method_type === 'Custom' && !custom_method_code.trim()) {
      alert('Введите код численного метода или выберите шаблон.');
      return;
    }
    onSimulate(buildParamsObject());
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Параметры моделирования</h2>
      <div>
        <label>Модель:</label>
        <select value={model_type} onChange={e => setModelType(e.target.value)}>
          <option value="SIR">SIR</option><option value="SEIR">SEIR</option><option value="SEIRS">SEIRS</option><option value="SEIHR">SEIHR</option><option value="SEIHRS">SEIHRS</option>
        </select>
      </div>
      <div>
        <label>Численный метод:</label>
        <select value={method_type} onChange={e => setMethodType(e.target.value)}>
          <option value="Euler">Эйлер</option><option value="Heun">Хойн (RK2)</option><option value="RK3">RK3</option><option value="RK4">RK4</option>
          <option value="RKF45">RKF45</option><option value="DOPRI5">DOPRI5</option>
          <option value="Adams-Bashforth-4">Adams-Bashforth 4</option><option value="Adams-Moulton-4-PC">Adams-Moulton 4 (PECE)</option>
          <option value="Rosenbrock2">Rosenbrock 2</option><option value="Custom">Свой метод</option>
        </select>
      </div>
      {(method_type === 'RKF45' || method_type === 'DOPRI5') && (
        <div><label>Допустимая погрешность:</label><input type="number" step="1e-8" value={tolerance} onChange={e => setTolerance(e.target.value)} /></div>
      )}
      {method_type.startsWith('Adams') && (
        <div>
          <label>Метод разгона:</label>
          <select value={startup_method} onChange={e => setStartupMethod(e.target.value)}>
            <option value="RK4">RK4</option><option value="Euler">Эйлер</option><option value="Heun">Хойн</option>
          </select>
        </div>
      )}
      {method_type === 'Custom' && (
        <>
          <div>
            <label>Шаблон метода:</label>
            <select value={selectedTemplate} onChange={handleTemplateChange}>
              <option value="">-- Выберите шаблон --</option>
              {Object.entries(METHOD_TEMPLATES).map(([key, tmpl]) => <option key={key} value={key}>{tmpl.label}</option>)}
            </select>
          </div>
          <div>
            <label>Код метода (Python):</label>
            <textarea rows={8} value={custom_method_code} onChange={e => { setCustomCode(e.target.value); setSelectedTemplate(''); }} placeholder="Выберите шаблон или введите код вручную..." />
            <button type="button" className="help-btn" onClick={() => alert('Функция custom_step_func(equations, t, y, h, params)\n\n...')}>?</button>
          </div>
        </>
      )}
      <div><label>Начальное S:</label><input type="number" value={initialS} onChange={e => setInitialS(e.target.value)} /></div>
      {model_type.includes('E') && <div><label>Начальное E:</label><input type="number" value={initialE} onChange={e => setInitialE(e.target.value)} /></div>}
      <div><label>Начальное I:</label><input type="number" value={initialI} onChange={e => setInitialI(e.target.value)} /></div>
      {model_type.includes('H') && <div><label>Начальное H:</label><input type="number" value={initialH} onChange={e => setInitialH(e.target.value)} /></div>}
      <div><label>β:</label><input type="number" step="0.01" value={beta} onChange={e => setBeta(e.target.value)} /></div>
      {model_type.includes('E') && <div><label>σ:</label><input type="number" step="0.01" value={sigma} onChange={e => setSigma(e.target.value)} /></div>}
      <div><label>γ:</label><input type="number" step="0.01" value={gamma} onChange={e => setGamma(e.target.value)} /></div>
      {model_type.endsWith('S') && <div><label>ρ:</label><input type="number" step="0.001" value={rho} onChange={e => setRho(e.target.value)} /></div>}
      {model_type.includes('H') && (
        <>
          <div><label>δ:</label><input type="number" step="0.01" value={delta} onChange={e => setDelta(e.target.value)} /></div>
          <div><label>μ:</label><input type="number" step="0.01" value={mu} onChange={e => setMu(e.target.value)} /></div>
        </>
      )}
      <div><label>Время (дни):</label><input type="number" value={time} onChange={e => setTime(e.target.value)} /></div>
      <div><label>Популяция:</label><input type="number" value={population} onChange={e => setPopulation(e.target.value)} /></div>
      <div><label>Шаг интегрирования:</label><input type="number" step="0.1" value={step_size} onChange={e => setStepSize(e.target.value)} /></div>
      <div className="form-buttons">
        <button type="submit">Запустить симуляцию</button>
      </div>
    </form>
  );
};

export default InputForm;