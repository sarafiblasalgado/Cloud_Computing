from flask import Flask, render_template, jsonify, request, abort
from datetime import datetime

app = Flask(__name__)

# In-memory storage for demo purposes (single user, no DB)
expenses = []
_next_id = 1

def _get_next_id():
    global _next_id
    nid = _next_id
    _next_id += 1
    return nid


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/expenses', methods=['GET'])
def list_expenses():
    """Return all expenses as JSON."""
    return jsonify(expenses)


@app.route('/api/expenses', methods=['POST'])
def add_expense():
    """Add an expense. Expects JSON: { amount: number, category: str, date: 'YYYY-MM-DD' (optional) }"""
    data = request.get_json()
    if not data:
        return abort(400, 'JSON body required')
    amount = data.get('amount')
    category = data.get('category')
    date_str = data.get('date')
    if amount is None or category is None:
        return abort(400, 'amount and category are required')
    try:
        amount = float(amount)
    except Exception:
        return abort(400, 'amount must be a number')
    # normalize date
        try:
            date_obj = datetime.fromisoformat(date_str).date()
            date_iso = date_obj.isoformat()
        except Exception:
            date_iso = datetime.utcnow().date().isoformat()
    else:
        date_iso = datetime.utcnow().date().isoformat()

    expense = {
        'id': _get_next_id(),
        'amount': amount,
        'category': category,
        'date': date_iso,
    }
    expenses.append(expense)
    return jsonify(expense), 201


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id: int):
    """Delete an expense by id."""
    for i, e in enumerate(expenses):
        if e['id'] == expense_id:
            expenses.pop(i)
            return jsonify({'message': 'deleted'})
    return abort(404, 'expense not found')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)