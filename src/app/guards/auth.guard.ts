import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';

/**
 * 모든 보호된 라우트에 적용되는 인증 가드.
 * 로그인되지 않은 경우 Keycloak 로그인 페이지로 리디렉션합니다.
 */
export const authGuard = async (): Promise<boolean> => {
    const keycloak = inject(KeycloakService);

    const isLoggedIn = await keycloak.isLoggedIn();
    if (isLoggedIn) {
        return true;
    }

    /* 인증되지 않은 경우 현재 URL을 redirectUri로 설정하여 로그인 */
    await keycloak.login({
        redirectUri: window.location.origin + window.location.pathname + window.location.search,
    });
    return false;
};
