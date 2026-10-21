
pipeline {
    agent any

    tools {
        nodejs 'NodeJS-20'
    }

    stages {
        stage('Checkout Source') {
            steps {
                checkout scm
                echo 'Easeway source code checked out successfully.'
            }
        }

        stage('Check Node.js and npm') {
            steps {
                sh 'node --version'
                sh 'npm --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Run Automated Tests') {
            steps {
                sh 'npm test'
            }
        }
    }

    post {
        success {
            echo 'Easeway CI pipeline completed successfully!'
        }

        failure {
            echo 'Pipeline failed. Check the Console Output for details.'
        }
    }
}
