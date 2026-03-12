import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  keycloak: {
    /* 프로덕션 환경에서는 실제 Keycloak 서버 URL로 교체하세요.
     * 예: 'https://keycloak.example.com'
     * 또는 앱과 동일 도메인에서 서비스되는 경우 상대경로 사용 가능
     */
    url: 'https://keycloak.example.com',
    realm: 'kubevirt-manager',
    clientId: 'kubevirt-manager-web',
  }
};
