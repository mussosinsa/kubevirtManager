import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';

@Injectable({ providedIn: 'root' })
export class AuthService {

    private _profile: KeycloakProfile | null = null;

    constructor(private keycloak: KeycloakService) {}

    /* 로그인 여부 확인 */
    async isLoggedIn(): Promise<boolean> {
        return this.keycloak.isLoggedIn();
    }

    /* 현재 액세스 토큰 반환 (만료 시 자동 갱신) */
    async getToken(): Promise<string> {
        return this.keycloak.getToken();
    }

    /* 사용자 프로필 반환 (캐시됨) */
    async getUserProfile(): Promise<KeycloakProfile> {
        if (!this._profile) {
            this._profile = await this.keycloak.loadUserProfile();
        }
        return this._profile;
    }

    /* 사용자 이름 반환 */
    getUsername(): string {
        const token = this.keycloak.getKeycloakInstance().tokenParsed;
        return token?.['preferred_username'] ?? token?.['sub'] ?? '사용자';
    }

    /* 사용자 표시 이름 (full name) 반환 */
    getDisplayName(): string {
        const token = this.keycloak.getKeycloakInstance().tokenParsed;
        return token?.['name'] ?? this.getUsername();
    }

    /* 사용자 이메일 반환 */
    getEmail(): string {
        const token = this.keycloak.getKeycloakInstance().tokenParsed;
        return token?.['email'] ?? '';
    }

    /* 사용자 이름 이니셜 (아바타용) */
    getInitials(): string {
        const name = this.getDisplayName();
        return name.split(' ')
                   .map(n => n[0])
                   .slice(0, 2)
                   .join('')
                   .toUpperCase();
    }

    /* 역할 포함 여부 확인 */
    hasRole(role: string): boolean {
        return this.keycloak.isUserInRole(role);
    }

    /* Keycloak 로그인 페이지로 리디렉션 */
    async login(): Promise<void> {
        await this.keycloak.login({
            redirectUri: window.location.origin + window.location.pathname,
        });
    }

    /* 로그아웃 후 Keycloak 로그아웃 페이지로 리디렉션 */
    async logout(): Promise<void> {
        await this.keycloak.logout(window.location.origin);
    }

    /* 액세스 토큰 갱신 */
    async updateToken(minValidity = 30): Promise<boolean> {
        return this.keycloak.updateToken(minValidity);
    }
}
