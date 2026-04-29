// ============================================================
// 사전 준비 (Jenkins 관리자가 최초 1회 설정)
//
// 1) Jenkins Credentials 등록
//    - ID: registry-credentials  → Username/Password (사설 레지스트리)
//    - ID: git-credentials        → Username/Password 또는 SSH Key (Git)
//
// 2) Kubernetes Secret 생성 (kaniko용 레지스트리 인증)
//    kubectl -n jenkins create secret docker-registry registry-dockerconfig \
//      --docker-server=<REGISTRY>   \
//      --docker-username=<USER>     \
//      --docker-password=<PASS>     \
//      --docker-email=jenkins@ci.local
//
// 3) Jenkins Kubernetes Plugin 설치 및 클러스터 연결 설정
//    (Manage Jenkins → Clouds → Kubernetes)
//
// 4) REGISTRY 환경변수를 실제 사설 레지스트리 주소로 변경
// ============================================================

pipeline {

    // ── Kubernetes 동적 에이전트 ──────────────────────────
    agent {
        kubernetes {
            label 'kubevirt-manager-agent'
            defaultContainer 'jnlp'
            yaml """
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: jenkins-agent
    project: kubevirt-manager
spec:
  serviceAccountName: jenkins
  containers:

  # Jenkins 기본 에이전트 (git, curl 포함)
  - name: jnlp
    image: jenkins/inbound-agent:latest-jdk17
    resources:
      requests: { cpu: '200m', memory: '256Mi' }
      limits:   { cpu: '500m', memory: '512Mi' }

  # kaniko: 루트 권한 없이 Docker 이미지 빌드
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command: [sleep]
    args:    [infinity]
    resources:
      requests: { cpu: '500m', memory: '1Gi' }
      limits:   { cpu: '2',    memory: '4Gi' }
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker

  volumes:
  # 사설 레지스트리 인증 (kubectl create secret docker-registry registry-dockerconfig 로 생성)
  - name: docker-config
    secret:
      secretName: registry-dockerconfig
      items:
      - key:  .dockerconfigjson
        path: config.json
"""
        }
    }

    // ── 환경 변수 ─────────────────────────────────────────
    environment {
        // ★ 사설 레지스트리 주소를 실제 값으로 변경하세요
        REGISTRY   = 'registry.example.com'
        IMAGE_NAME = 'kubevirt-manager'

        // Jenkins Credentials ID
        GIT_CRED_ID = 'git-credentials'

        // Git 커밋 정보 (checkout 이후 설정됨)
        GIT_COMMIT_SHORT = ''
        IMAGE_TAG        = ''

        // ArgoCD Application 이름
        ARGOCD_APP = 'kubevirt-manager'
    }

    // ── 빌드 파라미터 ─────────────────────────────────────
    parameters {
        string(
            name:         'BRANCH',
            defaultValue: 'main',
            description:  '빌드할 Git 브랜치'
        )
        string(
            name:         'KVM_VERSION',
            defaultValue: '',
            description:  '이미지 버전 태그 (비어있으면 빌드번호-커밋SHA 자동 생성)'
        )
        booleanParam(
            name:         'SKIP_PUSH',
            defaultValue: false,
            description:  'true 시 레지스트리 Push 생략 (로컬 빌드 테스트용)'
        )
    }

    options {
        // 빌드 이력 30개 보관
        buildDiscarder(logRotator(numToKeepStr: '30'))
        // 동일 브랜치 중복 빌드 방지
        disableConcurrentBuilds()
        // 전체 타임아웃 60분
        timeout(time: 60, unit: 'MINUTES')
        // 타임스탬프 출력
        timestamps()
    }

    stages {

        // ── Stage 1: 소스 체크아웃 ────────────────────────
        stage('소스 체크아웃') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${params.BRANCH}"]],
                    userRemoteConfigs: [[
                        url:           scm.userRemoteConfigs[0].url,
                        credentialsId: env.GIT_CRED_ID
                    ]]
                ])
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()

                    // 버전 태그 결정: 파라미터 > 자동생성
                    env.IMAGE_TAG = params.KVM_VERSION?.trim()
                        ? params.KVM_VERSION.trim()
                        : "${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"

                    echo "빌드 태그: ${env.IMAGE_TAG}"
                    currentBuild.displayName = "#${env.BUILD_NUMBER} | ${env.IMAGE_TAG}"
                }
            }
        }

        // ── Stage 2: Docker 이미지 빌드 (kaniko) ─────────
        stage('Docker 이미지 빌드') {
            steps {
                container('kaniko') {
                    sh """
                        /kaniko/executor \\
                          --context=dir://\${WORKSPACE} \\
                          --dockerfile=Dockerfile \\
                          --build-arg KVM_VERSION=\${IMAGE_TAG} \\
                          --destination=\${REGISTRY}/\${IMAGE_NAME}:\${IMAGE_TAG} \\
                          --destination=\${REGISTRY}/\${IMAGE_NAME}:latest \\
                          --cache=true \\
                          --cache-repo=\${REGISTRY}/\${IMAGE_NAME}/cache \\
                          --cache-ttl=168h \\
                          --compressed-caching=false \\
                          --snapshot-mode=redo \\
                          --log-format=text \\
                          --verbosity=info
                    """
                }
            }
        }

        // ── Stage 3: 배포 매니페스트 이미지 태그 업데이트 ─
        stage('매니페스트 업데이트 & Git Push') {
            when {
                // SKIP_PUSH=true 이면 건너뜀
                expression { !params.SKIP_PUSH }
            }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: env.GIT_CRED_ID,
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_PASS'
                )]) {
                    sh """
                        git config user.email "jenkins@ci.local"
                        git config user.name  "Jenkins CI"

                        # deployment.yaml 이미지 태그 교체
                        sed -i "s|image: .*kubevirt-manager.*|          image: \${REGISTRY}/\${IMAGE_NAME}:\${IMAGE_TAG}|g" \\
                            kubernetes/deployment.yaml

                        # 변경 여부 확인
                        git diff --stat

                        git add kubernetes/deployment.yaml
                        git commit -m "ci: 이미지 태그 업데이트 → \${IMAGE_TAG} [skip ci]" || \\
                            echo "변경사항 없음, 커밋 스킵"

                        # HTTPS 자격증명으로 Push
                        REPO_URL=\$(git remote get-url origin | sed 's|https://||' | sed 's|http://||')
                        git push "https://\${GIT_USER}:\${GIT_PASS}@\${REPO_URL}" HEAD:${params.BRANCH}
                    """
                }
            }
        }

    }

    // ── 빌드 후 처리 ─────────────────────────────────────
    post {
        success {
            echo """
╔══════════════════════════════════════════════╗
║  ✅ 빌드 성공
║  이미지: \${REGISTRY}/\${IMAGE_NAME}:\${IMAGE_TAG}
║  ArgoCD 앱(\${ARGOCD_APP})이 자동 배포를 시작합니다.
╚══════════════════════════════════════════════╝"""
        }
        failure {
            echo """
╔══════════════════════════════════════════════╗
║  ❌ 빌드 실패
║  브랜치: ${params.BRANCH}
║  Jenkins 로그를 확인하세요.
╚══════════════════════════════════════════════╝"""
        }
        always {
            cleanWs()
        }
    }
}
