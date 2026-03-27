import { Component, OnInit, OnDestroy } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { SchedulerAiService } from '../../services/scheduler-ai.service';
import { NodeScore } from '../../models/node-score.model';
import {
    SchedulingPolicy,
    LabelEntry,
    AffinityExpr,
    PreferredAffinity,
    Toleration,
    PodAffinityRule,
    TopologyConstraint,
} from '../../models/scheduling-policy.model';

declare var $: any;

@Component({
    selector: 'app-scheduler-ai',
    templateUrl: './scheduler-ai.component.html',
    styleUrls: ['./scheduler-ai.component.css'],
})
export class SchedulerAiComponent implements OnInit, OnDestroy {

    /* ── 로딩 상태 ── */
    loading      = false;
    analyzing    = false;
    errorMsg     = '';

    /* ── 노드 원본 데이터 ── */
    rawNodes: any[]  = [];
    rawPods:  any[]  = [];
    metricsMap: Map<string, { cpuUsage: number; memUsage: number }> = new Map();
    metricsAvailable = true;

    /* ── 결과 ── */
    nodeScores: NodeScore[] = [];
    selectedNode: NodeScore | null = null;
    generatedYaml = '';

    /* ── 정책 객체 ── */
    policy = new SchedulingPolicy();

    /* ── 탭 상태 ── */
    activeTab: 'node-targeting' | 'pod-placement' | 'resource' = 'node-targeting';

    /* ── nodeSelector 입력 임시 ── */
    newNsKey   = '';
    newNsValue = '';

    /* ── Required Affinity 입력 임시 ── */
    newReqKey      = '';
    newReqOp       = 'In';
    newReqValues   = '';
    affinityOps    = ['In', 'NotIn', 'Exists', 'DoesNotExist', 'Gt', 'Lt'];

    /* ── Preferred Affinity 입력 임시 ── */
    newPrefWeight = 100;
    newPrefKey    = '';
    newPrefOp     = 'In';
    newPrefValues = '';

    /* ── Toleration 입력 임시 ── */
    newTolKey    = '';
    newTolOp     = 'Equal';
    newTolValue  = '';
    newTolEffect = 'NoSchedule';
    tolerationOps     = ['Equal', 'Exists'];
    tolerationEffects = ['NoSchedule', 'PreferNoSchedule', 'NoExecute', ''];

    /* ── Pod Affinity 입력 임시 ── */
    newPATopology   = 'kubernetes.io/hostname';
    newPALabelKey   = '';
    newPALabelValue = '';
    newPAScheduling = 'required';

    /* ── Pod Anti-Affinity 입력 임시 ── */
    newPAATopology   = 'kubernetes.io/hostname';
    newPAALabelKey   = '';
    newPAALabelValue = '';
    newPAAScheduling = 'required';

    /* ── Topology Spread 입력 임시 ── */
    newTsTopology    = 'topology.kubernetes.io/zone';
    newTsMaxSkew     = 1;
    newTsWhenUnsatisfiable = 'DoNotSchedule';
    newTsLabelKey    = '';
    newTsLabelValue  = '';
    spreadPolicies   = ['DoNotSchedule', 'ScheduleAnyway'];

    /* ── YAML 모달 ── */
    yamlTarget: NodeScore | null = null;

    constructor(private schedulerSvc: SchedulerAiService) {}

    ngOnInit(): void {
        this.loadNodes();
    }

    ngOnDestroy(): void {}

    /* ════════════════════════════════════════════
       데이터 로딩
    ════════════════════════════════════════════ */

    async loadNodes(): Promise<void> {
        this.loading = true;
        this.errorMsg = '';
        try {
            const [nodesResp, podsResp, metricsResp] = await Promise.allSettled([
                lastValueFrom(this.schedulerSvc.getNodes()),
                lastValueFrom(this.schedulerSvc.getAllPods()),
                lastValueFrom(this.schedulerSvc.getNodeMetrics()),
            ]);

            if (nodesResp.status === 'fulfilled') {
                this.rawNodes = nodesResp.value?.items ?? [];
            } else {
                throw new Error('노드 정보를 불러올 수 없습니다.');
            }

            if (podsResp.status === 'fulfilled') {
                this.rawPods = podsResp.value?.items ?? [];
            }

            this.metricsMap = new Map();
            if (metricsResp.status === 'fulfilled') {
                const items: any[] = metricsResp.value?.items ?? [];
                items.forEach(m => {
                    this.metricsMap.set(m.metadata.name, {
                        cpuUsage: this.parseCpu(m.usage?.cpu ?? '0'),
                        memUsage: this.parseMem(m.usage?.memory ?? '0'),
                    });
                });
                this.metricsAvailable = true;
            } else {
                this.metricsAvailable = false;
            }

            // 초기 분석 실행
            this.runAnalysis();
        } catch (e: any) {
            this.errorMsg = e.message ?? '알 수 없는 오류가 발생했습니다.';
        } finally {
            this.loading = false;
        }
    }

    /* ════════════════════════════════════════════
       AI 분석 실행
    ════════════════════════════════════════════ */

    runAnalysis(): void {
        this.analyzing = true;
        try {
            this.nodeScores = this.schedulerSvc.scoreNodes(
                this.rawNodes,
                this.rawPods,
                this.metricsMap,
                this.policy,
            );
        } finally {
            this.analyzing = false;
        }
    }

    /* ════════════════════════════════════════════
       YAML 생성 및 모달
    ════════════════════════════════════════════ */

    openYamlModal(node: NodeScore): void {
        this.yamlTarget  = node;
        this.generatedYaml = this.schedulerSvc.generateSchedulingYaml(this.policy, node.name);
        $('#yamlModal').modal('show');
    }

    copyYaml(): void {
        navigator.clipboard.writeText(this.generatedYaml).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = this.generatedYaml;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
    }

    /* ════════════════════════════════════════════
       NodeSelector 관리
    ════════════════════════════════════════════ */

    addNodeSelector(): void {
        const k = this.newNsKey.trim();
        const v = this.newNsValue.trim();
        if (!k) return;
        this.policy.nodeSelector.push({ key: k, value: v });
        this.newNsKey = '';
        this.newNsValue = '';
    }

    removeNodeSelector(idx: number): void {
        this.policy.nodeSelector.splice(idx, 1);
    }

    /* ════════════════════════════════════════════
       Required Node Affinity 관리
    ════════════════════════════════════════════ */

    addRequiredAffinity(): void {
        const k = this.newReqKey.trim();
        if (!k) return;
        this.policy.requiredAffinity.push({
            key: k, operator: this.newReqOp, values: this.newReqValues.trim(),
        });
        this.newReqKey = '';
        this.newReqValues = '';
    }

    removeRequiredAffinity(idx: number): void {
        this.policy.requiredAffinity.splice(idx, 1);
    }

    /* ════════════════════════════════════════════
       Preferred Node Affinity 관리
    ════════════════════════════════════════════ */

    addPreferredAffinity(): void {
        const k = this.newPrefKey.trim();
        if (!k) return;
        const expr: AffinityExpr = {
            key: k, operator: this.newPrefOp, values: this.newPrefValues.trim(),
        };
        this.policy.preferredAffinity.push({ weight: this.newPrefWeight, expressions: [expr] });
        this.newPrefKey = '';
        this.newPrefValues = '';
    }

    removePreferredAffinity(idx: number): void {
        this.policy.preferredAffinity.splice(idx, 1);
    }

    /* ════════════════════════════════════════════
       Toleration 관리
    ════════════════════════════════════════════ */

    addToleration(): void {
        const k = this.newTolKey.trim();
        if (!k && this.newTolOp !== 'Exists') return;
        this.policy.tolerations.push({
            key: k,
            operator: this.newTolOp,
            value: this.newTolValue.trim(),
            effect: this.newTolEffect,
        });
        this.newTolKey = '';
        this.newTolValue = '';
    }

    removeToleration(idx: number): void {
        this.policy.tolerations.splice(idx, 1);
    }

    /* ════════════════════════════════════════════
       Pod Affinity 관리
    ════════════════════════════════════════════ */

    addPodAffinity(): void {
        const k = this.newPALabelKey.trim();
        if (!k) return;
        this.policy.podAffinityRules.push({
            topologyKey: this.newPATopology.trim(),
            labelKey: k,
            labelValue: this.newPALabelValue.trim(),
            scheduling: this.newPAScheduling,
        });
        this.newPALabelKey = '';
        this.newPALabelValue = '';
    }

    removePodAffinity(idx: number): void {
        this.policy.podAffinityRules.splice(idx, 1);
    }

    /* ════════════════════════════════════════════
       Pod Anti-Affinity 관리
    ════════════════════════════════════════════ */

    addPodAntiAffinity(): void {
        const k = this.newPAALabelKey.trim();
        if (!k) return;
        this.policy.podAntiAffinityRules.push({
            topologyKey: this.newPAATopology.trim(),
            labelKey: k,
            labelValue: this.newPAALabelValue.trim(),
            scheduling: this.newPAAScheduling,
        });
        this.newPAALabelKey = '';
        this.newPAALabelValue = '';
    }

    removePodAntiAffinity(idx: number): void {
        this.policy.podAntiAffinityRules.splice(idx, 1);
    }

    /* ════════════════════════════════════════════
       Topology Spread 관리
    ════════════════════════════════════════════ */

    addTopologyConstraint(): void {
        const k = this.newTsLabelKey.trim();
        if (!k) return;
        this.policy.topologyConstraints.push({
            topologyKey: this.newTsTopology.trim(),
            maxSkew: this.newTsMaxSkew,
            whenUnsatisfiable: this.newTsWhenUnsatisfiable,
            labelKey: k,
            labelValue: this.newTsLabelValue.trim(),
        });
        this.newTsLabelKey = '';
        this.newTsLabelValue = '';
    }

    removeTopologyConstraint(idx: number): void {
        this.policy.topologyConstraints.splice(idx, 1);
    }

    /* ════════════════════════════════════════════
       가중치 합계 검증
    ════════════════════════════════════════════ */

    get schedulableCount(): number {
        return this.nodeScores.filter(n => n.filtered).length;
    }

    get filteredOutCount(): number {
        return this.nodeScores.filter(n => !n.filtered).length;
    }

    get weightSum(): number {
        return this.policy.weightLeastRequested
             + this.policy.weightBalancedAllocation
             + this.policy.weightNodeAffinity
             + this.policy.weightTopologySpread
             + this.policy.weightPodAffinity;
    }

    get weightValid(): boolean {
        return this.weightSum === 100;
    }

    /* ════════════════════════════════════════════
       UI 헬퍼
    ════════════════════════════════════════════ */

    recommendationLabel(rec: string): string {
        switch (rec) {
            case 'best': return '최적';
            case 'good': return '양호';
            case 'fair': return '보통';
            default:     return '부적합';
        }
    }

    recommendationClass(rec: string): string {
        switch (rec) {
            case 'best': return 'badge-success';
            case 'good': return 'badge-info';
            case 'fair': return 'badge-warning';
            default:     return 'badge-danger';
        }
    }

    scoreBarClass(score: number): string {
        if (score >= 80) return 'bg-success';
        if (score >= 55) return 'bg-info';
        if (score >= 30) return 'bg-warning';
        return 'bg-danger';
    }

    cpuUsagePct(n: NodeScore): number {
        if (!n.cpuAllocatable) return 0;
        return Math.round((n.cpuRequested / n.cpuAllocatable) * 100);
    }

    memUsagePct(n: NodeScore): number {
        if (!n.memAllocatable) return 0;
        return Math.round((n.memRequested / n.memAllocatable) * 100);
    }

    trackByName(_: number, n: NodeScore): string { return n.name; }

    /* ── 파서 (서비스와 동일) ── */
    private parseCpu(raw: string): number {
        if (raw.endsWith('m')) return parseInt(raw, 10) / 1000;
        if (raw.endsWith('n')) return parseInt(raw, 10) / 1e9;
        return parseFloat(raw);
    }

    private parseMem(raw: string): number {
        if (raw.endsWith('Ki')) return parseInt(raw, 10) / 1024;
        if (raw.endsWith('Mi')) return parseInt(raw, 10);
        if (raw.endsWith('Gi')) return parseInt(raw, 10) * 1024;
        if (raw.endsWith('Ti')) return parseInt(raw, 10) * 1024 * 1024;
        if (raw.endsWith('K'))  return parseInt(raw, 10) / 1000;
        if (raw.endsWith('M'))  return parseInt(raw, 10);
        if (raw.endsWith('G'))  return parseInt(raw, 10) * 1000;
        return parseInt(raw, 10) / (1024 * 1024);
    }
}
