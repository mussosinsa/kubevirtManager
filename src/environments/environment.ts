// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.

import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'kubevirt-manager',
    clientId: 'kubevirt-manager-web',
  }
};
