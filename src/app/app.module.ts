import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

/* Keycloak */
import { KeycloakAngularModule, KeycloakBearerInterceptor, KeycloakService } from 'keycloak-angular';
import { environment } from '../environments/environment';

/* Components */
import { MainHeaderComponent } from './components/main-header/main-header.component';
import { SideMenuComponent } from './components/side-menu/side-menu.component';
import { MainFooterComponent } from './components/main-footer/main-footer.component';
import { NodelistComponent } from './components/nodelist/nodelist.component';
import { VmlistComponent } from './components/vmlist/vmlist.component';
import { DiskListComponent } from './components/disk-list/disk-list.component';
import { NetworkListComponent } from './components/network-list/network-list.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ClusterInstanceTypeListComponent } from './components/cluster-instance-type-list/cluster-instance-type-list.component';
import { VMPoolsComponent } from './components/vmpools/vmpools.component';
import { LoadBalancersComponent } from './components/load-balancers/load-balancers.component';
import { RefreshComponent } from './components/refresh/refresh.component';
import { AutoscaleComponent } from './components/autoscale/autoscale.component';
import { VmpooldetailsComponent } from './components/vmpooldetails/vmpooldetails.component';
import { VmdetailsComponent } from './components/vmdetails/vmdetails.component';
import { KClusterComponent } from './components/kcluster/kcluster.component';
import { KClusterDetailsComponent } from './components/kcluster-details/kcluster-details.component';
import { KClusterPoolDetailsComponent } from './components/kcluster-pool-details/kcluster-pool-details.component';
import { ImagesComponent } from './components/images/images.component';
import { SSHKeysComponent } from './components/sshkeys/sshkeys.component';
import { FirewallListComponent } from './components/firewall-list/firewall-list.component';
import { SettingsComponent } from './components/settings/settings.component';
import { DataTablesModule } from 'angular-datatables';

/**
 * Keycloak 초기화 팩토리 함수.
 * 앱 부트스트랩 전에 Keycloak 세션을 확인하고 인증을 설정합니다.
 * Keycloak 서버에 연결할 수 없는 경우 인증 없이 앱을 시작합니다.
 */
function initializeKeycloak(keycloak: KeycloakService) {
    return async () => {
        try {
            await keycloak.init({
                config: {
                    url:      environment.keycloak.url,
                    realm:    environment.keycloak.realm,
                    clientId: environment.keycloak.clientId,
                },
                initOptions: {
                    /* 앱 로드 시 로그인 필수 (미인증 시 Keycloak 로그인 페이지로 이동) */
                    onLoad: 'login-required',
                    /* 사일런트 SSO 확인을 위한 리디렉션 URI */
                    silentCheckSsoRedirectUri:
                        window.location.origin + '/assets/silent-check-sso.html',
                    /* PKCE (Proof Key for Code Exchange) 사용 */
                    pkceMethod: 'S256',
                },
                /* Kubernetes API로 보내는 모든 요청에 Bearer 토큰 자동 주입 */
                bearerPrefix: 'Bearer',
                /* /assets 경로는 토큰 주입 제외 */
                bearerExcludedUrls: ['/assets'],
            });
        } catch (error) {
            /* Keycloak 서버 미실행 또는 설정 오류 시 인증 없이 앱 구동 */
            console.warn('[Keycloak] 초기화 실패 — 인증 없이 실행합니다.', error);
        }
    };
}

@NgModule({
    declarations: [
        AppComponent,
        MainHeaderComponent,
        SideMenuComponent,
        MainFooterComponent,
        NodelistComponent,
        VmlistComponent,
        DiskListComponent,
        NetworkListComponent,
        DashboardComponent,
        ClusterInstanceTypeListComponent,
        VMPoolsComponent,
        LoadBalancersComponent,
        RefreshComponent,
        AutoscaleComponent,
        VmpooldetailsComponent,
        VmdetailsComponent,
        KClusterComponent,
        KClusterDetailsComponent,
        KClusterPoolDetailsComponent,
        ImagesComponent,
        SSHKeysComponent,
        FirewallListComponent,
        SettingsComponent,
    ],
    bootstrap: [AppComponent],
    imports: [
        BrowserModule,
        AppRoutingModule,
        FormsModule,
        ReactiveFormsModule,
        DataTablesModule,
        KeycloakAngularModule,
    ],
    providers: [
        /* Keycloak 초기화 (앱 부트스트랩 전) */
        {
            provide: APP_INITIALIZER,
            useFactory: initializeKeycloak,
            multi: true,
            deps: [KeycloakService],
        },
        /* 모든 HTTP 요청에 Keycloak Bearer 토큰 자동 주입 */
        {
            provide: HTTP_INTERCEPTORS,
            useClass: KeycloakBearerInterceptor,
            multi: true,
        },
        provideHttpClient(withInterceptorsFromDi()),
    ],
})
export class AppModule {}
