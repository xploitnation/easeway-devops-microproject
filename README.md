# Easeway – Student Mental Wellness Support Platform

Working prototype for the SEP micro project *"Scrum-Based Development Framework for a Student Mental Wellness Support Platform"* (SDG 9 and SDG 3).
It implements backlog stories US-01 to US-10 from the report.

**Not a medical service.** It signposts support and cannot diagnose or treat anything. It uses synthetic data only.

## Run it (Kali Linux / any OS with Node.js 18+)

```bash
cd easeway
npm install          # installs express, express-session, bcryptjs, better-sqlite3
npm run seed         # optional: adds 12 synthetic students + 14 days of check-ins for the demo
npm start            # http://localhost:3000
npm test             # 19 automated checks on a temporary database
```

If `npm install` fails building `better-sqlite3`: `sudo apt install build-essential python3` and retry.

## Demo accounts

| Role | Name | Password |
|---|---|---|
| Counsellor | `counsellor1` (Dr. Meera Rao) | `Counsel@123` |
| Counsellor | `counsellor2` (Mr. Arjun Nair) | `Counsel@123` |
| Student (synthetic) | `demo_student_01` ... `demo_student_12` | `Student@123` |

Create your own student account on the sign-in screen for the video (use a made-up name, not your real one).

## Suggested 3-minute video script

1. **(0:00)** Intro: project title, SDG 9 / SDG 3, adapted Scrum (Privacy Impact Review + Ethical Definition of Done). Show your JIRA board and burndown for 15 seconds.
2. **(0:25)** Create account: point out no email/real name, the consent notice and the checkbox (US-01, US-02).
3. **(0:55)** Check in with score 4 and a note; then check in with score 2 to show the support card (US-03, US-08). Say it is rule-based, non-diagnostic, nobody is alerted.
4. **(1:25)** *My trend* chart and table view (US-04). *Resources* with topic filter (US-05).
5. **(1:50)** *Counsellor*: book a slot (US-06). Show it appears under your appointments.
6. **(2:05)** Sign out, sign in as `counsellor1`: *Appointments* shows only your chosen name; *Campus trends* shows aggregated bars and hidden days under the 5-student threshold (US-07).
7. **(2:30)** Sign in as your student again: *Privacy* > turn consent off (check-in now refused), turn on, then delete account (US-09).
8. **(2:50)** Run `npm test` in the terminal to show 19/19 passing, then close with future scope.

Accessibility (US-10): demonstrate pressing Tab through the check-in form and using the mood buttons with arrow keys, and resize the window to phone width.

## Mapping to the report's test cases

| Report TC | Covered by | How |
|---|---|---|
| TC-01 Register with handle + password | `npm test` TC-01, 01b, 01c | Schema has no name/email columns; email-style handle and missing consent rejected |
| TC-02 Mood with note | TC-02, 02b, 02c | Owner-only access; note encrypted at rest; consent withdrawal blocks writes |
| TC-03 Invalid score | TC-03 | Score 9, text and 501-char note rejected |
| TC-04 Student requests counsellor URL | TC-04 | 403 for students, 401 for anonymous |
| TC-05 Injection string | TC-05, 05b | Stored as plain text; tables intact; requests without CSRF header blocked |
| TC-06 Very low score | TC-06 | Helplines returned for score 1-2 or crisis keywords |
| TC-07 Delete account | TC-07, 07b | Needs password; removes user, moods, bookings |
| TC-08 Small-group trends | TC-08 | Hidden below 5 students, shown at 5 |
| TC-09 Keyboard only | TC-09 (static) + **manual** | Static checks automated; do the Tab-through yourself and screenshot it |
| TC-10 Logs hold no personal data | TC-10 | Server log checked for notes, passwords, handles |

Paste the `npm test` output and a screenshot into section 4.4 of your report as evidence.

## Privacy and security design

- No real name, email, roll number or location is collected. Handles with `@` are refused.
- Passwords hashed with bcrypt; sessions in HttpOnly, SameSite=Strict cookies; login throttling (5 failures / 10 minutes).
- Notes are encrypted with AES-256-GCM. The key is generated on first run in `data/easeway.db.key`. Do not commit or share it.
- Parameterised SQL everywhere; strict Content-Security-Policy; the front end never injects data as HTML.
- Counsellors see only the pseudonymous handle on booked appointments, never scores or notes.
- Campus averages show only when at least `K_THRESHOLD` (5) distinct students contributed that day.
- Logs record method, path and status only.

## Configuration (`config.js`)

Helpline numbers, the aggregation threshold, the low-score trigger and the crisis keyword list. **Check and update the helpline numbers for your campus before showing anyone.** Add your campus counselling number there.

## DevSecOps Engineering Stack (SAKEC Lab Syllabus Aligned)

This project includes a complete end-to-end DevSecOps pipeline fulfilling University of Mumbai / SAKEC DevSecOps laboratory requirements (CO1–CO3, Exp 1–10):

- **Containerization**: [`Dockerfile`](Dockerfile) (multi-stage, non-root `node:20-bookworm-slim`, persistent `/app/data` volume) & [`docker-compose.yml`](docker-compose.yml).
- **CI/CD Pipeline**: [`Jenkinsfile`](Jenkinsfile) with automated testing, SonarQube SAST, Docker build, and Trivy CVE scanning.
- **Infrastructure as Code (IaC)**: [`terraform/`](terraform/) provisions AWS VPC, Subnets, Internet Gateway, Security Groups, and Ubuntu EC2.
- **Configuration Management**: [`ansible/`](ansible/) playbooks for automated host configuration and deployment.
- **Vulnerability Scanning & Threat Modeling**: Aqua Trivy integration and OWASP STRIDE threat model in [`security/THREAT_MODEL.md`](security/THREAT_MODEL.md).
- **Continuous Monitoring**: Prometheus & Grafana stack in [`monitoring/`](monitoring/).
- **GitHub Actions**: Continuous integration workflow in [`.github/workflows/devsecops-ci.yml`](.github/workflows/devsecops-ci.yml).
- **Complete Lab Report**: See [`DEVOPS_PROJECT_REPORT.md`](DEVOPS_PROJECT_REPORT.md) for full syllabus mapping and step-by-step commands.

## Project layout

```
server.js      API + security middleware      db.js          SQLite + AES-256 encryption
seed.js        counsellors, slots, demo data  config.js      thresholds, helplines
public/        index.html, style.css, app.js  test.js        automated checks (19 tests)
resources.json self-help guides               Dockerfile     container definition
Jenkinsfile    declarative CI/CD pipeline     terraform/     AWS IaC infrastructure
ansible/       automated configuration        monitoring/    Prometheus & Grafana
security/      STRIDE threat model            .github/       GitHub Actions CI workflow
```

## Known limitations (state these in your report's Analysis section)

- Prototype scale: in-memory session store and single-node SQLite.
- Crisis detection is a simple rule, not clinical assessment, and cannot catch every phrasing.
- No password reset (by design: no email is held), and counsellor accounts are seeded, not self-registered.
- Needs HTTPS and a hardened session store before any real deployment.

