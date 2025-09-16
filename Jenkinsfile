pipeline {
    agent any

    environment {
        GITHUB_TOKEN = credentials('my-github-token')
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'maksud',
                    url: 'https://github.com/1996sachin/sociar_chatbot.git',
                    credentialsId: 'github-pat'
            }
        }

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
