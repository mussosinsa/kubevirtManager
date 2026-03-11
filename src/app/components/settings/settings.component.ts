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

    /* 클러스터 연결 상태 */
    clusterConnected: boolean = false;
    clusterVersion: string = '-';
    clusterPlatform: string = '-';

    /* 노드 정보 */
    nodeList: any[] = [];
    nodeCount: number = 0;
    readyNodeCount: number = 0;

    /* 네임스페이스 */
    namespaceList: string[] = [];

    /* 스토리지 클래스 */
    storageClassList: any[] = [];

    /* CRD 설치 현황 */
    crdList: any[] = [];
    kubevirtInstalled: boolean = false;
    cdiInstalled: boolean = false;
    capkInstalled: boolean = false;
    multusInstalled: boolean = false;
    imagesInstalled: boolean = false;

    /* 로딩 상태 */
    loadingCluster: boolean = true;
    loadingNodes: boolean = true;
    loadingNamespaces: boolean = true;
    loadingStorage: boolean = true;
    loadingCrds: boolean = true;

    constructor(
        private k8sService: K8sService,
        private k8sApisService: K8sApisService
    ) { }

    async ngOnInit(): Promise<void> {
        this.myConstants = new Constants();
        await Promise.all([
            this.loadClusterInfo(),
            this.loadNodes(),
            this.loadNamespaces(),
            this.loadStorageClasses(),
            this.loadCrds()
        ]);
    }

    async loadClusterInfo(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getNodes());
            if (data && data.items && data.items.length > 0) {
                const node = data.items[0];
                this.clusterVersion = node.status?.nodeInfo?.kubeletVersion || '-';
                this.clusterPlatform = node.status?.nodeInfo?.operatingSystem + ' / ' + node.status?.nodeInfo?.architecture || '-';
                this.clusterConnected = true;
            }
        } catch (e: any) {
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
            this.readyNodeCount = this.nodeList.filter((n: any) => {
                const conditions = n.status?.conditions || [];
                return conditions.some((c: any) => c.type === 'Ready' && c.status === 'True');
            }).length;
        } catch (e: any) {
            this.nodeList = [];
        } finally {
            this.loadingNodes = false;
        }
    }

    async loadNamespaces(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getNamespaces());
            this.namespaceList = (data.items || []).map((ns: any) => ns.metadata.name);
        } catch (e: any) {
            this.namespaceList = [];
        } finally {
            this.loadingNamespaces = false;
        }
    }

    async loadStorageClasses(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sApisService.getStorageClasses());
            this.storageClassList = data.items || [];
        } catch (e: any) {
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
        } catch (e: any) {
            this.crdList = [];
        } finally {
            this.loadingCrds = false;
        }
    }

    checkCrdStatus(): void {
        const crdNames = this.crdList.map((c: any) => c.metadata?.name || '');

        this.kubevirtInstalled = crdNames.some((n: string) => n.includes('kubevirt.io'));
        this.cdiInstalled = crdNames.includes(this.myConstants.ContainerizedDataImporter);
        this.multusInstalled = crdNames.includes(this.myConstants.NetworkAttachmentDefinition);
        this.imagesInstalled = crdNames.includes(this.myConstants.KubevirtManagerImages);
        this.capkInstalled = crdNames.includes(this.myConstants.Clusters) &&
                             crdNames.includes(this.myConstants.KubevirtClusters);
    }

    getNodeRole(node: any): string {
        const labels = node.metadata?.labels || {};
        if (labels['node-role.kubernetes.io/control-plane'] !== undefined ||
            labels['node-role.kubernetes.io/master'] !== undefined) {
            return '컨트롤 플레인';
        }
        return '워커';
    }

    getNodeStatus(node: any): string {
        const conditions = node.status?.conditions || [];
        const ready = conditions.find((c: any) => c.type === 'Ready');
        return ready?.status === 'True' ? 'Ready' : 'NotReady';
    }

    isNodeReady(node: any): boolean {
        return this.getNodeStatus(node) === 'Ready';
    }

    getStorageClassProvisioner(sc: any): string {
        return sc.provisioner || '-';
    }

    isDefaultStorageClass(sc: any): boolean {
        const annotations = sc.metadata?.annotations || {};
        return annotations['storageclass.kubernetes.io/is-default-class'] === 'true';
    }
}
