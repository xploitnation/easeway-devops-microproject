pipeline {
    agent any

    parameters {
        string(name: 'BRANCH', defaultValue: 'main', description: 'Git branch to build')
        booleanParam(name: 'FAIL_ON_CRITICAL_CVE', defaultValue: false, description: 'Halt build if Trivy detects CRITICAL vulnerabilities')
        string(name: 'IMAGE_TAG', defaultValue: 'latest', description: 'Docker image tag')
    }

    environment {
        APP_NAME        = 'easeway'
        IMAGE_NAME      = 'easeway'
        DOCKER_HUB_USER = 'sakecstudent' // Update with your Docker Hub username
        PORT            = '3000'
        SONAR_HOST      = 'http://localhost:9000'
    }

    stages {
        stage('Checkout Source') {
            steps {
                echo "===> Checking out branch ${params.BRANCH}..."
                checkout scm
            }
        }

        stage('Install Dependencies & Automated Tests') {
            steps {
                echo "===> Running automated test suite (19 test cases)..."
                sh '''
                    npm ci
                    npm test
                '''
            }
        }

        stage('SonarQube Static Analysis (SAST)') {
            steps {
                echo "===> Executing SonarQube static code analysis..."
                // Runs SonarQube scanner against the codebase
                sh '''
                    if command -v sonar-scanner >/dev/null 2>&1; then
                        sonar-scanner \
                          -Dsonar.projectKey=easeway \
                          -Dsonar.sources=. \
                          -Dsonar.exclusions=node_modules/**,public/**,coverage/**,test.js \
                          -Dsonar.host.url=${SONAR_HOST} || true
                    else
                        echo "sonar-scanner CLI not installed on agent; skipping or run via docker container"
                    fi
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "===> Building Docker image ${IMAGE_NAME}:${params.IMAGE_TAG}..."
                sh "docker build -t ${IMAGE_NAME}:${params.IMAGE_TAG} -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('DevSecOps - Trivy Vulnerability Scan') {
            steps {
                echo "===> Running Aqua Trivy container security scanner..."
                script {
                    sh '''
                        # Download official HTML report template if not present
                        if [ ! -f html.tpl ]; then
                            curl -fsSL -o html.tpl https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl || true
                        fi

                        # Generate HTML vulnerability report
                        docker run --rm \
                            -v /var/run/docker.sock:/var/run/docker.sock \
                            -v $WORKSPACE:/workspace \
                            aquasec/trivy image \
                            --format template \
                            --template "@html.tpl" \
                            -o /workspace/trivy-report.html \
                            ${IMAGE_NAME}:${params.IMAGE_TAG} || true

                        # Optional quality gate scan: return exit code on HIGH/CRITICAL
                        if [ "${params.FAIL_ON_CRITICAL_CVE}" = "true" ]; then
                            docker run --rm \
                                -v /var/run/docker.sock:/var/run/docker.sock \
                                aquasec/trivy image \
                                --severity CRITICAL \
                                --exit-code 1 \
                                ${IMAGE_NAME}:${params.IMAGE_TAG}
                        fi
                    '''

                    // Publish report if publishHTML plugin is available
                    catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                        publishHTML(target: [
                            allowMissing: true,
                            alwaysLinkToLastBuild: true,
                            keepAll: true,
                            reportDir: '.',
                            reportFiles: 'trivy-report.html',
                            reportName: 'Trivy Security Scan Report'
                        ])
                    }
                }
            }
        }

        stage('Push Image to Registry') {
            when {
                expression { return env.DOCKER_HUB_USER != 'sakecstudent' }
            }
            steps {
                echo "===> Pushing image to Docker Hub registry..."
                withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker tag ${IMAGE_NAME}:${params.IMAGE_TAG} ${DOCKER_HUB_USER}/${IMAGE_NAME}:${params.IMAGE_TAG}
                        docker push ${DOCKER_HUB_USER}/${IMAGE_NAME}:${params.IMAGE_TAG}
                    '''
                }
            }
        }

        stage('Deploy Application Container') {
            steps {
                echo "===> Deploying containerized Easeway application..."
                sh '''
                    # Stop and remove existing running container if present
                    docker stop easeway-app || true
                    docker rm easeway-app || true

                    # Ensure persistent host data directory exists
                    mkdir -p /home/ubuntu/easeway-data || mkdir -p ./data

                    # Launch updated container
                    docker run -d \
                        --name easeway-app \
                        --restart unless-stopped \
                        -p ${PORT}:${PORT} \
                        -v easeway-data:/app/data \
                        ${IMAGE_NAME}:${params.IMAGE_TAG}

                    echo "===> Verification: Checking running containers..."
                    docker ps --filter "name=easeway-app"
                '''
            }
        }
    }

    post {
        always {
            cleanWs(cleanWhenNotBuilt: false,
                    deleteDirs: true,
                    disableDeferredWipeout: true,
                    notFailBuild: true,
                    patterns: [[pattern: 'node_modules', type: 'EXCLUDE']])
        }
        success {
            echo "✅ DevSecOps Pipeline executed successfully! Easeway is live."
        }
        failure {
            echo "❌ Pipeline failed! Please inspect stage logs."
        }
    }
}
