import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'kubevirt-manager';

  /** 로그인 페이지에서는 헤더/사이드바/푸터를 숨깁니다. */
  showShell = true;

  constructor(router: Router) {
    router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.showShell = !e.urlAfterRedirects.startsWith('/login');
      });
  }
}
