import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { K8sService } from 'src/app/services/k8s.service';
import { Constants } from 'src/app/classes/constants';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {

    myConstants!: Constants;

    /* 탭 상태 */
    activeTab: string = 'connection';

    /* ──────────────────────────────────────────
       연결 설정 폼
    ────────────────────────────────────────── */
    connForm = {
        apiServerUrl: '',
        authType: 'token',          // 'token' | 'cert' | 'kubeconfig'
        token: '',
        caCert: '',
        clientCert: '',
        clientKey: '',
        kubeconfig: '',
        skipTlsVerify: false
    };

    connSaveMsg: string = '';
    connSaveMsgType: string = '';   // 'success' | 'danger'
    connTesting: boolean = false;
    connTestMsg: string = '';
    connTestMsgType: string = '';
    showToken: boolean = false;

    /* ──────────────────────────────────────────
       클러스터 현황
    ────────────────────────────────────────── */
    clusterConnected: boolean = false;
    clusterVersion: string = '-';
    clusterPlatform: string = '-';

    nodeList: any[] = [];
    nodeCount: number = 0;
    readyNodeCount: number = 0;

    namespaceList: string[] = [];
    storageClassList: any[] = [];

    crdList: any[] = [];
    kubevirtInstalled: boolean = false;
    cdiInstalled: boolean = false;
    capkInstalled: boolean = false;
    multusInstalled: boolean = false;
    imagesInstalled: boolean = false;

    loadingCluster: boolean = true;
    loadingNodes: boolean = true;
    loadingNamespaces: boolean = true;
    loadingStorage: boolean = true;
    loadingCrds: boolean = true;

    /* localStorage 키 */
    private readonly STORAGE_KEY = 'kpaas_cluster_conn';

    constructor(
        private k8sService: K8sService,
        private k8sApisService: K8sApisService
    ) { }

    async ngOnInit(): Promise<void> {
        this.myConstants = new Constants();
        this.loadSavedConnection();
        await Promise.all([
            this.loadClusterInfo(),
            this.loadNodes(),
            this.loadNamespaces(),
            this.loadStorageClasses(),
            this.loadCrds()
        ]);
    }

    /* ──────────────────────────────────────────
       연결 설정 관련
    ────────────────────────────────────────── */

    loadSavedConnection(): void {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.connForm = { ...this.connForm, ...parsed };
            }
        } catch (_) { }
    }

    saveConnection(): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.connForm));
            this.connSaveMsg = '연결 설정이 저장되었습니다.';
            this.connSaveMsgType = 'success';
        } catch (_) {
            this.connSaveMsg = '설정 저장에 실패했습니다.';
            this.connSaveMsgType = 'danger';
        }
        setTimeout(() => { this.connSaveMsg = ''; }, 4000);
    }

    resetConnection(): void {
        localStorage.removeItem(this.STORAGE_KEY);
        this.connForm = {
            apiServerUrl: '',
            authType: 'token',
            token: '',
            caCert: '',
            clientCert: '',
            clientKey: '',
            kubeconfig: '',
            skipTlsVerify: false
        };
        this.connSaveMsg = '설정이 초기화되었습니다.';
        this.connSaveMsgType = 'success';
        setTimeout(() => { this.connSaveMsg = ''; }, 4000);
    }

    async testConnection(): Promise<void> {
        this.connTesting = true;
        this.connTestMsg = '';
        try {
            const data = await lastValueFrom(this.k8sService.getNodes());
            if (data && data.items) {
                this.connTestMsg = `연결 성공 — 노드 ${data.items.length}개 감지됨`;
                this.connTestMsgType = 'success';
            } else {
                this.connTestMsg = '응답을 받았으나 노드 정보가 없습니다.';
                this.connTestMsgType = 'warning';
            }
        } catch (e: any) {
            this.connTestMsg = `연결 실패: ${e?.message || '알 수 없는 오류'}`;
            this.connTestMsgType = 'danger';
        } finally {
            this.connTesting = false;
        }
    }

    parseKubeconfig(): void {
        if (!this.connForm.kubeconfig.trim()) return;
        try {
            const lines = this.connForm.kubeconfig.split('\n');
            const serverLine = lines.find(l => l.trim().startsWith('server:'));
            if (serverLine) {
                this.connForm.apiServerUrl = serverLine.split('server:')[1].trim();
            }
            const tokenLine = lines.find(l => l.trim().startsWith('token:'));
            if (tokenLine) {
                this.connForm.token = tokenLine.split('token:')[1].trim();
                this.connForm.authType = 'token';
            }
        } catch (_) { }
    }

    /* ──────────────────────────────────────────
       클러스터 현황 로딩
    ────────────────────────────────────────── */

    async loadClusterInfo(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getNodes());
            if (data?.items?.length > 0) {
                const node = data.items[0];
                this.clusterVersion = node.status?.nodeInfo?.kubeletVersion || '-';
                this.clusterPlatform =
                    (node.status?.nodeInfo?.operatingSystem || '') +
                    ' / ' +
                    (node.status?.nodeInfo?.architecture || '');
                this.clusterConnected = true;
            }
        } catch (_) {
            this.clusterConnected = false;
        } finally {
            this.loadingCluster = false;
        }
    }

    async loadNodes(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getNodes());
            this.nodeList = data.items || [];
            this.nodeCount = this.nodeList.length;
            this.readyNodeCount = this.nodeList.filter((n: any) =>
                (n.status?.conditions || []).some((c: any) => c.type === 'Ready' && c.status === 'True')
            ).length;
        } catch (_) {
            this.nodeList = [];
        } finally {
            this.loadingNodes = false;
        }
    }

    async loadNamespaces(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getNamespaces());
            this.namespaceList = (data.items || []).map((ns: any) => ns.metadata.name);
        } catch (_) {
            this.namespaceList = [];
        } finally {
            this.loadingNamespaces = false;
        }
    }

    async loadStorageClasses(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sApisService.getStorageClasses());
            this.storageClassList = data.items || [];
        } catch (_) {
            this.storageClassList = [];
        } finally {
            this.loadingStorage = false;
        }
    }

    async loadCrds(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sApisService.getCrds());
            this.crdList = data.items || [];
            this.checkCrdStatus();
        } catch (_) {
            this.crdList = [];
        } finally {
            this.loadingCrds = false;
        }
    }

    checkCrdStatus(): void {
        const names = this.crdList.map((c: any) => c.metadata?.name || '');
        this.kubevirtInstalled = names.some((n: string) => n.includes('kubevirt.io'));
        this.cdiInstalled      = names.includes(this.myConstants.ContainerizedDataImporter);
        this.multusInstalled   = names.includes(this.myConstants.NetworkAttachmentDefinition);
        this.imagesInstalled   = names.includes(this.myConstants.KubevirtManagerImages);
        this.capkInstalled     = names.includes(this.myConstants.Clusters) &&
                                 names.includes(this.myConstants.KubevirtClusters);
    }

    getNodeRole(node: any): string {
        const labels = node.metadata?.labels || {};
        return (labels['node-role.kubernetes.io/control-plane'] !== undefined ||
                labels['node-role.kubernetes.io/master'] !== undefined)
            ? '컨트롤 플레인' : '워커';
    }

    getNodeStatus(node: any): string {
        const ready = (node.status?.conditions || []).find((c: any) => c.type === 'Ready');
        return ready?.status === 'True' ? 'Ready' : 'NotReady';
    }

    isNodeReady(node: any): boolean {
        return this.getNodeStatus(node) === 'Ready';
    }

    isDefaultStorageClass(sc: any): boolean {
        return sc.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true';
    }
}
