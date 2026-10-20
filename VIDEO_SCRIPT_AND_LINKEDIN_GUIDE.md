# Demonstration Video Script & LinkedIn Guide

**Project:** Easeway – End-to-End DevSecOps Pipeline  
**Target Duration:** 3 to 5 minutes  
**Target Platforms:** LinkedIn, Academic Evaluation Submission  

---

## 1. Credential & Security Safety Checklist (IMPORTANT!)

> [!CAUTION]
> **Before recording, verify that NO sensitive secrets are visible on your screen:**
> 1. **AWS Keys:** Never open `.aws/credentials` or show `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`.
> 2. **Environment & Secrets:** Hide or blur any `.env` or `.pem` private keys.
> 3. **Passwords:** Use synthetic passwords only (e.g. `Student@123`, `Counsel@123`).
> 4. **Jenkins Tokens:** Do not reveal SonarQube auth tokens or GitHub personal access tokens.
> 5. **Terminal Clear:** Run `clear` or `cls` before starting each recording segment.

---

## 2. Timed 4-Minute Video Script

### Section 1: Introduction & Problem Scope (0:00 – 0:40)
- **What to show:** Title slide or opening screen of the **Easeway** platform (`http://localhost:3000`).
- **Narration:**
  > "Hello everyone! This is my final DevSecOps micro-project: **Easeway**, an end-to-end cloud-native student mental wellness support platform built with an adapted Scrum framework and privacy-by-design principles aligned with UN SDGs 3 and 9. 
  > In this video, I will demonstrate the full DevSecOps lifecycle—from functional application testing and containerization to Jenkins CI/CD, Terraform Infrastructure as Code on AWS, and automated security scanning with SonarQube and Trivy."

### Section 2: Website & Privacy Features (0:40 – 1:30)
- **What to show:**
  1. Register a new anonymous student account (highlight no email/real name required).
  2. Perform a check-in with a mood score and note. Show the non-diagnostic crisis support card triggering on low scores (Score 1 or 2).
  3. Sign in as counsellor (`counsellor1` / `Counsel@123`) and demonstrate the **Campus Trends** view—show how daily averages are suppressed under the 5-student k-anonymity threshold (`K_THRESHOLD = 5`) to preserve anonymity.
- **Narration:**
  > "Easeway collects zero Personally Identifiable Information (no email or roll numbers). Free-text notes are encrypted at rest using AES-256-GCM. Aggregated campus trends implement k-anonymity to prevent individual student deanonymization."

### Section 3: Automated Testing & Docker Containerization (1:30 – 2:15)
- **What to show:**
  1. Terminal: Run `npm test` showing **19/19 passing tests** (TC-01 to TC-10 covering SQL injection, CSRF headers, RBAC, and encryption).
  2. Terminal / Docker Desktop: Show `Dockerfile`, container running (`docker ps`), and healthcheck status.
- **Narration:**
  > "Our automated test suite verifies 19 distinct integration and security contracts. The application is containerized using a multi-stage, non-root Node.js Docker image with health monitoring and persistent volume mapping."

### Section 4: Jenkins CI/CD Pipeline & Shift-Left Security (2:15 – 3:15)
- **What to show:**
  1. Jenkins Dashboard: Open `easeway-devsecops-pipeline`.
  2. Click on the latest build execution: Show stages (Checkout -> Automated Tests -> SonarQube SAST -> Docker Build -> Trivy Security Scan -> Deploy).
  3. Open the **Trivy Security Scan Report** HTML tab in Jenkins.
  4. Show the SonarQube Quality Gate showing an **A** grade with 0 vulnerabilities.
- **Narration:**
  > "Our Jenkins declarative pipeline integrates automated quality and security gates at every commit. Aqua Trivy inspects container layers and npm dependencies for CVEs, while SonarQube performs Static Application Security Testing (SAST). If critical vulnerabilities or test failures occur, the pipeline halts immediately."

### Section 5: AWS Infrastructure as Code with Terraform (3:15 – 3:45)
- **What to show:**
  1. VS Code: Show `terraform/networking.tf`, `security_group.tf`, and `ec2.tf`.
  2. Terminal: Show `terraform plan` or outputs showing VPC, Subnet, and EC2 provisioning.
- **Narration:**
  > "All underlying AWS cloud infrastructure—including custom VPC, public subnets, Internet Gateways, and restrictive security groups—is provisioned deterministically as code using Terraform."

### Section 6: Conclusion & Wrap-up (3:45 – 4:00)
- **What to show:** GitHub repository overview (`README.md`, `Jenkinsfile`, `terraform/`, `Dockerfile`).
- **Narration:**
  > "This project demonstrates how shifting security left into automated CI/CD and provisioning infrastructure via code creates reliable, secure, and observable software systems. Thank you!"

---

## 3. LinkedIn Post Template

Copy and adapt this text when posting your video to LinkedIn:

```markdown
🚀 Excited to share my final DevSecOps project: "Easeway – Cloud-Native Student Mental Wellness Platform"! 🛡️💻

In this project, I built and deployed an end-to-end, security-hardened web application following modern DevSecOps practices:

🔹 Website & Security: Built with Node.js and SQLite with authenticated AES-256-GCM encryption at rest, zero-PII data modeling, and k-anonymity (k=5) privacy protection.
🔹 Automated Testing: 19 automated integration and security test cases covering SQLi, CSRF, and RBAC.
🔹 Containerization: Multi-stage, non-root Docker container with persistent storage volumes and healthchecks.
🔹 CI/CD Automation: Declarative Jenkins pipeline automating build, test, scan, and deployment stages.
🔹 Shift-Left Security: Integrated SonarQube (SAST) and Aqua Trivy for automated container vulnerability and CVE analysis.
🔹 Infrastructure as Code (IaC): Automated provisioning of AWS VPC, security groups, and EC2 instances using Terraform.
🔹 Continuous Monitoring: Real-time system and application observability via Prometheus & Grafana.

Special thanks to our faculty at Shah & Anchor Kutchhi Engineering College (SAKEC) for their continuous guidance!

Check out the full walkthrough in the video below! 👇

#DevSecOps #DevOps #AWS #Terraform #Docker #Jenkins #SonarQube #Trivy #Prometheus #CyberSecurity #CloudComputing #Engineering #ContinuousIntegration #SAKEC
```
