import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';

/** 로컬 로그인 자격증명 저장 키 */
const LOCAL_CRED_KEY    = 'kpaas_local_cred';
/** 로컬 로그인 세션 키 */
const LOCAL_SESSION_KEY = 'kpaas_local_session';

@Injectable({ providedIn: 'root' })
export class AuthService {

    /**
     * Keycloak 서버 초기화 성공 여부.
     * APP_INITIALIZER에서 설정되며, false이면 로컬 로그인을 사용합니다.
     */
    keycloakAvailable = false;

    private _profile: KeycloakProfile | null = null;

    constructor(private keycloak: KeycloakService) {}

    /* ──────────────────────────────────────────
       공통
    ────────────────────────────────────────── */

    /** Keycloak 또는 로컬 세션 기준 로그인 여부 */
    async isLoggedIn(): Promise<boolean> {
        if (this.keycloakAvailable) {
            return this.keycloak.isLoggedIn();
        }
        return this.isLocallyLoggedIn();
    }

    /* ──────────────────────────────────────────
       Keycloak 전용
    ────────────────────────────────────────── */

    /** 현재 액세스 토큰 반환 (만료 시 자동 갱신) */
    async getToken(): Promise<string> {
        return this.keycloak.getToken();
    }

    /** 사용자 프로필 반환 (캐시됨) */
    async getUserProfile(): Promise<KeycloakProfile> {
        if (!this._profile) {
            this._profile = await this.keycloak.loadUserProfile();
        }
        return this._profile;
    }

    /** 사용자 이름 반환 */
    getUsername(): string {
        if (!this.keycloakAvailable) {
            return this.getLocalUsername();
        }
        const token = this.keycloak.getKeycloakInstance().tokenParsed;
        return token?.['preferred_username'] ?? token?.['sub'] ?? '사용자';
    }

    /** 사용자 표시 이름 (full name) 반환 */
    getDisplayName(): string {
        if (!this.keycloakAvailable) {
            return this.getLocalUsername();
        }
        const token = this.keycloak.getKeycloakInstance().tokenParsed;
        return token?.['name'] ?? this.getUsername();
    }

    /** 사용자 이메일 반환 */
    getEmail(): string {
        if (!this.keycloakAvailable) return '';
        const token = this.keycloak.getKeycloakInstance().tokenParsed;
        return token?.['email'] ?? '';
    }

    /** 사용자 이름 이니셜 (아바타용) */
    getInitials(): string {
        const name = this.getDisplayName();
        return name.split(' ')
                   .map(n => n[0])
                   .slice(0, 2)
                   .join('')
                   .toUpperCase();
    }

    /** 역할 포함 여부 확인 */
    hasRole(role: string): boolean {
        return this.keycloakAvailable && this.keycloak.isUserInRole(role);
    }

    /** Keycloak 로그인 페이지로 리디렉션 */
    async login(): Promise<void> {
        await this.keycloak.login({
            redirectUri: window.location.origin + window.location.pathname,
        });
    }

    /** 로그아웃 */
    async logout(): Promise<void> {
        if (this.keycloakAvailable) {
            await this.keycloak.logout(window.location.origin);
        } else {
            this.localLogout();
        }
    }

    /** 액세스 토큰 갱신 */
    async updateToken(minValidity = 30): Promise<boolean> {
        return this.keycloak.updateToken(minValidity);
    }

    /* ──────────────────────────────────────────
       로컬 로그인 전용
    ────────────────────────────────────────── */

    /** 로컬 세션 로그인 여부 확인 */
    isLocallyLoggedIn(): boolean {
        return sessionStorage.getItem(LOCAL_SESSION_KEY) === 'true';
    }

    /**
     * 로컬 자격증명으로 로그인.
     * 저장된 자격증명이 없으면 기본값 admin / admin 을 사용합니다.
     */
    localLogin(username: string, password: string): boolean {
        const creds = this.getLocalCredentials();
        if (username === creds.username && password === creds.password) {
            sessionStorage.setItem(LOCAL_SESSION_KEY, 'true');
            sessionStorage.setItem('kpaas_local_user', username);
            return true;
        }
        return false;
    }

    /** 로컬 세션 로그아웃 */
    localLogout(): void {
        sessionStorage.removeItem(LOCAL_SESSION_KEY);
        sessionStorage.removeItem('kpaas_local_user');
    }

    /** 로컬 로그인된 사용자 이름 반환 */
    getLocalUsername(): string {
        return sessionStorage.getItem('kpaas_local_user') ?? 'admin';
    }

    /**
     * 로컬 자격증명 반환.
     * localStorage에 저장된 값이 없으면 기본값 반환.
     */
    getLocalCredentials(): { username: string; password: string } {
        try {
            const raw = localStorage.getItem(LOCAL_CRED_KEY);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return { username: 'admin', password: 'admin' };
    }

    /**
     * 로컬 자격증명 저장 (설정 페이지에서 변경 시 사용).
     */
    saveLocalCredentials(username: string, password: string): void {
        localStorage.setItem(LOCAL_CRED_KEY, JSON.stringify({ username, password }));
    }
}
