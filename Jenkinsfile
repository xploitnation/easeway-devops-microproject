
pipeline {
    agent any

    tools {
        nodejs 'NodeJS-20'
    }

    environment {
        IMAGE_NAME = 'easeway'
        IMAGE_TAG  = 'latest'
    }

    stages {
        stage('Checkout Source') {
            steps {
                checkout scm
                echo 'Easeway source checked out.'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Automated Tests') {
            steps {
                sh 'npm test'
            }
        }

        
stage('SonarQube Code Analysis') {
    steps {
        withSonarQubeEnv('SonarQube') {
            sh '''
                docker run --rm \
                  --network host \
                  -e SONAR_HOST_URL="$SONAR_HOST_URL" \
                  -e SONAR_TOKEN="$SONAR_AUTH_TOKEN" \
                  -v "$WORKSPACE:/usr/src" \
                  sonarsource/sonar-scanner-cli:latest \
                  -Dsonar.projectKey=easeway \
                  -Dsonar.projectName=Easeway \
                  -Dsonar.sources=. \
                  -Dsonar.projectBaseDir=/usr/src \
                  -Dsonar.scm.disabled=true \
                  -Dsonar.exclusions=node_modules/**,coverage/**,.git/**,test/**,tests/**
            '''
        }
    }
}


        stage('Build Docker Image') {
            steps {
                sh 'docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .'
            }
        }

        stage('Trivy Vulnerability Scan') {
            steps {
                sh '''
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      aquasec/trivy:latest image \
                      --format table \
                      ${IMAGE_NAME}:${IMAGE_TAG} > trivy-report.txt
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'trivy-report.txt',
                             allowEmptyArchive: true
        }

        success {
            echo 'Easeway CI/CD checks completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Check the stage logs.'
        }
    }
}
