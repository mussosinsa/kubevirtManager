import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {

    username    = '';
    displayName = '';
    email       = '';
    initials    = '';

    /* 비밀번호 변경 폼 (로컬 로그인 전용) */
    isLocalAuth  = false;
    currentPw    = '';
    newPw        = '';
    confirmPw    = '';
    showCurrent  = false;
    showNew      = false;
    showConfirm  = false;
    successMsg   = '';
    errorMsg     = '';

    constructor(private authService: AuthService) {}

    ngOnInit(): void {
        this.username    = this.authService.getUsername();
        this.displayName = this.authService.getDisplayName();
        this.email       = this.authService.getEmail();
        this.initials    = this.authService.getInitials();
        this.isLocalAuth = !this.authService.keycloakAvailable;
    }

    changePassword(): void {
        this.successMsg = '';
        this.errorMsg   = '';

        if (!this.currentPw || !this.newPw || !this.confirmPw) {
            this.errorMsg = '모든 필드를 입력해주세요.';
            return;
        }
        if (this.newPw !== this.confirmPw) {
            this.errorMsg = '새 비밀번호가 일치하지 않습니다.';
            return;
        }
        if (this.newPw.length < 4) {
            this.errorMsg = '새 비밀번호는 4자 이상이어야 합니다.';
            return;
        }

        /* 현재 자격증명 확인 */
        const creds = this.authService.getLocalCredentials();
        if (this.currentPw !== creds.password) {
            this.errorMsg = '현재 비밀번호가 올바르지 않습니다.';
            return;
        }

        this.authService.saveLocalCredentials(this.username, this.newPw);
        this.successMsg = '비밀번호가 성공적으로 변경되었습니다.';
        this.currentPw  = '';
        this.newPw      = '';
        this.confirmPw  = '';
    }
}
