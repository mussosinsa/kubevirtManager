import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NodeScore } from '../models/node-score.model';
import { SchedulingPolicy, AffinityExpr } from '../models/scheduling-policy.model';

const coreBase    = './k8s/api/v1';
const metricsBase = './k8s/apis/metrics.k8s.io/v1beta1';

@Injectable({ providedIn: 'root' })
export class SchedulerAiService {

    constructor(private http: HttpClient) {}

    /* ════════════════════════════════════════════
       Kubernetes API 조회
    ════════════════════════════════════════════ */

    /** 모든 노드 조회 (status.allocatable 포함) */
    getNodes(): Observable<any> {
        return this.http.get(`${coreBase}/nodes`);
    }

    /** Metrics API – 실시간 노드 사용량 */
    getNodeMetrics(): Observable<any> {
        return this.http.get(`${metricsBase}/nodes`);
    }

    /** 특정 노드에서 실행 중인 파드 목록 */
    getPodsOnNode(nodeName: string): Observable<any> {
        return this.http.get(
            `${coreBase}/pods?fieldSelector=spec.nodeName%3D${nodeName}%2Cstatus.phase%3DRunning`
        );
    }

    /** 전체 파드 목록 (Pod Affinity 계산용) */
    getAllPods(): Observable<any> {
        return this.http.get(`${coreBase}/pods?fieldSelector=status.phase%3DRunning`);
    }

    /* ════════════════════════════════════════════
       AI 스코어링 엔진
    ════════════════════════════════════════════ */

    /**
     * 노드 목록과 정책을 받아 각 노드의 AI 배치 점수를 계산합니다.
     * 1단계: 필터 (하드 제약 충족 여부)
     * 2단계: 스코어 (가중 합산)
     */
    scoreNodes(
        rawNodes: any[],
        rawPods: any[],
        metricsMap: Map<string, { cpuUsage: number; memUsage: number }>,
        policy: SchedulingPolicy
    ): NodeScore[] {

        const scored = rawNodes.map(n => this.buildNodeScore(n, rawPods, metricsMap, policy));

        // 최고 점수 기준으로 recommendation 등급 부여
        const passedScores = scored.filter(s => s.filtered).map(s => s.totalScore);
        const maxScore = passedScores.length ? Math.max(...passedScores) : 100;

        scored.forEach(s => {
            if (!s.filtered) { s.recommendation = 'poor'; return; }
            const ratio = s.totalScore / (maxScore || 1);
            if (ratio >= 0.85)      { s.recommendation = 'best'; }
            else if (ratio >= 0.65) { s.recommendation = 'good'; }
            else if (ratio >= 0.40) { s.recommendation = 'fair'; }
            else                    { s.recommendation = 'poor'; }
        });

        return scored.sort((a, b) => b.totalScore - a.totalScore);
    }

    private buildNodeScore(
        raw: any,
        rawPods: any[],
        metricsMap: Map<string, { cpuUsage: number; memUsage: number }>,
        policy: SchedulingPolicy
    ): NodeScore {

        const ns = new NodeScore();
        ns.name   = raw.metadata.name;
        ns.labels = raw.metadata.labels ?? {};
        ns.taints = (raw.spec?.taints ?? []).map((t: any) => ({
            key: t.key, value: t.value ?? '', effect: t.effect
        }));
        ns.ready  = this.isNodeReady(raw);

        /* ── 1. 리소스 파싱 ─────────────────────── */
        ns.cpuAllocatable = this.parseCpu(raw.status?.allocatable?.cpu ?? '0');
        ns.memAllocatable = this.parseMem(raw.status?.allocatable?.memory ?? '0Ki');

        // 실제 사용량 (Metrics API) 또는 Pod 요청 합산
        const metrics = metricsMap.get(ns.name);
        if (metrics) {
            ns.cpuRequested = metrics.cpuUsage;
            ns.memRequested = metrics.memUsage;
        } else {
            // Metrics API 미설치 시 파드 requests 합산
            const nodePods = rawPods.filter(p => p.spec?.nodeName === ns.name);
            ns.podCount    = nodePods.length;
            nodePods.forEach(p => {
                (p.spec?.containers ?? []).forEach((c: any) => {
                    ns.cpuRequested += this.parseCpu(c.resources?.requests?.cpu ?? '0');
                    ns.memRequested += this.parseMem(c.resources?.requests?.memory ?? '0Ki');
                });
            });
        }

        /* ── 2. 필터 단계 ──────────────────────── */
        if (!ns.ready) {
            ns.filtered     = false;
            ns.filterReason = '노드 NotReady';
            return ns;
        }

        if (!this.checkNodeSelector(ns.labels, policy.nodeSelector)) {
            ns.filtered     = false;
            ns.filterReason = 'nodeSelector 불일치';
            return ns;
        }

        if (!this.checkRequiredAffinity(ns.labels, policy.requiredAffinity)) {
            ns.filtered     = false;
            ns.filterReason = '필수 NodeAffinity 불충족';
            return ns;
        }

        if (!this.checkTolerations(ns.taints, policy.tolerations)) {
            ns.filtered     = false;
            ns.filterReason = '테인트 처리 불가 (Toleration 없음)';
            return ns;
        }

        if (policy.cpuRequest > 0 && ns.cpuAllocatable - ns.cpuRequested < policy.cpuRequest) {
            ns.filtered     = false;
            ns.filterReason = 'CPU 리소스 부족';
            return ns;
        }

        if (policy.memRequest > 0 && ns.memAllocatable - ns.memRequested < policy.memRequest) {
            ns.filtered     = false;
            ns.filterReason = '메모리 리소스 부족';
            return ns;
        }

        /* ── 3. 스코어 단계 ────────────────────── */

        // LeastRequested
        const cpuFree = ns.cpuAllocatable > 0
            ? (ns.cpuAllocatable - ns.cpuRequested) / ns.cpuAllocatable * 100 : 50;
        const memFree = ns.memAllocatable > 0
            ? (ns.memAllocatable - ns.memRequested) / ns.memAllocatable * 100 : 50;
        ns.cpuScore   = Math.max(0, Math.min(100, cpuFree));
        ns.memScore   = Math.max(0, Math.min(100, memFree));
        const leastReq = (ns.cpuScore + ns.memScore) / 2;

        // BalancedAllocation
        ns.balanceScore = Math.max(0, 100 - Math.abs(ns.cpuScore - ns.memScore));

        // NodeAffinity Preferred
        ns.affinityScore = this.scoreNodeAffinity(ns.labels, policy.preferredAffinity);

        // TopologySpread
        ns.topologyScore = 50;   // 기본 50 – 실제 topology 계산은 외부에서 보정

        // PodAffinity / AntiAffinity
        ns.podAffinityScore = this.scorePodAffinity(ns.name, rawPods, policy);

        // 가중 합산
        const w  = policy;
        const wt = w.weightLeastRequested + w.weightBalancedAllocation +
                   w.weightNodeAffinity   + w.weightTopologySpread + w.weightPodAffinity || 100;

        ns.totalScore = Math.round(
            (leastReq              * w.weightLeastRequested     +
             ns.balanceScore       * w.weightBalancedAllocation +
             ns.affinityScore      * w.weightNodeAffinity       +
             ns.topologyScore      * w.weightTopologySpread      +
             ns.podAffinityScore   * w.weightPodAffinity) / wt
        );

        return ns;
    }

    /* ────────────────────────────────────────────
       TopologySpread 보정 (외부 노드 목록 필요)
    ──────────────────────────────────────────── */
    applyTopologySpread(scores: NodeScore[], policy: SchedulingPolicy): void {
        if (!policy.topologyConstraints.length) {
            scores.forEach(s => { if (s.filtered) s.topologyScore = 50; });
            return;
        }
        const key  = policy.topologyKey;
        const zoneMap = new Map<string, number>();
        scores.forEach(s => {
            const zone = s.labels[key] ?? '__default__';
            s.topologyZone = zone;
            zoneMap.set(zone, (zoneMap.get(zone) ?? 0) + s.podCount);
        });
        const max = Math.max(...zoneMap.values(), 1);
        scores.forEach(s => {
            if (!s.filtered) { s.topologyScore = 0; return; }
            const cnt = zoneMap.get(s.topologyZone) ?? 0;
            s.topologyScore = Math.round((1 - cnt / max) * 100);
        });
    }

    /* ════════════════════════════════════════════
       필터 헬퍼
    ════════════════════════════════════════════ */

    private checkNodeSelector(
        labels: Record<string, string>,
        selectors: { key: string; value: string }[]
    ): boolean {
        return selectors.every(s => s.key === '' || labels[s.key] === s.value);
    }

    private checkRequiredAffinity(
        labels: Record<string, string>,
        exprs: AffinityExpr[]
    ): boolean {
        return exprs.every(e => {
            if (!e.key) return true;
            const vals = e.values.split(',').map(v => v.trim());
            return this.evalExpr(labels[e.key], e.operator, vals);
        });
    }

    private checkTolerations(
        taints: { key: string; value?: string; effect: string }[],
        tolerations: { key: string; operator: string; value: string; effect: string }[]
    ): boolean {
        return taints.every(taint => {
            if (taint.effect === 'PreferNoSchedule') return true;
            return tolerations.some(tol => {
                const keyMatch  = tol.key === '' || tol.key === taint.key;
                const effMatch  = tol.effect === '' || tol.effect === taint.effect;
                const valMatch  = tol.operator === 'Exists' || tol.value === taint.value;
                return keyMatch && effMatch && valMatch;
            });
        });
    }

    /* ════════════════════════════════════════════
       스코어 헬퍼
    ════════════════════════════════════════════ */

    private scoreNodeAffinity(
        labels: Record<string, string>,
        preferred: { weight: number; expressions: AffinityExpr[] }[]
    ): number {
        let totalWeight = 0, matchedWeight = 0;
        preferred.forEach(p => {
            if (!p.expressions.length) return;
            totalWeight += p.weight;
            const allMatch = p.expressions.every(e => {
                if (!e.key) return true;
                const vals = e.values.split(',').map(v => v.trim());
                return this.evalExpr(labels[e.key], e.operator, vals);
            });
            if (allMatch) matchedWeight += p.weight;
        });
        return totalWeight > 0 ? Math.round(matchedWeight / totalWeight * 100) : 50;
    }

    private scorePodAffinity(
        nodeName: string,
        pods: any[],
        policy: SchedulingPolicy
    ): number {
        let score = 50;
        const nodePods = pods.filter(p => p.spec?.nodeName === nodeName);

        policy.podAffinityRules.forEach(rule => {
            if (!rule.labelKey) return;
            const match = nodePods.some(p =>
                p.metadata?.labels?.[rule.labelKey] === rule.labelValue
            );
            if (match) score = Math.min(100, score + 20);
        });

        policy.podAntiAffinityRules.forEach(rule => {
            if (!rule.labelKey) return;
            const match = nodePods.some(p =>
                p.metadata?.labels?.[rule.labelKey] === rule.labelValue
            );
            if (match) {
                if (rule.scheduling === 'required') {
                    score = -1;   // 필터링됨
                } else {
                    score = Math.max(0, score - 30);
                }
            }
        });

        return Math.max(0, Math.min(100, score));
    }

    private evalExpr(
        labelVal: string | undefined,
        op: string,
        vals: string[]
    ): boolean {
        switch (op) {
            case 'In':            return vals.includes(labelVal ?? '');
            case 'NotIn':         return !vals.includes(labelVal ?? '');
            case 'Exists':        return labelVal !== undefined;
            case 'DoesNotExist':  return labelVal === undefined;
            case 'Gt':            return parseFloat(labelVal ?? '0') > parseFloat(vals[0]);
            case 'Lt':            return parseFloat(labelVal ?? '0') < parseFloat(vals[0]);
            default:              return true;
        }
    }

    /* ════════════════════════════════════════════
       단위 파싱
    ════════════════════════════════════════════ */

    parseCpu(val: string): number {
        if (!val) return 0;
        if (val.endsWith('m'))  return parseFloat(val) / 1000;
        if (val.endsWith('n'))  return parseFloat(val) / 1e9;
        return parseFloat(val);
    }

    parseMem(val: string): number {
        if (!val) return 0;
        if (val.endsWith('Ki')) return parseFloat(val) / 1024;
        if (val.endsWith('Mi')) return parseFloat(val);
        if (val.endsWith('Gi')) return parseFloat(val) * 1024;
        if (val.endsWith('Ti')) return parseFloat(val) * 1024 * 1024;
        if (val.endsWith('K'))  return parseFloat(val) / 1000;
        if (val.endsWith('M'))  return parseFloat(val);
        if (val.endsWith('G'))  return parseFloat(val) * 1000;
        return parseFloat(val) / (1024 * 1024);
    }

    private isNodeReady(raw: any): boolean {
        const conds: any[] = raw.status?.conditions ?? [];
        const ready = conds.find(c => c.type === 'Ready');
        return ready?.status === 'True';
    }

    /* ════════════════════════════════════════════
       YAML 생성 (파드 스펙 스케줄링 섹션)
    ════════════════════════════════════════════ */
    generateSchedulingYaml(policy: SchedulingPolicy, bestNode: string): string {
        const lines: string[] = [];

        // nodeSelector
        const selectors = policy.nodeSelector.filter(s => s.key);
        if (selectors.length) {
            lines.push('  nodeSelector:');
            selectors.forEach(s => lines.push(`    ${s.key}: "${s.value}"`));
        }

        // tolerations
        const tols = policy.tolerations.filter(t => t.key);
        if (tols.length) {
            lines.push('  tolerations:');
            tols.forEach(t => {
                lines.push(`  - key: "${t.key}"`);
                lines.push(`    operator: ${t.operator}`);
                if (t.operator === 'Equal') lines.push(`    value: "${t.value}"`);
                if (t.effect) lines.push(`    effect: ${t.effect}`);
            });
        }

        // affinity
        const hasReq  = policy.requiredAffinity.some(e => e.key);
        const hasPref = policy.preferredAffinity.some(p => p.expressions.some(e => e.key));
        const hasPodAff  = policy.podAffinityRules.some(r => r.labelKey);
        const hasPodAnti = policy.podAntiAffinityRules.some(r => r.labelKey);

        if (hasReq || hasPref || hasPodAff || hasPodAnti) {
            lines.push('  affinity:');

            if (hasReq || hasPref) {
                lines.push('    nodeAffinity:');
                if (hasReq) {
                    lines.push('      requiredDuringSchedulingIgnoredDuringExecution:');
                    lines.push('        nodeSelectorTerms:');
                    lines.push('        - matchExpressions:');
                    policy.requiredAffinity.filter(e => e.key).forEach(e => {
                        lines.push(`          - key: ${e.key}`);
                        lines.push(`            operator: ${e.operator}`);
                        if (['In','NotIn'].includes(e.operator)) {
                            lines.push('            values:');
                            e.values.split(',').map(v => v.trim()).forEach(v =>
                                lines.push(`            - ${v}`)
                            );
                        }
                    });
                }
                if (hasPref) {
                    lines.push('      preferredDuringSchedulingIgnoredDuringExecution:');
                    policy.preferredAffinity.forEach(p => {
                        const exprs = p.expressions.filter(e => e.key);
                        if (!exprs.length) return;
                        lines.push(`      - weight: ${p.weight}`);
                        lines.push('        preference:');
                        lines.push('          matchExpressions:');
                        exprs.forEach(e => {
                            lines.push(`          - key: ${e.key}`);
                            lines.push(`            operator: ${e.operator}`);
                            if (['In','NotIn'].includes(e.operator)) {
                                lines.push('            values:');
                                e.values.split(',').map(v => v.trim()).forEach(v =>
                                    lines.push(`            - ${v}`)
                                );
                            }
                        });
                    });
                }
            }

            const buildPodAffinitySection = (
                rules: typeof policy.podAffinityRules,
                kind: string
            ) => {
                const valid = rules.filter(r => r.labelKey);
                if (!valid.length) return;
                const req = valid.filter(r => r.scheduling === 'required');
                const pref = valid.filter(r => r.scheduling !== 'required');
                lines.push(`    ${kind}:`);
                if (req.length) {
                    lines.push('      requiredDuringSchedulingIgnoredDuringExecution:');
                    req.forEach(r => {
                        lines.push(`      - topologyKey: ${r.topologyKey}`);
                        lines.push('        labelSelector:');
                        lines.push('          matchLabels:');
                        lines.push(`            ${r.labelKey}: "${r.labelValue}"`);
                    });
                }
                if (pref.length) {
                    lines.push('      preferredDuringSchedulingIgnoredDuringExecution:');
                    pref.forEach(r => {
                        lines.push('      - weight: 100');
                        lines.push('        podAffinityTerm:');
                        lines.push(`          topologyKey: ${r.topologyKey}`);
                        lines.push('          labelSelector:');
                        lines.push('            matchLabels:');
                        lines.push(`              ${r.labelKey}: "${r.labelValue}"`);
                    });
                }
            };

            if (hasPodAff)  buildPodAffinitySection(policy.podAffinityRules, 'podAffinity');
            if (hasPodAnti) buildPodAffinitySection(policy.podAntiAffinityRules, 'podAntiAffinity');
        }

        // topologySpreadConstraints
        const tsc = policy.topologyConstraints.filter(c => c.topologyKey);
        if (tsc.length) {
            lines.push('  topologySpreadConstraints:');
            tsc.forEach(c => {
                lines.push(`  - maxSkew: ${c.maxSkew}`);
                lines.push(`    topologyKey: ${c.topologyKey}`);
                lines.push(`    whenUnsatisfiable: ${c.whenUnsatisfiable}`);
                lines.push('    labelSelector:');
                lines.push('      matchLabels:');
                lines.push(`        ${c.labelKey}: "${c.labelValue}"`);
            });
        }

        if (!lines.length) {
            if (bestNode) {
                lines.push('  # AI 추천 노드 직접 지정');
                lines.push(`  nodeName: ${bestNode}`);
            } else {
                lines.push('  # 스케줄링 제약 없음 – 기본 스케줄러 사용');
            }
        }

        return `spec:\n${lines.join('\n')}`;
    }
}
