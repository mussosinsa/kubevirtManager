import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
    selector: 'app-local-login',
    templateUrl: './local-login.component.html',
    styleUrl: './local-login.component.css'
})
export class LocalLoginComponent {

    username = '';
    password = '';
    showPassword = false;
    errorMsg = '';
    loading = false;

    constructor(
        private authService: AuthService,
        private router: Router
    ) {}

    async onLogin(): Promise<void> {
        if (!this.username || !this.password) {
            this.errorMsg = '아이디와 비밀번호를 입력하세요.';
            return;
        }

        this.loading = true;
        this.errorMsg = '';

        /* 짧은 지연으로 로딩 표시 */
        await new Promise(r => setTimeout(r, 400));

        const ok = this.authService.localLogin(this.username, this.password);
        this.loading = false;

        if (ok) {
            await this.router.navigate(['/dashboard']);
        } else {
            this.errorMsg = '아이디 또는 비밀번호가 올바르지 않습니다.';
            this.password = '';
        }
    }
}
