import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';

import { K8sService } from './k8s.service';
import { KubeVirtService } from './kube-virt.service';
import { CicdService } from './cicd.service';
import { HciService } from './hci.service';
import {
    ReportData,
    ReportTemplateId,
    NodeRow,
    VmRow,
    DeploymentRow,
    HciCephInfo,
    HciGlusterInfo,
} from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {

    constructor(
        private k8sService: K8sService,
        private kubeVirtService: KubeVirtService,
        private cicdService: CicdService,
        private hciService: HciService,
    ) {}

    /* ── 보고서 전체 데이터 수집 ─────────────────── */

    async gather(templateId: ReportTemplateId): Promise<ReportData> {
        const [nodes, vms, deployments, ceph, gluster] = await Promise.allSettled([
            this.fetchNodes(),
            this.fetchVMs(),
            this.fetchDeployments(),
            this.fetchCeph(),
            this.fetchGluster(),
        ]);

        const nodeRows: NodeRow[]         = nodes.status       === 'fulfilled' ? nodes.value       : [];
        const vmRows: VmRow[]             = vms.status         === 'fulfilled' ? vms.value         : [];
        const deployRows: DeploymentRow[] = deployments.status === 'fulfilled' ? deployments.value : [];
        const cephRows: HciCephInfo[]     = ceph.status        === 'fulfilled' ? ceph.value        : [];
        const glusterRows: HciGlusterInfo[] = gluster.status   === 'fulfilled' ? gluster.value     : [];

        const readyNodes   = nodeRows.filter(n => n.status === '정상').length;
        const runningVMs   = vmRows.filter(v => v.status === 'Running').length;

        return {
            generatedAt: new Date().toLocaleString('ko-KR'),
            templateId,
            cluster: {
                totalNodes:       nodeRows.length,
                readyNodes,
                totalVMs:         vmRows.length,
                runningVMs,
                totalPools:       0,   // 추후 확장
                totalDeployments: deployRows.length,
            },
            nodes:        nodeRows,
            vms:          vmRows,
            deployments:  deployRows,
            cephClusters: cephRows,
            glusterVolumes: glusterRows,
        };
    }

    /* ── 노드 데이터 ─────────────────────────────── */

    private async fetchNodes(): Promise<NodeRow[]> {
        const res = await lastValueFrom(this.k8sService.getNodes());
        const items: any[] = res?.items ?? [];
        return items.map(node => {
            const conditions: any[] = node.status?.conditions ?? [];
            const readyCond = conditions.find((c: any) => c.type === 'Ready');
            const ready = readyCond?.status === 'True';

            const labels = node.metadata?.labels ?? {};
            const roles: string[] = [];
            if (labels['node-role.kubernetes.io/control-plane'] !== undefined) roles.push('control-plane');
            if (labels['node-role.kubernetes.io/master'] !== undefined)        roles.push('master');
            if (roles.length === 0) roles.push('worker');

            const created = new Date(node.metadata?.creationTimestamp ?? '');
            const ageDays = Math.floor((Date.now() - created.getTime()) / 86400000);

            return {
                name:           node.metadata?.name ?? '',
                status:         ready ? '정상' : '비정상',
                roles:          roles.join(', '),
                cpuAllocatable: node.status?.allocatable?.cpu ?? '-',
                memAllocatable: this.formatMemory(node.status?.allocatable?.memory),
                k8sVersion:     node.status?.nodeInfo?.kubeletVersion ?? '-',
                age:            `${ageDays}일`,
            } as NodeRow;
        });
    }

    /* ── VM 데이터 ───────────────────────────────── */

    private async fetchVMs(): Promise<VmRow[]> {
        const [vms, vmis] = await Promise.allSettled([
            lastValueFrom(this.kubeVirtService.getVMs()),
            lastValueFrom(this.kubeVirtService.getVMis()),
        ]);

        const vmiMap: Record<string, any> = {};
        if (vmis.status === 'fulfilled') {
            (vmis.value?.items ?? []).forEach((vmi: any) => {
                const key = `${vmi.metadata.namespace}/${vmi.metadata.name}`;
                vmiMap[key] = vmi;
            });
        }

        const items: any[] = vms.status === 'fulfilled' ? (vms.value?.items ?? []) : [];
        return items.map(vm => {
            const ns   = vm.metadata?.namespace ?? '';
            const name = vm.metadata?.name ?? '';
            const key  = `${ns}/${name}`;
            const vmi  = vmiMap[key];

            const phase  = vm.status?.printableStatus ?? vm.status?.phase ?? '-';
            const cpuCfg = vm.spec?.template?.spec?.domain?.cpu;
            const memCfg = vm.spec?.template?.spec?.domain?.resources?.requests?.memory ?? '-';
            const nodeName = vmi?.status?.nodeName ?? '-';

            const cpuStr = cpuCfg
                ? `${cpuCfg.cores ?? 1} 코어`
                : '-';

            return {
                name,
                namespace: ns,
                status:    phase,
                cpu:       cpuStr,
                memory:    memCfg,
                node:      nodeName,
            } as VmRow;
        });
    }

    /* ── CI/CD Deployment 데이터 ─────────────────── */

    private async fetchDeployments(): Promise<DeploymentRow[]> {
        const res = await lastValueFrom(this.cicdService.getDeployments());
        const items: any[] = res?.items ?? [];
        return items.map(d => {
            const created = new Date(d.metadata?.creationTimestamp ?? '');
            const ageDays = Math.floor((Date.now() - created.getTime()) / 86400000);
            const containers: any[] = d.spec?.template?.spec?.containers ?? [];
            const image = containers[0]?.image ?? '-';
            const desired   = d.spec?.replicas ?? 1;
            const ready     = d.status?.readyReplicas ?? 0;
            const available = d.status?.availableReplicas ?? 0;

            return {
                name:      d.metadata?.name ?? '',
                namespace: d.metadata?.namespace ?? '',
                ready:     `${ready}/${desired}`,
                desired,
                available,
                image,
                age:       `${ageDays}일`,
            } as DeploymentRow;
        });
    }

    /* ── Ceph 클러스터 데이터 ────────────────────── */

    private async fetchCeph(): Promise<HciCephInfo[]> {
        const res = await lastValueFrom(this.hciService.getCephClusters());
        const items: any[] = res?.items ?? [];
        return items.map(c => ({
            name:      c.metadata?.name ?? '',
            namespace: c.metadata?.namespace ?? '',
            phase:     c.status?.phase ?? '-',
            health:    c.status?.ceph?.health ?? '-',
            monitors:  c.spec?.mon?.count ?? 0,
        }));
    }

    /* ── GlusterFS 볼륨 데이터 ───────────────────── */

    private async fetchGluster(): Promise<HciGlusterInfo[]> {
        const res = await lastValueFrom(this.hciService.getKadaluStorages());
        const items: any[] = res?.items ?? [];
        return items.map(g => ({
            name:      g.metadata?.name ?? '',
            namespace: g.metadata?.namespace ?? '',
            phase:     g.status?.state ?? '-',
            volumes:   (g.spec?.storage ?? []).length,
        }));
    }

    /* ── CSV 생성 ────────────────────────────────── */

    buildCsv(data: ReportData): string {
        const lines: string[] = [];

        lines.push('=== 클러스터 요약 ===');
        lines.push('항목,값');
        lines.push(`전체 노드,${data.cluster.totalNodes}`);
        lines.push(`정상 노드,${data.cluster.readyNodes}`);
        lines.push(`전체 VM,${data.cluster.totalVMs}`);
        lines.push(`실행중 VM,${data.cluster.runningVMs}`);
        lines.push(`배포 앱 수,${data.cluster.totalDeployments}`);
        lines.push('');

        if (data.nodes.length > 0) {
            lines.push('=== 노드 목록 ===');
            lines.push('이름,상태,역할,CPU,메모리,버전,운영기간');
            data.nodes.forEach(n =>
                lines.push(`${n.name},${n.status},${n.roles},${n.cpuAllocatable},${n.memAllocatable},${n.k8sVersion},${n.age}`)
            );
            lines.push('');
        }

        if (data.vms.length > 0) {
            lines.push('=== VM 목록 ===');
            lines.push('이름,네임스페이스,상태,CPU,메모리,노드');
            data.vms.forEach(v =>
                lines.push(`${v.name},${v.namespace},${v.status},${v.cpu},${v.memory},${v.node}`)
            );
            lines.push('');
        }

        if (data.deployments.length > 0) {
            lines.push('=== CI/CD 배포 목록 ===');
            lines.push('이름,네임스페이스,준비상태,가용,이미지,운영기간');
            data.deployments.forEach(d =>
                lines.push(`${d.name},${d.namespace},${d.ready},${d.available},${d.image},${d.age}`)
            );
            lines.push('');
        }

        if (data.cephClusters.length > 0) {
            lines.push('=== Ceph 클러스터 ===');
            lines.push('이름,네임스페이스,상태,헬스,모니터수');
            data.cephClusters.forEach(c =>
                lines.push(`${c.name},${c.namespace},${c.phase},${c.health},${c.monitors}`)
            );
            lines.push('');
        }

        return '\uFEFF' + lines.join('\r\n');   // BOM for Excel
    }

    /* ── 유틸 ───────────────────────────────────── */

    private formatMemory(raw?: string): string {
        if (!raw) return '-';
        const ki = parseInt(raw.replace('Ki', ''), 10);
        if (isNaN(ki)) return raw;
        if (ki >= 1048576) return `${(ki / 1048576).toFixed(1)} GiB`;
        if (ki >= 1024)    return `${(ki / 1024).toFixed(0)} MiB`;
        return `${ki} KiB`;
    }
}
