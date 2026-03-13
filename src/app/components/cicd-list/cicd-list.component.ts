import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { lastValueFrom, Subject } from 'rxjs';
import { Config } from 'datatables.net';
import { CicdService } from 'src/app/services/cicd.service';
import { K8sService } from 'src/app/services/k8s.service';
import { PaasApp } from 'src/app/models/paas-app.model';
import { Deployment } from 'src/app/interfaces/deployment';
import { Constants } from 'src/app/classes/constants';
import { Toasts } from 'src/app/classes/toasts';

@Component({
    selector: 'app-cicd-list',
    templateUrl: './cicd-list.component.html',
    styleUrls: ['./cicd-list.component.css'],
})
export class CicdListComponent implements OnInit {

    pageName = 'CI/CD 배포';

    myConstants!: Constants;
    myToasts!: Toasts;

    appList: PaasApp[] = [];
    namespaceList: string[] = [];

    /* ─── 모달 공유 상태 ───────────────────────── */
    activeNamespace = '';
    activeName      = '';
    activeImage     = '';
    activeContainer = '';
    activeReplicas  = 1;
    activePort      = 80;

    /* ─── 새 앱 폼 ─────────────────────────────── */
    newName       = '';
    newNamespace  = '';
    newImage      = '';
    newReplicas   = 1;
    newPort       = 80;
    newExposeType = 'ClusterIP';   /* ClusterIP | NodePort | LoadBalancer */
    newExpose     = false;

    /* ─── 스케일 폼 ────────────────────────────── */
    scaleReplicas = 1;

    /* ─── 이미지 업데이트 폼 ────────────────────── */
    updateImage = '';

    /* ─── DataTable ────────────────────────────── */
    dtOptions: Config = {
        paging: false,
        info: false,
        ordering: true,
        orderMulti: true,
        search: true,
        destroy: false,
        stateSave: false,
        serverSide: false,
        columnDefs: [{ orderable: false, targets: [0, 7] }],
        order: [[1, 'asc']],
    };
    dtTrigger: Subject<any> = new Subject<any>();

    myInterval = setInterval(() => { this.loadApps(); }, 60000);

    constructor(
        private cdRef: ChangeDetectorRef,
        private cicdService: CicdService,
        private k8sService: K8sService
    ) {}

    async ngOnInit(): Promise<void> {
        const navTitle = document.getElementById('nav-title');
        if (navTitle) { navTitle.replaceChildren(this.pageName); }
        this.myConstants = new Constants();
        this.myToasts    = new Toasts();
        await Promise.all([this.loadNamespaces(), this.loadApps()]);
    }

    ngOnDestroy(): void {
        clearInterval(this.myInterval);
        this.dtTrigger.unsubscribe();
    }

    /* ─── 데이터 로드 ──────────────────────────── */

    async loadNamespaces(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getNamespaces());
            this.namespaceList = (data.items as any[]).map(ns => ns.metadata.name);
        } catch (_) { this.namespaceList = []; }
    }

    async loadApps(): Promise<void> {
        try {
            const data = await lastValueFrom(this.cicdService.getDeployments());
            this.appList = (data.items as any[]).map(d => this.mapDeployment(d));
            this.cdRef.detectChanges();
            this.dtTrigger.next(null);
        } catch (_) {
            this.appList = [];
        }
    }

    private mapDeployment(d: any): PaasApp {
        const app = new PaasApp();
        app.namespace          = d.metadata.namespace;
        app.name               = d.metadata.name;
        app.containerName      = d.spec?.template?.spec?.containers?.[0]?.name ?? app.name;
        app.image              = d.spec?.template?.spec?.containers?.[0]?.image ?? '';
        app.replicas           = d.spec?.replicas ?? 0;
        app.readyReplicas      = d.status?.readyReplicas ?? 0;
        app.availableReplicas  = d.status?.availableReplicas ?? 0;
        app.port               = d.spec?.template?.spec?.containers?.[0]?.ports?.[0]?.containerPort ?? 0;
        app.creationTimestamp  = d.metadata.creationTimestamp ?? '';
        app.status             = this.resolveStatus(d.status?.conditions ?? []);
        return app;
    }

    private resolveStatus(conditions: any[]): string {
        const available   = conditions.find(c => c.type === 'Available');
        const progressing = conditions.find(c => c.type === 'Progressing');
        if (available?.status === 'True')                        { return 'available'; }
        if (progressing?.status === 'True')                     { return 'progressing'; }
        return 'degraded';
    }

    statusBadge(status: string): string {
        const map: Record<string, string> = {
            available:   'badge-success',
            progressing: 'badge-warning',
            degraded:    'badge-danger',
        };
        return map[status] ?? 'badge-secondary';
    }

    statusLabel(status: string): string {
        const map: Record<string, string> = {
            available:   '배포 완료',
            progressing: '배포 진행 중',
            degraded:    '배포 실패',
        };
        return map[status] ?? status;
    }

    /* ─── 새 앱 배포 ───────────────────────────── */

    showNewApp(): void {
        this.newName      = '';
        this.newNamespace = this.namespaceList[0] ?? 'default';
        this.newImage     = '';
        this.newReplicas  = 1;
        this.newPort      = 80;
        this.newExpose    = false;
        this.newExposeType = 'ClusterIP';
        this.showModal('modal-new');
    }

    async onCreateApp(): Promise<void> {
        if (!this.newName || !this.newNamespace || !this.newImage) {
            this.myToasts.toastError(this.pageName, '', '앱 이름, 네임스페이스, 이미지는 필수입니다.');
            return;
        }
        const appLabel: Record<string, string> = {
            'app':                          this.newName,
            'kubevirt-manager.io/managed':  'true',
            'kubevirt-manager.io/type':     'paas-app',
        };
        const deployment: Deployment = {
            apiVersion: 'apps/v1',
            kind:       'Deployment',
            metadata: {
                name:      this.newName,
                namespace: this.newNamespace,
                labels:    { ...appLabel },
            },
            spec: {
                replicas: this.newReplicas,
                selector: { matchLabels: { app: this.newName } },
                template: {
                    metadata: { labels: { app: this.newName } },
                    spec: {
                        containers: [{
                            name:            this.newName,
                            image:           this.newImage,
                            args:            [],
                            command:         [],
                            imagePullPolicy: 'Always',
                            ports: this.newPort > 0
                                ? [{ name: 'http', containerPort: this.newPort }]
                                : [],
                        }],
                    },
                },
            },
        };
        try {
            await lastValueFrom(this.cicdService.createDeployment(deployment));
            if (this.newExpose && this.newPort > 0) {
                await this.createServiceForApp(
                    this.newName, this.newNamespace, this.newPort, this.newExposeType
                );
            }
            this.myToasts.toastSuccess(this.pageName, '', `[${this.newName}] 배포를 시작했습니다.`);
            this.hideModal('modal-new');
            await this.loadApps();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `배포 실패: ${e?.message ?? e}`);
        }
    }

    private async createServiceForApp(
        appName: string, namespace: string, port: number, type: string
    ): Promise<void> {
        const svc = {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: {
                name: `${appName}-svc`,
                namespace,
                labels: {
                    'kubevirt-manager.io/managed':  'true',
                    'kubevirt-manager.io/paas-app': appName,
                },
            },
            spec: {
                type,
                selector: { app: appName },
                ports: [{ name: 'http', port, targetPort: port, protocol: 'TCP' }],
            },
        };
        await lastValueFrom(this.cicdService.createService(svc));
    }

    /* ─── 이미지 업데이트 ──────────────────────── */

    showUpdateImage(app: PaasApp): void {
        this.activeNamespace = app.namespace;
        this.activeName      = app.name;
        this.activeContainer = app.containerName;
        this.updateImage     = app.image;
        this.showModal('modal-update-image');
    }

    async onUpdateImage(): Promise<void> {
        if (!this.updateImage) { return; }
        try {
            await lastValueFrom(
                this.cicdService.updateImage(
                    this.activeNamespace, this.activeName, this.activeContainer, this.updateImage
                )
            );
            this.myToasts.toastSuccess(
                this.pageName, '', `[${this.activeName}] 이미지를 ${this.updateImage} 으로 업데이트했습니다.`
            );
            this.hideModal('modal-update-image');
            await this.loadApps();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `이미지 업데이트 실패: ${e?.message ?? e}`);
        }
    }

    /* ─── 스케일 ───────────────────────────────── */

    showScale(app: PaasApp): void {
        this.activeNamespace = app.namespace;
        this.activeName      = app.name;
        this.scaleReplicas   = app.replicas;
        this.showModal('modal-scale');
    }

    async onScale(): Promise<void> {
        try {
            await lastValueFrom(
                this.cicdService.scaleDeployment(this.activeNamespace, this.activeName, this.scaleReplicas)
            );
            this.myToasts.toastSuccess(
                this.pageName, '', `[${this.activeName}] 레플리카를 ${this.scaleReplicas}개로 조정했습니다.`
            );
            this.hideModal('modal-scale');
            await this.loadApps();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `스케일 조정 실패: ${e?.message ?? e}`);
        }
    }

    /* ─── 재시작 ───────────────────────────────── */

    async onRestart(app: PaasApp): Promise<void> {
        try {
            await lastValueFrom(this.cicdService.restartDeployment(app.namespace, app.name));
            this.myToasts.toastSuccess(this.pageName, '', `[${app.name}] 롤아웃 재시작을 요청했습니다.`);
            await this.loadApps();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `재시작 실패: ${e?.message ?? e}`);
        }
    }

    /* ─── 삭제 ─────────────────────────────────── */

    showDelete(app: PaasApp): void {
        this.activeNamespace = app.namespace;
        this.activeName      = app.name;
        this.showModal('modal-delete');
    }

    async onDelete(): Promise<void> {
        try {
            await lastValueFrom(this.cicdService.deleteDeployment(this.activeNamespace, this.activeName));
            /* 연결된 Service도 삭제 시도 (없어도 무시) */
            try {
                await lastValueFrom(
                    this.cicdService.deleteService(this.activeNamespace, `${this.activeName}-svc`)
                );
            } catch (_) {}
            this.myToasts.toastSuccess(this.pageName, '', `[${this.activeName}] 삭제했습니다.`);
            this.hideModal('modal-delete');
            await this.loadApps();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `삭제 실패: ${e?.message ?? e}`);
        }
    }

    /* ─── 전체 새로고침 ────────────────────────── */

    async fullReload(): Promise<void> {
        await this.loadApps();
    }

    /* ─── 유틸 ─────────────────────────────────── */

    showModal(id: string): void {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'block';
            el.classList.add('show');
        }
    }

    hideModal(id: string): void {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.classList.remove('show');
        }
    }
}
