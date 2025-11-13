# CC_Assignment2 — Condensed Report

Date: 2025-11-01

Summary:
this condensed report documents the three exercises for CC_Assignment2 and references included EC2 screenshots.

**Exercise 1 — MyApp (language detection)**
- Purpose: Flask microservice that detects language using langdetect.
- Key files: MyApp/langdetectSara.py, MyApp/index.html, MyApp/curl.zsh
- Run: create venv, install requirements, then:
  python MyApp/langdetectSara.py
  Open http://127.0.0.1:5000/ or use curl.zsh examples.
- Endpoints: /detect (top language), /detect_probs (candidates), /is_language (match check).

**Exercise 2 — EC2 screenshots**
- Add screenshots to: MyApp/docs/screenshots/
  - Image2.png — EC2 instances list (shows instance name, id, public IP)
  - Image1.png — service response page (instance id)
- Observations:
  - Instance name: langdetect-api, ID: i-06e5d8288f463f5fc
  - Public IPv4: 13.51.106.196 (this will change after stopping and re-running the instance)
  - The service returned the instance id at the /instance endpoint, confirming reachability and metadata usage.

Images required:
![EC2 list](MyApp/Image1.png)
![Instance page](MyApp/Image2.png)

**Exercise 3 — MyApp2 (Monthly Expense Tracker)**
- Purpose: Minimal Flask expense tracker with CSV import/export.
- Key files: MyApp2/app.py, MyApp2/templates/index.html, MyApp2/static/js/main.js, MyApp2/test_import.csv
- Features: Circular plot of expenses grouped by category, add expense (amount, category, date), delete expense and calculates remaining that are savings. When overspent message displayed.
- Run:
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r MyApp2/requirements.txt
  python MyApp2/app.py
  Open http://127.0.0.1:5000
- Test CSV import using MyApp2/test_import.csv via the UI import control.

Notes:
- Data is kept in memory (no database) and will be lost when the server restarts.
- This project is intended as a small demo / proof-of-concept.


