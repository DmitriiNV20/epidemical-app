import numpy as np

# Уравнения моделей
def sir_equations(t, s, i, r, beta, gamma, population, *extra):
    N = population
    dsdt = -beta * s * i / N
    didt = beta * s * i / N - gamma * i
    drdt = gamma * i
    return dsdt, didt, drdt

def seir_equations(t, s, e, i, r, beta, sigma, gamma, population, *extra):
    N = population
    dsdt = -beta * s * i / N
    dedt = beta * s * i / N - sigma * e
    didt = sigma * e - gamma * i
    drdt = gamma * i
    return dsdt, dedt, didt, drdt

def seirs_equations(t, s, e, i, r, beta, sigma, gamma, rho, population, *extra):
    N = population
    dsdt = -beta * s * i / N + rho * r
    dedt = beta * s * i / N - sigma * e
    didt = sigma * e - gamma * i
    drdt = gamma * i - rho * r
    return dsdt, dedt, didt, drdt

def seihr_equations(t, s, e, i, h, r, beta, sigma, gamma, delta, mu, population):
    N = population
    dsdt = -beta * s * i / N
    dedt = beta * s * i / N - sigma * e
    didt = sigma * e - (gamma + delta) * i
    dhdt = delta * i - mu * h
    drdt = gamma * i + mu * h
    return dsdt, dedt, didt, dhdt, drdt

def seihrs_equations(t, s, e, i, h, r, beta, sigma, gamma, rho, delta, mu, population):
    N = population
    dsdt = -beta * s * i / N + rho * r
    dedt = beta * s * i / N - sigma * e
    didt = sigma * e - (gamma + delta) * i
    dhdt = delta * i - (mu + gamma) * h
    drdt = gamma * i + gamma * h - rho * r
    return dsdt, dedt, didt, dhdt, drdt


# Одношаговые методы (фиксированный шаг)
def euler_step(equations, t, y, h, params):
    dy = equations(t, *y, *params)
    return [max(0, y[i] + h * dy[i]) for i in range(len(y))]

def rk2_step(equations, t, y, h, params):  # Heun
    k1 = equations(t, *y, *params)
    y_temp = [y[i] + h * k1[i] for i in range(len(y))]
    k2 = equations(t + h, *y_temp, *params)
    return [max(0, y[i] + h/2 * (k1[i] + k2[i])) for i in range(len(y))]

def rk3_step(equations, t, y, h, params):
    k1 = equations(t, *y, *params)
    y_temp = [y[i] + h/2 * k1[i] for i in range(len(y))]
    k2 = equations(t + h/2, *y_temp, *params)
    y_temp2 = [y[i] + h * (-k1[i] + 2*k2[i]) for i in range(len(y))]
    k3 = equations(t + h, *y_temp2, *params)
    return [max(0, y[i] + h/6 * (k1[i] + 4*k2[i] + k3[i])) for i in range(len(y))]

def rk4_step(equations, t, y, h, params):
    k1 = equations(t, *y, *params)
    y2 = [y[i] + h/2 * k1[i] for i in range(len(y))]
    k2 = equations(t + h/2, *y2, *params)
    y3 = [y[i] + h/2 * k2[i] for i in range(len(y))]
    k3 = equations(t + h/2, *y3, *params)
    y4 = [y[i] + h * k3[i] for i in range(len(y))]
    k4 = equations(t + h, *y4, *params)
    return [max(0, y[i] + h/6 * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i])) for i in range(len(y))]


# Адаптивные методы (RKF45, DOPRI5)
def rkf45_step(equations, t, y, h, params, tol=1e-6):
    k1 = equations(t, *y, *params)
    y2 = [y[i] + h * 1/4 * k1[i] for i in range(len(y))]
    k2 = equations(t + h/4, *y2, *params)
    y3 = [y[i] + h * (3/32*k1[i] + 9/32*k2[i]) for i in range(len(y))]
    k3 = equations(t + 3*h/8, *y3, *params)
    y4 = [y[i] + h * (1932/2197*k1[i] - 7200/2197*k2[i] + 7296/2197*k3[i]) for i in range(len(y))]
    k4 = equations(t + 12*h/13, *y4, *params)
    y5 = [y[i] + h * (439/216*k1[i] - 8*k2[i] + 3680/513*k3[i] - 845/4104*k4[i]) for i in range(len(y))]
    k5 = equations(t + h, *y5, *params)
    y6 = [y[i] + h * (-8/27*k1[i] + 2*k2[i] - 3544/2565*k3[i] + 1859/4104*k4[i] - 11/40*k5[i]) for i in range(len(y))]
    k6 = equations(t + h/2, *y6, *params)

    y4_order = [y[i] + h * (25/216*k1[i] + 1408/2565*k3[i] + 2197/4104*k4[i] - 1/5*k5[i]) for i in range(len(y))]
    y5_order = [y[i] + h * (16/135*k1[i] + 6656/12825*k3[i] + 28561/56430*k4[i] - 9/50*k5[i] + 2/55*k6[i]) for i in range(len(y))]
    err = max(abs(y5_order[i] - y4_order[i]) for i in range(len(y)))
    if err == 0:
        h_new = h * 2
    else:
        h_new = 0.9 * h * (tol / err) ** 0.2
        h_new = max(0.1 * h, min(2.0 * h, h_new))
    if err > tol:
        return None, h_new
    return [max(0, yi) for yi in y5_order], h_new

def dopri5_step(equations, t, y, h, params, tol=1e-6):
    k1 = equations(t, *y, *params)
    y2 = [y[i] + h * 1/5 * k1[i] for i in range(len(y))]
    k2 = equations(t + h/5, *y2, *params)
    y3 = [y[i] + h * (3/40*k1[i] + 9/40*k2[i]) for i in range(len(y))]
    k3 = equations(t + 3*h/10, *y3, *params)
    y4 = [y[i] + h * (44/45*k1[i] - 56/15*k2[i] + 32/9*k3[i]) for i in range(len(y))]
    k4 = equations(t + 4*h/5, *y4, *params)
    y5 = [y[i] + h * (19372/6561*k1[i] - 25360/2187*k2[i] + 64448/6561*k3[i] - 212/729*k4[i]) for i in range(len(y))]
    k5 = equations(t + 8*h/9, *y5, *params)
    y6 = [y[i] + h * (9017/3168*k1[i] - 355/33*k2[i] + 46732/5247*k3[i] + 49/176*k4[i] - 5103/18656*k5[i]) for i in range(len(y))]
    k6 = equations(t + h, *y6, *params)
    y7 = [y[i] + h * (35/384*k1[i] + 500/1113*k3[i] + 125/192*k4[i] - 2187/6784*k5[i] + 11/84*k6[i]) for i in range(len(y))]
    k7 = equations(t + h, *y7, *params)

    y4_order = [y[i] + h * (5179/57600*k1[i] + 7571/16695*k3[i] + 393/640*k4[i] - 92097/339200*k5[i] + 187/2100*k6[i] + 1/40*k7[i]) for i in range(len(y))]
    y5_order = [y[i] + h * (35/384*k1[i] + 500/1113*k3[i] + 125/192*k4[i] - 2187/6784*k5[i] + 11/84*k6[i]) for i in range(len(y))]
    err = max(abs(y5_order[i] - y4_order[i]) for i in range(len(y)))
    if err == 0:
        h_new = h * 2
    else:
        h_new = 0.9 * h * (tol / err) ** 0.2
        h_new = max(0.1 * h, min(2.0 * h, h_new))
    if err > tol:
        return None, h_new
    return [max(0, yi) for yi in y5_order], h_new


# Многошаговые методы с выбором разгона
def adams_bashforth_4_step(equations, t, y, h, params, f_history):
    f_n3, f_n2, f_n1, f_n = f_history
    dy = [(55*f_n[i] - 59*f_n1[i] + 37*f_n2[i] - 9*f_n3[i]) / 24 for i in range(len(y))]
    y_new = [max(0, y[i] + h * dy[i]) for i in range(len(y))]
    new_f_history = f_history[1:] + [dy]
    return y_new, new_f_history

def adams_moulton_4_pc_step(equations, t, y, h, params, f_history):
    f_n3, f_n2, f_n1, f_n = f_history
    dy_pred = [(55*f_n[i] - 59*f_n1[i] + 37*f_n2[i] - 9*f_n3[i]) / 24 for i in range(len(y))]
    y_pred = [max(0, y[i] + h * dy_pred[i]) for i in range(len(y))]
    f_pred = np.array(equations(t + h, *y_pred, *params))
    dy_corr = [(9*f_pred[i] + 19*f_n[i] - 5*f_n1[i] + f_n2[i]) / 24 for i in range(len(y))]
    y_corr = [max(0, y[i] + h * dy_corr[i]) for i in range(len(y))]
    f_corr = np.array(equations(t + h, *y_corr, *params))
    new_f_history = f_history[1:] + [f_corr]
    return y_corr, new_f_history

STARTUP_METHODS = {
    'Euler': euler_step,
    'Heun': rk2_step,
    'RK4': rk4_step
}


# Розенброк 2
def numerical_jacobian(equations, t, y, params, eps=1e-6):
    n = len(y)
    f0 = np.array(equations(t, *y, *params))
    J = np.zeros((n, n))
    for i in range(n):
        y_eps = y.copy()
        y_eps[i] += eps
        f_eps = np.array(equations(t, *y_eps, *params))
        J[:, i] = (f_eps - f0) / eps
    return J

def rosenbrock2_step(equations, t, y, h, params, jac_func):
    n = len(y)
    I = np.eye(n)
    gamma = 1 - 1/np.sqrt(2)
    J = jac_func(t, y, params)
    lhs = I - gamma * h * J
    f = np.array(equations(t, *y, *params))
    k1 = np.linalg.solve(lhs, f)
    y2 = [y[i] + h * k1[i] for i in range(n)]
    f2 = np.array(equations(t + h, *y2, *params))
    rhs = f2 - gamma * h * J @ k1
    k2 = np.linalg.solve(lhs, rhs)
    y_new = [y[i] + h * (1.5 * k1[i] + 0.5 * k2[i]) for i in range(n)]
    return [max(0, yi) for yi in y_new]


# Пользовательский метод
def custom_step(equations, t, y, h, params, custom_code):
    namespace = {}
    exec(custom_code, namespace)
    if 'custom_step_func' not in namespace:
        raise ValueError("Функция custom_step_func не найдена")
    return namespace['custom_step_func'](equations, t, y, h, params)


# Главная функция симуляции
def simulate_model(model_type, method_type, initial_s, initial_e, initial_i,
                   initial_h, initial_r, beta, sigma, gamma, rho, delta, mu,
                   time, population, step_size=1, custom_method_code=None,
                   tolerance=1e-6, startup_method='RK4'):
    if model_type == 'SIR':
        equations = sir_equations
        y = [initial_s, initial_i, initial_r]
        params = (beta, gamma, population)
        compartments = ['s', 'i', 'r']
    elif model_type == 'SEIR':
        equations = seir_equations
        y = [initial_s, initial_e, initial_i, initial_r]
        params = (beta, sigma, gamma, population)
        compartments = ['s', 'e', 'i', 'r']
    elif model_type == 'SEIRS':
        equations = seirs_equations
        y = [initial_s, initial_e, initial_i, initial_r]
        params = (beta, sigma, gamma, rho, population)
        compartments = ['s', 'e', 'i', 'r']
    elif model_type == 'SEIHR':
        equations = seihr_equations
        y = [initial_s, initial_e, initial_i, initial_h, initial_r]
        params = (beta, sigma, gamma, delta, mu, population)
        compartments = ['s', 'e', 'i', 'h', 'r']
    elif model_type == 'SEIHRS':
        equations = seihrs_equations
        y = [initial_s, initial_e, initial_i, initial_h, initial_r]
        params = (beta, sigma, gamma, rho, delta, mu, population)
        compartments = ['s', 'e', 'i', 'h', 'r']
    else:
        raise ValueError("Unknown model_type")

    results = {comp: [max(0, y[i])] for i, comp in enumerate(compartments)}
    results['time'] = [0.0]
    t = 0.0
    y_history = [y[:]]
    f_history = []

    # Разгон для многошаговых методов
    if method_type in ['Adams-Bashforth-4', 'Adams-Moulton-4-PC']:
        startup_func = STARTUP_METHODS.get(startup_method, rk4_step)
        f0 = np.array(equations(0, *y, *params))
        f_history.append(f0)
        for _ in range(3):
            y = startup_func(equations, t, y, step_size, params)
            t += step_size
            for i, comp in enumerate(compartments):
                results[comp].append(max(0, y[i]))
            results['time'].append(t)
            f_now = np.array(equations(t, *y, *params))
            f_history.append(f_now)

    while t < time:
        h_step = min(step_size, time - t)
        if method_type == 'Euler':
            y = euler_step(equations, t, y, h_step, params)
        elif method_type == 'Heun':
            y = rk2_step(equations, t, y, h_step, params)
        elif method_type == 'RK3':
            y = rk3_step(equations, t, y, h_step, params)
        elif method_type == 'RK4':
            y = rk4_step(equations, t, y, h_step, params)
        elif method_type == 'RKF45':
            y_new, h_new = rkf45_step(equations, t, y, h_step, params, tolerance)
            while y_new is None:
                h_step = h_new
                if t + h_step > time:
                    h_step = time - t
                y_new, h_new = rkf45_step(equations, t, y, h_step, params, tolerance)
            y = y_new
            step_size = h_new
        elif method_type == 'DOPRI5':
            y_new, h_new = dopri5_step(equations, t, y, h_step, params, tolerance)
            while y_new is None:
                h_step = h_new
                if t + h_step > time:
                    h_step = time - t
                y_new, h_new = dopri5_step(equations, t, y, h_step, params, tolerance)
            y = y_new
            step_size = h_new
        elif method_type == 'Adams-Bashforth-4':
            y, f_history = adams_bashforth_4_step(equations, t, y, h_step, params, f_history)
        elif method_type == 'Adams-Moulton-4-PC':
            y, f_history = adams_moulton_4_pc_step(equations, t, y, h_step, params, f_history)
        elif method_type == 'Rosenbrock2':
            y = rosenbrock2_step(equations, t, y, h_step, params,
                                 lambda t, y, p: numerical_jacobian(equations, t, y, p))
        elif method_type == 'Custom':
            if not custom_method_code:
                raise ValueError("Custom method code required")
            y = custom_step(equations, t, y, h_step, params, custom_method_code)
        else:
            raise ValueError(f"Unknown method_type: {method_type}")

        t += h_step
        for i, comp in enumerate(compartments):
            results[comp].append(max(0, y[i]))
        results['time'].append(t)

    return results