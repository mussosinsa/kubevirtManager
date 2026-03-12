import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { AuthService } from '../services/auth.service';

/**
 * 모든 보호된 라우트에 적용되는 인증 가드.
 * - Keycloak 사용 가능: 미인증 시 Keycloak 로그인 페이지로 리디렉션
 * - Keycloak 미사용: 미인증 시 /login(로컬 로그인)으로 리디렉션
 */
export const authGuard = async (): Promise<boolean | UrlTree> => {
    const authService = inject(AuthService);
    const keycloak    = inject(KeycloakService);
    const router      = inject(Router);

    if (authService.keycloakAvailable) {
        /* Keycloak 인증 흐름 */
        const isLoggedIn = await keycloak.isLoggedIn();
        if (isLoggedIn) {
            return true;
        }
        await keycloak.login({
            redirectUri: window.location.origin + window.location.pathname + window.location.search,
        });
        return false;
    }

    /* 로컬 로그인 흐름 */
    if (authService.isLocallyLoggedIn()) {
        return true;
    }
    return router.createUrlTree(['/login']);
};
