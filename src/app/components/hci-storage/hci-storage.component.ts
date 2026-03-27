import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { lastValueFrom, Subject } from 'rxjs';
import { Config } from 'datatables.net';
import { HciService } from 'src/app/services/hci.service';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { K8sService } from 'src/app/services/k8s.service';
import { CephCluster } from 'src/app/models/ceph-cluster.model';
import { CephPool } from 'src/app/models/ceph-pool.model';
import { CephFilesystem } from 'src/app/models/ceph-filesystem.model';
import { CephObjectStore } from 'src/app/models/ceph-objectstore.model';
import { GlusterStorage } from 'src/app/models/gluster-storage.model';
import { Toasts } from 'src/app/classes/toasts';

@Component({
    selector: 'app-hci-storage',
    templateUrl: './hci-storage.component.html',
    styleUrls: ['./hci-storage.component.css'],
})
export class HciStorageComponent implements OnInit {

    pageName = 'HCI 스토리지';
    myToasts!: Toasts;

    /* ─── 탭 상태 ──────────────────────────────── */
    /** 'ceph' | 'gluster' */
    activeTab: string = 'ceph';

    /* ─── 설치 감지 ────────────────────────────── */
    cephDetected    = false;
    glusterDetected = false;

    /* ─── Ceph 데이터 ───────────────────────────── */
    cephClusters:    CephCluster[]    = [];
    cephPools:       CephPool[]       = [];
    cephFilesystems: CephFilesystem[] = [];
    cephObjectStores: CephObjectStore[] = [];

    /* ─── GlusterFS 데이터 ─────────────────────── */
    glusterStorages: GlusterStorage[] = [];

    /* ─── 공통 목록 ────────────────────────────── */
    namespaceList: string[] = [];

    /* ─── 활성 대상 (모달 공유) ────────────────── */
    activeNamespace = '';
    activeName      = '';

    /* ─── 새 Ceph 클러스터 폼 ─────────────────── */
    newCephName       = '';
    newCephNamespace  = 'rook-ceph';
    newCephVersion    = 'quay.io/ceph/ceph:v18.2.4';
    newCephMonCount   = 3;
    newCephUseAll     = true;

    /* ─── 새 Block Pool 폼 ────────────────────── */
    newPoolName      = '';
    newPoolNamespace = 'rook-ceph';
    newPoolReplicas  = 3;
    newPoolFailDomain = 'host';

    /* ─── 새 Filesystem 폼 ─────────────────────── */
    newFsName         = '';
    newFsNamespace    = 'rook-ceph';
    newFsDataReplicas = 3;
    newFsMetaReplicas = 3;
    newFsMdsCount     = 1;

    /* ─── 새 Object Store 폼 ─────────────────── */
    newOsName      = '';
    newOsNamespace = 'rook-ceph';
    newOsReplicas  = 3;
    newOsPort      = 80;

    /* ─── 새 GlusterFS 스토리지 폼 ─────────────── */
    newGlusterName      = '';
    newGlusterNamespace = 'kadalu';
    newGlusterType      = 'Replica3';
    newGlusterNodes: { node: string; path: string }[] = [{ node: '', path: '' }];

    /* ─── DataTable ────────────────────────────── */
    dtOpts: Config = {
        paging: false, info: false, ordering: true, orderMulti: true,
        search: true, destroy: true, stateSave: false, serverSide: false,
        order: [[1, 'asc']],
    };
    dtTriggerPool:  Subject<any> = new Subject<any>();
    dtTriggerFs:    Subject<any> = new Subject<any>();
    dtTriggerOs:    Subject<any> = new Subject<any>();
    dtTriggerGluster: Subject<any> = new Subject<any>();

    myInterval = setInterval(() => { this.reloadAll(); }, 60000);

    constructor(
        private cdRef: ChangeDetectorRef,
        private hciService: HciService,
        private k8sApisService: K8sApisService,
        private k8sService: K8sService,
    ) {}

    async ngOnInit(): Promise<void> {
        const navTitle = document.getElementById('nav-title');
        if (navTitle) { navTitle.replaceChildren(this.pageName); }
        this.myToasts = new Toasts();
        await Promise.all([this.loadNamespaces(), this.detectAndLoad()]);
    }

    ngOnDestroy(): void {
        clearInterval(this.myInterval);
        this.dtTriggerPool.unsubscribe();
        this.dtTriggerFs.unsubscribe();
        this.dtTriggerOs.unsubscribe();
        this.dtTriggerGluster.unsubscribe();
    }

    /* ─── 초기화 ───────────────────────────────── */

    async loadNamespaces(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getNamespaces());
            this.namespaceList = (data.items as any[]).map(ns => ns.metadata.name);
        } catch (_) { this.namespaceList = ['rook-ceph', 'kadalu', 'default']; }
    }

    /** CRD 존재 여부를 확인하고 각 데이터를 로드합니다. */
    async detectAndLoad(): Promise<void> {
        try {
            const crdData = await lastValueFrom(this.k8sApisService.getCrds());
            const names: string[] = (crdData.items as any[]).map(c => c.metadata.name);
            this.cephDetected    = names.includes('cephclusters.ceph.rook.io');
            this.glusterDetected = names.includes('kadalustorages.kadalu.storage');
        } catch (_) {}

        await Promise.all([
            this.cephDetected    ? this.loadCephAll()    : Promise.resolve(),
            this.glusterDetected ? this.loadGlusterAll() : Promise.resolve(),
        ]);
    }

    async reloadAll(): Promise<void> {
        await Promise.all([
            this.cephDetected    ? this.loadCephAll()    : Promise.resolve(),
            this.glusterDetected ? this.loadGlusterAll() : Promise.resolve(),
        ]);
    }

    /* ════════════════════════════════════════════
       Ceph – 데이터 로드
    ════════════════════════════════════════════ */

    async loadCephAll(): Promise<void> {
        await Promise.all([
            this.loadCephClusters(),
            this.loadCephPools(),
            this.loadCephFilesystems(),
            this.loadCephObjectStores(),
        ]);
        this.cdRef.detectChanges();
    }

    async loadCephClusters(): Promise<void> {
        try {
            const data = await lastValueFrom(this.hciService.getCephClusters());
            this.cephClusters = (data.items as any[]).map(c => this.mapCephCluster(c));
        } catch (_) { this.cephClusters = []; }
    }

    private mapCephCluster(c: any): CephCluster {
        const cl = new CephCluster();
        cl.namespace         = c.metadata.namespace;
        cl.name              = c.metadata.name;
        cl.cephVersion       = c.spec?.cephVersion?.image ?? '';
        cl.monCount          = c.spec?.mon?.count ?? 0;
        cl.phase             = c.status?.phase ?? 'Unknown';
        cl.health            = c.status?.ceph?.health ?? '';
        cl.message           = c.status?.message ?? '';
        cl.capacity          = c.status?.ceph?.capacity?.bytesTotal
            ? this.formatBytes(c.status.ceph.capacity.bytesTotal) : '';
        cl.osdCount          = c.status?.storage?.osd?.storeType?.bluestore ?? 0;
        cl.creationTimestamp = c.metadata.creationTimestamp ?? '';
        return cl;
    }

    async loadCephPools(): Promise<void> {
        try {
            const data = await lastValueFrom(this.hciService.getCephBlockPools());
            this.cephPools = (data.items as any[]).map(p => this.mapCephPool(p));
            this.dtTriggerPool.next(null);
        } catch (_) { this.cephPools = []; }
    }

    private mapCephPool(p: any): CephPool {
        const pool = new CephPool();
        pool.namespace         = p.metadata.namespace;
        pool.name              = p.metadata.name;
        pool.failureDomain     = p.spec?.failureDomain ?? 'host';
        pool.replicas          = p.spec?.replicated?.size ?? 0;
        pool.phase             = p.status?.phase ?? '';
        pool.creationTimestamp = p.metadata.creationTimestamp ?? '';
        return pool;
    }

    async loadCephFilesystems(): Promise<void> {
        try {
            const data = await lastValueFrom(this.hciService.getCephFilesystems());
            this.cephFilesystems = (data.items as any[]).map(f => this.mapCephFilesystem(f));
            this.dtTriggerFs.next(null);
        } catch (_) { this.cephFilesystems = []; }
    }

    private mapCephFilesystem(f: any): CephFilesystem {
        const fs = new CephFilesystem();
        fs.namespace         = f.metadata.namespace;
        fs.name              = f.metadata.name;
        fs.dataPoolReplicas  = f.spec?.dataPools?.[0]?.replicated?.size ?? 0;
        fs.metaReplicas      = f.spec?.metadataPool?.replicated?.size ?? 0;
        fs.activeCount       = f.spec?.metadataServer?.activeCount ?? 1;
        fs.phase             = f.status?.phase ?? '';
        fs.creationTimestamp = f.metadata.creationTimestamp ?? '';
        return fs;
    }

    async loadCephObjectStores(): Promise<void> {
        try {
            const data = await lastValueFrom(this.hciService.getCephObjectStores());
            this.cephObjectStores = (data.items as any[]).map(o => this.mapCephObjectStore(o));
            this.dtTriggerOs.next(null);
        } catch (_) { this.cephObjectStores = []; }
    }

    private mapCephObjectStore(o: any): CephObjectStore {
        const store = new CephObjectStore();
        store.namespace         = o.metadata.namespace;
        store.name              = o.metadata.name;
        store.replicas          = o.spec?.metadataPool?.replicated?.size ?? 0;
        store.port              = o.spec?.gateway?.port ?? 80;
        store.phase             = o.status?.phase ?? '';
        store.endpoint          = o.status?.info?.endpoint ?? '';
        store.creationTimestamp = o.metadata.creationTimestamp ?? '';
        return store;
    }

    /* ════════════════════════════════════════════
       GlusterFS – 데이터 로드
    ════════════════════════════════════════════ */

    async loadGlusterAll(): Promise<void> {
        await this.loadGlusterStorages();
        this.cdRef.detectChanges();
    }

    async loadGlusterStorages(): Promise<void> {
        try {
            const data = await lastValueFrom(this.hciService.getKadaluStorages());
            this.glusterStorages = (data.items as any[]).map(s => this.mapGlusterStorage(s));
            this.dtTriggerGluster.next(null);
        } catch (_) { this.glusterStorages = []; }
    }

    private mapGlusterStorage(s: any): GlusterStorage {
        const gs = new GlusterStorage();
        gs.namespace         = s.metadata.namespace;
        gs.name              = s.metadata.name;
        gs.type              = s.spec?.type ?? 'Replica3';
        gs.volumeCount       = (s.spec?.storage ?? []).length;
        gs.phase             = s.status?.pvcReady ? 'Ready' : (s.status ? 'Progressing' : 'Unknown');
        gs.creationTimestamp = s.metadata.creationTimestamp ?? '';
        gs.storageNodes      = (s.spec?.storage ?? []).map((n: any) => ({
            node: n.node ?? '', path: n.path ?? ''
        }));
        return gs;
    }

    /* ════════════════════════════════════════════
       Ceph Cluster – 생성 / 삭제
    ════════════════════════════════════════════ */

    showNewCephCluster(): void {
        this.newCephName      = '';
        this.newCephNamespace = 'rook-ceph';
        this.newCephVersion   = 'quay.io/ceph/ceph:v18.2.4';
        this.newCephMonCount  = 3;
        this.newCephUseAll    = true;
        this.showModal('modal-new-cluster');
    }

    async onCreateCephCluster(): Promise<void> {
        if (!this.newCephName || !this.newCephNamespace) {
            this.myToasts.toastError(this.pageName, '', '이름과 네임스페이스는 필수입니다.'); return;
        }
        const spec: any = {
            apiVersion: 'ceph.rook.io/v1',
            kind: 'CephCluster',
            metadata: { name: this.newCephName, namespace: this.newCephNamespace },
            spec: {
                cephVersion:     { image: this.newCephVersion, allowUnsupported: false },
                dataDirHostPath: '/var/lib/rook',
                mon:             { count: this.newCephMonCount, allowMultiplePerNode: false },
                mgr:             { count: 1, modules: [{ name: 'pg_autoscaler', enabled: true }] },
                dashboard:       { enabled: true, ssl: false },
                monitoring:      { enabled: false },
                network:         { connections: { encryption: { enabled: false } } },
                crashCollector:  { disable: false },
                storage:         { useAllNodes: this.newCephUseAll, useAllDevices: this.newCephUseAll },
            },
        };
        try {
            await lastValueFrom(this.hciService.createCephCluster(spec));
            this.myToasts.toastSuccess(this.pageName, '', `[${this.newCephName}] Ceph 클러스터를 생성했습니다.`);
            this.hideModal('modal-new-cluster');
            await this.loadCephClusters();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `생성 실패: ${e?.message ?? e}`);
        }
    }

    showDeleteCluster(ns: string, name: string): void {
        this.activeNamespace = ns;
        this.activeName      = name;
        this.showModal('modal-delete-cluster');
    }

    async onDeleteCephCluster(): Promise<void> {
        try {
            await lastValueFrom(this.hciService.deleteCephCluster(this.activeNamespace, this.activeName));
            this.myToasts.toastSuccess(this.pageName, '', `[${this.activeName}] 클러스터를 삭제했습니다.`);
            this.hideModal('modal-delete-cluster');
            await this.loadCephClusters();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `삭제 실패: ${e?.message ?? e}`);
        }
    }

    /* ════════════════════════════════════════════
       Ceph Block Pool – 생성 / 삭제
    ════════════════════════════════════════════ */

    showNewPool(): void {
        this.newPoolName      = '';
        this.newPoolNamespace = this.cephClusters[0]?.namespace ?? 'rook-ceph';
        this.newPoolReplicas  = 3;
        this.newPoolFailDomain = 'host';
        this.showModal('modal-new-pool');
    }

    async onCreatePool(): Promise<void> {
        if (!this.newPoolName) {
            this.myToasts.toastError(this.pageName, '', '풀 이름은 필수입니다.'); return;
        }
        const pool = {
            apiVersion: 'ceph.rook.io/v1',
            kind: 'CephBlockPool',
            metadata: { name: this.newPoolName, namespace: this.newPoolNamespace },
            spec: {
                failureDomain: this.newPoolFailDomain,
                replicated:    { size: this.newPoolReplicas, requireSafeReplicaSize: true },
            },
        };
        try {
            await lastValueFrom(this.hciService.createCephBlockPool(pool));
            this.myToasts.toastSuccess(this.pageName, '', `[${this.newPoolName}] Block Pool을 생성했습니다.`);
            this.hideModal('modal-new-pool');
            await this.loadCephPools();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `생성 실패: ${e?.message ?? e}`);
        }
    }

    showDeletePool(ns: string, name: string): void {
        this.activeNamespace = ns; this.activeName = name;
        this.showModal('modal-delete-pool');
    }

    async onDeletePool(): Promise<void> {
        try {
            await lastValueFrom(this.hciService.deleteCephBlockPool(this.activeNamespace, this.activeName));
            this.myToasts.toastSuccess(this.pageName, '', `[${this.activeName}] Block Pool을 삭제했습니다.`);
            this.hideModal('modal-delete-pool');
            await this.loadCephPools();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `삭제 실패: ${e?.message ?? e}`);
        }
    }

    /* ════════════════════════════════════════════
       Ceph Filesystem – 생성 / 삭제
    ════════════════════════════════════════════ */

    showNewFs(): void {
        this.newFsName         = '';
        this.newFsNamespace    = this.cephClusters[0]?.namespace ?? 'rook-ceph';
        this.newFsDataReplicas = 3;
        this.newFsMetaReplicas = 3;
        this.newFsMdsCount     = 1;
        this.showModal('modal-new-fs');
    }

    async onCreateFs(): Promise<void> {
        if (!this.newFsName) {
            this.myToasts.toastError(this.pageName, '', 'Filesystem 이름은 필수입니다.'); return;
        }
        const fs = {
            apiVersion: 'ceph.rook.io/v1',
            kind: 'CephFilesystem',
            metadata: { name: this.newFsName, namespace: this.newFsNamespace },
            spec: {
                metadataPool: { replicated: { size: this.newFsMetaReplicas } },
                dataPools: [{
                    name:          'data0',
                    failureDomain: 'host',
                    replicated:    { size: this.newFsDataReplicas },
                }],
                preserveFilesystemOnDelete: true,
                metadataServer: {
                    activeCount:   this.newFsMdsCount,
                    activeStandby: true,
                },
            },
        };
        try {
            await lastValueFrom(this.hciService.createCephFilesystem(fs));
            this.myToasts.toastSuccess(this.pageName, '', `[${this.newFsName}] Filesystem을 생성했습니다.`);
            this.hideModal('modal-new-fs');
            await this.loadCephFilesystems();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `생성 실패: ${e?.message ?? e}`);
        }
    }

    showDeleteFs(ns: string, name: string): void {
        this.activeNamespace = ns; this.activeName = name;
        this.showModal('modal-delete-fs');
    }

    async onDeleteFs(): Promise<void> {
        try {
            await lastValueFrom(this.hciService.deleteCephFilesystem(this.activeNamespace, this.activeName));
            this.myToasts.toastSuccess(this.pageName, '', `[${this.activeName}] Filesystem을 삭제했습니다.`);
            this.hideModal('modal-delete-fs');
            await this.loadCephFilesystems();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `삭제 실패: ${e?.message ?? e}`);
        }
    }

    /* ════════════════════════════════════════════
       Ceph Object Store – 생성 / 삭제
    ════════════════════════════════════════════ */

    showNewOs(): void {
        this.newOsName      = '';
        this.newOsNamespace = this.cephClusters[0]?.namespace ?? 'rook-ceph';
        this.newOsReplicas  = 3;
        this.newOsPort      = 80;
        this.showModal('modal-new-os');
    }

    async onCreateOs(): Promise<void> {
        if (!this.newOsName) {
            this.myToasts.toastError(this.pageName, '', 'Object Store 이름은 필수입니다.'); return;
        }
        const store = {
            apiVersion: 'ceph.rook.io/v1',
            kind: 'CephObjectStore',
            metadata: { name: this.newOsName, namespace: this.newOsNamespace },
            spec: {
                metadataPool: { failureDomain: 'host', replicated: { size: this.newOsReplicas } },
                dataPool:     { failureDomain: 'host', replicated: { size: this.newOsReplicas } },
                preservePoolsOnDelete: true,
                gateway: {
                    type:         's3',
                    port:         this.newOsPort,
                    instances:    1,
                    priorityClassName: 'system-cluster-critical',
                },
            },
        };
        try {
            await lastValueFrom(this.hciService.createCephObjectStore(store));
            this.myToasts.toastSuccess(this.pageName, '', `[${this.newOsName}] Object Store를 생성했습니다.`);
            this.hideModal('modal-new-os');
            await this.loadCephObjectStores();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `생성 실패: ${e?.message ?? e}`);
        }
    }

    showDeleteOs(ns: string, name: string): void {
        this.activeNamespace = ns; this.activeName = name;
        this.showModal('modal-delete-os');
    }

    async onDeleteOs(): Promise<void> {
        try {
            await lastValueFrom(this.hciService.deleteCephObjectStore(this.activeNamespace, this.activeName));
            this.myToasts.toastSuccess(this.pageName, '', `[${this.activeName}] Object Store를 삭제했습니다.`);
            this.hideModal('modal-delete-os');
            await this.loadCephObjectStores();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `삭제 실패: ${e?.message ?? e}`);
        }
    }

    /* ════════════════════════════════════════════
       GlusterFS – 생성 / 삭제
    ════════════════════════════════════════════ */

    showNewGluster(): void {
        this.newGlusterName      = '';
        this.newGlusterNamespace = 'kadalu';
        this.newGlusterType      = 'Replica3';
        this.newGlusterNodes     = [{ node: '', path: '' }];
        this.showModal('modal-new-gluster');
    }

    addGlusterNode(): void {
        this.newGlusterNodes.push({ node: '', path: '' });
    }

    removeGlusterNode(idx: number): void {
        if (this.newGlusterNodes.length > 1) {
            this.newGlusterNodes.splice(idx, 1);
        }
    }

    async onCreateGluster(): Promise<void> {
        if (!this.newGlusterName) {
            this.myToasts.toastError(this.pageName, '', '스토리지 이름은 필수입니다.'); return;
        }
        const storage = {
            apiVersion: 'kadalu.storage/v1alpha1',
            kind: 'KadaluStorage',
            metadata: { name: this.newGlusterName, namespace: this.newGlusterNamespace },
            spec: {
                type:    this.newGlusterType,
                storage: this.newGlusterNodes
                    .filter(n => n.node && n.path)
                    .map(n => ({ node: n.node, path: n.path })),
            },
        };
        try {
            await lastValueFrom(this.hciService.createKadaluStorage(storage));
            this.myToasts.toastSuccess(this.pageName, '', `[${this.newGlusterName}] GlusterFS 스토리지를 생성했습니다.`);
            this.hideModal('modal-new-gluster');
            await this.loadGlusterStorages();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `생성 실패: ${e?.message ?? e}`);
        }
    }

    showDeleteGluster(ns: string, name: string): void {
        this.activeNamespace = ns; this.activeName = name;
        this.showModal('modal-delete-gluster');
    }

    async onDeleteGluster(): Promise<void> {
        try {
            await lastValueFrom(this.hciService.deleteKadaluStorage(this.activeNamespace, this.activeName));
            this.myToasts.toastSuccess(this.pageName, '', `[${this.activeName}] GlusterFS 스토리지를 삭제했습니다.`);
            this.hideModal('modal-delete-gluster');
            await this.loadGlusterStorages();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, '', `삭제 실패: ${e?.message ?? e}`);
        }
    }

    /* ─── 유틸 ─────────────────────────────────── */

    healthBadge(health: string): string {
        if (health === 'HEALTH_OK')   { return 'badge-success'; }
        if (health === 'HEALTH_WARN') { return 'badge-warning'; }
        if (health === 'HEALTH_ERR')  { return 'badge-danger'; }
        return 'badge-secondary';
    }

    phaseBadge(phase: string): string {
        const map: Record<string, string> = {
            Ready: 'badge-success', Progressing: 'badge-warning',
            Failure: 'badge-danger', Error: 'badge-danger', Unknown: 'badge-secondary',
        };
        return map[phase] ?? 'badge-secondary';
    }

    phaseIcon(phase: string): string {
        const map: Record<string, string> = {
            Ready: 'fa-check-circle text-success',
            Progressing: 'fa-spinner fa-spin text-warning',
            Failure: 'fa-exclamation-circle text-danger',
            Error: 'fa-exclamation-circle text-danger',
        };
        return map[phase] ?? 'fa-question-circle text-secondary';
    }

    private formatBytes(bytes: number): string {
        if (bytes >= 1e12) { return (bytes / 1e12).toFixed(1) + ' TB'; }
        if (bytes >= 1e9)  { return (bytes / 1e9).toFixed(1) + ' GB'; }
        return (bytes / 1e6).toFixed(1) + ' MB';
    }

    showModal(id: string): void {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'block'; el.classList.add('show'); }
    }

    hideModal(id: string): void {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.classList.remove('show'); }
    }
}
