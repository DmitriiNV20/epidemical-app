from flask import Flask, request, jsonify, make_response, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import (LoginManager, UserMixin, login_user, logout_user,
                         login_required, current_user)
from flask_bcrypt import Bcrypt
import sys, os, json

sys.path.insert(0, os.path.dirname(__file__))
from models import simulate_model

basedir = os.path.abspath(os.path.dirname(__file__))
static_folder = os.path.join(basedir, '..', 'frontend', 'build')
app = Flask(__name__, static_folder=static_folder, static_url_path='/')

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return response

@app.before_request
def handle_options():
    if request.method == 'OPTIONS':
        return make_response('', 200)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret')
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'simulations.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.unauthorized_handler = lambda: (jsonify({"error": "Unauthorized"}), 401)
bcrypt = Bcrypt(app)

# ---------- Модели ----------
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

class Simulation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False, default="Без названия")
    model_type = db.Column(db.String(20))
    method_type = db.Column(db.String(40))
    parameters = db.Column(db.Text)
    results = db.Column(db.Text)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    def to_dict(self):
        return {
            'id': self.id, 'name': self.name,
            'model_type': self.model_type, 'method_type': self.method_type,
            'parameters': json.loads(self.parameters) if self.parameters else {},
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Comparison(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False, default="Сравнение")
    common_params = db.Column(db.Text)
    configs = db.Column(db.Text)
    results = db.Column(db.Text)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    def to_dict(self):
        return {
            'id': self.id, 'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

with app.app_context():
    db.create_all()

# ---------- Валидация ----------
def validate_parameters(model_type, method_type, initial_s, initial_e, initial_i,
                        initial_h, beta, sigma, gamma, rho, delta, mu,
                        time, population, step_size, custom_code=None):
    errors = []
    if population <= 0: errors.append("Популяция должна быть положительным числом.")
    if time <= 0: errors.append("Время симуляции должно быть положительным.")
    if step_size <= 0: errors.append("Шаг интегрирования должен быть положительным.")
    for name, val in [("S", initial_s), ("I", initial_i)]:
        if val < 0: errors.append(f"Начальное {name} не может быть отрицательным.")
    if 'E' in model_type and initial_e < 0: errors.append("Начальное E не может быть отрицательным.")
    if 'H' in model_type and initial_h < 0: errors.append("Начальное H не может быть отрицательным.")
    init_sum = initial_s
    comp_list = ['S']
    if 'E' in model_type: init_sum += initial_e; comp_list.append('E')
    init_sum += initial_i; comp_list.append('I')
    if 'H' in model_type: init_sum += initial_h; comp_list.append('H')
    if init_sum > population:
        comp_str = '+'.join(comp_list)
        errors.append(f"Сумма начальных {comp_str} = {init_sum} превышает популяцию ({population}).")
    if beta < 0: errors.append("Коэффициент β должен быть неотрицательным.")
    if gamma <= 0: errors.append("Скорость выздоровления γ должна быть положительной.")
    if 'E' in model_type and sigma <= 0: errors.append("Скорость σ должна быть положительной.")
    if model_type.endswith('S') and rho < 0: errors.append("Скорость утраты иммунитета ρ не может быть отрицательной.")
    if 'H' in model_type:
        if delta < 0: errors.append("Скорость госпитализации δ не может быть отрицательной.")
        if mu < 0: errors.append("Скорость смертности/выбывания μ не может быть отрицательной.")
    if method_type == 'Custom' and (not custom_code or not custom_code.strip()):
        errors.append("Для кастомного метода необходимо ввести код.")
    return errors

# ---------- Аутентификация ----------
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password: return jsonify({"error": "Логин и пароль обязательны"}), 400
    if User.query.filter_by(username=username).first(): return jsonify({"error": "Пользователь уже существует"}), 400
    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "Регистрация успешна"}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        login_user(user)
        return jsonify({"message": "Вход выполнен", "user_id": user.id, "username": user.username})
    return jsonify({"error": "Неверный логин или пароль"}), 401

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Выход выполнен"})

@app.route('/current_user')
def get_current_user():
    if current_user.is_authenticated:
        return jsonify({"user_id": current_user.id, "username": current_user.username})
    return jsonify(None)

# ---------- Симуляция ----------
@app.route('/simulate', methods=['POST'])
def simulate():
    data = request.get_json()
    model_type = data.get('model_type', 'SEIR')
    method_type = data.get('method_type', 'RK4')
    custom_code = data.get('custom_method_code', None)
    tolerance = data.get('tolerance', 1e-6)
    startup_method = data.get('startup_method', 'RK4')

    initial_s = data.get('initialS', 990)
    initial_e = data.get('initialE', 0) if 'E' in model_type else 0
    initial_i = data.get('initialI', 10)
    initial_h = data.get('initialH', 0) if 'H' in model_type else 0
    initial_r = 0
    beta = data.get('beta', 0.3)
    sigma = data.get('sigma', 0.1) if 'E' in model_type else 0
    gamma = data.get('gamma', 0.1)
    rho = data.get('rho', 0.011) if model_type.endswith('S') else 0
    delta = data.get('delta', 0.05) if 'H' in model_type else 0
    mu = data.get('mu', 0.01) if 'H' in model_type else 0
    time = data.get('time', 100)
    population = data.get('population', 1000)
    step_size = data.get('step_size', 1)

    errors = validate_parameters(model_type, method_type, initial_s, initial_e, initial_i,
                                 initial_h, beta, sigma, gamma, rho, delta, mu,
                                 time, population, step_size, custom_code)
    if errors:
        return jsonify({"error": "Некорректные параметры:\n" + "\n".join("• " + e for e in errors)}), 400

    try:
        results = simulate_model(
            model_type, method_type,
            initial_s, initial_e, initial_i, initial_h, initial_r,
            beta, sigma, gamma, rho, delta, mu,
            time, population, step_size,
            custom_method_code=custom_code,
            tolerance=tolerance,
            startup_method=startup_method
        )
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": f"Ошибка симуляции: {str(e)}"}), 400

@app.route('/compare', methods=['POST'])
def compare():
    data = request.get_json()
    configs = data.get('configs', [])
    time = data.get('time', 100)
    population = data.get('population', 1000)
    step_size = data.get('step_size', 1)
    tolerance = data.get('tolerance', 1e-6)
    startup_method = data.get('startup_method', 'RK4')

    results_list = []
    for cfg in configs:
        model_type = cfg.get('model_type', 'SEIR')
        method_type = cfg.get('method_type', 'RK4')
        custom_code = cfg.get('custom_method_code', None)

        initial_s = cfg.get('initialS', 990)
        initial_e = cfg.get('initialE', 0) if 'E' in model_type else 0
        initial_i = cfg.get('initialI', 10)
        initial_h = cfg.get('initialH', 0) if 'H' in model_type else 0
        initial_r = 0
        beta = cfg.get('beta', 0.3)
        sigma = cfg.get('sigma', 0.1) if 'E' in model_type else 0
        gamma = cfg.get('gamma', 0.1)
        rho = cfg.get('rho', 0.011) if model_type.endswith('S') else 0
        delta = cfg.get('delta', 0.05) if 'H' in model_type else 0
        mu = cfg.get('mu', 0.01) if 'H' in model_type else 0

        label = cfg.get('label', f"{model_type} ({method_type})")

        errors = validate_parameters(model_type, method_type, initial_s, initial_e, initial_i,
                                     initial_h, beta, sigma, gamma, rho, delta, mu,
                                     time, population, step_size, custom_code)
        if errors:
            results_list.append({'label': label, 'error': "Некорректные параметры: " + "; ".join(errors)})
            continue

        try:
            sim_result = simulate_model(
                model_type, method_type,
                initial_s, initial_e, initial_i, initial_h, initial_r,
                beta, sigma, gamma, rho, delta, mu,
                time, population, step_size,
                custom_method_code=custom_code,
                tolerance=tolerance,
                startup_method=startup_method
            )
            results_list.append({
                'label': label,
                'model_type': model_type,
                'method_type': method_type,
                'data': sim_result
            })
        except Exception as e:
            results_list.append({'label': label, 'error': str(e)})

    return jsonify(results_list)

# ---------- Сохранение / загрузка ----------
@app.route('/save_simulation', methods=['POST'])
@login_required
def save_simulation():
    data = request.get_json()
    name = data.get('name', 'Без названия')
    model_type = data.get('model_type')
    method_type = data.get('method_type')
    parameters = json.dumps(data.get('parameters', {}))
    results = json.dumps(data.get('results', {}))

    sim = Simulation(
        user_id=current_user.id,
        name=name,
        model_type=model_type,
        method_type=method_type,
        parameters=parameters,
        results=results
    )
    db.session.add(sim)
    db.session.commit()
    return jsonify({"message": "Симуляция сохранена", "id": sim.id})

@app.route('/simulations', methods=['GET'])
@login_required
def list_simulations():
    simulations = Simulation.query.filter_by(user_id=current_user.id).order_by(Simulation.created_at.desc()).all()
    return jsonify([sim.to_dict() for sim in simulations])

@app.route('/simulation/<int:sim_id>', methods=['GET'])
@login_required
def get_simulation(sim_id):
    sim = Simulation.query.get_or_404(sim_id)
    if sim.user_id != current_user.id:
        return jsonify({"error": "Доступ запрещён"}), 403
    data = {
        'id': sim.id,
        'name': sim.name,
        'model_type': sim.model_type,
        'method_type': sim.method_type,
        'parameters': json.loads(sim.parameters),
        'results': json.loads(sim.results) if sim.results else None,
        'created_at': sim.created_at.isoformat()
    }
    return jsonify(data)

@app.route('/simulation/<int:sim_id>', methods=['DELETE'])
@login_required
def delete_simulation(sim_id):
    sim = Simulation.query.get_or_404(sim_id)
    if sim.user_id != current_user.id:
        return jsonify({"error": "Доступ запрещён"}), 403
    db.session.delete(sim)
    db.session.commit()
    return jsonify({"message": "Симуляция удалена"})

@app.route('/save_comparison', methods=['POST'])
@login_required
def save_comparison():
    data = request.get_json()
    name = data.get('name', 'Сравнение')
    common_params = json.dumps(data.get('common_params', {}))
    configs = json.dumps(data.get('configs', []))
    results = json.dumps(data.get('results', []))

    comp = Comparison(
        user_id=current_user.id,
        name=name,
        common_params=common_params,
        configs=configs,
        results=results
    )
    db.session.add(comp)
    db.session.commit()
    return jsonify({"message": "Сравнение сохранено", "id": comp.id})

@app.route('/comparisons', methods=['GET'])
@login_required
def list_comparisons():
    comparisons = Comparison.query.filter_by(user_id=current_user.id).order_by(Comparison.created_at.desc()).all()
    return jsonify([c.to_dict() for c in comparisons])

@app.route('/comparison/<int:comp_id>', methods=['GET'])
@login_required
def get_comparison(comp_id):
    comp = Comparison.query.get_or_404(comp_id)
    if comp.user_id != current_user.id:
        return jsonify({"error": "Доступ запрещён"}), 403
    return jsonify({
        'id': comp.id,
        'name': comp.name,
        'common_params': json.loads(comp.common_params),
        'configs': json.loads(comp.configs),
        'results': json.loads(comp.results),
        'created_at': comp.created_at.isoformat()
    })

@app.route('/comparison/<int:comp_id>', methods=['DELETE'])
@login_required
def delete_comparison(comp_id):
    comp = Comparison.query.get_or_404(comp_id)
    if comp.user_id != current_user.id:
        return jsonify({"error": "Доступ запрещён"}), 403
    db.session.delete(comp)
    db.session.commit()
    return jsonify({"message": "Сравнение удалено"})

# ---------- Раздача React ----------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    if path.startswith('api/'):
        return app.handle_request()
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=False)
