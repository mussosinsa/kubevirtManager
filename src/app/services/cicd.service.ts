import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Deployment } from '../interfaces/deployment';

const appsBase = './k8s/apis/apps/v1';
const coreBase = './k8s/api/v1';

/** PaaS 앱 공통 레이블 셀렉터 */
const PAAS_SELECTOR = 'kubevirt-manager.io%2Fmanaged%3Dtrue%2Ckubevirt-manager.io%2Ftype%3Dpaas-app';

@Injectable({
    providedIn: 'root',
})
export class CicdService {
    constructor(private http: HttpClient) {}

    /* ─── Deployment 조회 ──────────────────────── */

    getDeployments(): Observable<any> {
        return this.http.get(`${appsBase}/deployments?labelSelector=${PAAS_SELECTOR}`);
    }

    getDeployment(namespace: string, name: string): Observable<any> {
        return this.http.get(`${appsBase}/namespaces/${namespace}/deployments/${name}`);
    }

    /* ─── Deployment 생성 / 삭제 ───────────────── */

    createDeployment(deployment: Deployment): Observable<any> {
        const headers = { 'content-type': 'application/json', 'accept': 'application/json' };
        return this.http.post(
            `${appsBase}/namespaces/${deployment.metadata.namespace}/deployments`,
            deployment,
            { headers }
        );
    }

    deleteDeployment(namespace: string, name: string): Observable<any> {
        return this.http.delete(`${appsBase}/namespaces/${namespace}/deployments/${name}`);
    }

    /* ─── 롤링 업데이트 (이미지 교체) ─────────── */

    updateImage(namespace: string, name: string, containerName: string, image: string): Observable<any> {
        const headers = {
            'content-type': 'application/strategic-merge-patch+json',
            'accept': 'application/json',
        };
        const patch = {
            spec: {
                template: {
                    spec: {
                        containers: [{ name: containerName, image }],
                    },
                },
            },
        };
        return this.http.patch(`${appsBase}/namespaces/${namespace}/deployments/${name}`, patch, { headers });
    }

    /* ─── 스케일 조정 ──────────────────────────── */

    scaleDeployment(namespace: string, name: string, replicas: number): Observable<any> {
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json',
        };
        return this.http.patch(
            `${appsBase}/namespaces/${namespace}/deployments/${name}`,
            `{"spec":{"replicas":${replicas}}}`,
            { headers }
        );
    }

    /* ─── 롤아웃 재시작 ────────────────────────── */

    restartDeployment(namespace: string, name: string): Observable<any> {
        const headers = {
            'content-type': 'application/strategic-merge-patch+json',
            'accept': 'application/json',
        };
        const patch = {
            spec: {
                template: {
                    metadata: {
                        annotations: {
                            'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
                        },
                    },
                },
            },
        };
        return this.http.patch(`${appsBase}/namespaces/${namespace}/deployments/${name}`, patch, { headers });
    }

    /* ─── Service 조회 / 생성 / 삭제 ──────────── */

    getServicesByApp(namespace: string, appName: string): Observable<any> {
        return this.http.get(
            `${coreBase}/namespaces/${namespace}/services?labelSelector=kubevirt-manager.io%2Fpaas-app%3D${appName}`
        );
    }

    createService(svc: any): Observable<any> {
        const headers = { 'content-type': 'application/json', 'accept': 'application/json' };
        return this.http.post(`${coreBase}/namespaces/${svc.metadata.namespace}/services`, svc, { headers });
    }

    deleteService(namespace: string, name: string): Observable<any> {
        return this.http.delete(`${coreBase}/namespaces/${namespace}/services/${name}`);
    }
}
