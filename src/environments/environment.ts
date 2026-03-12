// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.

export const environment = {
  production: false,
  keycloak: {
    /* Keycloak 서버 URL (개발 환경) */
    url: 'http://localhost:8080',
    /* Realm 이름 */
    realm: 'kubevirt-manager',
    /* Client ID */
    clientId: 'kubevirt-manager-web',
  }
};
