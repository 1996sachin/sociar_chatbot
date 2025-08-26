pipeline {
    agent any

    environment {
        GITHUB_TOKEN = credentials('my-github-token') // Jenkins stored secret
    }

    stages {
        stage('Clean old project files') {
            steps {
                dir('./sociair-chat-bot') {
                    deleteDir()
                }
            }
        }

        stage('Remove old Docker containers and images') {
            steps {
                sh 'docker stop $(docker ps -aq) || true'
                sh 'docker rm $(docker ps -aq) || true'
                sh 'docker rmi $(docker images -q) || true'
            }
        }

        stage('Build and Run Docker Compose') {
            steps {
                dir('./sociair-chat-bot') {
                    sh 'docker compose up --build -d'
                }
            }
        }
    }
}
