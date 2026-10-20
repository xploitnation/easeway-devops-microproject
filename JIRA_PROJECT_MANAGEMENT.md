# Agile & JIRA Project Management: Easeway Platform

**Framework:** Adapted Scrum with Privacy Impact Reviews (PIR) and Ethical Definition of Done (DoD)  
**Project Key:** `EW` (Easeway)  
**Tracking Tool:** Atlassian JIRA / Kanban Board  

---

## 1. Product Backlog & User Stories (US-01 to US-10)

| Story ID | Summary | Story Points | Priority | Sprint | Status | Mapped Test Case |
|---|---|---|---|---|---|---|
| **US-01** | Anonymous Student Registration (Zero PII, no email/phone) | 3 | High | Sprint 1 | DONE | TC-01, 01b, 01c |
| **US-02** | Explicit Informed Consent Agreement & Privacy Disclosure | 2 | High | Sprint 1 | DONE | TC-01c, 02c |
| **US-03** | Daily Mood Check-In with Encrypted Free-Text Notes | 5 | Highest | Sprint 1 | DONE | TC-02, 02b |
| **US-04** | Personal 30-Day Mood Trend Visualization (SVG Chart + Table) | 5 | Medium | Sprint 1 | DONE | TC-02 |
| **US-05** | Curated Self-Help Resources with Categorized Topic Filtering | 3 | Medium | Sprint 1 | DONE | TC-09 |
| **US-06** | Confidential Student-Counsellor Appointment Booking | 5 | High | Sprint 2 | DONE | TC-06b |
| **US-07** | Counsellor Aggregated Campus Mood Trends (k-Anonymity >= 5) | 8 | Highest | Sprint 2 | DONE | TC-08 |
| **US-08** | Automated Non-Diagnostic Crisis Trigger & Helpline Signposting | 5 | Highest | Sprint 2 | DONE | TC-06 |
| **US-09** | GDPR/DPDP Consent Revocation & One-Click Account Deletion | 5 | High | Sprint 2 | DONE | TC-07, 07b |
| **US-10** | WCAG 2.1 AA Accessibility & Keyboard-Only Navigation | 3 | Medium | Sprint 2 | DONE | TC-09 |

---

## 2. Sprint Execution Plan

### Sprint 1: Core Platform, Privacy & Data Architecture
- **Sprint Goal:** Establish anonymous student identity, encrypted check-in data store, and core visualization.
- **Velocity:** 18 Story Points completed.
- **Key Deliverables:** SQLite schema without PII columns, AES-256-GCM authenticated cipher engine, responsive web UI, and basic tests.

### Sprint 2: Counsellor Portal, k-Anonymity & DevSecOps Hardening
- **Sprint Goal:** Deliver appointment booking, k-anonymity aggregation, automated tests, Docker containerization, and Jenkins pipeline.
- **Velocity:** 26 Story Points completed.
- **Key Deliverables:** k-Anonymity threshold logic (`K_THRESHOLD = 5`), 19 automated tests in `test.js`, Dockerfile, Jenkinsfile, and Terraform scripts.

---

## 3. Ethical Definition of Done (DoD)

Before any user story could transition to `DONE` on the JIRA board, it was evaluated against strict ethical and technical criteria:

1. **Privacy Review Passed:** Does the story introduce any unneeded PII (email, roll number, IP address)?
2. **Encryption Verified:** Are sensitive fields encrypted at rest using AES-256-GCM?
3. **Automated Unit & Integration Tests Passed:** All 19 tests in `test.js` exit with code `0`.
4. **Security Vulnerability Gates Clean:** SonarQube quality gate rating A; zero `CRITICAL` or `HIGH` vulnerabilities flagged by Trivy.
5. **Accessibility Verified:** All interactable controls operable via keyboard alone with appropriate ARIA attributes.
6. **Container Compatibility:** Runs successfully inside standard non-root Docker container with healthcheck passing.
