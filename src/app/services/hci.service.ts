import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const rookBase    = './k8s/apis/ceph.rook.io/v1';
const kadaluBase  = './k8s/apis/kadalu.storage/v1alpha1';
const appsBase    = './k8s/apis/apps/v1';
const coreBase    = './k8s/api/v1';

@Injectable({
    providedIn: 'root',
})
export class HciService {
    constructor(private http: HttpClient) {}

    /* ════════════════════════════════════════════
       Ceph Cluster (Rook-Ceph)
    ════════════════════════════════════════════ */

    getCephClusters(): Observable<any> {
        return this.http.get(`${rookBase}/cephclusters`);
    }

    getCephCluster(namespace: string, name: string): Observable<any> {
        return this.http.get(`${rookBase}/namespaces/${namespace}/cephclusters/${name}`);
    }

    createCephCluster(cluster: any): Observable<any> {
        const headers = { 'content-type': 'application/json', 'accept': 'application/json' };
        return this.http.post(`${rookBase}/namespaces/${cluster.metadata.namespace}/cephclusters`, cluster, { headers });
    }

    deleteCephCluster(namespace: string, name: string): Observable<any> {
        return this.http.delete(`${rookBase}/namespaces/${namespace}/cephclusters/${name}`);
    }

    /* ════════════════════════════════════════════
       Ceph Block Pool
    ════════════════════════════════════════════ */

    getCephBlockPools(): Observable<any> {
        return this.http.get(`${rookBase}/cephblockpools`);
    }

    getCephBlockPoolsByNs(namespace: string): Observable<any> {
        return this.http.get(`${rookBase}/namespaces/${namespace}/cephblockpools`);
    }

    createCephBlockPool(pool: any): Observable<any> {
        const headers = { 'content-type': 'application/json', 'accept': 'application/json' };
        return this.http.post(`${rookBase}/namespaces/${pool.metadata.namespace}/cephblockpools`, pool, { headers });
    }

    deleteCephBlockPool(namespace: string, name: string): Observable<any> {
        return this.http.delete(`${rookBase}/namespaces/${namespace}/cephblockpools/${name}`);
    }

    /* ════════════════════════════════════════════
       Ceph Filesystem (CephFS)
    ════════════════════════════════════════════ */

    getCephFilesystems(): Observable<any> {
        return this.http.get(`${rookBase}/cephfilesystems`);
    }

    getCephFilesystemsByNs(namespace: string): Observable<any> {
        return this.http.get(`${rookBase}/namespaces/${namespace}/cephfilesystems`);
    }

    createCephFilesystem(fs: any): Observable<any> {
        const headers = { 'content-type': 'application/json', 'accept': 'application/json' };
        return this.http.post(`${rookBase}/namespaces/${fs.metadata.namespace}/cephfilesystems`, fs, { headers });
    }

    deleteCephFilesystem(namespace: string, name: string): Observable<any> {
        return this.http.delete(`${rookBase}/namespaces/${namespace}/cephfilesystems/${name}`);
    }

    /* ════════════════════════════════════════════
       Ceph Object Store
    ════════════════════════════════════════════ */

    getCephObjectStores(): Observable<any> {
        return this.http.get(`${rookBase}/cephobjectstores`);
    }

    getCephObjectStoresByNs(namespace: string): Observable<any> {
        return this.http.get(`${rookBase}/namespaces/${namespace}/cephobjectstores`);
    }

    createCephObjectStore(store: any): Observable<any> {
        const headers = { 'content-type': 'application/json', 'accept': 'application/json' };
        return this.http.post(`${rookBase}/namespaces/${store.metadata.namespace}/cephobjectstores`, store, { headers });
    }

    deleteCephObjectStore(namespace: string, name: string): Observable<any> {
        return this.http.delete(`${rookBase}/namespaces/${namespace}/cephobjectstores/${name}`);
    }

    /* ════════════════════════════════════════════
       GlusterFS – Kadalu Operator
    ════════════════════════════════════════════ */

    getKadaluStorages(): Observable<any> {
        return this.http.get(`${kadaluBase}/kadalustorages`);
    }

    getKadaluStoragesByNs(namespace: string): Observable<any> {
        return this.http.get(`${kadaluBase}/namespaces/${namespace}/kadalustorages`);
    }

    getKadaluStorage(namespace: string, name: string): Observable<any> {
        return this.http.get(`${kadaluBase}/namespaces/${namespace}/kadalustorages/${name}`);
    }

    createKadaluStorage(storage: any): Observable<any> {
        const headers = { 'content-type': 'application/json', 'accept': 'application/json' };
        return this.http.post(`${kadaluBase}/namespaces/${storage.metadata.namespace}/kadalustorages`, storage, { headers });
    }

    deleteKadaluStorage(namespace: string, name: string): Observable<any> {
        return this.http.delete(`${kadaluBase}/namespaces/${namespace}/kadalustorages/${name}`);
    }

    /* ════════════════════════════════════════════
       Kadalu StatefulSet 상태 조회 (파드 상태 확인)
    ════════════════════════════════════════════ */

    getKadaluPods(namespace: string): Observable<any> {
        return this.http.get(
            `${coreBase}/namespaces/${namespace}/pods?labelSelector=app.kubernetes.io%2Fname%3Dkadalu`
        );
    }

    /* ════════════════════════════════════════════
       Rook-Ceph ConfigMap (OSD 개수 등 클러스터 상태)
    ════════════════════════════════════════════ */

    getRookCephPods(namespace: string): Observable<any> {
        return this.http.get(
            `${coreBase}/namespaces/${namespace}/pods?labelSelector=rook-ceph-mon%2Capp%3Drook-ceph-mon`
        );
    }
}
